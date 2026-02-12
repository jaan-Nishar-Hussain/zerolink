import { Link, useLocation } from 'react-router-dom';
import {
    Shield,
    Home,
    Send,
    Download,
    Settings,
    History,
    Menu,
    X
} from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store';
import { WalletButton } from '../WalletButton';
import './Header.css';

export function Header() {
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const { alias } = useAppStore();

    const navItems = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/receive', label: 'Receive', icon: Download },
        { path: '/pay', label: 'Pay', icon: Send },
        { path: '/transactions', label: 'Transactions', icon: History },
        { path: '/withdraw', label: 'Withdraw', icon: Download },
        { path: '/settings', label: 'Settings', icon: Settings },
    ];

    const isActive = (path: string) => location.pathname === path;

    return (
        <header className="header">
            <div className="header-container">
                <Link to="/" className="logo">
                    <Shield className="logo-icon" />
                    <span className="logo-text">ZeroLink</span>
                </Link>

                <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
                    {navItems.map(({ path, label, icon: Icon }) => (
                        <Link
                            key={path}
                            to={path}
                            className={`nav-link ${isActive(path) ? 'nav-link-active' : ''}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="header-actions">
                    {alias && <span className="alias-badge">@{alias}</span>}
                    <WalletButton />

                    <button
                        className="menu-toggle"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>
        </header>
    );
}
