/**
 * Wallet Connect Button Component
 * 
 * Handles Starknet wallet connection UI
 */

import { useState } from 'react';
import { useConnect, useDisconnect, useAccount } from '@starknet-react/core';
import { Wallet, ChevronDown, LogOut, Copy, Check } from 'lucide-react';
import './WalletButton.css';

export function WalletButton() {
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { address, isConnected, isConnecting } = useAccount();
    const [showDropdown, setShowDropdown] = useState(false);
    const [copied, setCopied] = useState(false);

    const truncateAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const copyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (isConnecting) {
        return (
            <button className="wallet-button connecting">
                <Wallet size={18} />
                <span>Connecting...</span>
            </button>
        );
    }

    if (isConnected && address) {
        return (
            <div className="wallet-connected">
                <button
                    className="wallet-button connected"
                    onClick={() => setShowDropdown(!showDropdown)}
                >
                    <div className="wallet-indicator" />
                    <span className="mono">{truncateAddress(address)}</span>
                    <ChevronDown size={16} className={showDropdown ? 'rotated' : ''} />
                </button>

                {showDropdown && (
                    <div className="wallet-dropdown glass">
                        <button className="dropdown-item" onClick={copyAddress}>
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            <span>{copied ? 'Copied!' : 'Copy Address'}</span>
                        </button>
                        <div className="dropdown-divider" />
                        <button
                            className="dropdown-item disconnect"
                            onClick={() => {
                                disconnect();
                                setShowDropdown(false);
                            }}
                        >
                            <LogOut size={16} />
                            <span>Disconnect</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="wallet-connect-wrapper">
            <button
                className="wallet-button"
                onClick={() => setShowDropdown(!showDropdown)}
            >
                <Wallet size={18} />
                <span>Connect Wallet</span>
            </button>

            {showDropdown && (
                <div className="wallet-dropdown glass">
                    <div className="dropdown-header">
                        <span>Choose a wallet</span>
                    </div>
                    {connectors.map((connector) => (
                        <button
                            key={connector.id}
                            className="dropdown-item wallet-option"
                            onClick={() => {
                                connect({ connector });
                                setShowDropdown(false);
                            }}
                        >
                            <img
                                src={typeof connector.icon === 'string'
                                    ? connector.icon
                                    : connector.icon?.dark || ''
                                }
                                alt={connector.name}
                                className="wallet-icon"
                            />
                            <span>{connector.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
