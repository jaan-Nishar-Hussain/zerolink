/// ZeroLink Token Adapter Contract
/// 
/// Provides a unified interface for handling different token types
/// Supports ETH and ERC20 tokens with consistent interface

use starknet::ContractAddress;

#[starknet::interface]
pub trait ITokenAdapter<TContractState> {
    /// Check if a token is supported
    fn is_supported(self: @TContractState, token: ContractAddress) -> bool;

    /// Add support for a token
    fn add_token(ref self: TContractState, token: ContractAddress, name: felt252);

    /// Remove token support
    fn remove_token(ref self: TContractState, token: ContractAddress);

    /// Get token info
    fn get_token_name(self: @TContractState, token: ContractAddress) -> felt252;

    /// Get list of supported tokens (length)
    fn get_supported_token_count(self: @TContractState) -> u32;
}

#[starknet::contract]
pub mod TokenAdapter {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::ITokenAdapter;

    #[storage]
    struct Storage {
        // Owner
        owner: ContractAddress,
        // Token support: token => is_supported
        supported_tokens: Map<ContractAddress, bool>,
        // Token names: token => name
        token_names: Map<ContractAddress, felt252>,
        // Token count
        token_count: u32,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TokenAdded: TokenAdded,
        TokenRemoved: TokenRemoved,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokenAdded {
        #[key]
        pub token: ContractAddress,
        pub name: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokenRemoved {
        #[key]
        pub token: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.token_count.write(0);

        // Add ETH as default supported token (zero address)
        let eth_address: ContractAddress = 0.try_into().unwrap();
        self.supported_tokens.write(eth_address, true);
        self.token_names.write(eth_address, 'ETH');
        self.token_count.write(1);
    }

    #[abi(embed_v0)]
    impl TokenAdapterImpl of ITokenAdapter<ContractState> {
        fn is_supported(self: @ContractState, token: ContractAddress) -> bool {
            self.supported_tokens.read(token)
        }

        fn add_token(ref self: ContractState, token: ContractAddress, name: felt252) {
            // Only owner
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner');

            // Check not already added
            assert(!self.supported_tokens.read(token), 'Token already added');

            // Add token
            self.supported_tokens.write(token, true);
            self.token_names.write(token, name);
            self.token_count.write(self.token_count.read() + 1);

            self.emit(TokenAdded { token, name });
        }

        fn remove_token(ref self: ContractState, token: ContractAddress) {
            // Only owner
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner');

            // Check exists
            assert(self.supported_tokens.read(token), 'Token not supported');

            // Cannot remove ETH
            let eth_address: ContractAddress = 0.try_into().unwrap();
            assert(token != eth_address, 'Cannot remove ETH');

            // Remove
            self.supported_tokens.write(token, false);
            self.token_count.write(self.token_count.read() - 1);

            self.emit(TokenRemoved { token });
        }

        fn get_token_name(self: @ContractState, token: ContractAddress) -> felt252 {
            self.token_names.read(token)
        }

        fn get_supported_token_count(self: @ContractState) -> u32 {
            self.token_count.read()
        }
    }
}
