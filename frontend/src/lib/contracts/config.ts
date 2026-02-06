/**
 * ZeroLink Contract Configuration
 * 
 * Contract addresses and ABIs for Starknet interaction
 */

// Contract addresses - update after deployment
export const CONTRACTS = {
    STEALTH_PAYMENT: import.meta.env.VITE_STEALTH_PAYMENT_CONTRACT || '0x0',
    EVENT_EMITTER: import.meta.env.VITE_EVENT_EMITTER_CONTRACT || '0x0',
    TOKEN_ADAPTER: import.meta.env.VITE_TOKEN_ADAPTER_CONTRACT || '0x0',
} as const;

// Starknet network
export const NETWORK = import.meta.env.VITE_STARKNET_NETWORK || 'sepolia';

// RPC URL
export const RPC_URL = import.meta.env.VITE_STARKNET_RPC_URL ||
    'https://free-rpc.nethermind.io/sepolia-juno';

// Contract ABIs (minimal interfaces for frontend interaction)
export const STEALTH_PAYMENT_ABI = [
    {
        name: 'send_eth',
        type: 'function',
        inputs: [
            { name: 'stealth_address', type: 'felt252' },
            { name: 'ephemeral_pub_key_x', type: 'felt252' },
            { name: 'ephemeral_pub_key_y', type: 'felt252' },
        ],
        outputs: [],
        state_mutability: 'external',
    },
    {
        name: 'send_token',
        type: 'function',
        inputs: [
            { name: 'token', type: 'felt252' },
            { name: 'stealth_address', type: 'felt252' },
            { name: 'amount', type: 'u256' },
            { name: 'ephemeral_pub_key_x', type: 'felt252' },
            { name: 'ephemeral_pub_key_y', type: 'felt252' },
        ],
        outputs: [],
        state_mutability: 'external',
    },
    {
        name: 'withdraw_eth',
        type: 'function',
        inputs: [
            { name: 'to', type: 'felt252' },
            { name: 'amount', type: 'u256' },
        ],
        outputs: [],
        state_mutability: 'external',
    },
    {
        name: 'withdraw_token',
        type: 'function',
        inputs: [
            { name: 'token', type: 'felt252' },
            { name: 'to', type: 'felt252' },
            { name: 'amount', type: 'u256' },
        ],
        outputs: [],
        state_mutability: 'external',
    },
    {
        name: 'get_eth_balance',
        type: 'function',
        inputs: [{ name: 'stealth_address', type: 'felt252' }],
        outputs: [{ name: 'balance', type: 'u256' }],
        state_mutability: 'view',
    },
    {
        name: 'get_token_balance',
        type: 'function',
        inputs: [
            { name: 'token', type: 'felt252' },
            { name: 'stealth_address', type: 'felt252' },
        ],
        outputs: [{ name: 'balance', type: 'u256' }],
        state_mutability: 'view',
    },
] as const;

export const EVENT_EMITTER_ABI = [
    {
        name: 'StealthPaymentAnnouncement',
        type: 'event',
        keys: [
            { name: 'stealth_address', type: 'felt252' },
            { name: 'token', type: 'felt252' },
        ],
        data: [
            { name: 'amount', type: 'u256' },
            { name: 'ephemeral_pub_key_x', type: 'felt252' },
            { name: 'ephemeral_pub_key_y', type: 'felt252' },
            { name: 'timestamp', type: 'u64' },
            { name: 'index', type: 'u256' },
        ],
    },
    {
        name: 'get_announcement_count',
        type: 'function',
        inputs: [],
        outputs: [{ name: 'count', type: 'u256' }],
        state_mutability: 'view',
    },
] as const;
