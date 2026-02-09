/**
 * ZeroLink Stealth Address Cryptography
 * 
 * Implements EIP-5564 style stealth addresses using secp256k1
 * Uses @noble/curves for all elliptic curve operations
 * Client-side only - NEVER send private keys to backend
 */

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex as toHex, hexToBytes as fromHex, concatBytes as concatBytesUtil } from '@noble/hashes/utils.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface KeyPair {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
}

export interface MetaAddress {
    spendPubKey: string;    // Hex-encoded compressed public key
    viewingPubKey: string;  // Hex-encoded compressed public key
}

export interface StealthKeys {
    spendKeyPair: KeyPair;
    viewingKeyPair: KeyPair;
    metaAddress: MetaAddress;
}

export interface StealthAddress {
    address: string;           // Starknet-compatible address
    ephemeralPubKey: string;   // Hex-encoded ephemeral public key
    stealthPubKey: string;     // Hex-encoded stealth public key
}

export interface DetectedPayment {
    stealthAddress: string;
    stealthPrivateKey: Uint8Array;
    ephemeralPubKey: string;
    amount: string;
    token: string;
    txHash: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
    return toHex(bytes);
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    return fromHex(cleanHex);
}

/**
 * Concatenate multiple byte arrays
 */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// secp256k1 curve order
const CURVE_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

/**
 * Modular addition of two scalars in secp256k1 field
 */
function modAdd(a: Uint8Array, b: Uint8Array): Uint8Array {
    const aNum = BigInt('0x' + bytesToHex(a));
    const bNum = BigInt('0x' + bytesToHex(b));
    const sum = (aNum + bNum) % CURVE_ORDER;
    const hexSum = sum.toString(16).padStart(64, '0');
    return hexToBytes(hexSum);
}

// =============================================================================
// KEY GENERATION (secp256k1)
// =============================================================================

/**
 * Generate a cryptographically secure random private key
 */
export function generatePrivateKey(): Uint8Array {
    return secp256k1.utils.randomSecretKey();
}

/**
 * Derive compressed public key from private key
 */
export function derivePublicKey(privateKey: Uint8Array): Uint8Array {
    return secp256k1.getPublicKey(privateKey, true); // compressed
}

/**
 * Generate a new keypair
 */
export function generateKeyPair(): KeyPair {
    const privateKey = generatePrivateKey();
    const publicKey = derivePublicKey(privateKey);
    return { privateKey, publicKey };
}

/**
 * Async version of generateKeyPair (for compatibility)
 */
export async function generateKeyPairAsync(): Promise<KeyPair> {
    return generateKeyPair();
}

/**
 * Generate complete stealth keys (spend + viewing keypairs)
 */
export function generateStealthKeys(): StealthKeys {
    const spendKeyPair = generateKeyPair();
    const viewingKeyPair = generateKeyPair();

    return {
        spendKeyPair,
        viewingKeyPair,
        metaAddress: {
            spendPubKey: bytesToHex(spendKeyPair.publicKey),
            viewingPubKey: bytesToHex(viewingKeyPair.publicKey),
        },
    };
}

// =============================================================================
// STEALTH ADDRESS DERIVATION (SENDER SIDE)
// 
// Protocol (EIP-5564 style):
// 1. Sender generates ephemeral keypair (r, R = r·G)
// 2. Sender computes shared secret S = r · viewingPub
// 3. Sender computes tweak = SHA256(S)
// 4. Sender computes stealth public key: P_stealth = spendPub + tweak·G
// 5. Sender derives address from stealth public key
// =============================================================================

/**
 * Compute ECDH shared secret between private key and public key
 * Returns the x-coordinate of the shared point
 */
export function computeSharedSecret(
    privateKey: Uint8Array,
    publicKey: Uint8Array
): Uint8Array {
    const sharedPoint = secp256k1.getSharedSecret(privateKey, publicKey, true);
    // Return x-coordinate (skip the prefix byte)
    return sharedPoint.slice(1, 33);
}

/**
 * Compute the tweak from shared secret
 */
export function computeTweak(sharedSecret: Uint8Array): Uint8Array {
    return sha256(sharedSecret);
}

/**
 * Add tweak to a public key (point addition: pubKey + tweak·G)
 */
export function addTweakToPublicKey(
    publicKey: Uint8Array,
    tweak: Uint8Array
): Uint8Array {
    // Compute tweak·G: derive public key from tweak as "private key"
    const tweakPubKeyBytes = secp256k1.getPublicKey(tweak, true);
    const tweakPoint = secp256k1.Point.fromHex(bytesToHex(tweakPubKeyBytes));

    // Parse the public key point
    const pubPoint = secp256k1.Point.fromHex(bytesToHex(publicKey));

    // Add points: pubKey + tweak·G
    const stealthPoint = pubPoint.add(tweakPoint);

    // Return compressed format
    return stealthPoint.toBytes(true);
}

