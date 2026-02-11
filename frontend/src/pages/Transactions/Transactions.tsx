import { useState, useEffect } from 'react';
import {
    History,
    Shield,
    ArrowDownLeft,
    RefreshCw,
    ExternalLink,
    Download,
    Eye,
    EyeOff
} from 'lucide-react';
import { useAppStore } from '../../store';
import { TransactionMonitor } from '../../components/TransactionMonitor';
import { loadKeys, type StealthKeys } from '../../lib/crypto';
import './Transactions.css';

export function Transactions() {
    const [stealthKeys, setStealthKeys] = useState<StealthKeys | null>(null);
    const [showMonitor, setShowMonitor] = useState(true);
    const { isUnlocked, walletAddress } = useAppStore();

    // In this simplified version, we'll try to load keys if they exist in session
    // In a real app, this would be handled by a more robust auth/session layer
    useEffect(() => {
        if (isUnlocked) {
            // Keys are typically handled by the Receive page or a global unlock mechanism
            // For monitoring, we need the viewing and spend private keys
        }
    }, [isUnlocked]);

    return (
        <div className="transactions-page">
            <div className="transactions-container">
                <header className="page-header animate-fade-in">
                    <div className="header-info">
                        <h1>
                            <History className="text-accent" />
                            Private Transactions
                        </h1>
                        <p className="text-secondary">
                            Monitor and manage your stealth payments
                        </p>
                    </div>
                </header>

                <div className="transactions-content animate-slide-up">
                    {!isUnlocked ? (
                        <div className="unlock-prompt glass">
                            <Shield size={48} className="text-accent" />
                            <h2>Wallet Locked</h2>
                            <p className="text-secondary">
                                Please unlock your wallet to scan for private transactions.
                            </p>
                            <a href="/receive" className="btn btn-primary">
                                Unlock Now
                            </a>
                        </div>
                    ) : (
                        <div className="monitor-wrapper">
                            <div className="monitor-controls">
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setShowMonitor(!showMonitor)}
                                >
                                    {showMonitor ? <EyeOff size={16} /> : <Eye size={16} />}
                                    {showMonitor ? 'Hide Scanner' : 'Show Scanner'}
                                </button>
                            </div>

                            {showMonitor && (
                                <TransactionMonitor
                                    stealthKeys={stealthKeys || undefined}
                                    autoScan={true}
                                    scanInterval={30000}
                                />
                            )}

                            {!showMonitor && (
                                <div className="monitor-placeholder glass">
                                    <Shield size={32} className="text-muted" />
                                    <p>Scanner is hidden. Your privacy is paramount.</p>
                                    <button
                                        className="btn btn-secondary mt-4"
                                        onClick={() => setShowMonitor(true)}
                                    >
                                        Re-enable Scanner
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
