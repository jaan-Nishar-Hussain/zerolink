import { useState, useEffect } from 'react';
import {
    Shield,
    Copy,
    Check,
    Link as LinkIcon,
    Key,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { useAppStore } from '../../store';
import { generateStealthKeys } from '../../lib/crypto';
import { saveKeys, hasStoredKeys, loadKeys, getStoredAlias } from '../../lib/crypto/storage';
import './Receive.css';

export function Receive() {
    const [step, setStep] = useState<'check' | 'create' | 'unlock' | 'done'>('check');
    const [alias, setAlias] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);

    const { setMetaAddress, setUnlocked } = useAppStore();

    useEffect(() => {
        checkExistingKeys();
    }, []);

    const checkExistingKeys = async () => {
        setLoading(true);
        const hasKeys = await hasStoredKeys();
        if (hasKeys) {
            const storedAlias = await getStoredAlias();
            if (storedAlias) setAlias(storedAlias);
            setStep('unlock');
        } else {
            setStep('create');
        }
        setLoading(false);
    };

    const handleCreateLink = async () => {
        setError('');

        if (!alias.trim()) {
            setError('Please enter an alias');
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
            setError('Alias can only contain letters, numbers, underscores, and hyphens');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            // Generate stealth keys
            const keys = generateStealthKeys();

            // Register alias with backend (optional - continues even if backend is unavailable)
            try {
                const { api } = await import('../../lib/api');
                await api.registerAlias(alias, keys.metaAddress);
            } catch (apiError) {
                console.warn('Backend registration failed (will work offline):', apiError);
            }

            // Always cache meta address in localStorage so the sender can look it up
            localStorage.setItem(`zerolink-meta-${alias}`, JSON.stringify(keys.metaAddress));

            // Save encrypted keys to IndexedDB
            await saveKeys(keys, alias, password);

            // Update store
            setMetaAddress(keys.metaAddress, alias);
            setUnlocked(true);

            setStep('done');
        } catch (err) {
            setError('Failed to create keys. Please try again.');
            console.error(err);
        }

        setLoading(false);
    };

    const handleUnlock = async () => {
        setError('');
        setLoading(true);

        try {
            const keys = await loadKeys(password);

            if (!keys) {
                setError('Wrong password');
                setLoading(false);
                return;
            }

            // Always update localStorage cache with current keys
            localStorage.setItem(`zerolink-meta-${alias}`, JSON.stringify(keys.metaAddress));

            // Re-register alias with backend in case it was lost
            try {
                const { api } = await import('../../lib/api');
                await api.registerAlias(alias, keys.metaAddress);
            } catch (apiError: any) {
                // 409 = alias already taken: update the keys if they changed
                if (apiError?.message?.includes('409') || apiError?.message?.includes('already')) {
                    console.log('Alias exists in DB (keys may be stale, but ok for now)');
                } else {
                    console.warn('Backend registration failed:', apiError);
                }
            }

            setMetaAddress(keys.metaAddress, alias);
            setUnlocked(true);
            setStep('done');
        } catch (err) {
            setError('Failed to unlock. Please try again.');
            console.error(err);
        }

        setLoading(false);
    };

    const copyLink = () => {
        const link = `${window.location.origin}/pay/${alias}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const paymentLink = `${window.location.origin}/pay/${alias}`;

    if (step === 'check' || loading) {
        return (
            <div className="receive-page">
                <div className="receive-container">
                    <div className="loading-state">
                        <Loader2 className="spinner" size={32} />
                        <p>Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="receive-page glow-bg">
            <div className="receive-container animate-slide-up">
                {step === 'create' && (
                    <div className="receive-card glass">
                        <div className="card-header">
                            <div className="card-icon">
                                <Key size={24} />
                            </div>
                            <h1>Create Payment Link</h1>
                            <p className="text-secondary">
                                Generate your private payment link. Your keys are encrypted and stored locally.
                            </p>
                        </div>

                        <div className="form">
                            <div className="form-group">
                                <label className="label">Choose Your Alias</label>
                                <div className="input-wrapper">
                                    <span className="input-prefix">@</span>
                                    <input
                                        type="text"
                                        className="input input-with-prefix"
                                        placeholder="satoshi"
                                        value={alias}
                                        onChange={(e) => setAlias(e.target.value.toLowerCase())}
                                    />
                                </div>
                                <p className="input-hint text-muted">
                                    Your payment link: zerolink.pay/@{alias || 'yourname'}
                                </p>
                            </div>

                            <div className="form-group">
                                <label className="label">Create Password</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Min 8 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="label">Confirm Password</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Confirm your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            {error && (
                                <div className="error-message">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-lg full-width"
                                onClick={handleCreateLink}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="spinner" size={18} />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Shield size={18} />
                                        Create Payment Link
                                    </>
                                )}
                            </button>

                            <p className="security-note text-muted">
                                <Shield size={14} />
                                Your private keys are encrypted with your password and never leave your device.
                            </p>
                        </div>
                    </div>
                )}

                {step === 'unlock' && (
                    <div className="receive-card glass">
                        <div className="card-header">
                            <div className="card-icon">
                                <Key size={24} />
                            </div>
                            <h1>Welcome Back, @{alias}</h1>
                            <p className="text-secondary">
                                Enter your password to unlock your payment link.
                            </p>
                        </div>

                        <div className="form">
                            <div className="form-group">
                                <label className="label">Password</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleUnlock()}
                                />
                            </div>

                            {error && (
                                <div className="error-message">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-lg full-width"
                                onClick={handleUnlock}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="spinner" size={18} />
                                        Unlocking...
                                    </>
                                ) : (
                                    'Unlock'
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'done' && (
                    <div className="receive-card glass">
                        <div className="card-header">
                            <div className="card-icon success">
                                <Check size={24} />
                            </div>
                            <h1>Your Payment Link is Ready!</h1>
                            <p className="text-secondary">
                                Share this link to receive private payments
                            </p>
                        </div>

                        <div className="payment-link-display">
                            <div className="link-box">
                                <LinkIcon size={18} className="text-accent" />
                                <span className="link-text">{paymentLink}</span>
                                <button
                                    className="btn btn-ghost copy-btn"
                                    onClick={copyLink}
                                >
                                    {copied ? <Check size={18} /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="link-features">
                            <div className="feature-item">
                                <Shield size={16} className="text-accent" />
                                <span>Every payment creates a unique stealth address</span>
                            </div>
                            <div className="feature-item">
                                <Key size={16} className="text-accent" />
                                <span>Only you can detect and spend received funds</span>
                            </div>
                            <div className="feature-item">
                                <LinkIcon size={16} className="text-accent" />
                                <span>Share one link, receive unlimited payments</span>
                            </div>
                        </div>

                        <div className="link-actions">
                            <button className="btn btn-primary" onClick={copyLink}>
                                {copied ? <Check size={18} /> : <Copy size={18} />}
                                {copied ? 'Copied!' : 'Copy Link'}
                            </button>
                            <a href="/transactions" className="btn btn-secondary">
                                Go to Transactions
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
