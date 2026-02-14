/**
 * Hook for sending stealth payments via the deposit pool + relayer
 *
 * Instead of calling the StealthPayment contract directly (which exposes the
 * sender on-chain), this hook:
 *   1. Deposits into the shared DepositPool (sender visible, but not tied to recipient)
 *   2. Asks the relayer to withdraw from the pool to the stealth address
 *   3. Announces the payment so the recipient can detect it
 */

import { useCallback, useState } from 'react';
import { useAccount, useSendTransaction } from '@starknet-react/core';
import { CONTRACTS } from '../lib/contracts';
import { deriveStealthAddress, type MetaAddress } from '../lib/crypto';
import { api } from '../lib/api';
import {
    createDepositNote,
    buildDepositCalldata,
    buildRelayRequest,
    saveNote,
} from '../lib/crypto/private-send';

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

const ETH_TOKEN = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

export function useSendStealthPayment() {
    const { address, isConnected } = useAccount();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { sendAsync } = useSendTransaction({});

    const sendPayment = useCallback(async (params: SendPaymentParams): Promise<SendPaymentResult | null> => {
        if (!isConnected || !address) {
            setError('Wallet not connected');
            return null;
        }

        const depositPoolAddress = CONTRACTS.DEPOSIT_POOL;
        if (!depositPoolAddress || depositPoolAddress === '0x0') {
            setError('Deposit pool contract not configured');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            // Derive stealth address from meta address
            const stealth = deriveStealthAddress(params.metaAddress);

            const tokenAddress = params.token || ETH_TOKEN;

            // ─── Step 1: Create deposit note ───────────────────────────
            const note = createDepositNote(params.amount, tokenAddress);

            // ─── Step 2: Deposit into the shared pool ──────────────────
            const { approve, deposit } = buildDepositCalldata(note, depositPoolAddress);
            const depositResult = await sendAsync([approve, deposit]);
            note.depositTxHash = depositResult.transaction_hash;
            saveNote(note);

            // ─── Step 3: Ask relayer to withdraw to stealth address ────
            const relayReq = buildRelayRequest(note, stealth.address);
            const relayResult = await api.submitRelay(relayReq);
            const finalTxHash = relayResult.transactionHash || depositResult.transaction_hash;

            // ─── Step 4: Announce the payment ──────────────────────────
            try {
                await api.announcePayment({
                    txHash: finalTxHash,
                    stealthAddress: stealth.address,
                    ephemeralPubKey: stealth.ephemeralPubKey,
                    amount: params.amount,
                    token: tokenAddress,
                    timestamp: new Date().toISOString(),
                });
            } catch (announceErr) {
                console.warn('Announcement failed, indexer will pick it up:', announceErr);
            }

            setLoading(false);
            return {
                txHash: finalTxHash,
                stealthAddress: stealth.address,
                ephemeralPubKey: stealth.ephemeralPubKey,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Transaction failed';
            setError(message);
            setLoading(false);
            return null;
        }
    }, [isConnected, address, sendAsync]);

    return {
        sendPayment,
        loading,
        error,
        isConnected,
        address,
    };
}
