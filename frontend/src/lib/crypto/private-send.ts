/**
 * ZeroLink Private Send Flow
 *
 * Implements the deposit-pool-based send that hides the sender:
 *
 *   1. Sender generates a random secret + nullifier
 *   2. commitment = Pedersen(secret, nullifier)
 *   3. Sender deposits (commitment, token, amount) into DepositPool
 *   4. Sender stores the "deposit note" locally (secret, nullifier, amount, token)
 *   5. Relayer later calls DepositPool.withdraw(...) to pay the stealth address
 *      without linking sender ↔ recipient on-chain
 */

import { pedersen } from '@scure/starknet';
import { bytesToHex, hexToBytes } from './stealth';

// ─── Types ─────────────────────────────────────────────────────────

export interface DepositNote {
    /** Random secret used to build the commitment */
    secret: string;
    /** Random nullifier – its hash prevents double-spend */
    nullifier: string;
    /** Pedersen(secret, nullifierHash) commitment stored on-chain */
    commitment: string;
    /** Deposited amount (as decimal string) */
    amount: string;
    /** Token contract address */
    token: string;
    /** Deposit transaction hash */
    depositTxHash?: string;
    /** Unix ms timestamp */
    createdAt: number;
}

export interface PrivateSendParams {
    /** Recipient stealth address */
    stealthAddress: string;
    /** Amount to send (decimal string) */
    amount: string;
    /** Token contract address */
    token: string;
}

// ─── Helpers ───────────────────────────────────────────────────────

function randomFelt(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(31)); // < 252 bits
    return '0x' + bytesToHex(bytes);
}

/**
 * Compute the nullifier hash: Pedersen(nullifier, 0)
 * (0 is a domain separator to differentiate from commitment derivation)
 *
 * We pass BigInt to pedersen() because it returns hex strings that can have
 * odd length (e.g. 63 chars), and re-feeding those into pedersen() causes
 * "Input string must contain hex characters in even length" from Uint8Array.fromHex.
 */
function nullifierHash(nullifier: string): string {
    return pedersen(BigInt(nullifier), 0n).toString();
}

// ─── Core Functions ────────────────────────────────────────────────

/**
 * Create a deposit note off-chain.
 * Returns the note (save it locally!) and the commitment to send on-chain.
 */
export function createDepositNote(amount: string, token: string): DepositNote {
    const secret = randomFelt();
    const nullifier = randomFelt();

    // commitment = Pedersen(secret, nullifierHash)
    const nHash = nullifierHash(nullifier);
    const commitment = pedersen(BigInt(secret), BigInt(nHash)).toString();

    return {
        secret,
        nullifier,
        commitment,
        amount,
        token,
        createdAt: Date.now(),
    };
}

/**
 * Build the calldata array for DepositPool.deposit(commitment, token, amount).
 * The caller should wrap this in the approve + deposit multicall.
 */
export function buildDepositCalldata(note: DepositNote, depositPoolAddress: string) {
    // u256 is split into (low, high) for Starknet calldata
    const amountBig = BigInt(note.amount);
    const low = (amountBig & ((1n << 128n) - 1n)).toString();
    const high = (amountBig >> 128n).toString();

    return {
        approve: {
            contractAddress: note.token,
            entrypoint: 'approve',
            calldata: [depositPoolAddress, low, high],
        },
        deposit: {
            contractAddress: depositPoolAddress,
            entrypoint: 'deposit',
            calldata: [note.commitment, note.token, low, high],
        },
    };
}

/**
 * Build the relay request body that the relayer needs to call
 * DepositPool.withdraw on-chain.
 */
export function buildRelayRequest(
    note: DepositNote,
    recipientStealthAddress: string,
) {
    const nHash = nullifierHash(note.nullifier);
    return {
        nullifierHash: nHash,
        commitment: note.commitment,
        recipient: recipientStealthAddress,
        amount: note.amount,
        token: note.token,
        secret: note.secret,
    };
}

// ─── Local Storage Helpers ────────────────────────────────────────

const NOTES_KEY = 'zerolink_deposit_notes';

export function saveNote(note: DepositNote): void {
    const notes = loadNotes();
    notes.push(note);
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export function loadNotes(): DepositNote[] {
    try {
        const raw = localStorage.getItem(NOTES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function deleteNote(commitment: string): void {
    const notes = loadNotes().filter((n) => n.commitment !== commitment);
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}
