import { Router } from 'express';
import { prisma } from '../db';
import { z } from 'zod';

const router = Router();

// Zod validation schemas
const aliasSchema = z.string()
    .min(3, 'Alias must be at least 3 characters')
    .max(30, 'Alias must be at most 30 characters')
    .regex(/^[a-z0-9_-]+$/, 'Use only lowercase letters, numbers, underscores, and hyphens');

const hexKeySchema = z.string()
    .regex(/^[0-9a-fA-F]+$/, 'Must be a valid hex string');

const registerAliasSchema = z.object({
    alias: aliasSchema,
    spendPubKey: hexKeySchema,
    viewingPubKey: hexKeySchema,
    displayName: z.string().max(50).optional(),
});

const updateAliasSchema = z.object({
    displayName: z.string().max(50).optional(),
    avatarUrl: z.string().url().optional(),
});

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
        // Validate request body with Zod
        const parseResult = registerAliasSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: parseResult.error.flatten().fieldErrors
            });
            return;
        }

        const { alias, spendPubKey, viewingPubKey, displayName } = parseResult.data;
        const aliasLower = alias.toLowerCase();

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
