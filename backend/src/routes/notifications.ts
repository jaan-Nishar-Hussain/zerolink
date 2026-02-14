/**
 * ZeroLink Real-Time Notifications (Server-Sent Events)
 *
 * Streams new stealth payment announcements to connected clients
 * so they can detect incoming payments without polling.
 */

import { Router, Response } from 'express';

const router = Router();
const clients = new Set<Response>();

/**
 * GET /api/notifications/stream
 * SSE endpoint — clients hold an open connection and receive events.
 */
router.get('/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // disable nginx buffering
    });

    res.write('data: {"type":"connected"}\n\n');

    clients.add(res);

    req.on('close', () => {
        clients.delete(res);
    });
});

/**
 * Broadcast a new announcement to all connected SSE clients.
 * Call this from the indexer after storing each announcement.
 */
export function broadcast(announcement: {
    txHash: string;
    stealthAddress: string;
    ephemeralPubKey: string;
    token: string;
    amount: string;
    blockNumber: string;
    timestamp: string;
}): void {
    const payload = `data: ${JSON.stringify({ type: 'announcement', ...announcement })}\n\n`;
    for (const client of clients) {
        try {
            client.write(payload);
        } catch {
            clients.delete(client);
        }
    }
}

export default router;
