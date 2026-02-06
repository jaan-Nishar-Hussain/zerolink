import { useState, useEffect, useCallback } from 'react';
import {
    Activity,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    ExternalLink,
    Download,
    Eye,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { useAppStore } from '../../store';
import { api } from '../../lib/api';
import {
    detectPayments,
    hexToBytes,
    type DetectedPayment,
    type StealthKeys
} from '../../lib/crypto';
import './TransactionMonitor.css';

interface MonitoredTransaction {
    txHash: string;
    stealthAddress: string;
    ephemeralPubKey: string;
    amount: string;
    token: string;
    timestamp: string;
    status: 'scanning' | 'detected' | 'not_ours' | 'pending' | 'confirmed' | 'failed';
    isOurs: boolean;
    stealthPrivateKey?: Uint8Array;
}

interface TransactionMonitorProps {
    stealthKeys?: StealthKeys;
    autoScan?: boolean;
    scanInterval?: number;
}

export function TransactionMonitor({
    stealthKeys,
    autoScan = true,
    scanInterval = 30000
}: TransactionMonitorProps) {
    const [transactions, setTransactions] = useState<MonitoredTransaction[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scanProgress, setScanProgress] = useState({ scanned: 0, total: 0 });

    const { addPayment } = useAppStore();

    const scanForPayments = useCallback(async () => {
        if (!stealthKeys || isScanning) return;

        setIsScanning(true);
        setError(null);

        try {
            // Fetch announcements from backend
            const { announcements, count } = await api.getAnnouncements(undefined, 100);

            setScanProgress({ scanned: 0, total: count });

            // Mark all as scanning initially
            const initialTxs: MonitoredTransaction[] = announcements.map(ann => ({
                txHash: ann.txHash,
                stealthAddress: ann.stealthAddress,
                ephemeralPubKey: ann.ephemeralPubKey,
                amount: ann.amount,
                token: ann.token,
                timestamp: ann.timestamp,
                status: 'scanning' as const,
                isOurs: false,
            }));

            setTransactions(initialTxs);

            // Detect payments belonging to us
            const detected = detectPayments(
                stealthKeys.viewingKeyPair.privateKey,
                stealthKeys.spendKeyPair.privateKey,
                stealthKeys.spendKeyPair.publicKey,
                announcements.map(ann => ({
                    ephemeralPubKey: ann.ephemeralPubKey,
                    stealthAddress: ann.stealthAddress,
                    amount: ann.amount,
                    token: ann.token,
                    txHash: ann.txHash,
                }))
            );

            // Create a set of detected addresses for quick lookup
            const detectedAddresses = new Set(detected.map(d => d.stealthAddress.toLowerCase()));
            const detectedMap = new Map(detected.map(d => [d.stealthAddress.toLowerCase(), d]));

            // Update transactions with detection results
            const updatedTxs: MonitoredTransaction[] = announcements.map(ann => {
                const isOurs = detectedAddresses.has(ann.stealthAddress.toLowerCase());
                const detectedPayment = detectedMap.get(ann.stealthAddress.toLowerCase());

                return {
                    txHash: ann.txHash,
                    stealthAddress: ann.stealthAddress,
                    ephemeralPubKey: ann.ephemeralPubKey,
                    amount: ann.amount,
                    token: ann.token,
                    timestamp: ann.timestamp,
                    status: isOurs ? 'detected' as const : 'not_ours' as const,
                    isOurs,
                    stealthPrivateKey: detectedPayment?.stealthPrivateKey,
                };
            });

            setTransactions(updatedTxs);
            setScanProgress({ scanned: count, total: count });
            setLastScanTime(new Date());

            // Add detected payments to store
            detected.forEach(payment => {
                addPayment({
                    id: payment.txHash,
                    amount: payment.amount,
                    token: payment.token,
                    txHash: payment.txHash,
                    ephemeralPubKey: payment.ephemeralPubKey,
                    timestamp: Date.now(),
                    status: 'confirmed',
                });
            });

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to scan for payments');
        } finally {
            setIsScanning(false);
        }
    }, [stealthKeys, isScanning, addPayment]);

    // Auto-scan effect
    useEffect(() => {
        if (!autoScan || !stealthKeys) return;

        // Initial scan
        scanForPayments();

        // Set up interval
        const interval = setInterval(scanForPayments, scanInterval);

        return () => clearInterval(interval);
    }, [autoScan, scanInterval, stealthKeys]);

    const formatTimeAgo = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    const getStatusIcon = (status: MonitoredTransaction['status']) => {
        switch (status) {
            case 'scanning':
                return <Loader2 size={16} className="icon-spin" />;
            case 'detected':
                return <CheckCircle size={16} className="icon-success" />;
            case 'confirmed':
                return <CheckCircle size={16} className="icon-success" />;
            case 'not_ours':
                return <Eye size={16} className="icon-muted" />;
            case 'pending':
                return <Clock size={16} className="icon-warning" />;
            case 'failed':
                return <XCircle size={16} className="icon-error" />;
            default:
                return <AlertCircle size={16} />;
        }
    };

    const getStatusBadge = (status: MonitoredTransaction['status'], isOurs: boolean) => {
        if (isOurs) {
            return <span className="badge badge-success">Your Payment</span>;
        }

        switch (status) {
            case 'scanning':
                return <span className="badge badge-warning">Scanning...</span>;
            case 'not_ours':
                return <span className="badge">Other</span>;
            case 'pending':
                return <span className="badge badge-warning">Pending</span>;
            default:
                return null;
        }
    };

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 8)}...${address.slice(-6)}`;
    };

    const ourPayments = transactions.filter(tx => tx.isOurs);
    const otherPayments = transactions.filter(tx => !tx.isOurs);

    return (
        <div className="transaction-monitor">
            {/* Header */}
            <div className="monitor-header">
                <div className="monitor-title">
                    <Activity size={20} className="text-accent" />
                    <h3>Transaction Monitor</h3>
                </div>
                <div className="monitor-actions">
                    {lastScanTime && (
                        <span className="last-scan text-muted">
                            Last scan: {formatTimeAgo(lastScanTime.toISOString())}
                        </span>
                    )}
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={scanForPayments}
                        disabled={isScanning || !stealthKeys}
                    >
                        <RefreshCw size={16} className={isScanning ? 'icon-spin' : ''} />
                        {isScanning ? 'Scanning...' : 'Scan'}
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="monitor-error">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* No Keys State */}
            {!stealthKeys && (
                <div className="monitor-empty">
                    <Eye size={40} className="text-muted" />
                    <p>Unlock your wallet to scan for payments</p>
                </div>
            )}

            {/* Scanning Progress */}
            {isScanning && scanProgress.total > 0 && (
                <div className="scan-progress">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${(scanProgress.scanned / scanProgress.total) * 100}%` }}
                        />
                    </div>
                    <span className="progress-text text-muted">
                        Scanning {scanProgress.scanned} / {scanProgress.total} announcements
                    </span>
                </div>
            )}

            {/* Your Payments Section */}
            {ourPayments.length > 0 && (
                <div className="payment-section">
                    <h4 className="section-label">
                        <CheckCircle size={14} className="icon-success" />
                        Your Payments ({ourPayments.length})
                    </h4>
                    <div className="payment-list">
                        {ourPayments.map(tx => (
                            <div key={tx.txHash} className="payment-row glass detected">
                                <div className="payment-icon">
                                    {getStatusIcon(tx.status)}
                                </div>
                                <div className="payment-info">
                                    <div className="payment-amount">
                                        +{formatAmount(tx.amount)} {getTokenSymbol(tx.token)}
                                    </div>
                                    <div className="payment-address mono text-muted">
                                        {truncateAddress(tx.stealthAddress)}
                                    </div>
                                </div>
                                <div className="payment-time text-muted">
                                    {formatTimeAgo(tx.timestamp)}
                                </div>
                                <div className="payment-actions">
                                    <button className="btn btn-primary btn-sm">
                                        <Download size={14} />
                                        Withdraw
                                    </button>
                                    <a
                                        href={`https://starkscan.co/tx/${tx.txHash}`}
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

            {/* Other Announcements Section (collapsed by default) */}
            {otherPayments.length > 0 && (
                <details className="payment-section other-section">
                    <summary className="section-label">
                        <Eye size={14} className="text-muted" />
                        Other Announcements ({otherPayments.length})
                    </summary>
                    <div className="payment-list">
                        {otherPayments.slice(0, 10).map(tx => (
                            <div key={tx.txHash} className="payment-row glass">
                                <div className="payment-icon">
                                    {getStatusIcon(tx.status)}
                                </div>
                                <div className="payment-info">
                                    <div className="payment-amount text-secondary">
                                        {formatAmount(tx.amount)} {getTokenSymbol(tx.token)}
                                    </div>
                                    <div className="payment-address mono text-muted">
                                        {truncateAddress(tx.stealthAddress)}
                                    </div>
                                </div>
                                <div className="payment-time text-muted">
                                    {formatTimeAgo(tx.timestamp)}
                                </div>
                                <div className="payment-badge">
                                    {getStatusBadge(tx.status, tx.isOurs)}
                                </div>
                            </div>
                        ))}
                        {otherPayments.length > 10 && (
                            <div className="more-indicator text-muted">
                                +{otherPayments.length - 10} more announcements
                            </div>
                        )}
                    </div>
                </details>
            )}

            {/* Empty State */}
            {stealthKeys && !isScanning && transactions.length === 0 && (
                <div className="monitor-empty">
                    <Activity size={40} className="text-muted" />
                    <p>No announcements found</p>
                    <button className="btn btn-secondary" onClick={scanForPayments}>
                        Scan for Payments
                    </button>
                </div>
            )}
        </div>
    );
}

// Helpers
function formatAmount(amount: string): string {
    const num = parseFloat(amount) / 1e18; // Assuming 18 decimals
    if (num < 0.001) return '<0.001';
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getTokenSymbol(tokenAddress: string): string {
    const tokens: Record<string, string> = {
        '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d': 'STRK',
        '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7': 'ETH',
    };
    return tokens[tokenAddress.toLowerCase()] || 'TOKEN';
}

export default TransactionMonitor;
