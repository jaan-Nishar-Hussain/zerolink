/**
 * Starknet Wallet Configuration
 * 
 * Sets up wallet connection providers for the ZeroLink app
 */

import { sepolia, mainnet } from '@starknet-react/chains';
import { StarknetConfig, publicProvider, argent, braavos } from '@starknet-react/core';
import type { ReactNode } from 'react';

// Supported chains
const chains = [sepolia, mainnet];

// Available wallet connectors
const connectors = [
    argent(),
    braavos(),
];

// Provider configuration
const provider = publicProvider();

interface WalletProviderProps {
    children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
    return (
        <StarknetConfig
            chains={chains}
            provider={provider}
            connectors={connectors}
            autoConnect
        >
            {children}
        </StarknetConfig>
    );
}

export { chains, connectors };
