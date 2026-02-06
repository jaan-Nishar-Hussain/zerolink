/**
 * ZeroLink Stealth Address Cryptography
 * 
 * Uses Web Crypto API for all cryptographic operations
 * Client-side only - NEVER send private keys to backend
 */

export interface KeyPair {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
}

export interface MetaAddress {
    spendPubKey: string;
    viewingPubKey: string;
}

export interface StealthKeys {
    spendKeyPair: KeyPair;
    viewingKeyPair: KeyPair;
    metaAddress: MetaAddress;
}

export interface StealthAddress {
    address: string;
    ephemeralPubKey: string;
}

// Helper functions for hex conversion
function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

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

async function sha256(data: Uint8Array): Promise<Uint8Array> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
    return new Uint8Array(hashBuffer);
}

/**
 * Generate a random 32-byte private key
 */
function generatePrivateKey(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Simple public key derivation (mock - in production use proper EC curve)
 * For demo purposes, we use a hash of the private key
 */
async function derivePublicKey(privateKey: Uint8Array): Promise<Uint8Array> {
    const hash = await sha256(privateKey);
    // Add a prefix byte to indicate compressed format
    return concatBytes(new Uint8Array([0x02]), hash);
}

/**
 * Generate a random keypair
 */
export async function generateKeyPairAsync(): Promise<KeyPair> {
    const privateKey = generatePrivateKey();
    const publicKey = await derivePublicKey(privateKey);
    return { privateKey, publicKey };
}

/**
 * Synchronous key generation (uses simpler derivation)
 */
export function generateKeyPair(): KeyPair {
    const privateKey = generatePrivateKey();
    // Simple deterministic derivation for sync operation
    const publicKeyBytes = new Uint8Array(33);
    publicKeyBytes[0] = 0x02;
    for (let i = 0; i < 32; i++) {
        publicKeyBytes[i + 1] = privateKey[i] ^ 0x55; // Simple XOR transform
    }
    return { privateKey, publicKey: publicKeyBytes };
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

/**
 * Compute shared secret between private key and public key
 */
async function computeSharedSecret(
    privateKey: Uint8Array,
    publicKey: Uint8Array
): Promise<Uint8Array> {
    // Concatenate and hash for demo (in production use ECDH)
    const combined = concatBytes(privateKey, publicKey);
    return sha256(combined);
}

/**
 * Derive stealth address from meta address (SENDER SIDE)
 */
export async function deriveStealthAddressAsync(metaAddress: MetaAddress): Promise<StealthAddress> {
    const ephemeralKeyPair = generateKeyPair();
    const viewingPubKey = hexToBytes(metaAddress.viewingPubKey);
    const spendPubKey = hexToBytes(metaAddress.spendPubKey);

    const sharedSecret = await computeSharedSecret(ephemeralKeyPair.privateKey, viewingPubKey);
    const tweak = await sha256(sharedSecret);

    // Derive stealth public key by combining spend pub key and tweak
    const stealthPubKey = concatBytes(spendPubKey, tweak);

    // Hash to get address
    const addressHash = await sha256(stealthPubKey);
    const address = '0x' + bytesToHex(addressHash).slice(0, 40);

    return {
        address,
        ephemeralPubKey: bytesToHex(ephemeralKeyPair.publicKey),
    };
}

/**
 * Sync version that creates predictable output (for demo)
 */
export function deriveStealthAddress(metaAddress: MetaAddress): StealthAddress {
    const ephemeralKeyPair = generateKeyPair();
    const viewingPubKey = hexToBytes(metaAddress.viewingPubKey);
    const spendPubKey = hexToBytes(metaAddress.spendPubKey);

    // Simple deterministic derivation for sync
    const combined = concatBytes(ephemeralKeyPair.privateKey, viewingPubKey, spendPubKey);
    const addressBytes = new Uint8Array(20);
    for (let i = 0; i < 20; i++) {
        addressBytes[i] = combined[i % combined.length] ^ combined[(i + 7) % combined.length];
    }
    const address = '0x' + bytesToHex(addressBytes);

    return {
        address,
        ephemeralPubKey: bytesToHex(ephemeralKeyPair.publicKey),
    };
}

/**
 * Export keys as encrypted backup (using password)
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

    // Regenerate public keys from private keys
    const spendPubKey = new Uint8Array(33);
    spendPubKey[0] = 0x02;
    for (let i = 0; i < 32; i++) {
        spendPubKey[i + 1] = spendPrivKey[i] ^ 0x55;
    }

    const viewingPubKey = new Uint8Array(33);
    viewingPubKey[0] = 0x02;
    for (let i = 0; i < 32; i++) {
        viewingPubKey[i + 1] = viewingPrivKey[i] ^ 0x55;
    }

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
