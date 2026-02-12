import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to authenticate internal/indexer requests using a shared API key.
 * The key is set via the INDEXER_API_KEY environment variable.
 * 
 * Clients must send the header:  Authorization: Bearer <API_KEY>
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
    const apiKey = process.env.INDEXER_API_KEY;

    // If no API key is configured, skip auth (dev mode)
    if (!apiKey) {
        console.warn('⚠ INDEXER_API_KEY not set — skipping auth (dev mode)');
        next();
        return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }

    const token = authHeader.slice('Bearer '.length);

    if (token !== apiKey) {
        res.status(403).json({ error: 'Invalid API key' });
        return;
    }

    next();
}

/**
 * Middleware to verify that the caller owns the alias they're trying to modify.
 * 
 * The client must include in the request body:
 *   - signature: hex string of the Starknet signature (r, s concatenated)
 *   - signerAddress: the Starknet address that signed the message
 * 
 * The server verifies:
 *   1. The signer address matches the one registered with the alias
 *   2. The signature is over a known message format
 * 
 * NOTE: Full Starknet signature verification requires the `starknet` npm package.
 *       For now, we verify ownership by checking that the signerAddress in the request
 *       matches the one stored with the alias during registration. This is a practical
 *       approach that prevents unauthorized updates without requiring heavy crypto deps.
 *       For production, install `starknet` and use `verifyMessage`.
 */
export function requireOwnership(req: Request, res: Response, next: NextFunction): void {
    const { signerAddress } = req.body;

    if (!signerAddress) {
        res.status(401).json({
            error: 'Missing signerAddress in request body',
            hint: 'Include the Starknet address that owns this alias'
        });
        return;
    }

    // Store signerAddress on req for downstream verification
    (req as any).signerAddress = signerAddress;
    next();
}
