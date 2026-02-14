/**
 * ZeroLink Private Amounts
 *
 * Hides the payment amount on-chain using Pedersen commitments.
 *
 * - Sender creates: commitment = Pedersen(amount, blinding)
 * - Sender encrypts (amount, blinding) with the ECDH shared secret
 *   so only the receiver can decrypt it.
 * - On-chain event stores `amount_commitment` and `encrypted_amount`
 *   instead of the plaintext amount.
 */

import { pedersen } from '@scure/starknet';
import { bytesToHex, hexToBytes, computeSharedSecret } from './stealth';

// ─── Types ─────────────────────────────────────────────────────────

export interface AmountCommitment {
    /** Pedersen(amount, blinding) as hex */
    commitment: string;
    /** Random blinding factor as hex */
    blinding: string;
}

export interface EncryptedAmount {
    /** Commitment stored on-chain */
    commitment: string;
    /** Encrypted blob (amount + blinding, XOR-ed with shared-secret hash) as hex */
    encrypted: string;
}

// ─── Commitment Creation (Sender) ─────────────────────────────────

/**
 * Create a Pedersen commitment to the amount.
 * commitment = Pedersen(amount_felt, blinding_felt)
 */
export function createAmountCommitment(amount: bigint): AmountCommitment {
    const blinding = crypto.getRandomValues(new Uint8Array(31));
    const blindingHex = '0x' + bytesToHex(blinding);
    const amountHex = '0x' + amount.toString(16);

    const commitment = '0x' + pedersen(amountHex, blindingHex);

    return { commitment, blinding: blindingHex };
}

/**
 * Encrypt (amount, blinding) using the ECDH shared secret so only
 * the receiver can decrypt.
 *
 * Encoding: XOR the 32-byte payload (16 bytes amount ‖ 16 bytes blinding)
 * with SHA-256(sharedSecret ‖ "amount").
 * This is a simple stream cipher — sufficient because each shared secret
 * is unique per ephemeral key.
 */
export function encryptAmountForReceiver(
    amount: bigint,
    blinding: string,
    ephemeralPrivateKey: Uint8Array,
    viewingPubKey: Uint8Array,
): string {
    const sharedSecret = computeSharedSecret(ephemeralPrivateKey, viewingPubKey);

    // Derive encryption key: SHA-256(sharedSecret ‖ "amount")
    const encoder = new TextEncoder();
    const keyMaterial = new Uint8Array([...sharedSecret, ...encoder.encode('amount')]);
    // Simple sync hash via the same sha256 used elsewhere
    const { sha256 } = require('@noble/hashes/sha2');
    const keyStream: Uint8Array = sha256(keyMaterial);

    // Encode amount (16 bytes big-endian) + blinding first 16 bytes
    const payload = new Uint8Array(32);
    const amountBytes = hexToBytes(amount.toString(16).padStart(32, '0'));
    payload.set(amountBytes.slice(0, 16), 0);

    const blindBytes = hexToBytes(blinding.startsWith('0x') ? blinding.slice(2) : blinding);
    payload.set(blindBytes.slice(0, 16), 16);

    // XOR
    const encrypted = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        encrypted[i] = payload[i] ^ keyStream[i];
    }

    return '0x' + bytesToHex(encrypted);
}

// ─── Decryption (Receiver) ────────────────────────────────────────

/**
 * Decrypt amount from an encrypted blob using the ECDH shared secret.
 * Returns { amount, blinding } or null if decryption / verification fails.
 */
export function decryptAmount(
    encryptedHex: string,
    commitmentHex: string,
    viewingPrivateKey: Uint8Array,
    ephemeralPubKey: Uint8Array,
): { amount: bigint; blinding: string } | null {
    try {
        const sharedSecret = computeSharedSecret(viewingPrivateKey, ephemeralPubKey);

        const encoder = new TextEncoder();
        const keyMaterial = new Uint8Array([...sharedSecret, ...encoder.encode('amount')]);
        const { sha256 } = require('@noble/hashes/sha2');
        const keyStream: Uint8Array = sha256(keyMaterial);

        const encrypted = hexToBytes(encryptedHex.startsWith('0x') ? encryptedHex.slice(2) : encryptedHex);

        // XOR to decrypt
        const payload = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            payload[i] = encrypted[i] ^ keyStream[i];
        }

        // Parse amount (first 16 bytes) and blinding (next 16 bytes)
        const amountHex = bytesToHex(payload.slice(0, 16));
        const amount = BigInt('0x' + amountHex);

        const blindingHex = '0x' + bytesToHex(payload.slice(16, 32)).padStart(62, '0');

        // Verify commitment: Pedersen(amount, blinding) == commitment
        const derived = '0x' + pedersen('0x' + amount.toString(16), blindingHex);
        if (derived.toLowerCase() !== commitmentHex.toLowerCase()) {
            return null; // commitment doesn't match — wrong key or corrupted data
        }

        return { amount, blinding: blindingHex };
    } catch {
        return null;
    }
}
