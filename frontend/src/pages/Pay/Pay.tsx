import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    Send,
    Shield,
    Check,
    AlertCircle,
    Loader2,
    Wallet,
    Copy,
    ExternalLink
} from 'lucide-react';
import { useAccount, useConnect, useSendTransaction } from '@starknet-react/core';
import { cairo } from 'starknet';
import { deriveStealthAddress, parsePublicKeyToCoordinates, type MetaAddress } from '../../lib/crypto';
import { api } from '../../lib/api';
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
    const { alias: urlAlias } = useParams<{ alias: string }>();

    const [amount, setAmount] = useState('');
    const [token, setToken] = useState('STRK');
    const [metaAddress, setMetaAddress] = useState<MetaAddress | null>(null);
    const [stealthAddress, setStealthAddress] = useState<string | null>(null);
    const [ephemeralPubKey, setEphemeralPubKey] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [txHash, setTxHash] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [recipientAlias, setRecipientAlias] = useState('');
    const [recipientLoading, setRecipientLoading] = useState(!!urlAlias);
    const [step, setStep] = useState<'amount' | 'confirm' | 'success'>('amount');
    const [lookupComplete, setLookupComplete] = useState(false);

    const { address: userAddress, account } = useAccount();
    const { connect, connectors } = useConnect();
    const { sendAsync } = useSendTransaction({
        calls: []
    });

    const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
    const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
    const STEALTH_PAYMENT_CONTRACT = import.meta.env.VITE_STEALTH_PAYMENT_CONTRACT;

    // The display alias is the URL alias or the manually entered one
    const displayAlias = urlAlias || recipientAlias;

    // Show amount input if we have a URL alias OR we have loaded a metaAddress OR lookup is complete
    const showAmountInput = !!urlAlias || !!metaAddress || lookupComplete;

    useEffect(() => {
        if (urlAlias) {
            loadRecipient(urlAlias);
        }
    }, [urlAlias]);

    const loadRecipient = async (alias: string) => {
        setRecipientLoading(true);
        try {
            const meta = await fetchMetaAddress(alias);
            if (meta) {
                setMetaAddress(meta);
            }
            // Even if not found, we still show the amount input - error will be shown on send
        } catch (err) {
            console.error('Failed to load recipient:', err);
        } finally {
            setRecipientLoading(false);
        }
    };

    const handleLookup = async () => {
        if (!recipientAlias.trim()) {
            setError('Please enter a recipient alias');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const meta = await fetchMetaAddress(recipientAlias.trim());
            if (meta) {
                setMetaAddress(meta);
                setLookupComplete(true);
                setError('');
            } else {
                setError('Recipient not found');
            }
        } catch (err) {
            setError('Failed to lookup recipient');
        } finally {
            setLoading(false);
        }
    };

    const handleContinue = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        setError('');
        setLoading(true);

        try {
            // If we don't have metaAddress yet, try to load it now
            let meta = metaAddress;
            if (!meta && displayAlias) {
                meta = await fetchMetaAddress(displayAlias);
                if (meta) {
                    setMetaAddress(meta);
                }
            }

            if (!meta) {
                setError('Recipient not found. Please check the username.');
                setLoading(false);
                return;
            }

            // Derive stealth address
            const stealth = deriveStealthAddress(meta);
            setStealthAddress(stealth.address);
            setEphemeralPubKey(stealth.ephemeralPubKey);
            setStep('confirm');
        } catch (err: any) {
            setError(err.message || 'Failed to prepare payment');
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!account) {
            setError('Please connect your wallet first');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (!stealthAddress || !ephemeralPubKey) {
                throw new Error('Stealth address not derived');
            }

            const coords = parsePublicKeyToCoordinates(ephemeralPubKey);
            const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));
            const amountU256 = cairo.uint256(amountWei);

            const tokenAddress = token === 'ETH' ? ETH_ADDRESS : STRK_ADDRESS;

            // On Starknet, ETH is an ERC20-like token, so we need to:
            // 1. Approve the stealth payment contract to spend our tokens
            // 2. Call send_token (not send_eth) which does transfer_from
            const calls = [
                // Step 1: Approve the stealth payment contract to spend the token
                {
                    contractAddress: tokenAddress,
                    entrypoint: 'approve',
                    calldata: [
                        STEALTH_PAYMENT_CONTRACT as string,
                        amountU256.low.toString(),
                        amountU256.high.toString()
                    ]
                },
                // Step 2: Call send_token which will transfer_from the approved amount
                {
                    contractAddress: STEALTH_PAYMENT_CONTRACT as string,
                    entrypoint: 'send_token',
                    calldata: [
                        tokenAddress,
                        stealthAddress,
                        amountU256.low.toString(),
                        amountU256.high.toString(),
                        coords.x,
                        coords.y
                    ]
                }
            ];

            const result = await sendAsync(calls);
            setTxHash(result.transaction_hash);
            setStep('success');

            // Notify backend about the payment for faster indexing
            try {
                await api.announcePayment({
                    txHash: result.transaction_hash,
                    stealthAddress,
                    ephemeralPubKey,
                    amount: amountWei.toString(),
                    token: tokenAddress,
                    timestamp: new Date().toISOString()
                });
            } catch (backendErr) {
                console.warn('Backend notification failed, indexer will pick it up eventually:', backendErr);
            }

        } catch (err: any) {
            console.error('Send error:', err);
            setError(err.message || 'Transaction failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const copyAddress = () => {
        if (stealthAddress) {
            navigator.clipboard.writeText(stealthAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Show loading while fetching recipient from URL
    if (recipientLoading) {
        return (
            <div className="pay-page">
                <Shield className="pay-logo" size={80} />
                <div className="pay-container">
                    <div className="loading-state">
                        <Loader2 className="spinner" size={32} />
                        <p>Loading payment link...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pay-page">
            <Shield className="pay-logo" size={80} />
            <div className="pay-container animate-slide-up">
                <div className="pay-card">
                    {step === 'amount' && (
                        <>
                            <div className="card-header">
                                <h1>
                                    {displayAlias ? (
                                        <>Send to <span className="highlight">@{displayAlias}</span></>
                                    ) : (
                                        'Send Payment'
                                    )}
                                </h1>
                                {displayAlias && (
                                    <p className="text-secondary">{displayAlias}.zerolink.pay</p>
                                )}
                            </div>

                            {/* Wallet Status */}
                            {account && (
                                <div className="wallet-status">
                                    <div>
                                        <div className="wallet-status-label">Wallet Connected</div>
                                        <div className="wallet-status-address">
                                            {userAddress?.slice(0, 8)}...{userAddress?.slice(-6)}
                                        </div>
                                    </div>
                                    <Check size={20} className="wallet-status-icon" />
                                </div>
                            )}

                            <div className="form">
                                {/* Show recipient lookup ONLY if no URL alias AND no metaAddress yet */}
                                {!showAmountInput && (
                                    <div className="form-group">
                                        <label className="label">Recipient</label>
                                        <div className="amount-input-wrapper">
                                            <span className="at-symbol">@</span>
                                            <input
                                                type="text"
                                                className="input amount-input"
                                                placeholder="username"
                                                value={recipientAlias}
                                                onChange={(e) => setRecipientAlias(e.target.value.toLowerCase())}
                                                style={{ paddingLeft: '2.5rem' }}
                                            />
                                            <button
                                                className="btn btn-secondary"
                                                onClick={handleLookup}
                                                disabled={loading}
                                            >
                                                {loading ? <Loader2 className="spinner" size={16} /> : 'Lookup'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Show amount input when we have a recipient (URL alias or looked up) */}
                                {showAmountInput && (
                                    <div className="amount-section">
                                        <div className="amount-label">Amount ({token})</div>
                                        <input
                                            type="number"
                                            className="input amount-input"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            step="0.001"
                                            min="0"
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                fontSize: '1.5rem',
                                                padding: '0'
                                            }}
                                        />
                                        <div className="amount-hint">Enter the amount you want to send</div>
                                    </div>
                                )}

                                {error && (
                                    <div className="error-message">
                                        <AlertCircle size={16} />
                                        {error}
                                    </div>
                                )}

                                {showAmountInput && (
                                    <button
                                        className="btn btn-primary btn-lg full-width"
                                        onClick={handleContinue}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="spinner" size={18} />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                Send {amount || '0'} {token}
                                            </>
                                        )}
                                    </button>
                                )}

                                <p className="payment-footer">
                                    Funds will be sent to a stealth address. The recipient can withdraw anytime.
                                </p>
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
                                    <span className="detail-value">@{displayAlias}</span>
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
                                    <p>
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
                                {!account ? (
                                    <div className="wallet-connect-section full-width">
                                        <p className="text-secondary text-center mb-2">Connect wallet to send payment</p>
                                        <div className="connector-list">
                                            {connectors.map((connector) => (
                                                <button
                                                    key={connector.id}
                                                    className="btn btn-secondary full-width mb-1"
                                                    onClick={() => connect({ connector })}
                                                >
                                                    Connect {connector.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <>
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
                                    </>
                                )}
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
                                    <span className="detail-value">@{displayAlias}</span>
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
