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
 *
 * Privacy: deposits use **fixed denominations** (like Tornado Cash) so that
 * all deposits in a tier are indistinguishable. If a user wants to send 5 tokens,
 * the system splits it into 5 × 1-token deposits.
 */

import { pedersen } from '@scure/starknet';
import { bytesToHex } from './stealth';

// ─── Fixed Denominations ──────────────────────────────────────────

/** Valid denominations in wei (must match the on-chain DepositPool contract) */
export const DENOMINATIONS = [
    { label: '1', wei: '1000000000000000000' },      // 1 token
    { label: '10', wei: '10000000000000000000' },     // 10 tokens
    { label: '100', wei: '100000000000000000000' },   // 100 tokens
] as const;

/** Map wei string → human-readable label */
const WEI_TO_LABEL: Record<string, string> = {};
for (const d of DENOMINATIONS) {
    WEI_TO_LABEL[d.wei] = d.label;
}

/**
 * Split an arbitrary amount (in human units, e.g. "5") into the minimum set
 * of fixed-denomination deposits.
 *
 * Example: splitAmount("25") → [
 *   { wei: "10000000000000000000", count: 2 },
 *   { wei: "1000000000000000000",  count: 5 },
 * ]
 *
 * Returns null if the amount cannot be represented with the available
 * denominations (e.g. "0.5" when smallest tier is 1).
 */
export function splitAmountIntoDenominations(
    amountHuman: string,
): { wei: string; label: string; count: number }[] | null {
    let remaining = parseFloat(amountHuman);
    if (remaining <= 0 || !Number.isFinite(remaining)) return null;

    const result: { wei: string; label: string; count: number }[] = [];

    // Sort denominations largest-first for greedy split
    const sorted = [...DENOMINATIONS].sort(
        (a, b) => parseFloat(b.label) - parseFloat(a.label),
    );

    for (const denom of sorted) {
        const denomValue = parseFloat(denom.label);
        const count = Math.floor(remaining / denomValue);
        if (count > 0) {
            result.push({ wei: denom.wei, label: denom.label, count });
            remaining -= count * denomValue;
            // Float precision guard
            remaining = Math.round(remaining * 1e12) / 1e12;
        }
    }

    if (remaining > 0) return null; // cannot represent exactly

    return result;
}

// ─── Types ─────────────────────────────────────────────────────────

export interface DepositNote {
    /** Random secret used to build the commitment */
    secret: string;
    /** Random nullifier – its hash prevents double-spend */
    nullifier: string;
    /** Pedersen(secret, nullifierHash) commitment stored on-chain */
    commitment: string;
    /** Deposited amount (as decimal string, in wei) */
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
