import { Router } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

// ─── Nonce store for challenge-response auth ────────────────────────
const nonceStore = new Map<string, { alias: string; expiresAt: Date }>();

// Clean expired nonces every 5 minutes
setInterval(() => {
    const now = new Date();
    for (const [nonce, data] of nonceStore) {
        if (data.expiresAt < now) nonceStore.delete(nonce);
    }
}, 5 * 60 * 1000);

// ─── Lazy-load ESM-only @noble libraries ────────────────────────────
async function verifySecp256k1Signature(
    signatureHex: string,
    messageHex: string,
    pubKeyHex: string,
): Promise<boolean> {
    // Dynamic import for ESM-only @noble packages
    const curves = await (Function('return import("@noble/curves/secp256k1")')() as Promise<any>);
    const hashes = await (Function('return import("@noble/hashes/sha256")')() as Promise<any>);
    const utils = await (Function('return import("@noble/hashes/utils")')() as Promise<any>);

    const { secp256k1 } = curves;
    const { sha256 } = hashes;
    const { hexToBytes } = utils;

    const messageHash = sha256(hexToBytes(messageHex));
    const sigBytes = hexToBytes(signatureHex);
    const pubKeyBytes = hexToBytes(pubKeyHex);
    return secp256k1.verify(sigBytes, messageHash, pubKeyBytes);
}

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
    signerAddress: z.string().optional(),
});

const updateAliasSchema = z.object({
    displayName: z.string().max(50).optional(),
    avatarUrl: z.string().url().optional(),
});

interface AliasParams {
    alias: string;
    [key: string]: string;
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

        const { alias, spendPubKey, viewingPubKey, displayName, signerAddress } = parseResult.data;
        const aliasLower = alias.toLowerCase();

        // Upsert: create if new, or update keys if alias already exists.
        // This handles key regeneration gracefully — the DB always has the latest keys.
        const result = await prisma.alias.upsert({
            where: { alias: aliasLower },
            update: {
                spendPubKey,
                viewingPubKey,
            },
            create: {
                alias: aliasLower,
                spendPubKey,
                viewingPubKey,
                displayName: displayName || null,
                signerAddress: signerAddress || null,
            },
        });

        res.status(201).json({
            message: 'Alias registered successfully',
            alias: result.alias,
            createdAt: result.createdAt,
        });
    } catch (error) {
        console.error('Error registering alias:', error);
        res.status(500).json({ error: 'Failed to register alias' });
    }
});

/**
 * GET /api/alias/:alias/challenge
 * Request a nonce for signing before updating alias metadata.
 * Returns a random nonce the client must sign with their spend key.
 */
router.get<AliasParams>('/:alias/challenge', async (req, res) => {
    try {
        const alias = req.params.alias?.toLowerCase();
        if (!alias) {
            res.status(400).json({ error: 'Alias parameter required' });
            return;
        }

        const existing = await prisma.alias.findUnique({
            where: { alias },
            select: { alias: true },
        });

        if (!existing) {
            res.status(404).json({ error: 'Alias not found' });
            return;
        }

        const nonce = crypto.randomBytes(32).toString('hex');
        nonceStore.set(nonce, {
            alias,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min TTL
        });

        res.json({ nonce, expiresIn: 300 });
    } catch (error) {
        console.error('Error generating challenge:', error);
        res.status(500).json({ error: 'Failed to generate challenge' });
    }
});

/**
 * PUT /api/alias/:alias
 * Update alias metadata (displayName, avatar)
 * Requires challenge-response: client signs the nonce with their spend private key
 * Body: { nonce, signature, displayName?, avatarUrl? }
 */
router.put<AliasParams>('/:alias', async (req, res) => {
    try {
        const alias = req.params.alias;
        const { nonce, signature, displayName, avatarUrl } = req.body;

        // 1. Validate nonce
        if (!nonce || !signature) {
            res.status(400).json({ error: 'nonce and signature are required' });
            return;
        }

        const challenge = nonceStore.get(nonce);
        if (!challenge) {
            res.status(401).json({ error: 'Invalid or expired nonce' });
            return;
        }

        if (challenge.alias !== alias.toLowerCase() || challenge.expiresAt < new Date()) {
            nonceStore.delete(nonce);
            res.status(401).json({ error: 'Nonce mismatch or expired' });
            return;
        }

        // 2. Look up the alias to get the registered spendPubKey
        const existing = await prisma.alias.findUnique({
            where: { alias: alias.toLowerCase() },
            select: { spendPubKey: true },
        });

        if (!existing) {
            nonceStore.delete(nonce);
            res.status(404).json({ error: 'Alias not found' });
            return;
        }

        // 3. Verify secp256k1 signature over SHA-256(nonce)
        try {
            const valid = await verifySecp256k1Signature(signature, nonce, existing.spendPubKey);

            if (!valid) {
                nonceStore.delete(nonce);
                res.status(403).json({ error: 'Invalid signature — you do not own this alias' });
                return;
            }
        } catch (err) {
            nonceStore.delete(nonce);
            res.status(403).json({ error: 'Signature verification failed' });
            return;
        }

        // 4. Consume nonce and apply update
        nonceStore.delete(nonce);

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
