/**
 * ZeroLink Relayer Service
 *
 * Submits withdrawal transactions on-chain so the original sender's wallet
 * never touches the withdrawal. This breaks the on-chain link between deposit
 * and stealth-address payment.
 *
 * The relayer is a backend-only service with its own funded Starknet account.
 */

import { Account, Contract, RpcProvider, cairo } from 'starknet';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly from the backend directory so it works regardless of cwd
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ─── Lazy-initialised singleton ────────────────────────────────────
// The provider + env vars are read the first time processRelayRequest()
// is called, NOT at import time.  This avoids timing issues where the
// module is evaluated before dotenv has injected the variables.

let _provider: RpcProvider | null = null;
let _relayerKey = '';
let _relayerAccount = '';
let _depositPool = '';
let _initialised = false;

function ensureInitialised(): void {
    if (_initialised) return;
    // Re-read env here in case dotenv ran after this module was first evaluated
    dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

    const rpcUrl =
        process.env.STARKNET_RPC_URL ||
        'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/XN9-BdSkx8Pw_0vERYc_f';

    _provider = new RpcProvider({ nodeUrl: rpcUrl });
    _relayerKey = process.env.RELAYER_PRIVATE_KEY || '';
    _relayerAccount = process.env.RELAYER_ACCOUNT_ADDRESS || '';
    _depositPool = process.env.DEPOSIT_POOL_CONTRACT || '';
    _initialised = true;

    console.log('[Relayer] Initialised');
    console.log('[Relayer]   RPC URL :', rpcUrl.substring(0, 50) + '…');
    console.log('[Relayer]   Account :', _relayerAccount ? _relayerAccount.substring(0, 16) + '…' : 'NOT SET');
    console.log('[Relayer]   Pool    :', _depositPool ? _depositPool.substring(0, 16) + '…' : 'NOT SET');
}

// Minimal ABI for DepositPool.withdraw
const DEPOSIT_POOL_ABI = [
    {
        name: 'withdraw',
        type: 'function',
        inputs: [
            { name: 'nullifier_hash', type: 'felt252' },
            { name: 'commitment', type: 'felt252' },
            { name: 'recipient', type: 'felt252' },
            { name: 'amount', type: 'u256' },
            { name: 'token', type: 'felt252' },
            { name: 'secret', type: 'felt252' },
        ],
        outputs: [],
        state_mutability: 'external',
    },
];

export interface RelayRequest {
    nullifierHash: string;
    commitment: string;
    recipient: string;
    amount: string;
    token: string;
    secret: string;
}

export interface RelayResult {
    transactionHash: string;
    status: 'submitted' | 'error';
    error?: string;
}

/**
 * Validate relay request parameters
 */
function validateRequest(req: RelayRequest): string | null {
    if (!req.nullifierHash) return 'Missing nullifierHash';
    if (!req.commitment) return 'Missing commitment';
    if (!req.recipient) return 'Missing recipient';
    if (!req.amount || BigInt(req.amount) <= 0n) return 'Invalid amount';
    if (!req.token) return 'Missing token';
    if (!req.secret) return 'Missing secret';
    return null;
}

/**
 * Process a relay request: call DepositPool.withdraw on-chain
 */
export async function processRelayRequest(request: RelayRequest): Promise<RelayResult> {
    ensureInitialised();

    const validationError = validateRequest(request);
    if (validationError) {
        return { transactionHash: '', status: 'error', error: validationError };
    }

    if (!_relayerKey || !_relayerAccount || !_depositPool) {
        return {
            transactionHash: '',
            status: 'error',
            error: 'Relayer not configured (missing env vars)',
        };
    }

    try {
        const account = new Account({
            provider: _provider!,
            address: _relayerAccount,
            signer: _relayerKey,
        });

        const amountBig = BigInt(request.amount);
        const amountU256 = cairo.uint256(amountBig);

        const tx = await account.execute([
            {
                contractAddress: _depositPool,
                entrypoint: 'withdraw',
                calldata: [
                    request.nullifierHash,
                    request.commitment,
                    request.recipient,
                    amountU256.low,
                    amountU256.high,
                    request.token,
                    request.secret,
                ],
            },
        ]);

        console.log(`[Relayer] tx submitted: ${tx.transaction_hash}`);
        return { transactionHash: tx.transaction_hash, status: 'submitted' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown relayer error';
        console.error('[Relayer] Error:', message);
        return { transactionHash: '', status: 'error', error: message };
    }
}
