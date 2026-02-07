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
    Download,
    Send,
    History,
    Link as LinkIcon,
    QrCode,
    Edit3,
    LayoutGrid,
    DollarSign
} from 'lucide-react';
import { useAppStore } from '../../store';
import { TransactionMonitor } from '../../components/TransactionMonitor';
import { loadKeys, type StealthKeys } from '../../lib/crypto';
import { withdrawFromStealth } from '../../lib/crypto/withdraw';
import './Dashboard.css';

export function Dashboard() {
    const [showBalance, setShowBalance] = useState(true);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
    const [stealthKeys, setStealthKeys] = useState<StealthKeys | null>(null);
    const [activeTab, setActiveTab] = useState<'username' | 'address'>('username');
    const [activeNav, setActiveNav] = useState<'dashboard' | 'links' | 'transactions'>('dashboard');
    const { alias, payments, totalReceived, isUnlocked, walletAddress, updatePaymentStatus } = useAppStore();

    // Load stealth keys when unlocked
    useEffect(() => {
        if (isUnlocked) {
            // Note: In production, we'd need the password from session
        }
    }, [isUnlocked]);

    const totalBalance = parseFloat(totalReceived).toFixed(6);
    const paymentLink = `${alias}.zerolink.pay`;

    const copyLink = () => {
        const link = `${window.location.origin}/pay/${alias}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        if (diff < 60000) return 'Just now';
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        return `${Math.floor(diff / 60000)}m ago`;
    };

    const handleWithdraw = async (payment: any) => {
        if (!stealthKeys) {
            setError('Please unlock your wallet first');
            return;
        }

        if (!walletAddress) {
            setError('Please connect your Starknet wallet');
            return;
        }

        setWithdrawingId(payment.id);
        setError(null);

        try {
            const result = await withdrawFromStealth({
                stealthAddress: payment.stealthAddress,
                ephemeralPubKey: payment.ephemeralPubKey,
                viewingPrivateKey: stealthKeys.viewingKeyPair.privateKey,
                spendPrivateKey: stealthKeys.spendKeyPair.privateKey,
                recipientAddress: walletAddress,
                amount: payment.amount,
                tokenAddress: payment.tokenAddress,
            });

            if (result.status === 'pending') {
                updatePaymentStatus(payment.id, 'withdrawn');
                alert('Withdrawal transaction submitted! It will appear in your wallet shortly.');
            }
        } catch (err: any) {
            console.error('Withdrawal error:', err);
            setError(err.message || 'Withdrawal failed');
        } finally {
            setWithdrawingId(null);
        }
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
                    <div className="unlock-prompt">
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
                {/* Receive Card Section */}
                <div className="receive-card-section animate-fade-in">
                    <div className="receive-card-header">
                        <h3>Receive</h3>
                        <div className="receive-tabs">
                            <button
                                className={`receive-tab ${activeTab === 'username' ? 'active' : ''}`}
                                onClick={() => setActiveTab('username')}
                            >
                                Username
                            </button>
                            <button
                                className={`receive-tab ${activeTab === 'address' ? 'active' : ''}`}
                                onClick={() => setActiveTab('address')}
                            >
                                Address
                            </button>
                        </div>
                    </div>
                    <div className="receive-link-box">
                        <span className="receive-link-text">{paymentLink}</span>
                        <div className="receive-link-actions">
                            <button className="icon-btn">
                                <Edit3 size={18} />
                            </button>
                            <button className="icon-btn">
                                <QrCode size={18} />
                            </button>
                            <button className="icon-btn" onClick={copyLink}>
                                {copied ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Balance Card */}
                <div className="balance-card animate-slide-up">
                    <div className="balance-header">
                        <div className="balance-label">Available Balance</div>
                        <div className="balance-sublabel">Held in treasury wallet</div>
                    </div>
                    <div className="balance-amount">
                        {showBalance ? totalBalance : '••••••'} <span>ETH</span>
                    </div>

                    {/* Portfolio Section */}
                    <div className="portfolio-section">
                        <div className="portfolio-header">
                            <div>
                                <div className="portfolio-title">Portfolio Balance</div>
                                <div className="portfolio-subtitle">Last 7 days trend</div>
                            </div>
                            <button
                                className="icon-btn"
                                onClick={() => setShowBalance(!showBalance)}
                            >
                                {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        <div className="portfolio-chart">
                            {/* Simple chart bars */}
                            {[40, 60, 30, 70, 50, 80, 45].map((height, i) => (
                                <div
                                    key={i}
                                    className="chart-bar"
                                    style={{ height: `${height}%` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="action-buttons animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <a href="/pay" className="action-btn action-btn-primary">
                        <Send size={18} style={{ marginRight: '8px' }} />
                        Send Payment
                    </a>
                    <div className="action-btn-row">
                        <button className="action-btn action-btn-secondary">
                            <Download size={18} style={{ marginRight: '8px' }} />
                            Withdraw
                        </button>
                        <button className="action-btn action-btn-secondary">
                            <History size={18} style={{ marginRight: '8px' }} />
                            History
                        </button>
                    </div>
                </div>

                {/* Payment Links Section */}
                <div className="payment-links-section animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    <div className="section-header">
                        <h2>Payment Links</h2>
                        <button className="see-more-btn">See More</button>
                    </div>
                    <div className="payment-link-card">
                        <div className="payment-link-url">{paymentLink}</div>
                        <div className="payment-link-logo">
                            <Shield size={40} />
                        </div>
                        <div className="payment-link-brand">ZEROLINK</div>
                    </div>
                </div>

                {/* Recent Payments */}
                {payments.length > 0 && (
                    <div className="transactions-section animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <div className="section-header">
                            <h2>Recent Payments</h2>
                        </div>
                        <div className="transactions-list">
                            {payments.map((payment) => (
                                <div key={payment.id} className="transaction-card">
                                    <div className="tx-icon received">
                                        <ArrowDownLeft size={20} />
                                    </div>
                                    <div className="tx-details">
                                        <div className="tx-amount">
                                            +{payment.amount} {payment.token}
                                        </div>
                                        <div className="tx-meta">
                                            <Clock size={12} />
                                            {formatTime(payment.timestamp)}
                                        </div>
                                    </div>
                                    <div className="tx-status">
                                        {getStatusBadge(payment.status)}
                                    </div>
                                    <div className="tx-actions">
                                        {payment.status === 'confirmed' && (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleWithdraw(payment)}
                                                disabled={withdrawingId === payment.id}
                                            >
                                                {withdrawingId === payment.id ? (
                                                    <RefreshCw size={14} className="spinner" />
                                                ) : (
                                                    <Download size={14} />
                                                )}
                                                {withdrawingId === payment.id ? 'Withdrawing...' : 'Withdraw'}
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
                    </div>
                )}

                {payments.length === 0 && (
                    <div className="empty-state animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <ArrowDownLeft size={48} className="text-muted" />
                        <h3>No payments yet</h3>
                        <p className="text-muted">
                            Share your payment link to start receiving private payments
                        </p>
                    </div>
                )}

                {/* Transaction Monitor */}
                <div className="monitor-section">
                    <TransactionMonitor
                        stealthKeys={stealthKeys || undefined}
                        autoScan={true}
                        scanInterval={30000}
                    />
                </div>
            </div>

            {/* Bottom Navigation */}
            <nav className="bottom-nav">
                <button
                    className={`bottom-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveNav('dashboard')}
                >
                    <LayoutGrid size={18} />
                    Dashboard
                </button>
                <button
                    className={`bottom-nav-item ${activeNav === 'links' ? 'active' : ''}`}
                    onClick={() => setActiveNav('links')}
                >
                    <LinkIcon size={18} />
                    Payment Links
                </button>
                <button
                    className={`bottom-nav-item ${activeNav === 'transactions' ? 'active' : ''}`}
                    onClick={() => setActiveNav('transactions')}
                >
                    <DollarSign size={18} />
                    Transactions
                </button>
            </nav>
        </div>
    );
}
