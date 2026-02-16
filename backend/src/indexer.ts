/**
 * ZeroLink Event Indexer
 * 
 * Monitors Starknet for stealth payment announcements
 * Stores them in the database for recipient detection
 */

import { prisma } from './db';
import { broadcast } from './routes/notifications';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly from the backend directory so it works regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Configuration
const STARKNET_RPC = process.env.STARKNET_RPC_URL || 'https://free-rpc.nethermind.io/sepolia-juno';
const EVENT_EMITTER_CONTRACT = process.env.EVENT_EMITTER_CONTRACT || '0x0';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100');

// Event signature for StealthPaymentAnnouncement
// sn_keccak("StealthPaymentAnnouncement") — computed via starknet.js hash.getSelectorFromName
const STEALTH_ANNOUNCEMENT_KEY = process.env.STEALTH_ANNOUNCEMENT_KEY || '0x370d4e719a5c006828be1792db85df647b592056f6d394cc14784ef00526003';

interface StarknetEvent {
    block_number: number;
    transaction_hash: string;
    data: string[];
    keys: string[];
    from_address: string;
}

interface BlockWithTxs {
    block_number: number;
    timestamp: number;
    transactions: {
        transaction_hash: string;
        events: StarknetEvent[];
    }[];
}

interface RPCResponse {
    result?: {
        events?: StarknetEvent[];
        timestamp?: number;
    } | number;
    error?: { message: string };
}

/**
 * Parse a StealthPaymentAnnouncement event
 *
 * Event data layout (after privacy update):
 *   data[0]: amount_commitment  (felt252 — Pedersen commitment)
 *   data[1]: encrypted_amount   (felt252 — real amount for recipient)
 *   data[2..3]: amount          (u256 low/high — now always 0)
 *   data[4]: ephemeral_pub_key_x
 *   data[5]: ephemeral_pub_key_y
 *   data[6]: timestamp          (u64)
 *   data[7..8]: index           (u256)
 */
function parseAnnouncementEvent(event: StarknetEvent, blockNumber: number, timestamp: Date): {
    txHash: string;
    stealthAddress: string;
    ephemeralPubKey: string;
    token: string;
    amount: string;
    blockNumber: bigint;
    timestamp: Date;
} | null {
    try {
        // keys[0]: event selector
        // keys[1]: stealth_address
        // keys[2]: token
        const stealthAddress = event.keys[1];
        const token = event.keys[2];

        // data[0]: amount_commitment (Pedersen hash)
        // data[1]: encrypted_amount  (real amount as felt252)
        const encryptedAmount = BigInt(event.data[1] || '0');

        // data[2..3]: public amount u256 (now always 0 for privacy)
        const amountLow = BigInt(event.data[2] || '0');
        const amountHigh = BigInt(event.data[3] || '0');
        const publicAmount = (amountHigh << BigInt(128)) + amountLow;

        // Use encrypted_amount if public amount is 0 (privacy-enabled)
        const amount = publicAmount > 0n ? publicAmount : encryptedAmount;

        // Ephemeral public key coordinates shifted by 2 positions
        const ephemeralPubKeyX = event.data[4];
        const ephemeralPubKeyY = event.data[5];
        const ephemeralPubKey = `${ephemeralPubKeyX}:${ephemeralPubKeyY}`;

        return {
            txHash: event.transaction_hash,
            stealthAddress,
            ephemeralPubKey,
            token,
            amount: amount.toString(),
            blockNumber: BigInt(blockNumber),
            timestamp,
        };
    } catch (error) {
        console.error('Failed to parse event:', error);
        return null;
    }
}

/**
 * Fetch events from Starknet
 */
async function fetchEvents(fromBlock: bigint, toBlock: bigint): Promise<StarknetEvent[]> {
    try {
        const response = await fetch(STARKNET_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'starknet_getEvents',
                params: {
                    filter: {
                        from_block: { block_number: Number(fromBlock) },
                        to_block: { block_number: Number(toBlock) },
                        address: EVENT_EMITTER_CONTRACT,
                        keys: [[STEALTH_ANNOUNCEMENT_KEY]],
                        chunk_size: BATCH_SIZE,
                    },
                },
                id: 1,
            }),
        });

        const result = await response.json() as RPCResponse;

        if (result.error) {
            console.error('RPC error:', result.error);
            return [];
        }

        const resultData = result.result as { events?: StarknetEvent[] } | undefined;
        return resultData?.events || [];
    } catch (error) {
        console.error('Failed to fetch events:', error);
        return [];
    }
}

