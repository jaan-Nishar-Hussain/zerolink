/**
 * ZeroLink Deterministic Rescan
 *
 * Re-scans all on-chain announcements from the backend and detects
 * payments that belong to the current user.  Useful after restoring
 * a key backup or if the local store missed any events.
 */

import { detectPayments, type StealthKeys, type DetectedPayment } from './stealth';
import { api } from '../api';

export interface RescanProgress {
    scanned: number;
    found: number;
    total: number;
}

/**
 * Fetch all announcements in pages and detect owned payments.
 *
 * @param keys       - The user's stealth key set
 * @param fromBlock  - Start scanning from this block (default '0')
 * @param onProgress - Optional progress callback
 * @returns Array of detected payments belonging to this user
 */
export async function rescanPayments(
    keys: StealthKeys,
    fromBlock = '0',
    onProgress?: (progress: RescanProgress) => void,
): Promise<DetectedPayment[]> {
    const allDetected: DetectedPayment[] = [];
    let cursor = fromBlock;
    let totalScanned = 0;
    const PAGE_SIZE = 500;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { announcements, count } = await api.scanAnnouncements(cursor, PAGE_SIZE);

        if (count === 0) break;

        const detected = detectPayments(
            keys.viewingKeyPair.privateKey,
            keys.spendKeyPair.privateKey,
            keys.spendKeyPair.publicKey,
            announcements.map((a) => ({
                ephemeralPubKey: a.ephemeralPubKey,
                stealthAddress: a.stealthAddress,
                amount: a.amount,
                token: a.token,
                txHash: a.txHash,
            })),
        );

        allDetected.push(...detected);
        totalScanned += count;

        onProgress?.({
            scanned: totalScanned,
            found: allDetected.length,
            total: totalScanned, // backend doesn't expose grand total
        });

        // Advance cursor to the next page
        const lastBlock = announcements[announcements.length - 1]?.blockNumber;
        if (!lastBlock || count < PAGE_SIZE) break;
        cursor = (BigInt(lastBlock) + 1n).toString();
    }

    return allDetected;
}
