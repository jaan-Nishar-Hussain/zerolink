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
import { deriveStealthAddress, parsePublicKeyToCoordinates, type MetaAddress } from '../../lib/crypto';
import { api } from '../../lib/api';
import { useAppStore } from '../../store';
import { CONTRACTS } from '../../lib/contracts/config';
import {
    createDepositNote,
    buildDepositCalldata,
    buildRelayRequest,
    saveNote,
    DENOMINATIONS,
    splitAmountIntoDenominations,
} from '../../lib/crypto/private-send';
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
    const [selectedDenom, setSelectedDenom] = useState<string>(DENOMINATIONS[0].wei);
    const [depositCount, setDepositCount] = useState(1);

    const { address: userAddress, account } = useAccount();
    const { connect, connectors } = useConnect();
    const { sendAsync } = useSendTransaction({
        calls: []
    });

    const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
    const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

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
        const denomLabel = DENOMINATIONS.find(d => d.wei === selectedDenom)?.label || '1';
        const totalAmount = (parseFloat(denomLabel) * depositCount).toString();
        setAmount(totalAmount);

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
            const tokenAddress = token === 'ETH' ? ETH_ADDRESS : STRK_ADDRESS;
            const depositPoolAddress = CONTRACTS.DEPOSIT_POOL;

            if (!depositPoolAddress || depositPoolAddress === '0x0') {
                throw new Error('Deposit pool contract not configured. Set VITE_DEPOSIT_POOL_CONTRACT.');
            }

            // ─── Fixed-denomination deposits ────────────────────────────────
            // Each deposit uses a valid denomination. For amounts > 1 tier,
            // we split into multiple deposits.
            let finalTxHash = '';
            const allNotes: any[] = [];

            for (let i = 0; i < depositCount; i++) {
                const note = createDepositNote(selectedDenom, tokenAddress);
                const { approve, deposit } = buildDepositCalldata(note, depositPoolAddress);

                const depositResult = await sendAsync([approve, deposit]);
                note.depositTxHash = depositResult.transaction_hash;
                finalTxHash = depositResult.transaction_hash;

                saveNote(note);
                allNotes.push(note);
            }

            // ─── Ask the relayer to withdraw to the stealth address ────────
            // Use the first note for the relay request (relayer handles one at a time)
            for (const note of allNotes) {
                const relayReq = buildRelayRequest(note, stealthAddress, coords.x, coords.y);
                try {
                    const relayResult = await api.submitRelay(relayReq);
                    if (relayResult.transactionHash) {
                        finalTxHash = relayResult.transactionHash;
                    }
                } catch (relayErr: any) {
                    console.warn('Relay request failed (deposit is safe, can retry):', relayErr.message || relayErr);
                }
            }

            setTxHash(finalTxHash);
            setStep('success');

            // Save sent transaction to the store
            const denomLabel = DENOMINATIONS.find(d => d.wei === selectedDenom)?.label || '1';
            const totalAmount = (parseFloat(denomLabel) * depositCount).toString();
            useAppStore.getState().addPayment({
                id: finalTxHash,
                type: 'sent',
                amount: totalAmount,
                token: token,
                txHash: finalTxHash,
                ephemeralPubKey: ephemeralPubKey,
                stealthAddress: stealthAddress,
                tokenAddress: tokenAddress,
                recipient: displayAlias || stealthAddress,
                timestamp: Date.now(),
                status: 'confirmed',
            });

            // ─── Announce the payment so the recipient can detect it ───────
            const totalWei = BigInt(selectedDenom) * BigInt(depositCount);
            try {
                await api.announcePayment({
                    txHash: finalTxHash,
                    stealthAddress,
                    ephemeralPubKey,
                    amount: totalWei.toString(),
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

                                {/* Show denomination picker when we have a recipient */}
                                {showAmountInput && (
                                    <div className="amount-section">
                                        <div className="amount-label">Select Amount ({token})</div>
                                        <div style={{
                                            display: 'flex',
                                            gap: '0.5rem',
                                            marginBottom: '1rem',
                                        }}>
                                            {DENOMINATIONS.map((d) => (
                                                <button
                                                    key={d.wei}
                                                    className={`btn ${selectedDenom === d.wei ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => {
                                                        setSelectedDenom(d.wei);
                                                        setDepositCount(1);
                                                    }}
                                                    style={{ flex: 1, padding: '0.75rem 0.5rem' }}
                                                >
                                                    {d.label} {token}
                                                </button>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                            <label className="amount-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>×</label>
                                            <input
                                                type="number"
                                                className="input"
                                                value={depositCount}
                                                onChange={(e) => setDepositCount(Math.max(1, parseInt(e.target.value) || 1))}
                                                min="1"
                                                max="20"
                                                style={{
                                                    width: '4rem',
                                                    textAlign: 'center',
                                                    background: 'transparent',
                                                    borderColor: 'var(--border)',
                                                }}
                                            />
                                            <span className="text-secondary" style={{ fontSize: '0.9rem' }}>
                                                = {(parseFloat(DENOMINATIONS.find(d => d.wei === selectedDenom)?.label || '1') * depositCount).toFixed(0)} {token}
                                            </span>
                                        </div>
                                        <div className="amount-hint">
                                            Fixed denominations protect your privacy — all deposits in a tier look identical on-chain
                                        </div>
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
                                                Send {(parseFloat(DENOMINATIONS.find(d => d.wei === selectedDenom)?.label || '1') * depositCount).toFixed(0)} {token}
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