/**
 * Get current block number
 */
async function getCurrentBlockNumber(): Promise<bigint> {
    try {
        const response = await fetch(STARKNET_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'starknet_blockNumber',
                params: [],
                id: 1,
            }),
        });

        const result = await response.json() as RPCResponse;
        return BigInt((result.result as number) || 0);
    } catch (error) {
        console.error('Failed to get block number:', error);
        return BigInt(0);
    }
}

/**
 * Get block timestamp
 */
async function getBlockTimestamp(blockNumber: bigint): Promise<Date> {
    try {
        const response = await fetch(STARKNET_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'starknet_getBlockWithTxHashes',
                params: { block_id: { block_number: Number(blockNumber) } },
                id: 1,
            }),
        });

        const result = await response.json() as RPCResponse;
        const resultData = result.result as { timestamp?: number } | undefined;
        const timestamp = resultData?.timestamp || Math.floor(Date.now() / 1000);
        return new Date(timestamp * 1000);
    } catch (error) {
        return new Date();
    }
}

/**
 * Process and store events
 */
async function processEvents(events: StarknetEvent[]): Promise<number> {
    let stored = 0;

    for (const event of events) {
        const blockNumber = event.block_number || 0;
        const timestamp = await getBlockTimestamp(BigInt(blockNumber));

        const parsed = parseAnnouncementEvent(event, blockNumber, timestamp);
        if (!parsed) continue;

        try {
            // Check for duplicates
            const existing = await prisma.stealthAnnouncement.findUnique({
                where: { txHash: parsed.txHash },
            });

            if (existing) {
                console.log(`Skipping duplicate: ${parsed.txHash}`);
                continue;
            }

            // Store announcement
            await prisma.stealthAnnouncement.create({
                data: parsed,
            });

            console.log(`Stored announcement: ${parsed.txHash.slice(0, 20)}... → ${parsed.stealthAddress.slice(0, 20)}...`);
            stored++;

            // Broadcast to SSE clients
            broadcast({
                txHash: parsed.txHash,
                stealthAddress: parsed.stealthAddress,
                ephemeralPubKey: parsed.ephemeralPubKey,
                token: parsed.token,
                amount: parsed.amount,
                blockNumber: parsed.blockNumber.toString(),
                timestamp: parsed.timestamp.toISOString(),
            });
        } catch (error) {
            console.error('Failed to store event:', error);
        }
    }

    return stored;
}

/**
 * Update indexer state
 */
async function updateState(blockNumber: bigint, lastTxHash?: string) {
    await prisma.indexerState.upsert({
        where: { id: 'main' },
        update: {
            lastBlockNumber: blockNumber,
            lastTxHash,
        },
        create: {
            id: 'main',
            lastBlockNumber: blockNumber,
            lastTxHash,
        },
    });
}

/**
 * Get last indexed block
 */
async function getLastIndexedBlock(): Promise<bigint> {
    const state = await prisma.indexerState.findUnique({
        where: { id: 'main' },
    });
    return state?.lastBlockNumber || BigInt(0);
}

/**
 * Main indexer loop
 */
async function runIndexer() {
    console.log('🔍 ZeroLink Event Indexer starting...');
    console.log(`   RPC: ${STARKNET_RPC}`);
    console.log(`   Contract: ${EVENT_EMITTER_CONTRACT}`);
    console.log(`   Poll interval: ${POLL_INTERVAL_MS}ms`);

    if (EVENT_EMITTER_CONTRACT === '0x0') {
        console.warn('⚠️  Event emitter contract not configured. Indexer will run in demo mode.');
    }

    while (true) {
        try {
            const lastBlock = await getLastIndexedBlock();
            const currentBlock = await getCurrentBlockNumber();

            if (currentBlock > lastBlock) {
                console.log(`\n📦 Processing blocks ${lastBlock + BigInt(1)} → ${currentBlock}`);

                const events = await fetchEvents(lastBlock + BigInt(1), currentBlock);

                if (events.length > 0) {
                    const stored = await processEvents(events);
                    console.log(`✓ Stored ${stored} new announcements`);
                }

                await updateState(currentBlock, events[events.length - 1]?.transaction_hash);
                console.log(`✓ Updated state to block ${currentBlock}`);
            } else {
                process.stdout.write('.');
            }
        } catch (error) {
            console.error('Indexer error:', error);
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\nShutting down indexer...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\nShutting down indexer...');
    await prisma.$disconnect();
    process.exit(0);
});

// Run
runIndexer().catch(console.error);
