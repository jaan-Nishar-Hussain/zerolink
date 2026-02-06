import { useState } from 'react';
import {
    Key,
    Download,
    Trash2,
    AlertCircle,
    Check,
    Shield,
    Eye,
    EyeOff,
    Copy
} from 'lucide-react';
import { useAppStore } from '../../store';
import { clearKeys } from '../../lib/crypto/storage';
import './Settings.css';

export function Settings() {
    const [showKeys, setShowKeys] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const { alias, metaAddress, isUnlocked, reset } = useAppStore();

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleDeleteKeys = async () => {
        await clearKeys();
        reset();
        window.location.href = '/';
    };

    if (!isUnlocked) {
        return (
            <div className="settings-page">
                <div className="settings-container">
                    <div className="unlock-prompt glass">
                        <Shield size={48} className="text-accent" />
                        <h2>Unlock Required</h2>
                        <p className="text-secondary">
                            Please unlock your wallet to access settings
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
        <div className="settings-page">
            <div className="settings-container">
                <div className="settings-header animate-fade-in">
                    <h1>Settings</h1>
                    <p className="text-secondary">Manage your account and security</p>
                </div>

                {/* Account Info */}
                <div className="settings-section glass animate-slide-up">
                    <div className="section-header">
                        <div className="section-icon">
                            <Key size={20} />
                        </div>
                        <div>
                            <h3>Account Information</h3>
                            <p className="text-muted">Your public payment details</p>
                        </div>
                    </div>

                    <div className="info-grid">
                        <div className="info-item">
                            <label className="info-label">Alias</label>
                            <div className="info-value">
                                <span>@{alias}</span>
                            </div>
                        </div>

                        <div className="info-item">
                            <label className="info-label">Payment Link</label>
                            <div className="info-value link-value">
                                <span className="mono">{window.location.origin}/pay/{alias}</span>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => copyToClipboard(`${window.location.origin}/pay/${alias}`, 'link')}
                                >
                                    {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Public Keys */}
                <div className="settings-section glass animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="section-header">
                        <div className="section-icon">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h3>Meta Address (Public Keys)</h3>
                            <p className="text-muted">These keys are used by senders to derive stealth addresses</p>
                        </div>
                        <button
                            className="btn btn-ghost"
                            onClick={() => setShowKeys(!showKeys)}
                        >
                            {showKeys ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showKeys ? 'Hide' : 'Show'}
                        </button>
                    </div>

                    {showKeys && metaAddress && (
                        <div className="keys-display">
                            <div className="key-item">
                                <label className="key-label">Spend Public Key</label>
                                <div className="key-value">
                                    <code className="mono">{metaAddress.spendPubKey}</code>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => copyToClipboard(metaAddress.spendPubKey, 'spend')}
                                    >
                                        {copied === 'spend' ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div className="key-item">
                                <label className="key-label">Viewing Public Key</label>
                                <div className="key-value">
                                    <code className="mono">{metaAddress.viewingPubKey}</code>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => copyToClipboard(metaAddress.viewingPubKey, 'viewing')}
                                    >
                                        {copied === 'viewing' ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Backup */}
                <div className="settings-section glass animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    <div className="section-header">
                        <div className="section-icon">
                            <Download size={20} />
                        </div>
                        <div>
                            <h3>Backup Keys</h3>
                            <p className="text-muted">Export encrypted backup of your keys</p>
                        </div>
                    </div>

                    <div className="section-content">
                        <p className="text-secondary">
                            Your backup will be encrypted with your password. Store it securely -
                            you'll need both the backup file and your password to recover your account.
                        </p>
                        <button className="btn btn-secondary">
                            <Download size={18} />
                            Export Encrypted Backup
                        </button>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="settings-section danger glass animate-slide-up" style={{ animationDelay: '0.3s' }}>
                    <div className="section-header">
                        <div className="section-icon danger">
                            <Trash2 size={20} />
                        </div>
                        <div>
                            <h3>Danger Zone</h3>
                            <p className="text-muted">Irreversible actions</p>
                        </div>
                    </div>

                    <div className="section-content">
                        {!showDeleteConfirm ? (
                            <>
                                <p className="text-secondary">
                                    Deleting your keys will permanently remove your ability to access received payments.
                                    Make sure you have withdrawn all funds first.
                                </p>
                                <button
                                    className="btn btn-danger"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <Trash2 size={18} />
                                    Delete All Keys
                                </button>
                            </>
                        ) : (
                            <div className="delete-confirm">
                                <div className="warning-box">
                                    <AlertCircle size={20} />
                                    <div>
                                        <strong>Are you absolutely sure?</strong>
                                        <p>This action cannot be undone. All your keys will be permanently deleted.</p>
                                    </div>
                                </div>
                                <div className="confirm-actions">
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setShowDeleteConfirm(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleDeleteKeys}
                                    >
                                        Yes, Delete Everything
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
