/**
 * ZeroLink Real-Time Payment Notifications (Frontend)
 *
 * Connects to the backend SSE stream and checks each new announcement
 * against the user's viewing key to detect incoming stealth payments.
 */

import { checkStealthPayment, type StealthKeys } from './crypto/stealth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface NotificationPayment {
    stealthAddress: string;
    ephemeralPubKey: string;
    amount: string;
    token: string;
    txHash: string;
    blockNumber: string;
    timestamp: string;
}

/**
 * Subscribe to the backend SSE stream.
 * Each announcement is checked client-side; only matching payments trigger the callback.
 *
 * @returns A cleanup function that closes the EventSource.
 */
export function subscribeToPayments(
    keys: StealthKeys,
    onPayment: (payment: NotificationPayment) => void,
    onError?: (err: Event) => void,
): () => void {
    const es = new EventSource(`${API}/notifications/stream`);

    es.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type !== 'announcement') return;

            const result = checkStealthPayment(
                keys.viewingKeyPair.privateKey,
                keys.spendKeyPair.privateKey,
                keys.spendKeyPair.publicKey,
                data.ephemeralPubKey,
                data.stealthAddress,
            );

            if (result) {
                onPayment({
                    stealthAddress: data.stealthAddress,
                    ephemeralPubKey: data.ephemeralPubKey,
                    amount: data.amount,
                    token: data.token,
                    txHash: data.txHash,
                    blockNumber: data.blockNumber,
                    timestamp: data.timestamp,
                });
            }
        } catch {
            // ignore parse errors for non-JSON heartbeat messages
        }
    };

    es.onerror = (err) => {
        onError?.(err);
    };

    return () => es.close();
}
