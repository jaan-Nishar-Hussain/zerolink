import { useState, useEffect } from 'react';
import {
    Shield,
    Wallet,
    ArrowDownLeft,
    Clock,
    Copy,
    Check,
    ExternalLink,
    RefreshCw,
    Eye,
    EyeOff,
    Download
} from 'lucide-react';
import { useAppStore } from '../../store';
import { TransactionMonitor } from '../../components/TransactionMonitor';
import { loadKeys, type StealthKeys } from '../../lib/crypto';
import './Dashboard.css';

export function Dashboard() {
    const [showBalance, setShowBalance] = useState(true);
    const [copied, setCopied] = useState(false);
    const [stealthKeys, setStealthKeys] = useState<StealthKeys | null>(null);
    const { alias, payments, isUnlocked } = useAppStore();

    // Load stealth keys when unlocked
    useEffect(() => {
        if (isUnlocked) {
            // Note: In production, we'd need the password from session
            // For now, this is a placeholder for the keys loading logic
            // stealthKeys would be passed from the unlock flow
        }
    }, [isUnlocked]);

    // Mock data for demo
    const mockPayments = payments.length > 0 ? payments : [
        {
            id: '1',
            amount: '0.5',
            token: 'ETH',
            txHash: '0x7a3f8c2d9e1b4f7a2c4d1e9f8b3a6c5d7e2f9a1b',
            ephemeralPubKey: '0x02...',
            timestamp: Date.now() - 3600000,
            status: 'confirmed' as const,
        },
        {
            id: '2',
            amount: '100',
            token: 'USDC',
            txHash: '0x9e1b4f7a2c4d1e9f8b3a6c5d7e2f9a1b3c4d5e6f',
            ephemeralPubKey: '0x03...',
            timestamp: Date.now() - 86400000,
            status: 'confirmed' as const,
        },
        {
            id: '3',
            amount: '0.1',
            token: 'ETH',
            txHash: '0x2c4d1e9f8b3a6c5d7e2f9a1b3c4d5e6f7a8b9c0d',
            ephemeralPubKey: '0x02...',
            timestamp: Date.now() - 172800000,
            status: 'withdrawn' as const,
        },
    ];

    const totalBalance = showBalance ? '0.60 ETH' : '••••••';
    const usdValue = showBalance ? '~$1,234.56' : '••••••';

    const copyLink = () => {
        const link = `${window.location.origin}/pay/${alias}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        return 'Just now';
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'confirmed':
                return <span className="badge badge-success">Confirmed</span>;
            case 'pending':
                return <span className="badge badge-warning">Pending</span>;
            case 'withdrawn':
                return <span className="badge">Withdrawn</span>;
            default:
                return null;
        }
    };

    if (!isUnlocked) {
        return (
            <div className="dashboard-page">
                <div className="dashboard-container">
                    <div className="unlock-prompt glass">
                        <Shield size={48} className="text-accent" />
                        <h2>Unlock Your Dashboard</h2>
                        <p className="text-secondary">
                            Please unlock your wallet to view your dashboard
                        </p>
                        <a href="/receive" className="btn btn-primary">
                            Unlock Wallet
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            <div className="dashboard-container">
                {/* Header */}
                <div className="dashboard-header animate-fade-in">
                    <div>
                        <h1>Dashboard</h1>
                        <p className="text-secondary">Manage your private payments</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-ghost">
                            <RefreshCw size={18} />
                            Rescan
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card glass animate-slide-up">
                        <div className="stat-header">
                            <div className="stat-icon">
                                <Wallet size={20} />
                            </div>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowBalance(!showBalance)}
                            >
                                {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <div className="stat-value">{totalBalance}</div>
                        <div className="stat-label text-muted">{usdValue}</div>
                    </div>

                    <div className="stat-card glass animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div className="stat-header">
                            <div className="stat-icon">
                                <ArrowDownLeft size={20} />
                            </div>
                        </div>
                        <div className="stat-value">{mockPayments.length}</div>
                        <div className="stat-label text-muted">Payments Received</div>
                    </div>

                    <div className="stat-card glass animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <div className="stat-header">
                            <div className="stat-icon">
                                <Shield size={20} />
                            </div>
                        </div>
                        <div className="stat-value">{mockPayments.length}</div>
                        <div className="stat-label text-muted">Stealth Addresses</div>
                    </div>
                </div>

                {/* Payment Link Card */}
                <div className="link-card glass animate-slide-up" style={{ animationDelay: '0.3s' }}>
                    <div className="link-card-header">
                        <div>
                            <h3>Your Payment Link</h3>
                            <p className="text-muted">Share this link to receive private payments</p>
                        </div>
                    </div>
                    <div className="link-box">
                        <span className="link-text mono">
                            {window.location.origin}/pay/{alias}
                        </span>
                        <button
                            className="btn btn-secondary"
                            onClick={copyLink}
                        >
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>

                {/* Transactions */}
                <div className="transactions-section animate-slide-up" style={{ animationDelay: '0.4s' }}>
                    <div className="section-header">
                        <h2>Recent Payments</h2>
                    </div>

                    <div className="transactions-list">
                        {mockPayments.map((payment) => (
                            <div key={payment.id} className="transaction-card glass">
                                <div className="tx-icon received">
                                    <ArrowDownLeft size={20} />
                                </div>
                                <div className="tx-details">
                                    <div className="tx-amount">
                                        +{payment.amount} {payment.token}
                                    </div>
                                    <div className="tx-meta text-muted">
                                        <Clock size={12} />
                                        {formatTime(payment.timestamp)}
                                    </div>
                                </div>
                                <div className="tx-status">
                                    {getStatusBadge(payment.status)}
                                </div>
                                <div className="tx-actions">
                                    {payment.status === 'confirmed' && (
                                        <button className="btn btn-secondary btn-sm">
                                            <Download size={14} />
                                            Withdraw
                                        </button>
                                    )}
                                    <a
                                        href={`https://starkscan.co/tx/${payment.txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-ghost btn-sm"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>

                    {mockPayments.length === 0 && (
                        <div className="empty-state">
                            <ArrowDownLeft size={48} className="text-muted" />
                            <h3>No payments yet</h3>
                            <p className="text-muted">
                                Share your payment link to start receiving private payments
                            </p>
                        </div>
                    )}
                </div>

                {/* Transaction Monitor */}
                <div className="monitor-section animate-slide-up" style={{ animationDelay: '0.5s' }}>
                    <TransactionMonitor
                        stealthKeys={stealthKeys || undefined}
                        autoScan={true}
                        scanInterval={30000}
                    />
                </div>
            </div>
        </div>
    );
}
