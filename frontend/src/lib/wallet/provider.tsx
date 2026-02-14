/**
 * Starknet Wallet Configuration
 * 
 * Sets up wallet connection providers for the ZeroLink app
 */

import { sepolia, mainnet } from '@starknet-react/chains';
import { StarknetConfig, argent, braavos, jsonRpcProvider } from '@starknet-react/core';
import type { ReactNode } from 'react';
import { RpcProvider } from 'starknet';

// Supported chains
const chains = [sepolia, mainnet];

// Available wallet connectors
const connectors = [
    argent(),
    braavos(),
];

// Use Alchemy or Infura for more reliable RPC
// Fall back to public endpoints with correct spec version handling
function rpc(chain: typeof sepolia | typeof mainnet) {
    const rpcUrl = chain.id === sepolia.id
        ? import.meta.env.VITE_STARKNET_RPC || 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/XN9-BdSkx8Pw_0vERYc_f'
        : 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7';

    return {
        nodeUrl: rpcUrl,
    };
}

interface WalletProviderProps {
    children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
    return (
        <StarknetConfig
            chains={chains}
            provider={jsonRpcProvider({ rpc })}
            connectors={connectors}
            autoConnect
        >
            {children}
        </StarknetConfig>
    );
}

export { chains, connectors };
