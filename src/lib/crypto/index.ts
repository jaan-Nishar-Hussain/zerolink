import * as secp from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// Helper to ensure private key is valid
function getRandomBytes(len: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(len));
}

export interface MetaAddress {
    spendingPublicKey: string; // hex
    viewingPublicKey: string;   // hex
}

export interface KeyPair {
    publicKey: string;  // hex
    privateKey: string; // hex
}

/**
 * Generate a new stealth identity (Meta Address)
 */
export function generateMetaAddress(): { metaAddress: MetaAddress; spendingPrivateKey: string; viewingPrivateKey: string } {
    const spendingPrivateKey = bytesToHex(getRandomBytes(32));
    const viewingPrivateKey = bytesToHex(getRandomBytes(32));

    const spendingPublicKey = bytesToHex(secp.getPublicKey(hexToBytes(spendingPrivateKey)));
    const viewingPublicKey = bytesToHex(secp.getPublicKey(hexToBytes(viewingPrivateKey)));

    return {
        metaAddress: {
            spendingPublicKey,
            viewingPublicKey
        },
        spendingPrivateKey,
        viewingPrivateKey
    };
}

/**
 * Payer: Generate stealth public key for a recipient's meta address
 */
export function generateStealthPublicKey(recipientMeta: MetaAddress): { stealthPublicKey: string; ephemeralPublicKey: string } {
    // 1. Generate ephemeral key pair
    const ephemeralPrivateKey = bytesToHex(getRandomBytes(32));
    const ephemeralPublicKey = bytesToHex(secp.getPublicKey(hexToBytes(ephemeralPrivateKey)));

    // 2. Compute shared secret: e * vG (ephemeral private * recipient view public)
    const sharedSecretPoint = secp.getSharedSecret(hexToBytes(ephemeralPrivateKey), hexToBytes(recipientMeta.viewingPublicKey));
    const sharedSecret = keccak_256(sharedSecretPoint); // hash the shared secret

    // 3. Compute stealth public key: P = S + hash(sharedSecret)G
    const h = bytesToHex(sharedSecret);
    const stealthPublicKeyPoint = secp.Point.fromHex(recipientMeta.spendingPublicKey)
        .add(secp.Point.BASE.multiply(BigInt('0x' + h)));

    return {
        stealthPublicKey: stealthPublicKeyPoint.toHex(),
        ephemeralPublicKey
    };
}

/**
 * Receiver: Compute stealth private key
 */
export function computeStealthPrivateKey(
    spendingPrivateKey: string,
    viewingPrivateKey: string,
    ephemeralPublicKey: string
): string {
    // 1. Compute shared secret: v * eG (recipient view private * ephemeral public)
    const sharedSecretPoint = secp.getSharedSecret(hexToBytes(viewingPrivateKey), hexToBytes(ephemeralPublicKey));
    const sharedSecret = keccak_256(sharedSecretPoint);

    // 2. Compute stealth private key: p = s + hash(v*eG)
    const h = BigInt('0x' + bytesToHex(sharedSecret));
    const s = BigInt('0x' + spendingPrivateKey);

    // p = (s + h) mod n
    const n = secp.Point.CURVE().n;
    const p = (s + h) % n;

    return p.toString(16).padStart(64, '0');
}
