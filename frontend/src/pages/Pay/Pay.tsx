import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    Send,
    Shield,
    Check,
    AlertCircle,
    Loader2,
    ArrowRight,
    Wallet,
    Copy,
    ExternalLink
} from 'lucide-react';
import { deriveStealthAddress, type MetaAddress } from '../../lib/crypto';
import './Pay.css';

// Fetch meta address from API with localStorage fallback
async function fetchMetaAddress(alias: string): Promise<MetaAddress | null> {
    // Try API first
    try {
        const { api } = await import('../../lib/api');
        const aliasInfo = await api.getAlias(alias);
        return aliasInfo.metaAddress;
    } catch (apiError) {
        console.warn('API fetch failed, trying localStorage:', apiError);
    }

    // Fallback to localStorage
    const stored = localStorage.getItem(`zerolink-meta-${alias}`);
    if (stored) {
        return JSON.parse(stored);
    }

    return null;
}

export function Pay() {
    const { alias } = useParams<{ alias: string }>();
    const [step, setStep] = useState<'loading' | 'amount' | 'confirm' | 'success' | 'error'>('loading');
    const [amount, setAmount] = useState('');
    const [token, setToken] = useState('ETH');
    const [metaAddress, setMetaAddress] = useState<MetaAddress | null>(null);
    const [stealthAddress, setStealthAddress] = useState<string | null>(null);
    const [ephemeralPubKey, setEphemeralPubKey] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (alias) {
            loadRecipient();
        }
    }, [alias]);

    const loadRecipient = async () => {
        try {
            const meta = await fetchMetaAddress(alias!);
            if (meta) {
                setMetaAddress(meta);
                setStep('amount');
            } else {
                setError('Payment link not found');
                setStep('error');
            }
        } catch (err) {
            setError('Failed to load recipient');
            setStep('error');
        }
    };

    const handleContinue = () => {
        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }
        setError('');

        // Derive stealth address
        if (metaAddress) {
            const stealth = deriveStealthAddress(metaAddress);
            setStealthAddress(stealth.address);
            setEphemeralPubKey(stealth.ephemeralPubKey);
            setStep('confirm');
        }
    };

    const handleSend = async () => {
        setLoading(true);

        try {
            // In production, this would:
            // 1. Connect to Starknet wallet
            // 2. Send transaction to stealth address
            // 3. Emit ephemeral public key in event

            // Simulating transaction
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Mock tx hash
            setTxHash('0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''));
            setStep('success');
        } catch (err) {
            setError('Transaction failed. Please try again.');
        }

        setLoading(false);
    };

    const copyAddress = () => {
        if (stealthAddress) {
            navigator.clipboard.writeText(stealthAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (step === 'loading') {
        return (
            <div className="pay-page">
                <div className="pay-container">
                    <div className="loading-state">
                        <Loader2 className="spinner" size={32} />
                        <p>Loading payment link...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (step === 'error') {
        return (
            <div className="pay-page">
                <div className="pay-container">
                    <div className="pay-card glass">
                        <div className="card-header">
                            <div className="card-icon error">
                                <AlertCircle size={24} />
                            </div>
                            <h1>Link Not Found</h1>
                            <p className="text-secondary">
                                This payment link doesn't exist or has been removed.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pay-page glow-bg">
            <div className="pay-container animate-slide-up">
                <div className="pay-card glass">
                    {step === 'amount' && (
                        <>
                            <div className="card-header">
                                <div className="card-icon">
                                    <Send size={24} />
                                </div>
                                <h1>Pay @{alias}</h1>
                                <p className="text-secondary">
                                    Send a private payment to this address
                                </p>
                            </div>

                            <div className="form">
                                <div className="form-group">
                                    <label className="label">Amount</label>
                                    <div className="amount-input-wrapper">
                                        <input
                                            type="number"
                                            className="input amount-input"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            step="0.001"
                                            min="0"
                                        />
                                        <select
                                            className="token-select"
                                            value={token}
                                            onChange={(e) => setToken(e.target.value)}
                                        >
                                            <option value="ETH">ETH</option>
                                            <option value="USDC">USDC</option>
                                            <option value="USDT">USDT</option>
                                            <option value="DAI">DAI</option>
                                        </select>
                                    </div>
                                </div>

                                {error && (
                                    <div className="error-message">
                                        <AlertCircle size={16} />
                                        {error}
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary btn-lg full-width"
                                    onClick={handleContinue}
                                >
                                    Continue
                                    <ArrowRight size={18} />
                                </button>

                                <div className="privacy-note">
                                    <Shield size={14} className="text-accent" />
                                    <span className="text-muted">
                                        Your payment will be sent to a unique stealth address
                                    </span>
                                </div>
                            </div>
                        </>
                    )}

                    {step === 'confirm' && (
                        <>
                            <div className="card-header">
                                <div className="card-icon">
                                    <Wallet size={24} />
                                </div>
                                <h1>Confirm Payment</h1>
                                <p className="text-secondary">
                                    Review and confirm your transaction
                                </p>
                            </div>

                            <div className="confirm-details">
                                <div className="detail-row">
                                    <span className="detail-label">Recipient</span>
                                    <span className="detail-value">@{alias}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Amount</span>
                                    <span className="detail-value highlight">{amount} {token}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Stealth Address</span>
                                    <div className="address-value">
                                        <span className="mono">{stealthAddress?.slice(0, 10)}...{stealthAddress?.slice(-8)}</span>
                                        <button className="btn btn-ghost" onClick={copyAddress}>
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="confirm-note">
                                <Shield size={16} className="text-accent" />
                                <div>
                                    <strong>Privacy Protected</strong>
                                    <p className="text-muted">
                                        This stealth address is unique to this payment. The recipient will be notified through our protocol.
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="error-message">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div className="confirm-actions">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setStep('amount')}
                                    disabled={loading}
                                >
                                    Back
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSend}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="spinner" size={18} />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={18} />
                                            Send {amount} {token}
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'success' && (
                        <>
                            <div className="card-header">
                                <div className="card-icon success">
                                    <Check size={24} />
                                </div>
                                <h1>Payment Sent!</h1>
                                <p className="text-secondary">
                                    Your private payment has been sent successfully
                                </p>
                            </div>

                            <div className="success-details">
                                <div className="detail-row">
                                    <span className="detail-label">Amount</span>
                                    <span className="detail-value highlight">{amount} {token}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">To</span>
                                    <span className="detail-value">@{alias}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Transaction</span>
                                    <a
                                        href={`https://starkscan.co/tx/${txHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tx-link"
                                    >
                                        {txHash?.slice(0, 10)}...{txHash?.slice(-8)}
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                            </div>

                            <div className="success-actions">
                                <button
                                    className="btn btn-primary full-width"
                                    onClick={() => {
                                        setStep('amount');
                                        setAmount('');
                                        setStealthAddress(null);
                                        setTxHash(null);
                                    }}
                                >
                                    Send Another Payment
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
