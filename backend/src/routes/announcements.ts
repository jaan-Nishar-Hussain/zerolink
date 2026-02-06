import { Router } from 'express';
import { PrismaClient, StealthAnnouncement } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

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
 * In production, this should be protected
 */
router.post('/', async (req, res) => {
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

export default router;
