import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface AliasParams {
    alias: string;
}

/**
 * GET /api/alias/:alias
 * Fetch a user's meta address by alias
 */
router.get<AliasParams>('/:alias', async (req, res) => {
    try {
        const alias = req.params.alias;

        const user = await prisma.alias.findUnique({
            where: { alias: alias.toLowerCase() },
            select: {
                alias: true,
                spendPubKey: true,
                viewingPubKey: true,
                displayName: true,
                avatarUrl: true,
                createdAt: true,
            },
        });

        if (!user) {
            res.status(404).json({ error: 'Alias not found' });
            return;
        }

        res.json({
            alias: user.alias,
            metaAddress: {
                spendPubKey: user.spendPubKey,
                viewingPubKey: user.viewingPubKey,
            },
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
        });
    } catch (error) {
        console.error('Error fetching alias:', error);
        res.status(500).json({ error: 'Failed to fetch alias' });
    }
});

/**
 * POST /api/alias
 * Register a new alias with meta address
 */
router.post('/', async (req, res) => {
    try {
        const { alias, spendPubKey, viewingPubKey, displayName } = req.body;

        // Validate inputs
        if (!alias || !spendPubKey || !viewingPubKey) {
            res.status(400).json({
                error: 'Missing required fields: alias, spendPubKey, viewingPubKey'
            });
            return;
        }

        // Validate alias format
        const aliasLower = (alias as string).toLowerCase();
        if (!/^[a-z0-9_-]+$/.test(aliasLower)) {
            res.status(400).json({
                error: 'Invalid alias format. Use only letters, numbers, underscores, and hyphens.'
            });
            return;
        }

        if (aliasLower.length < 3 || aliasLower.length > 30) {
            res.status(400).json({
                error: 'Alias must be between 3 and 30 characters'
            });
            return;
        }

        // Validate public keys (basic hex check)
        const hexRegex = /^[0-9a-fA-F]+$/;
        if (!hexRegex.test(spendPubKey) || !hexRegex.test(viewingPubKey)) {
            res.status(400).json({
                error: 'Invalid public key format (must be hex)'
            });
            return;
        }

        // Check if alias already exists
        const existing = await prisma.alias.findUnique({
            where: { alias: aliasLower },
        });

        if (existing) {
            res.status(409).json({ error: 'Alias already taken' });
            return;
        }

        // Create new alias
        const newAlias = await prisma.alias.create({
            data: {
                alias: aliasLower,
                spendPubKey,
                viewingPubKey,
                displayName: displayName || null,
            },
        });

        res.status(201).json({
            message: 'Alias registered successfully',
            alias: newAlias.alias,
            createdAt: newAlias.createdAt,
        });
    } catch (error) {
        console.error('Error registering alias:', error);
        res.status(500).json({ error: 'Failed to register alias' });
    }
});

/**
 * PUT /api/alias/:alias
 * Update alias metadata (displayName, avatar)
 * Requires signature verification in production
 */
router.put<AliasParams>('/:alias', async (req, res) => {
    try {
        const alias = req.params.alias;
        const { displayName, avatarUrl } = req.body;

        // In production, verify signature here

        const updated = await prisma.alias.update({
            where: { alias: alias.toLowerCase() },
            data: {
                displayName,
                avatarUrl,
            },
        });

        res.json({
            message: 'Alias updated successfully',
            alias: updated.alias,
            updatedAt: updated.updatedAt,
        });
    } catch (error) {
        console.error('Error updating alias:', error);
        res.status(500).json({ error: 'Failed to update alias' });
    }
});

/**
 * GET /api/alias/check/:alias
 * Check if an alias is available
 */
router.get<AliasParams>('/check/:alias', async (req, res) => {
    try {
        const alias = req.params.alias;

        const existing = await prisma.alias.findUnique({
            where: { alias: alias.toLowerCase() },
            select: { alias: true },
        });

        res.json({
            alias: alias.toLowerCase(),
            available: !existing,
        });
    } catch (error) {
        console.error('Error checking alias:', error);
        res.status(500).json({ error: 'Failed to check alias' });
    }
});

export default router;
