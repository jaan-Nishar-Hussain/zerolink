import { describe, it, expect } from 'vitest';
import { generateMetaAddress, generateStealthPublicKey, computeStealthPrivateKey } from './index.js';

describe('Stealth Identity Cryptography', () => {
    it('should generate a valid meta address', () => {
        const { metaAddress, spendingPrivateKey, viewingPrivateKey } = generateMetaAddress();

        expect(metaAddress.spendingPublicKey).toBeDefined();
        expect(metaAddress.viewingPublicKey).toBeDefined();
        expect(spendingPrivateKey).toBeDefined();
        expect(viewingPrivateKey).toBeDefined();
        expect(metaAddress.spendingPublicKey.length).toBeGreaterThan(60);
    });

    it('should derive the same shared secret for payer and receiver', () => {
        // 1. Setup recipient
        const recipient = generateMetaAddress();

        // 2. Payer generates stealth info
        const { stealthPublicKey, ephemeralPublicKey } = generateStealthPublicKey(recipient.metaAddress);

        // 3. Receiver computes stealth private key
        const derivedPrivateKey = computeStealthPrivateKey(
            recipient.spendingPrivateKey,
            recipient.viewingPrivateKey,
            ephemeralPublicKey
        );

        expect(derivedPrivateKey).toBeDefined();
        expect(derivedPrivateKey.length).toBe(64);
    });
});
