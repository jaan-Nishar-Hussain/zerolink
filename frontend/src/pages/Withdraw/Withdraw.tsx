import { useState, useEffect, useCallback } from 'react';
import {
    Download,
    ArrowDownLeft,
    Loader2,
    CheckCircle,
    XCircle,
    RefreshCw,
    ExternalLink,
    Shield,
    Wallet,
    AlertCircle,
    ArrowUpRight
} from 'lucide-react';
import { useAccount, useConnect } from '@starknet-react/core';
import { useAppStore } from '../../store';
import { api } from '../../lib/api';
import {
    detectPayments,
    withdrawFromStealth,
    getStealthBalances,
    type StealthKeys,
} from '../../lib/crypto';
import { loadKeys } from '../../lib/crypto/storage';
import './Withdraw.css';

interface WithdrawablePayment {
    stealthAddress: string;
    ephemeralPubKey: string;
    amount: string;
    token: string;
    txHash: string;
    stealthPrivateKey: Uint8Array;
    balanceStrk: string;
    balanceEth: string;
    withdrawStatus: 'idle' | 'withdrawing' | 'success' | 'failed';
    withdrawTxHash?: string;
    withdrawError?: string;
}

export function Withdraw() {
    const [stealthKeys, setStealthKeys] = useState<StealthKeys | null>(null);
    const [payments, setPayments] = useState<WithdrawablePayment[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isLoadingKeys, setIsLoadingKeys] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [withdrawAllStatus, setWithdrawAllStatus] = useState<'idle' | 'running' | 'done'>('idle');
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [keysLoaded, setKeysLoaded] = useState(false);

    const { isUnlocked, updatePaymentStatus } = useAppStore();
    const { address: walletAddress, account } = useAccount();
    const { connect, connectors } = useConnect();

    // Unlock keys with password
    const handleUnlockKeys = async () => {
        if (!password.trim()) return;
        setIsLoadingKeys(true);
        setPasswordError(null);
        try {
            const keys = await loadKeys(password);
            if (keys) {
                setStealthKeys(keys);
                setKeysLoaded(true);
            } else {
                setPasswordError('Wrong password or no keys found');
            }
        } catch (err) {
            setPasswordError('Failed to decrypt keys');
        } finally {
            setIsLoadingKeys(false);
        }
    };

    // Scan for payments belonging to us
    const scanPayments = useCallback(async () => {
        if (!stealthKeys || isScanning) return;

        setIsScanning(true);
        setError(null);

        try {
            const { announcements } = await api.getAnnouncements(undefined, 500);

            // Detect which payments are ours
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

            if (detected.length === 0) {
                setPayments([]);
                return;
            }

            // Fetch balances for each detected stealth address
            const paymentsWithBalances: WithdrawablePayment[] = await Promise.all(
                detected.map(async (d) => {
                    let balanceStrk = '0';
                    let balanceEth = '0';
                    try {
                        const balances = await getStealthBalances(d.stealthAddress);
                        balanceStrk = balances.strk;
                        balanceEth = balances.eth;
                    } catch {
                        // Balance fetch failed — fall back to announced amount
                    }

                    // If on-chain balance is 0 but we have an announced amount,
                    // use that as the display balance so the user can attempt withdrawal
                    if (balanceStrk === '0' && balanceEth === '0' && d.amount && d.amount !== '0') {
                        const isEthToken = d.token === '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
                            || d.token === '0x0'
                            || d.token === '0x0000000000000000000000000000000000000000000000000000000000000000';
                        if (isEthToken) {
                            balanceEth = d.amount;
                        } else {
                            balanceStrk = d.amount;
                        }
                    }

                    return {
                        stealthAddress: d.stealthAddress,
                        ephemeralPubKey: d.ephemeralPubKey,
                        amount: d.amount,
                        token: d.token,
                        txHash: d.txHash,
                        stealthPrivateKey: d.stealthPrivateKey,
                        balanceStrk,
                        balanceEth,
                        withdrawStatus: 'idle' as const,
                    };
                })
            );

            setPayments(paymentsWithBalances);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to scan for payments');
        } finally {
            setIsScanning(false);
        }
    }, [stealthKeys, isScanning]);

    // Auto-scan on key load
    useEffect(() => {
        if (stealthKeys && !isLoadingKeys) {
            scanPayments();
        }
    }, [stealthKeys, isLoadingKeys]);

    // Withdraw from a single stealth address
    const handleWithdraw = async (index: number) => {
        if (!stealthKeys || !walletAddress || !account) return;

        const payment = payments[index];
        setPayments(prev => prev.map((p, i) =>
            i === index ? { ...p, withdrawStatus: 'withdrawing' as const } : p
        ));

        try {
            const result = await withdrawFromStealth({
                stealthAddress: payment.stealthAddress,
                ephemeralPubKey: payment.ephemeralPubKey,
                viewingPrivateKey: stealthKeys.viewingKeyPair.privateKey,
                spendPrivateKey: stealthKeys.spendKeyPair.privateKey,
                recipientAddress: walletAddress,
                amount: payment.balanceStrk !== '0' ? payment.balanceStrk : (payment.balanceEth !== '0' ? payment.balanceEth : payment.amount),
                tokenAddress: payment.balanceStrk !== '0'
                    ? '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
                    : '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            }, account);

            setPayments(prev => prev.map((p, i) =>
                i === index ? {
                    ...p,
                    withdrawStatus: 'success' as const,
                    withdrawTxHash: result.transactionHash
                } : p
            ));

            // Update store
            updatePaymentStatus(payment.txHash, 'withdrawn');
        } catch (err) {
            setPayments(prev => prev.map((p, i) =>
                i === index ? {
                    ...p,
                    withdrawStatus: 'failed' as const,
                    withdrawError: err instanceof Error ? err.message : 'Withdrawal failed'
                } : p
            ));
        }
    };

    // Withdraw all payments
    const handleWithdrawAll = async () => {
        if (!stealthKeys || !walletAddress || !account) return;
        setWithdrawAllStatus('running');

        for (let i = 0; i < payments.length; i++) {
            if (payments[i].withdrawStatus === 'idle') {
                await handleWithdraw(i);
            }
        }

        setWithdrawAllStatus('done');
    };

    const formatAmount = (amount: string): string => {
        const num = parseFloat(amount) / 1e18;
        if (num === 0) return '0';
        if (num < 0.0001) return '<0.0001';
        if (num < 1) return num.toFixed(4);
        if (num < 1000) return num.toFixed(4);
        return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    };

    const truncateHash = (hash: string) =>
        `${hash.slice(0, 8)}...${hash.slice(-6)}`;

    const getTokenSymbol = (tokenAddress: string): string => {
        const tokens: Record<string, string> = {
            '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d': 'STRK',
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7': 'ETH',
        };
        return tokens[tokenAddress.toLowerCase()] || 'TOKEN';
    };

    const totalStrk = payments.reduce((sum, p) => sum + parseFloat(p.balanceStrk || '0'), 0);
    const totalEth = payments.reduce((sum, p) => sum + parseFloat(p.balanceEth || '0'), 0);
    const withdrawableCount = payments.filter(p => p.withdrawStatus === 'idle' &&
        (parseFloat(p.balanceStrk) > 0 || parseFloat(p.balanceEth) > 0)).length;

    // Loading keys
    if (isLoadingKeys) {
        return (
            <div className="withdraw-page">
                <div className="withdraw-container">
                    <div className="withdraw-loading glass">
                        <Loader2 size={32} className="icon-spin text-accent" />
                        <p>Loading keys...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Not unlocked - show password prompt
    if (!keysLoaded || !stealthKeys) {
        return (
            <div className="withdraw-page">
                <div className="withdraw-container">
                    <div className="withdraw-locked glass">
                        <Shield size={48} className="text-accent" />
                        <h2>Unlock to Withdraw</h2>
                        <p className="text-secondary">
                            Enter your password to decrypt your stealth keys and scan for payments
                        </p>
                        <div className="unlock-form">
                            <input
                                type="password"
                                className="unlock-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUnlockKeys()}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleUnlockKeys}
                                disabled={isLoadingKeys || !password.trim()}
                            >
                                {isLoadingKeys ? (
                                    <><Loader2 size={16} className="icon-spin" /> Unlocking...</>
                                ) : (
                                    <><Shield size={16} /> Unlock & Scan</>
                                )}
                            </button>
                        </div>
                        {passwordError && (
                            <div className="password-error">
                                <AlertCircle size={14} />
                                {passwordError}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // No wallet connected
    if (!walletAddress) {
        return (
            <div className="withdraw-page">
                <div className="withdraw-container">
                    <div className="withdraw-locked glass">
                        <Wallet size={48} className="text-accent" />
                        <h2>Connect Wallet</h2>
                        <p className="text-secondary">
                            Connect your Starknet wallet to withdraw funds
                        </p>
                        <div className="unlock-form">
                            {connectors.map((connector) => (
                                <button
                                    key={connector.id}
                                    className="btn btn-primary"
                                    onClick={() => connect({ connector })}
                                >
                                    <Wallet size={16} />
                                    Connect {connector.name || connector.id}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="withdraw-page">
            <div className="withdraw-container">
                {/* Header */}
                <div className="page-header animate-fade-in">
                    <div className="header-info">
                        <h1>
                            <Download size={28} />
                            Withdraw
                        </h1>
                        <p className="text-secondary">Claim funds from your stealth addresses</p>
                    </div>
                    <button
                        className="btn btn-ghost"
                        onClick={scanPayments}
                        disabled={isScanning}
                    >
                        <RefreshCw size={18} className={isScanning ? 'icon-spin' : ''} />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="withdraw-stats animate-slide-up">
                    <div className="withdraw-stat glass">
                        <div className="stat-icon received-icon">
                            <ArrowDownLeft size={20} />
                        </div>
                        <div>
                            <div className="stat-value">{payments.length}</div>
                            <div className="stat-label">Detected</div>
                        </div>
                    </div>
                    <div className="withdraw-stat glass">
                        <div className="stat-icon strk-icon">
                            <Wallet size={20} />
                        </div>
                        <div>
                            <div className="stat-value">{formatAmount(totalStrk.toString())}</div>
                            <div className="stat-label">STRK Available</div>
                        </div>
                    </div>
                    <div className="withdraw-stat glass">
                        <div className="stat-icon eth-icon">
                            <Wallet size={20} />
                        </div>
                        <div>
                            <div className="stat-value">{formatAmount(totalEth.toString())}</div>
                            <div className="stat-label">ETH Available</div>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="withdraw-error">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                        <button className="btn btn-ghost btn-sm" onClick={scanPayments}>
                            Retry
                        </button>
                    </div>
                )}

                {/* Scanning */}
                {isScanning && (
                    <div className="withdraw-scanning glass">
                        <Loader2 size={24} className="icon-spin text-accent" />
                        <p>Scanning announcements for your payments...</p>
                    </div>
                )}

                {/* Withdraw All Button */}
                {withdrawableCount > 0 && (
                    <div className="withdraw-all-bar glass animate-slide-up">
                        <div className="withdraw-all-info">
                            <ArrowUpRight size={18} className="text-accent" />
                            <span><strong>{withdrawableCount}</strong> payment{withdrawableCount !== 1 ? 's' : ''} ready to withdraw</span>
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={handleWithdrawAll}
                            disabled={withdrawAllStatus === 'running'}
                        >
                            {withdrawAllStatus === 'running' ? (
                                <><Loader2 size={16} className="icon-spin" /> Withdrawing...</>
                            ) : (
                                <><Download size={16} /> Withdraw All to Wallet</>
                            )}
                        </button>
                    </div>
                )}

                {/* Payment List */}
                <div className="withdraw-list">
                    {payments.length === 0 && !isScanning ? (
                        <div className="withdraw-empty glass">
                            <Download size={48} className="text-muted" />
                            <h3>No payments detected</h3>
                            <p className="text-secondary">
                                When someone sends you a stealth payment, it will appear here for withdrawal.
                            </p>
                            <button className="btn btn-secondary" onClick={scanPayments}>
                                <RefreshCw size={16} /> Scan Again
                            </button>
                        </div>
                    ) : (
                        payments.map((payment, index) => {
                            const hasStrk = parseFloat(payment.balanceStrk) > 0;
                            const hasEth = parseFloat(payment.balanceEth) > 0;
                            const hasBalance = hasStrk || hasEth;

                            return (
                                <div
                                    key={payment.txHash}
                                    className={`withdraw-row glass ${payment.withdrawStatus}`}
                                >
                                    {/* Status Icon */}
                                    <div className="withdraw-icon">
                                        {payment.withdrawStatus === 'withdrawing' ? (
                                            <Loader2 size={20} className="icon-spin" />
                                        ) : payment.withdrawStatus === 'success' ? (
                                            <CheckCircle size={20} className="icon-success" />
                                        ) : payment.withdrawStatus === 'failed' ? (
                                            <XCircle size={20} className="icon-error" />
                                        ) : (
                                            <ArrowDownLeft size={20} className="text-accent" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="withdraw-info">
                                        <div className="withdraw-title">
                                            Stealth Payment
                                            <span className="mono text-muted"> {truncateHash(payment.stealthAddress)}</span>
                                        </div>
                                        <div className="withdraw-balances">
                                            {hasStrk && (
                                                <span className="balance-tag strk">
                                                    {formatAmount(payment.balanceStrk)} STRK
                                                </span>
                                            )}
                                            {hasEth && (
                                                <span className="balance-tag eth">
                                                    {formatAmount(payment.balanceEth)} ETH
                                                </span>
                                            )}
                                            {!hasBalance && payment.withdrawStatus !== 'success' && (
                                                <span className="balance-tag empty">No balance</span>
                                            )}
                                        </div>
                                        {payment.withdrawError && (
                                            <div className="withdraw-error-msg text-muted">
                                                {payment.withdrawError}
                                            </div>
                                        )}
                                        {payment.withdrawTxHash && (
                                            <div className="withdraw-success-msg">
                                                <a
                                                    href={`https://sepolia.starkscan.co/tx/${payment.withdrawTxHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-accent"
                                                >
                                                    View withdrawal tx <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="withdraw-actions">
                                        {payment.withdrawStatus === 'idle' && hasBalance && (
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleWithdraw(index)}
                                            >
                                                <Download size={14} />
                                                Withdraw
                                            </button>
                                        )}
                                        {payment.withdrawStatus === 'success' && (
                                            <span className="withdraw-badge success">Withdrawn</span>
                                        )}
                                        {payment.withdrawStatus === 'failed' && (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleWithdraw(index)}
                                            >
                                                Retry
                                            </button>
                                        )}
                                        {payment.withdrawStatus === 'withdrawing' && (
                                            <span className="withdraw-badge pending">Withdrawing...</span>
                                        )}
                                        <a
                                            href={`https://sepolia.starkscan.co/tx/${payment.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-ghost btn-sm"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Destination Info */}
                {payments.length > 0 && (
                    <div className="withdraw-destination glass animate-slide-up">
                        <Wallet size={16} className="text-accent" />
                        <span className="text-muted">Funds will be sent to: </span>
                        <span className="mono">{truncateHash(walletAddress)}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
