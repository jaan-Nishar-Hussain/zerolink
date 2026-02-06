import { openDB, type IDBPDatabase } from 'idb';
import type { StealthKeys } from './stealth';

const DB_NAME = 'zerolink-keys';
const DB_VERSION = 1;
const STORE_NAME = 'encrypted-keys';

interface EncryptedKeyStore {
    id: string;
    encryptedData: string;
    alias: string;
    createdAt: number;
}

let db: IDBPDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
async function getDB(): Promise<IDBPDatabase> {
    if (db) return db;

    db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        },
    });

    return db;
}

/**
 * Encrypt data using WebCrypto with a derived key from password
 */
async function encryptData(data: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

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
        ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        derivedKey,
        encoder.encode(data)
    );

    // Combine salt + iv + encrypted
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using WebCrypto
 */
async function decryptData(encryptedBase64: string, password: string): Promise<string> {
    const combined = new Uint8Array(
        atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
    );

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

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

    return new TextDecoder().decode(decrypted);
}

/**
 * Store encryption password hash for session validation
 */
function hashPassword(password: string): string {
    // Simple hash for session validation (NOT for security)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

/**
 * Save stealth keys to IndexedDB (encrypted)
 */
export async function saveKeys(
    keys: StealthKeys,
    alias: string,
    password: string
): Promise<void> {
    const database = await getDB();

    const keyData = JSON.stringify({
        spendPrivKey: Array.from(keys.spendKeyPair.privateKey),
        spendPubKey: Array.from(keys.spendKeyPair.publicKey),
        viewingPrivKey: Array.from(keys.viewingKeyPair.privateKey),
        viewingPubKey: Array.from(keys.viewingKeyPair.publicKey),
        metaAddress: keys.metaAddress,
    });

    const encryptedData = await encryptData(keyData, password);

    await database.put(STORE_NAME, {
        id: 'primary-keys',
        encryptedData,
        alias,
        createdAt: Date.now(),
    });

    // Store password hash in session storage for quick validation
    sessionStorage.setItem('zerolink-session', hashPassword(password));
}

/**
 * Load stealth keys from IndexedDB
 */
export async function loadKeys(password: string): Promise<StealthKeys | null> {
    const database = await getDB();
    const stored = await database.get(STORE_NAME, 'primary-keys') as EncryptedKeyStore | undefined;

    if (!stored) return null;

    try {
        const decryptedJson = await decryptData(stored.encryptedData, password);
        const keyData = JSON.parse(decryptedJson);

        return {
            spendKeyPair: {
                privateKey: new Uint8Array(keyData.spendPrivKey),
                publicKey: new Uint8Array(keyData.spendPubKey),
            },
            viewingKeyPair: {
                privateKey: new Uint8Array(keyData.viewingPrivKey),
                publicKey: new Uint8Array(keyData.viewingPubKey),
            },
            metaAddress: keyData.metaAddress,
        };
    } catch {
        console.error('Failed to decrypt keys - wrong password?');
        return null;
    }
}

/**
 * Check if keys exist in storage
 */
export async function hasStoredKeys(): Promise<boolean> {
    const database = await getDB();
    const stored = await database.get(STORE_NAME, 'primary-keys');
    return !!stored;
}

/**
 * Get stored alias
 */
export async function getStoredAlias(): Promise<string | null> {
    const database = await getDB();
    const stored = await database.get(STORE_NAME, 'primary-keys') as EncryptedKeyStore | undefined;
    return stored?.alias || null;
}

/**
 * Delete all stored keys
 */
export async function clearKeys(): Promise<void> {
    const database = await getDB();
    await database.delete(STORE_NAME, 'primary-keys');
    sessionStorage.removeItem('zerolink-session');
}

/**
 * Check if session is still valid
 */
export function isSessionValid(): boolean {
    return !!sessionStorage.getItem('zerolink-session');
}
