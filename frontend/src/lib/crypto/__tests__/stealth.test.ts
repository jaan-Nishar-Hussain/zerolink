/**
 * ZeroLink Stealth Cryptography Tests
 *
 * Run with: npx vitest run src/lib/crypto/__tests__/stealth.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    generateStealthKeys,
    deriveStealthAddress,
    checkStealthPayment,
    detectPayments,
    deriveStealthPrivateKey,
    derivePublicKey,
    publicKeyToStarknetAddress,
    bytesToHex,
    hexToBytes,
    isValidPrivateKey,
    isValidPublicKey,
    exportKeysEncrypted,
    importKeysEncrypted,
    type StealthKeys,
    type MetaAddress,
} from '../stealth';

// ────────────────────────────────────────────────────────────────────
// 1. Key generation produces valid secp256k1 keys
// ────────────────────────────────────────────────────────────────────

describe('Key Generation', () => {
    it('generates valid spend and viewing keypairs', () => {
        const keys = generateStealthKeys();

        // Private keys are 32 bytes
        expect(keys.spendKeyPair.privateKey.length).toBe(32);
        expect(keys.viewingKeyPair.privateKey.length).toBe(32);

        // Public keys are 33 bytes (compressed)
        expect(keys.spendKeyPair.publicKey.length).toBe(33);
        expect(keys.viewingKeyPair.publicKey.length).toBe(33);

        // Validate via the library helper
        expect(isValidPrivateKey(keys.spendKeyPair.privateKey)).toBe(true);
        expect(isValidPrivateKey(keys.viewingKeyPair.privateKey)).toBe(true);

        expect(isValidPublicKey(keys.metaAddress.spendPubKey)).toBe(true);
        expect(isValidPublicKey(keys.metaAddress.viewingPubKey)).toBe(true);
    });

    it('spend and viewing keys are different', () => {
        const keys = generateStealthKeys();
        expect(bytesToHex(keys.spendKeyPair.privateKey)).not.toBe(
            bytesToHex(keys.viewingKeyPair.privateKey),
        );
    });

    it('public key derivation is deterministic', () => {
        const keys = generateStealthKeys();
        const pub1 = derivePublicKey(keys.spendKeyPair.privateKey);
        const pub2 = derivePublicKey(keys.spendKeyPair.privateKey);
        expect(bytesToHex(pub1)).toBe(bytesToHex(pub2));
    });
});

// ────────────────────────────────────────────────────────────────────
// 2. Stealth derivation roundtrip
// ────────────────────────────────────────────────────────────────────

describe('Stealth Address Derivation Roundtrip', () => {
    it('sender derives address → receiver detects it', () => {
        const receiverKeys = generateStealthKeys();

        // Sender side
        const stealth = deriveStealthAddress(receiverKeys.metaAddress);
        expect(stealth.address).toBeTruthy();
        expect(stealth.ephemeralPubKey).toBeTruthy();

        // Receiver side — detect
        const result = checkStealthPayment(
            receiverKeys.viewingKeyPair.privateKey,
            receiverKeys.spendKeyPair.privateKey,
            receiverKeys.spendKeyPair.publicKey,
            stealth.ephemeralPubKey,
            stealth.address,
        );

        expect(result).not.toBeNull();
        expect(result!.stealthAddress.toLowerCase()).toBe(stealth.address.toLowerCase());
    });

    it('wrong receiver does NOT detect the payment', () => {
        const receiverKeys = generateStealthKeys();
        const wrongKeys = generateStealthKeys();

        const stealth = deriveStealthAddress(receiverKeys.metaAddress);

        const result = checkStealthPayment(
            wrongKeys.viewingKeyPair.privateKey,
            wrongKeys.spendKeyPair.privateKey,
            wrongKeys.spendKeyPair.publicKey,
            stealth.ephemeralPubKey,
            stealth.address,
        );

        expect(result).toBeNull();
    });

    it('derived stealth private key can reproduce the stealth address', () => {
        const receiverKeys = generateStealthKeys();
        const stealth = deriveStealthAddress(receiverKeys.metaAddress);

        const stealthPriv = deriveStealthPrivateKey(
            receiverKeys.viewingKeyPair.privateKey,
            receiverKeys.spendKeyPair.privateKey,
            hexToBytes(stealth.ephemeralPubKey),
        );

        const stealthPub = derivePublicKey(stealthPriv);
        const derivedAddr = publicKeyToStarknetAddress(stealthPub);

        expect(derivedAddr.toLowerCase()).toBe(stealth.address.toLowerCase());
    });
});

// ────────────────────────────────────────────────────────────────────
// 3. detectPayments finds correct announcement among decoys
// ────────────────────────────────────────────────────────────────────

describe('detectPayments with decoys', () => {
    it('finds the real payment among 100 decoy announcements', () => {
        const receiverKeys = generateStealthKeys();

        // Create the real stealth address
        const realStealth = deriveStealthAddress(receiverKeys.metaAddress);

        // Build 100 decoy announcements (random ephemeral keys + random addresses)
        const announcements = Array.from({ length: 100 }, (_, i) => {
            const decoyKeys = generateStealthKeys();
            const decoyStealth = deriveStealthAddress(decoyKeys.metaAddress);
            return {
                ephemeralPubKey: decoyStealth.ephemeralPubKey,
                stealthAddress: decoyStealth.address,
                amount: `${(i + 1) * 1000}`,
                token: '0x0',
                txHash: `0xdecoy${i.toString().padStart(4, '0')}`,
            };
        });

        // Insert the real one at a random position
        const realAnnouncement = {
            ephemeralPubKey: realStealth.ephemeralPubKey,
            stealthAddress: realStealth.address,
            amount: '42000',
            token: '0x0',
            txHash: '0xreal_payment',
        };
        const insertIdx = Math.floor(Math.random() * 100);
        announcements.splice(insertIdx, 0, realAnnouncement);

        // Detect
        const detected = detectPayments(
            receiverKeys.viewingKeyPair.privateKey,
            receiverKeys.spendKeyPair.privateKey,
            receiverKeys.spendKeyPair.publicKey,
            announcements,
        );

        expect(detected.length).toBe(1);
        expect(detected[0].txHash).toBe('0xreal_payment');
        expect(detected[0].amount).toBe('42000');
        expect(detected[0].stealthAddress.toLowerCase()).toBe(realStealth.address.toLowerCase());
    });
});

// ────────────────────────────────────────────────────────────────────
// 4. exportKeysEncrypted → importKeysEncrypted roundtrip
// ────────────────────────────────────────────────────────────────────

describe('Encrypted Key Backup', () => {
    it('roundtrip: export then import recovers identical keys', async () => {
        const keys = generateStealthKeys();
        const password = 'super-secret-password-2026';

        const encrypted = await exportKeysEncrypted(keys, password);
        expect(typeof encrypted).toBe('string');
        expect(encrypted.length).toBeGreaterThan(0);

        const restored = await importKeysEncrypted(encrypted, password);

        // Private keys match
        expect(bytesToHex(restored.spendKeyPair.privateKey)).toBe(
            bytesToHex(keys.spendKeyPair.privateKey),
        );
        expect(bytesToHex(restored.viewingKeyPair.privateKey)).toBe(
            bytesToHex(keys.viewingKeyPair.privateKey),
        );

        // Public keys match
        expect(bytesToHex(restored.spendKeyPair.publicKey)).toBe(
            bytesToHex(keys.spendKeyPair.publicKey),
        );
        expect(bytesToHex(restored.viewingKeyPair.publicKey)).toBe(
            bytesToHex(keys.viewingKeyPair.publicKey),
        );

        // Meta address matches
        expect(restored.metaAddress.spendPubKey).toBe(keys.metaAddress.spendPubKey);
        expect(restored.metaAddress.viewingPubKey).toBe(keys.metaAddress.viewingPubKey);
    });

    // ────────────────────────────────────────────────────────────────
    // 5. Wrong password fails decryption gracefully
    // ────────────────────────────────────────────────────────────────

    it('wrong password throws during import', async () => {
        const keys = generateStealthKeys();
        const encrypted = await exportKeysEncrypted(keys, 'correct-password');

        await expect(
            importKeysEncrypted(encrypted, 'wrong-password'),
        ).rejects.toThrow();
    });
});
