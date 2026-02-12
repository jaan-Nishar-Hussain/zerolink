/**
 * Hook for sending stealth payments
 * 
 * Integrates wallet connection with stealth payment contract
 */

import { useCallback, useState } from 'react';
import { useAccount, useContract, useSendTransaction } from '@starknet-react/core';
import { CONTRACTS, STEALTH_PAYMENT_ABI } from '../lib/contracts';
import { deriveStealthAddress, type MetaAddress } from '../lib/crypto';

export interface SendPaymentParams {
    metaAddress: MetaAddress;
    amount: string;
    token?: string; // Contract address, undefined for ETH
}

export interface SendPaymentResult {
    txHash: string;
    stealthAddress: string;
    ephemeralPubKey: string;
}

export function useSendStealthPayment() {
    const { address, isConnected } = useAccount();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { contract } = useContract({
        address: CONTRACTS.STEALTH_PAYMENT,
        abi: STEALTH_PAYMENT_ABI,
    });

    const { sendAsync } = useSendTransaction({});

    const sendPayment = useCallback(async (params: SendPaymentParams): Promise<SendPaymentResult | null> => {
        if (!isConnected || !address) {
            setError('Wallet not connected');
            return null;
        }

        if (!contract) {
            setError('Contract not initialized');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            // Derive stealth address from meta address
            const stealth = deriveStealthAddress(params.metaAddress);

            // Split ephemeral public key into x and y coordinates
            // Assuming format is "x:y" from the crypto module
            const [ephemeralX, ephemeralY] = stealth.ephemeralPubKey.split(':');

            let calls;

            if (params.token) {
                // ERC20 token payment — approve + send_token
                calls = [
                    {
                        contractAddress: params.token,
                        entrypoint: 'approve',
                        calldata: [
                            CONTRACTS.STEALTH_PAYMENT,
                            params.amount,
                            '0', // amount high (for u256)
                        ],
                    },
                    {
                        contractAddress: CONTRACTS.STEALTH_PAYMENT,
                        entrypoint: 'send_token',
                        calldata: [
                            params.token,
                            stealth.address,
                            params.amount,
                            '0', // amount high (for u256)
                            ephemeralX,
                            ephemeralY,
                        ],
                    },
                ];
            } else {
                // ETH payment — approve + send_eth
                const ETH_TOKEN = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
                calls = [
                    {
                        contractAddress: ETH_TOKEN,
                        entrypoint: 'approve',
                        calldata: [
                            CONTRACTS.STEALTH_PAYMENT,
                            params.amount,
                            '0', // amount high (for u256)
                        ],
                    },
                    {
                        contractAddress: CONTRACTS.STEALTH_PAYMENT,
                        entrypoint: 'send_eth',
                        calldata: [
                            stealth.address,
                            params.amount,
                            '0', // amount high (for u256)
                            ephemeralX,
                            ephemeralY,
                        ],
                    },
                ];
            }

            const response = await sendAsync(calls);

            setLoading(false);
            return {
                txHash: response.transaction_hash,
                stealthAddress: stealth.address,
                ephemeralPubKey: stealth.ephemeralPubKey,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Transaction failed';
            setError(message);
            setLoading(false);
            return null;
        }
    }, [isConnected, address, contract, sendAsync]);

    return {
        sendPayment,
        loading,
        error,
        isConnected,
        address,
    };
}