/**
 * Convert public key to Starknet-compatible address
 * Uses the lower 251 bits of the hash
 */
export function publicKeyToStarknetAddress(publicKey: Uint8Array): string {
    const hash = sha256(publicKey);
    // Take first 31 bytes and convert to hex (248 bits, within 251 bit limit)
    const addressBytes = hash.slice(0, 31);
    return '0x' + bytesToHex(addressBytes);
}

/**
 * Derive stealth address from meta address (SENDER SIDE)
 * This is the main function senders use to create a payment destination
 */
export function deriveStealthAddress(metaAddress: MetaAddress): StealthAddress {
    // 1. Generate ephemeral keypair
    const ephemeralKeyPair = generateKeyPair();

    // 2. Parse recipient's keys
    const viewingPubKey = hexToBytes(metaAddress.viewingPubKey);
    const spendPubKey = hexToBytes(metaAddress.spendPubKey);

    // 3. Compute shared secret: S = ephemeralPriv · viewingPub
    const sharedSecret = computeSharedSecret(ephemeralKeyPair.privateKey, viewingPubKey);

    // 4. Compute tweak: t = SHA256(S)
    const tweak = computeTweak(sharedSecret);

    // 5. Compute stealth public key: P_stealth = spendPub + t·G
    const stealthPubKey = addTweakToPublicKey(spendPubKey, tweak);

    // 6. Derive Starknet address from stealth public key
    const address = publicKeyToStarknetAddress(stealthPubKey);

    return {
        address,
        ephemeralPubKey: bytesToHex(ephemeralKeyPair.publicKey),
        stealthPubKey: bytesToHex(stealthPubKey),
    };
}

/**
 * Async version of deriveStealthAddress (for compatibility)
 */
export async function deriveStealthAddressAsync(metaAddress: MetaAddress): Promise<StealthAddress> {
    return deriveStealthAddress(metaAddress);
}

// =============================================================================
// STEALTH KEY DERIVATION (RECEIVER SIDE)
// 
// Protocol:
// 1. Receiver computes shared secret S = viewingPriv · ephemeralPub
// 2. Receiver computes tweak = SHA256(S)
// 3. Receiver computes stealth private key: s_stealth = spendPriv + tweak (mod n)
// =============================================================================

/**
 * Derive stealth private key from ephemeral public key (RECEIVER SIDE)
 * This allows the receiver to spend funds sent to the stealth address
 */
export function deriveStealthPrivateKey(
    viewingPrivateKey: Uint8Array,
    spendPrivateKey: Uint8Array,
    ephemeralPubKey: Uint8Array
): Uint8Array {
    // 1. Compute shared secret: S = viewingPriv · ephemeralPub
    const sharedSecret = computeSharedSecret(viewingPrivateKey, ephemeralPubKey);

    // 2. Compute tweak: t = SHA256(S)
    const tweak = computeTweak(sharedSecret);

    // 3. Compute stealth private key: s_stealth = spendPriv + t (mod n)
    const stealthPrivateKey = modAdd(spendPrivateKey, tweak);

    return stealthPrivateKey;
}

/**
 * Verify that an announcement belongs to this receiver
 * Returns the stealth private key if it matches, null otherwise
 */
export function checkStealthPayment(
    viewingPrivateKey: Uint8Array,
    spendPrivateKey: Uint8Array,
    spendPublicKey: Uint8Array,
    ephemeralPubKeyHex: string,
    expectedAddress: string
): { stealthPrivKey: Uint8Array; stealthAddress: string } | null {
    const ephemeralPubKey = hexToBytes(ephemeralPubKeyHex);

    // Compute shared secret
    const sharedSecret = computeSharedSecret(viewingPrivateKey, ephemeralPubKey);

    // Compute tweak
    const tweak = computeTweak(sharedSecret);

    // Compute expected stealth public key
    const stealthPubKey = addTweakToPublicKey(spendPublicKey, tweak);

    // Derive address
    const derivedAddress = publicKeyToStarknetAddress(stealthPubKey);

    // Check if it matches
    if (derivedAddress.toLowerCase() === expectedAddress.toLowerCase()) {
        // It's ours! Derive the private key
        const stealthPrivKey = modAdd(spendPrivateKey, tweak);
        return { stealthPrivKey, stealthAddress: derivedAddress };
    }

    return null;
}

