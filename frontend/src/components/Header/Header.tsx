import { Link, useLocation } from 'react-router-dom';
import {
    Shield,
    Home,
    Send,
    Download,
    Settings,
    Menu,
    X
} from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store';
import './Header.css';

export function Header() {
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const { isWalletConnected, alias, walletAddress } = useAppStore();

    const navItems = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/receive', label: 'Receive', icon: Download },
        { path: '/pay', label: 'Pay', icon: Send },
        { path: '/dashboard', label: 'Dashboard', icon: Shield },
        { path: '/settings', label: 'Settings', icon: Settings },
    ];

    const isActive = (path: string) => location.pathname === path;

    const truncateAddress = (address: string) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

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
                    {isWalletConnected ? (
                        <div className="wallet-info">
                            {alias && <span className="alias">@{alias}</span>}
                            <span className="address mono">
                                {walletAddress ? truncateAddress(walletAddress) : ''}
                            </span>
                        </div>
                    ) : (
                        <Link to="/receive" className="btn btn-primary">
                            Get Started
                        </Link>
                    )}

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
