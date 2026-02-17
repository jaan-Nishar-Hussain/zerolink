import { Router } from 'express';
import { prisma } from '../db';
import type { StealthAnnouncement } from '@prisma/client';
import { requireApiKey } from '../middleware/auth';
import { RpcProvider } from 'starknet';
import rateLimit from 'express-rate-limit';

const router = Router();

// RPC provider for on-chain verification
const provider = new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL || 'https://free-rpc.nethermind.io/sepolia-juno',
});

// Rate limiter for the public /announce endpoint
const announceLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute window
    max: 10,              // 10 requests per minute per IP
    message: { error: 'Too many announcements, slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * GET /api/announcements
 * Fetch stealth payment announcements
 * Query params: 
 *   - fromBlock: starting block number
 *   - limit: max results (default 100)
 */
router.get('/', async (req, res) => {
    try {
        const fromBlock = req.query.fromBlock
            ? BigInt(req.query.fromBlock as string)
            : BigInt(0);
        const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

        const announcements = await prisma.stealthAnnouncement.findMany({
            where: {
                blockNumber: { gte: fromBlock },
            },
            orderBy: { blockNumber: 'asc' },
            take: limit,
        });

        res.json({
            announcements: announcements.map((a: StealthAnnouncement) => ({
                ...a,
                blockNumber: a.blockNumber.toString(),
                amount: a.amount,
            })),
            count: announcements.length,
            fromBlock: fromBlock.toString(),
        });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

/**
 * GET /api/announcements/scan
 * Scan announcements for a specific viewing public key
 * This is a privacy-preserving endpoint - client does the actual detection
 */
router.get('/scan', async (req, res) => {
    try {
        const fromBlock = req.query.fromBlock
            ? BigInt(req.query.fromBlock as string)
            : BigInt(0);
        const limit = Math.min(parseInt(req.query.limit as string) || 500, 2000);

        // Return ephemeral public keys and stealth addresses for client-side detection
        const announcements = await prisma.stealthAnnouncement.findMany({
            where: {
                blockNumber: { gte: fromBlock },
            },
            select: {
                id: true,
                stealthAddress: true,
                ephemeralPubKey: true,
                token: true,
                amount: true,
                txHash: true,
                blockNumber: true,
                timestamp: true,
            },
            orderBy: { blockNumber: 'asc' },
            take: limit,
        });

        type AnnouncementSelect = typeof announcements[0];

        res.json({
            announcements: announcements.map((a: AnnouncementSelect) => ({
                id: a.id,
                stealthAddress: a.stealthAddress,
                ephemeralPubKey: a.ephemeralPubKey,
                token: a.token,
                amount: a.amount,
                txHash: a.txHash,
                blockNumber: a.blockNumber.toString(),
                timestamp: a.timestamp,
            })),
            count: announcements.length,
        });
    } catch (error) {
        console.error('Error scanning announcements:', error);
        res.status(500).json({ error: 'Failed to scan announcements' });
    }
});

/**
 * GET /api/announcements/stats
 * Get indexer statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const [totalCount, indexerState] = await Promise.all([
            prisma.stealthAnnouncement.count(),
            prisma.indexerState.findUnique({ where: { id: 'main' } }),
        ]);

        res.json({
            totalAnnouncements: totalCount,
            lastBlockNumber: indexerState?.lastBlockNumber.toString() || '0',
            lastUpdated: indexerState?.updatedAt || null,
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/**
 * POST /api/announcements
 * Internal endpoint for indexer to store new announcements
 * Protected with API key authentication
 */
router.post('/', requireApiKey, async (req, res) => {
    try {
        const {
            txHash,
            stealthAddress,
            ephemeralPubKey,
            token,
            amount,
            blockNumber,
            timestamp
        } = req.body;

        // Validate required fields
        if (!txHash || !stealthAddress || !ephemeralPubKey || !token || !amount || !blockNumber) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Check for duplicate
        const existing = await prisma.stealthAnnouncement.findUnique({
            where: { txHash },
        });

        if (existing) {
            res.status(200).json({
                message: 'Announcement already exists',
                id: existing.id,
            });
            return;
        }

        // Create announcement
        const announcement = await prisma.stealthAnnouncement.create({
            data: {
                txHash,
                stealthAddress,
                ephemeralPubKey,
                token,
                amount: amount.toString(),
                blockNumber: BigInt(blockNumber),
                timestamp: new Date(timestamp),
            },
        });

        // Update indexer state
        await prisma.indexerState.upsert({
            where: { id: 'main' },
            update: {
                lastBlockNumber: BigInt(blockNumber),
                lastTxHash: txHash,
            },
            create: {
                id: 'main',
                lastBlockNumber: BigInt(blockNumber),
                lastTxHash: txHash,
            },
        });

        res.status(201).json({
            message: 'Announcement stored',
            id: announcement.id,
        });
    } catch (error) {
        console.error('Error storing announcement:', error);
        res.status(500).json({ error: 'Failed to store announcement' });
    }
});

/**
 * POST /api/announcements/announce
 * Public endpoint for frontend clients to announce stealth payments
 * No API key required - announcements are public data
 */
router.post('/announce', announceLimiter, async (req, res) => {
    try {
        const {
            txHash,
            stealthAddress,
            ephemeralPubKey,
            token,
            amount,
            timestamp
        } = req.body;

        // Validate required fields
        if (!txHash || !stealthAddress || !ephemeralPubKey || !token || !amount) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Check for duplicate
        const existing = await prisma.stealthAnnouncement.findUnique({
            where: { txHash },
        });

        if (existing) {
            res.status(200).json({
                message: 'Announcement already exists',
                id: existing.id,
            });
            return;
        }

        // Store the announcement optimistically.
        // The tx may not be confirmed on-chain yet since the frontend calls
        // announce immediately after submitting the transaction.
        // The indexer will verify and update later.
        const announcement = await prisma.stealthAnnouncement.create({
            data: {
                txHash,
                stealthAddress,
                ephemeralPubKey,
                token,
                amount: amount.toString(),
                blockNumber: BigInt(0), // Will be updated by indexer
                timestamp: timestamp ? new Date(timestamp) : new Date(),
            },
        });

        // Try on-chain verification in the background (non-blocking)
        provider.getTransactionReceipt(txHash).then(receipt => {
            if (receipt && receipt.isSuccess()) {
                console.log(`Announcement ${announcement.id} verified on-chain`);
            } else {
                console.warn(`Announcement ${announcement.id} tx not yet confirmed, will be verified by indexer`);
            }
        }).catch(() => {
            console.warn(`Announcement ${announcement.id} could not verify tx yet, indexer will handle it`);
        });

        res.status(201).json({
            message: 'Announcement stored',
            id: announcement.id,
        });
    } catch (error) {
        console.error('Error storing announcement:', error);
        res.status(500).json({ error: 'Failed to store announcement' });
    }
});

export default router;