/**
 * Scan a list of announcements for payments belonging to this receiver
 */
export function detectPayments(
    viewingPrivateKey: Uint8Array,
    spendPrivateKey: Uint8Array,
    spendPublicKey: Uint8Array,
    announcements: Array<{
        ephemeralPubKey: string;
        stealthAddress: string;
        amount: string;
        token: string;
        txHash: string;
    }>
): DetectedPayment[] {
    const detected: DetectedPayment[] = [];

    for (const announcement of announcements) {
        const result = checkStealthPayment(
            viewingPrivateKey,
            spendPrivateKey,
            spendPublicKey,
            announcement.ephemeralPubKey,
            announcement.stealthAddress
        );

        if (result) {
            detected.push({
                stealthAddress: result.stealthAddress,
                stealthPrivateKey: result.stealthPrivKey,
                ephemeralPubKey: announcement.ephemeralPubKey,
                amount: announcement.amount,
                token: announcement.token,
                txHash: announcement.txHash,
            });
        }
    }

    return detected;
}

// =============================================================================
// KEY EXPORT/IMPORT (Encrypted Backup)
// =============================================================================

/**
 * Export keys as encrypted backup using WebCrypto
 */
export async function exportKeysEncrypted(
    keys: StealthKeys,
    password: string
): Promise<string> {
    const keyData = {
        spendPrivKey: bytesToHex(keys.spendKeyPair.privateKey),
        viewingPrivKey: bytesToHex(keys.viewingKeyPair.privateKey),
        metaAddress: keys.metaAddress,
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(keyData));

    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const derivedKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        data
    );

    const result = concatBytes(salt, iv, new Uint8Array(encrypted));
    return bytesToHex(result);
}

/**
 * Import keys from encrypted backup
 */
export async function importKeysEncrypted(
    encryptedHex: string,
    password: string
): Promise<StealthKeys> {
    const data = hexToBytes(encryptedHex);

    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encrypted = data.slice(28);

    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const derivedKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        encrypted
    );

    const decoder = new TextDecoder();
    const keyData = JSON.parse(decoder.decode(decrypted));

    const spendPrivKey = hexToBytes(keyData.spendPrivKey);
    const viewingPrivKey = hexToBytes(keyData.viewingPrivKey);

    // Regenerate public keys from private keys using real EC math
    const spendPubKey = derivePublicKey(spendPrivKey);
    const viewingPubKey = derivePublicKey(viewingPrivKey);

    return {
        spendKeyPair: {
            privateKey: spendPrivKey,
            publicKey: spendPubKey,
        },
        viewingKeyPair: {
            privateKey: viewingPrivKey,
            publicKey: viewingPubKey,
        },
        metaAddress: keyData.metaAddress,
    };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Verify that a private key is valid for secp256k1
 */
export function isValidPrivateKey(privateKey: Uint8Array): boolean {
    try {
        secp256k1.getPublicKey(privateKey);
        return true;
    } catch {
        return false;
    }
}

/**
 * Verify that a public key is valid for secp256k1
 */
export function isValidPublicKey(publicKeyHex: string): boolean {
    try {
        secp256k1.Point.fromHex(publicKeyHex);
        return true;
    } catch {
        return false;
    }
}

/**
 * Sign a message hash with a private key
 */
export function signMessage(privateKey: Uint8Array, messageHash: Uint8Array): Uint8Array {
    const signature = secp256k1.sign(messageHash, privateKey, { prehash: false });
    return signature;
}

/**
 * Verify a signature
 */
export function verifySignature(
    signature: Uint8Array,
    messageHash: Uint8Array,
    publicKey: Uint8Array
): boolean {
    try {
        return secp256k1.verify(signature, messageHash, publicKey);
    } catch {
        return false;
    }
}
/**
 * Parse a public key hex into X and Y coordinates (as hex strings)
 * Truncates to fit within Starknet felt252 (251 bits max)
 */
export function parsePublicKeyToCoordinates(publicKeyHex: string): { x: string, y: string } {
    const point = secp256k1.Point.fromHex(publicKeyHex);

    // Starknet felt252 can hold values up to 2^251 - 1
    // secp256k1 coordinates are 256-bit, so we need to truncate
    const FELT_MAX = (BigInt(1) << BigInt(251)) - BigInt(1);

    // Mask to keep only the lower 251 bits
    const xTruncated = point.x & FELT_MAX;
    const yTruncated = point.y & FELT_MAX;

    return {
        x: '0x' + xTruncated.toString(16),
        y: '0x' + yTruncated.toString(16)
    };
}
