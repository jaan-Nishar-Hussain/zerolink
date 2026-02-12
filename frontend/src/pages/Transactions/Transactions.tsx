import { useState, useEffect, useCallback, useRef } from 'react';
import {
    History,
    ArrowUpRight,
    ArrowDownLeft,
    Clock,
    ExternalLink,
    Shield,
    Search,
    Filter,
    RefreshCw,
    Loader2,
    Lock
} from 'lucide-react';
import { useAppStore } from '../../store';
import { api } from '../../lib/api';
import type { StealthAnnouncement } from '../../lib/api/client';
import { checkStealthPayment, hexToBytes } from '../../lib/crypto/stealth';
import { loadKeys } from '../../lib/crypto/storage';
import './Transactions.css';

type FilterType = 'all' | 'sent' | 'received';

interface DisplayTransaction {
    id: string;
    type: 'sent' | 'received' | 'unknown';
    amount: string;
    token: string;
    txHash: string;
    stealthAddress: string;
    recipient?: string;
    timestamp: number;
    status: string;
}

// Token address mapping for display
const TOKEN_MAP: Record<string, string> = {
    '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7': 'ETH',
    '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d': 'STRK',
};

function getTokenSymbol(address: string): string {
    return TOKEN_MAP[address.toLowerCase()] || TOKEN_MAP[address] || address.slice(0, 8);
}

function formatAmount(amount: string, token: string): string {
    // If amount looks like wei (very large number), convert
    const num = parseFloat(amount);
    if (num > 1e15) {
        return (num / 1e18).toFixed(4);
    }
    return amount;
}

