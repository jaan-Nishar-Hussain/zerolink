/**
 * ZeroLink Relay Endpoint
 *
 * Accepts withdrawal requests from the frontend and forwards them
 * through the relayer so the sender's wallet is never visible on-chain.
 */

import { Router } from 'express';
import { processRelayRequest } from '../relayer';

const router = Router();

/**
 * POST /api/relay
 * Body: { nullifierHash, commitment, recipient, amount, token, secret }
 */
router.post('/', async (req, res) => {
    try {
        const { nullifierHash, commitment, recipient, amount, token, secret, ephemeralPubKeyX, ephemeralPubKeyY } = req.body;

        if (!nullifierHash || !commitment || !recipient || !amount || !token || !secret || !ephemeralPubKeyX || !ephemeralPubKeyY) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        const result = await processRelayRequest({
            nullifierHash,
            commitment,
            recipient,
            amount,
            token,
            secret,
            ephemeralPubKeyX,
            ephemeralPubKeyY,
        });

        if (result.status === 'error') {
            res.status(400).json({ error: result.error });
            return;
        }

        res.json({
            transactionHash: result.transactionHash,
            status: result.status,
        });
    } catch (error) {
        console.error('Relay error:', error);
        res.status(500).json({ error: 'Internal relay error' });
    }
});

export default router;
