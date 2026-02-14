import { useState, useRef } from 'react';
import {
    Key,
    Download,
    Upload,
    Trash2,
    AlertCircle,
    Check,
    Shield,
    Eye,
    EyeOff,
    Copy,
    Loader2,
    RefreshCw
} from 'lucide-react';
import { useAppStore } from '../../store';
import { clearKeys, exportEncryptedBackup, importEncryptedBackup } from '../../lib/crypto/storage';
import { rescanPayments, type RescanProgress } from '../../lib/crypto/rescan';
import type { StealthKeys } from '../../lib/crypto/stealth';
import './Settings.css';

export function Settings() {
    const [showKeys, setShowKeys] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');
    const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
    const [importError, setImportError] = useState<string | null>(null);
    const [rescanStatus, setRescanStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
    const [rescanProgress, setRescanProgress] = useState<RescanProgress | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { alias, metaAddress, isUnlocked, reset, addPayment } = useAppStore();

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

    const handleExport = async () => {
        setExportStatus('exporting');
        try {
            const result = await exportEncryptedBackup();
            if (!result) {
                setExportStatus('error');
                return;
            }
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setExportStatus('done');
            setTimeout(() => setExportStatus('idle'), 3000);
        } catch {
            setExportStatus('error');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportStatus('importing');
        setImportError(null);
        try {
            const importedAlias = await importEncryptedBackup(file);
            setImportStatus('done');
            setTimeout(() => {
                window.location.href = '/receive';
            }, 1500);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : 'Import failed');
            setImportStatus('error');
        }
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRescan = async () => {
        if (!metaAddress) return;
        setRescanStatus('scanning');
        setRescanProgress(null);
        try {
            // Reconstruct a minimal StealthKeys from the store's metaAddress.
            // Private keys are needed — the real app should load them from IndexedDB.
            // For now we import the helper that loads from secure storage.
            const { loadKeys } = await import('../../lib/crypto/storage');
            const keys = await loadKeys();
            if (!keys) {
                setRescanStatus('error');
                return;
            }

            const detected = await rescanPayments(
                keys as StealthKeys,
                '0',
                (p) => setRescanProgress(p),
            );

            for (const d of detected) {
                addPayment({
                    id: d.txHash,
                    type: 'received',
                    amount: d.amount,
                    token: d.token,
                    txHash: d.txHash,
                    ephemeralPubKey: d.ephemeralPubKey,
                    stealthAddress: d.stealthAddress,
                    tokenAddress: d.token,
                    timestamp: Date.now(),
                    status: 'confirmed',
                });
            }

            setRescanStatus('done');
            setTimeout(() => setRescanStatus('idle'), 4000);
        } catch {
            setRescanStatus('error');
        }
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

                {/* Backup & Import */}
                <div className="settings-section glass animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    <div className="section-header">
                        <div className="section-icon">
                            <Download size={20} />
                        </div>
                        <div>
                            <h3>Backup & Import Keys</h3>
                            <p className="text-muted">Export or restore your encrypted key backup</p>
                        </div>
                    </div>

                    <div className="section-content">
                        <p className="text-secondary">
                            Your backup is encrypted with your password. Store it securely —
                            you'll need both the backup file and your password to recover.
                        </p>
                        <div className="backup-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={handleExport}
                                disabled={exportStatus === 'exporting'}
                            >
                                {exportStatus === 'exporting' ? (
                                    <><Loader2 size={18} className="icon-spin" /> Exporting...</>
                                ) : exportStatus === 'done' ? (
                                    <><Check size={18} /> Exported!</>
                                ) : (
                                    <><Download size={18} /> Export Encrypted Backup</>
                                )}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importStatus === 'importing'}
                            >
                                {importStatus === 'importing' ? (
                                    <><Loader2 size={18} className="icon-spin" /> Importing...</>
                                ) : importStatus === 'done' ? (
                                    <><Check size={18} /> Imported! Redirecting...</>
                                ) : (
                                    <><Upload size={18} /> Import Backup</>
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                style={{ display: 'none' }}
                                onChange={handleImport}
                            />
                        </div>
                        {importError && (
                            <div className="import-error">
                                <AlertCircle size={14} />
                                {importError}
                            </div>
                        )}
                    </div>
                </div>

                {/* Rescan Payments */}
                <div className="settings-section glass animate-slide-up" style={{ animationDelay: '0.25s' }}>
                    <div className="section-header">
                        <div className="section-icon">
                            <RefreshCw size={20} />
                        </div>
                        <div>
                            <h3>Rescan Payments</h3>
                            <p className="text-muted">Re-scan on-chain events to find missed payments</p>
                        </div>
                    </div>

                    <div className="section-content">
                        <p className="text-secondary">
                            If you restored from backup or think payments were missed, rescan
                            all on-chain announcements to recover them.
                        </p>
                        <button
                            className="btn btn-secondary"
                            onClick={handleRescan}
                            disabled={rescanStatus === 'scanning'}
                        >
                            {rescanStatus === 'scanning' ? (
                                <><Loader2 size={18} className="icon-spin" /> Scanning... {rescanProgress ? `(${rescanProgress.scanned} checked, ${rescanProgress.found} found)` : ''}</>
                            ) : rescanStatus === 'done' ? (
                                <><Check size={18} /> Rescan Complete{rescanProgress ? ` — ${rescanProgress.found} payments found` : ''}</>
                            ) : rescanStatus === 'error' ? (
                                <><AlertCircle size={18} /> Rescan Failed — Try Again</>
                            ) : (
                                <><RefreshCw size={18} /> Rescan Payments</>
                            )}
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