export function Transactions() {
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [backendTxs, setBackendTxs] = useState<DisplayTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [keysAvailable, setKeysAvailable] = useState(true);
    const [passwordPrompt, setPasswordPrompt] = useState(false);
    const [password, setPassword] = useState('');
    const passwordRef = useRef('');
    const { payments, walletAddress, isUnlocked } = useAppStore();

    // Fetch announcements from backend and detect received payments
    const fetchTransactions = useCallback(async (pwd?: string) => {
        setLoading(true);
        setError('');
        try {
            // Try to load user's stealth keys for detection
            let stealthKeys = null;
            const unlockPassword = pwd || passwordRef.current;
            if (unlockPassword) {
                try {
                    stealthKeys = await loadKeys(unlockPassword);
                    if (stealthKeys) {
                        setKeysAvailable(true);
                        setPasswordPrompt(false);
                        passwordRef.current = unlockPassword;
                        console.log('[Transactions] Stealth keys loaded successfully');
                    } else {
                        console.warn('[Transactions] loadKeys returned null - wrong password?');
                    }
                } catch (e) {
                    console.warn('[Transactions] Could not load stealth keys:', e);
                }
            }

            const result = await api.scanAnnouncements(undefined, 500);
            console.log(`[Transactions] Scan returned ${result.announcements.length} announcements`);
            const txs: DisplayTransaction[] = [];

            for (const a of result.announcements) {
                // Check if this tx is in the local store (means we sent it)
                const storePayment = payments.find(p => p.txHash === a.txHash);

                if (storePayment) {
                    // We sent this transaction
                    txs.push({
                        id: a.id || a.txHash,
                        type: 'sent',
                        amount: formatAmount(a.amount, a.token),
                        token: getTokenSymbol(a.token),
                        txHash: a.txHash,
                        stealthAddress: a.stealthAddress,
                        recipient: storePayment.recipient,
                        timestamp: new Date(a.timestamp).getTime(),
                        status: 'confirmed',
                    });
                    continue;
                }

                // If we have stealth keys, check if this payment is for us
                if (stealthKeys && a.ephemeralPubKey) {
                    try {
                        const detected = checkStealthPayment(
                            stealthKeys.viewingKeyPair.privateKey,
                            stealthKeys.spendKeyPair.privateKey,
                            stealthKeys.spendKeyPair.publicKey,
                            a.ephemeralPubKey,
                            a.stealthAddress
                        );

                        if (detected) {
                            console.log(`[Transactions] Detected received payment: ${a.txHash}`);
                            txs.push({
                                id: a.id || a.txHash,
                                type: 'received',
                                amount: formatAmount(a.amount, a.token),
                                token: getTokenSymbol(a.token),
                                txHash: a.txHash,
                                stealthAddress: a.stealthAddress,
                                timestamp: new Date(a.timestamp).getTime(),
                                status: 'confirmed',
                            });
                        }
                    } catch (e) {
                        console.warn('[Transactions] Error checking stealth payment:', e);
                    }
                }
            }

            console.log(`[Transactions] Final result: ${txs.length} relevant txs (${txs.filter(t => t.type === 'sent').length} sent, ${txs.filter(t => t.type === 'received').length} received)`);

            // If no stealth keys and no store payments, prompt for password
            if (!stealthKeys && txs.length === 0) {
                setKeysAvailable(false);
            }

            setBackendTxs(txs);
        } catch (err: any) {
            console.error('[Transactions] Failed to fetch transactions:', err);
            setError('Could not load transactions from server');
        } finally {
            setLoading(false);
        }
    }, [payments]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    // Re-announce store-only payments that may have failed to POST to the backend
    useEffect(() => {
        if (payments.length === 0) return;

        const reAnnounce = async () => {
            try {
                const result = await api.scanAnnouncements(undefined, 500);
                const backendHashes = new Set(result.announcements.map((a: any) => a.txHash));

                for (const p of payments) {
                    if (p.type === 'sent' && !backendHashes.has(p.txHash) && p.ephemeralPubKey && p.stealthAddress) {
                        console.log(`[Transactions] Re-announcing missing payment: ${p.txHash}`);
                        try {
                            await api.announcePayment({
                                txHash: p.txHash,
                                stealthAddress: p.stealthAddress,
                                ephemeralPubKey: p.ephemeralPubKey,
                                amount: (BigInt(Math.floor(parseFloat(p.amount) * 1e18))).toString(),
                                token: p.tokenAddress || p.token,
                                timestamp: new Date(p.timestamp).toISOString(),
                            });
                            console.log(`[Transactions] Re-announced successfully: ${p.txHash}`);
                        } catch (e) {
                            console.warn(`[Transactions] Failed to re-announce ${p.txHash}:`, e);
                        }
                    }
                }
            } catch (e) {
                console.warn('[Transactions] Re-announce check failed:', e);
            }
        };

        reAnnounce();
    }, [payments]);

    // Merge: backend txs + any store-only txs (not yet in backend)
    const allTransactions = (() => {
        const backendHashes = new Set(backendTxs.map(t => t.txHash));
        const storeOnly = payments
            .filter(p => !backendHashes.has(p.txHash))
            .map(p => ({
                id: p.id,
                type: p.type || ('sent' as const),
                amount: p.amount,
                token: p.token,
                txHash: p.txHash,
                stealthAddress: p.stealthAddress,
                recipient: p.recipient,
                timestamp: p.timestamp,
                status: p.status,
            }));
        return [...storeOnly, ...backendTxs].sort((a, b) => b.timestamp - a.timestamp);
    })();

    const filteredPayments = allTransactions
        .filter(p => {
            if (filter === 'all') return true;
            return p.type === filter;
        })
        .filter(p => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                p.txHash.toLowerCase().includes(q) ||
                p.token.toLowerCase().includes(q) ||
                p.stealthAddress.toLowerCase().includes(q) ||
                (p.recipient && p.recipient.toLowerCase().includes(q))
            );
        });

    const formatTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        if (diff < 60000) return 'Just now';
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        return `${minutes}m ago`;
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const truncateHash = (hash: string) => {
        return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'confirmed':
                return <span className="tx-badge tx-badge-success">Confirmed</span>;
            case 'pending':
                return <span className="tx-badge tx-badge-warning">Pending</span>;
            case 'withdrawn':
                return <span className="tx-badge tx-badge-info">Withdrawn</span>;
            default:
                return <span className="tx-badge tx-badge-success">Confirmed</span>;
        }
    };

    const sentCount = allTransactions.filter(p => p.type === 'sent').length;
    const receivedCount = allTransactions.filter(p => p.type === 'received').length;

    return (
        <div className="transactions-page">
            <div className="transactions-container">
                {/* Page Header */}
                <header className="page-header animate-fade-in">
                    <div className="header-info">
                        <h1>
                            <History className="text-accent" />
                            Transactions
                        </h1>
                        <p className="text-secondary">
                            Your private payment history
                        </p>
                    </div>
                    <button
                        className="btn btn-ghost"
                        onClick={() => fetchTransactions()}
                        disabled={loading}
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={loading ? 'icon-spin' : ''} />
                    </button>
                </header>

                {/* Stats Cards */}
                <div className="tx-stats animate-slide-up">
                    <div className="tx-stat-card glass">
                        <div className="tx-stat-icon sent-icon">
                            <ArrowUpRight size={20} />
                        </div>
                        <div className="tx-stat-info">
                            <div className="tx-stat-value">{sentCount}</div>
                            <div className="tx-stat-label">Sent</div>
                        </div>
                    </div>
                    <div className="tx-stat-card glass">
                        <div className="tx-stat-icon received-icon">
                            <ArrowDownLeft size={20} />
                        </div>
                        <div className="tx-stat-info">
                            <div className="tx-stat-value">{receivedCount}</div>
                            <div className="tx-stat-label">Received</div>
                        </div>
                    </div>
                    <div className="tx-stat-card glass">
                        <div className="tx-stat-icon total-icon">
                            <Shield size={20} />
                        </div>
                        <div className="tx-stat-info">
                            <div className="tx-stat-value">{allTransactions.length}</div>
                            <div className="tx-stat-label">Total</div>
                        </div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="tx-toolbar animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="tx-filters">
                        <button
                            className={`tx-filter-btn ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All
                        </button>
                        <button
                            className={`tx-filter-btn ${filter === 'sent' ? 'active' : ''}`}
                            onClick={() => setFilter('sent')}
                        >
                            <ArrowUpRight size={14} /> Sent
                        </button>
                        <button
                            className={`tx-filter-btn ${filter === 'received' ? 'active' : ''}`}
                            onClick={() => setFilter('received')}
                        >
                            <ArrowDownLeft size={14} /> Received
                        </button>
                    </div>
                    <div className="tx-search">
                        <Search size={16} className="tx-search-icon" />
                        <input
                            type="text"
                            placeholder="Search tx hash, token..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="tx-search-input"
                        />
                    </div>
                </div>

                {/* Loading state */}
                {loading && allTransactions.length === 0 && (
                    <div className="tx-loading glass">
                        <Loader2 size={32} className="icon-spin text-accent" />
                        <p>Loading transactions...</p>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="tx-error">
                        <p>{error}</p>
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchTransactions()}>
                            Retry
                        </button>
                    </div>
                )}

                {/* Transaction List */}
                {!loading && (
                    <div className="tx-list animate-slide-up" style={{ animationDelay: '0.15s' }}>
                        {filteredPayments.length === 0 ? (
                            <div className="tx-empty glass">
                                {allTransactions.length === 0 ? (
                                    <>
                                        {!keysAvailable ? (
                                            <>
                                                <Lock size={48} className="text-muted" />
                                                <h3>Unlock to see received payments</h3>
                                                <p className="text-secondary">
                                                    Enter your password to scan for payments sent to you.
                                                </p>
                                                <div className="tx-unlock-form">
                                                    <input
                                                        type="password"
                                                        placeholder="Enter password"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="tx-password-input"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && password) {
                                                                fetchTransactions(password);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => fetchTransactions(password)}
                                                        disabled={!password || loading}
                                                    >
                                                        {loading ? <Loader2 size={16} className="icon-spin" /> : 'Unlock & Scan'}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Shield size={48} className="text-muted" />
                                                <h3>No transactions yet</h3>
                                                <p className="text-secondary">
                                                    Send or receive a private payment to see it here.
                                                </p>
                                                <div className="tx-empty-actions">
                                                    <a href="/pay" className="btn btn-primary">
                                                        <ArrowUpRight size={16} /> Send Payment
                                                    </a>
                                                    <a href="/receive" className="btn btn-secondary">
                                                        <ArrowDownLeft size={16} /> Receive
                                                    </a>
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Filter size={48} className="text-muted" />
                                        <h3>No matching transactions</h3>
                                        <p className="text-secondary">
                                            Try adjusting your filter or search query.
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            filteredPayments.map((payment) => (
                                <div
                                    key={payment.id}
                                    className={`tx-row glass ${payment.type === 'received' ? 'tx-row-received' : 'tx-row-sent'}`}
                                >
                                    {/* Direction Icon */}
                                    <div className={`tx-direction-icon ${payment.type}`}>
                                        {payment.type === 'sent' ? (
                                            <ArrowUpRight size={20} />
                                        ) : payment.type === 'received' ? (
                                            <ArrowDownLeft size={20} />
                                        ) : (
                                            <ArrowUpRight size={20} />
                                        )}
                                    </div>

                                    {/* Main Info */}
                                    <div className="tx-main-info">
                                        <div className="tx-title">
                                            {payment.type === 'sent' ? (
                                                <>Sent <span className="tx-highlight">{payment.amount} {payment.token}</span> to <span className="tx-highlight mono">{payment.recipient ? `@${payment.recipient}` : truncateHash(payment.stealthAddress)}</span></>
                                            ) : payment.type === 'received' ? (
                                                <>Received <span className="tx-highlight">{payment.amount} {payment.token}</span> via <span className="tx-highlight mono">{truncateHash(payment.stealthAddress)}</span></>
                                            ) : (
                                                <>Stealth Payment to <span className="tx-highlight mono">{truncateHash(payment.stealthAddress)}</span></>
                                            )}
                                        </div>
                                        <div className="tx-subtitle text-muted">
                                            <Clock size={12} />
                                            <span title={formatDate(payment.timestamp)}>{formatTime(payment.timestamp)}</span>
                                            <span className="tx-dot">·</span>
                                            <span className="mono">{truncateHash(payment.txHash)}</span>
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <div className={`tx-amount ${payment.type}`}>
                                        {payment.type === 'received' ? '+' : '-'}{payment.amount} {payment.token}
                                    </div>

                                    {/* Status + Actions */}
                                    <div className="tx-end">
                                        {getStatusBadge(payment.status)}
                                        <a
                                            href={`https://sepolia.starkscan.co/tx/${payment.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-ghost btn-sm"
                                            title="View on Explorer"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
