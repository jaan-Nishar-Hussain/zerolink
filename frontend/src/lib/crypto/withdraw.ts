/**
 * ZeroLink Withdrawal Flow
 * 
 * Handles withdrawing funds from stealth addresses to main wallet
 * Uses the derived stealth private key to sign transactions
 */

import { Account, Contract, RpcProvider, cairo } from 'starknet';
import { bytesToHex, deriveStealthPrivateKey, publicKeyToStarknetAddress, derivePublicKey } from './stealth';

// =============================================================================
// CONFIGURATION
// =============================================================================

const STARKNET_RPC = import.meta.env.VITE_STARKNET_RPC || 'https://free-rpc.nethermind.io/sepolia-juno';
const STRK_TOKEN = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const ETH_TOKEN = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

// ERC20 ABI (simplified for transfer)
const ERC20_ABI = [
    {
        name: 'transfer',
        type: 'function',
        inputs: [
            { name: 'recipient', type: 'felt252' },
            { name: 'amount', type: 'Uint256' },
        ],
        outputs: [{ name: 'success', type: 'felt252' }],
    },
    {
        name: 'balance_of',
        type: 'function',
        inputs: [{ name: 'account', type: 'felt252' }],
        outputs: [{ name: 'balance', type: 'Uint256' }],
        state_mutability: 'view',
    },
];

// =============================================================================
// TYPES
// =============================================================================

export interface WithdrawParams {
    // Stealth address details
    stealthAddress: string;
    ephemeralPubKey: string;

    // User's keys (from StealthKeys)
    viewingPrivateKey: Uint8Array;
    spendPrivateKey: Uint8Array;

    // Withdrawal details
    recipientAddress: string;
    amount: string;
    tokenAddress?: string; // defaults to STRK
}

export interface WithdrawResult {
    transactionHash: string;
    status: 'pending' | 'confirmed' | 'failed';
    amount: string;
    token: string;
    from: string;
    to: string;
}

// =============================================================================
// PROVIDER
// =============================================================================

function getProvider(): RpcProvider {
    return new RpcProvider({ nodeUrl: STARKNET_RPC });
}

// =============================================================================
// BALANCE CHECKING
// =============================================================================

/**
 * Get token balance for an address
 */
export async function getTokenBalance(
    address: string,
    tokenAddress: string = STRK_TOKEN
): Promise<string> {
    const provider = getProvider();
    const contract = new Contract(ERC20_ABI, tokenAddress, provider);

    try {
        const balance = await contract.balance_of(address);
        return balance.toString();
    } catch (error) {
        console.error('Failed to get balance:', error);
        return '0';
    }
}

/**
 * Get balances for multiple tokens
 */
export async function getStealthBalances(
    stealthAddress: string
): Promise<{ strk: string; eth: string }> {
    const [strk, eth] = await Promise.all([
        getTokenBalance(stealthAddress, STRK_TOKEN),
        getTokenBalance(stealthAddress, ETH_TOKEN),
    ]);

    return { strk, eth };
}

// =============================================================================
// WITHDRAWAL
// =============================================================================

/**
 * Withdraw funds from a stealth address
 * 
 * This creates an account from the derived stealth private key
 * and executes a transfer to the recipient address.
 */
export async function withdrawFromStealth(params: WithdrawParams): Promise<WithdrawResult> {
    const {
        stealthAddress,
        ephemeralPubKey,
        viewingPrivateKey,
        spendPrivateKey,
        recipientAddress,
        amount,
        tokenAddress = STRK_TOKEN,
    } = params;

    // 1. Derive the stealth private key
    const ephemeralPubKeyBytes = hexToBytes(ephemeralPubKey);
    const stealthPrivateKey = deriveStealthPrivateKey(
        viewingPrivateKey,
        spendPrivateKey,
        ephemeralPubKeyBytes
    );

    // 2. Verify derived address matches
    const derivedPubKey = derivePublicKey(stealthPrivateKey);
    const derivedAddress = publicKeyToStarknetAddress(derivedPubKey);

    if (derivedAddress.toLowerCase() !== stealthAddress.toLowerCase()) {
        throw new Error(
            `Address mismatch: derived ${derivedAddress} but expected ${stealthAddress}`
        );
    }

    // 3. Create provider and account
    const provider = getProvider();
    const privateKeyHex = '0x' + bytesToHex(stealthPrivateKey);

    // Note: For Starknet, we need the account to be deployed first
    // Stealth accounts use a specific account class
    const account = new Account(provider, stealthAddress, privateKeyHex);

    // 4. Create transfer call
    const tokenContract = new Contract(ERC20_ABI, tokenAddress, provider);
    tokenContract.connect(account);

    const amountU256 = cairo.uint256(amount);

    try {
        // 5. Execute transfer
        const tx = await tokenContract.transfer(recipientAddress, amountU256);

        console.log('Withdrawal transaction submitted:', tx.transaction_hash);

        return {
            transactionHash: tx.transaction_hash,
            status: 'pending',
            amount,
            token: tokenAddress,
            from: stealthAddress,
            to: recipientAddress,
        };
    } catch (error) {
        console.error('Withdrawal failed:', error);
        throw new Error(`Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Wait for a transaction to be confirmed
 */
export async function waitForTransaction(
    txHash: string,
    timeout = 60000
): Promise<'confirmed' | 'failed'> {
    const provider = getProvider();
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const receipt = await provider.getTransactionReceipt(txHash);

            if (receipt.isSuccess()) {
                return 'confirmed';
            } else if (receipt.isReverted()) {
                return 'failed';
            }
        } catch {
            // Transaction not yet processed, continue polling
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return 'failed'; // Timeout
}

// =============================================================================
// BATCH WITHDRAWAL
// =============================================================================

export interface StealthPaymentWithKeys {
    stealthAddress: string;
    ephemeralPubKey: string;
    amount: string;
    token: string;
}

/**
 * Withdraw all detected payments to a single address
 */
export async function withdrawAllPayments(
    payments: StealthPaymentWithKeys[],
    viewingPrivateKey: Uint8Array,
    spendPrivateKey: Uint8Array,
    recipientAddress: string
): Promise<WithdrawResult[]> {
    const results: WithdrawResult[] = [];

    for (const payment of payments) {
        try {
            const result = await withdrawFromStealth({
                stealthAddress: payment.stealthAddress,
                ephemeralPubKey: payment.ephemeralPubKey,
                viewingPrivateKey,
                spendPrivateKey,
                recipientAddress,
                amount: payment.amount,
                tokenAddress: payment.token,
            });

            results.push(result);
        } catch (error) {
            console.error(`Failed to withdraw from ${payment.stealthAddress}:`, error);
            results.push({
                transactionHash: '',
                status: 'failed',
                amount: payment.amount,
                token: payment.token,
                from: payment.stealthAddress,
                to: recipientAddress,
            });
        }
    }

    return results;
}

// =============================================================================
// HELPER
// =============================================================================

function hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes;
}
