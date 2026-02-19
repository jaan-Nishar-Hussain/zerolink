/**
 * ZeroLink Relayer Service
 *
 * Submits withdrawal transactions on-chain so the original sender's wallet
 * never touches the withdrawal. This breaks the on-chain link between deposit
 * and stealth-address payment.
 *
 * Flow:
 *   1. Withdraw from DepositPool to the relayer's own address
 *   2. Approve StealthPayment to spend the withdrawn tokens
 *   3. Call StealthPayment.send_eth / send_token so the funds are recorded
 *      in the contract's internal balance and the on-chain announcement is emitted
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
let _stealthPayment = '';
let _initialised = false;

const ETH_TOKEN = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

function ensureInitialised(): void {
    if (_initialised) return;
    // Re-read env here in case dotenv ran after this module was first evaluated
    dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

    const rpcUrl =
        process.env.STARKNET_RPC_URL ||
        'https://free-rpc.nethermind.io/sepolia-juno';

    _provider = new RpcProvider({ nodeUrl: rpcUrl });
    _relayerKey = process.env.RELAYER_PRIVATE_KEY || '';
    _relayerAccount = process.env.RELAYER_ACCOUNT_ADDRESS || '';
    _depositPool = process.env.DEPOSIT_POOL_CONTRACT || '';
    _stealthPayment = process.env.STEALTH_PAYMENT_CONTRACT || '';
    _initialised = true;

    console.log('[Relayer] Initialised');
    console.log('[Relayer]   RPC URL  :', rpcUrl.substring(0, 50) + '…');
    console.log('[Relayer]   Account  :', _relayerAccount ? _relayerAccount.substring(0, 16) + '…' : 'NOT SET');
    console.log('[Relayer]   Pool     :', _depositPool ? _depositPool.substring(0, 16) + '…' : 'NOT SET');
    console.log('[Relayer]   Stealth  :', _stealthPayment ? _stealthPayment.substring(0, 16) + '…' : 'NOT SET');
}

export interface RelayRequest {
    nullifierHash: string;
    commitment: string;
    recipient: string;
    amount: string;
    token: string;
    secret: string;
    ephemeralPubKeyX: string;
    ephemeralPubKeyY: string;
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
    if (!req.ephemeralPubKeyX) return 'Missing ephemeralPubKeyX';
    if (!req.ephemeralPubKeyY) return 'Missing ephemeralPubKeyY';
    return null;
}

/**
 * Process a relay request:
 *   1. DepositPool.withdraw → relayer receives tokens
 *   2. Token.approve → StealthPayment can pull tokens
 *   3. StealthPayment.send_eth / send_token → records balance + emits event
 */
export async function processRelayRequest(request: RelayRequest): Promise<RelayResult> {
    ensureInitialised();

    const validationError = validateRequest(request);
    if (validationError) {
        return { transactionHash: '', status: 'error', error: validationError };
    }

    if (!_relayerKey || !_relayerAccount || !_depositPool || !_stealthPayment) {
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

        const isEth =
            request.token.toLowerCase() === ETH_TOKEN.toLowerCase() ||
            request.token === '0x0';

        const tokenForApproval = isEth ? ETH_TOKEN : request.token;

        // Build a 3-step multicall executed atomically
        const calls = [
            // 1. Withdraw from DepositPool to relayer (self)
            {
                contractAddress: _depositPool,
                entrypoint: 'withdraw',
                calldata: [
                    request.nullifierHash,
                    request.commitment,
                    _relayerAccount,       // recipient = relayer, NOT stealth address
                    amountU256.low,
                    amountU256.high,
                    request.token,
                    request.secret,
                ],
            },
            // 2. Approve StealthPayment to pull the tokens from the relayer
            {
                contractAddress: tokenForApproval,
                entrypoint: 'approve',
                calldata: [
                    _stealthPayment,
                    amountU256.low,
                    amountU256.high,
                ],
            },
            // 3. Deposit into StealthPayment (records internal balance + emits event)
            isEth
                ? {
                      contractAddress: _stealthPayment,
                      entrypoint: 'send_eth',
                      calldata: [
                          request.recipient,
                          amountU256.low,
                          amountU256.high,
                          request.ephemeralPubKeyX,
                          request.ephemeralPubKeyY,
                      ],
                  }
                : {
                      contractAddress: _stealthPayment,
                      entrypoint: 'send_token',
                      calldata: [
                          request.token,
                          request.recipient,
                          amountU256.low,
                          amountU256.high,
                          request.ephemeralPubKeyX,
                          request.ephemeralPubKeyY,
                      ],
                  },
        ];

        const tx = await account.execute(calls);

        console.log(`[Relayer] tx submitted: ${tx.transaction_hash}`);
        return { transactionHash: tx.transaction_hash, status: 'submitted' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown relayer error';
        console.error('[Relayer] Error:', message);
        return { transactionHash: '', status: 'error', error: message };
    }
}
