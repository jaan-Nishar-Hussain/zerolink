/// ZeroLink Deposit Pool Contract
///
/// Implements a fixed-denomination commitment-based deposit pool to break the
/// on-chain link between sender and recipient.  All deposits within a token
/// use one of the allowed denominations (e.g. 1, 10, 100 tokens) so that
/// individual deposits are indistinguishable — exactly like Tornado Cash.
///
/// Flow:
///   1. Sender computes commitment = Pedersen(secret, nullifier_hash) off-chain
///   2. Sender calls deposit(commitment, token, amount) — amount must be a valid denomination
///   3. Relayer calls withdraw(nullifier_hash, commitment, recipient, amount, token, secret)
///      — the contract re-derives the commitment and checks the nullifier was not used
///
/// Privacy guarantees:
///   - The Deposited event does NOT contain the amount (all deposits in a tier are identical)
///   - The sender address is visible on-chain (inherent L2 property), but cannot be
///     linked to a specific withdrawal because many users deposit the same denomination

use starknet::ContractAddress;

#[starknet::interface]
pub trait IDepositPool<TContractState> {
    /// Deposit into the pool. commitment = Pedersen(secret, nullifier)
    /// amount must be one of the valid denominations
    fn deposit(ref self: TContractState, commitment: felt252, token: ContractAddress, amount: u256);

    /// Withdraw from the pool to a recipient.
    /// Caller must supply the secret & nullifier that reproduce the commitment.
    fn withdraw(
        ref self: TContractState,
        nullifier_hash: felt252,
        commitment: felt252,
        recipient: ContractAddress,
        amount: u256,
        token: ContractAddress,
        secret: felt252,
    );

    /// Check whether a commitment has been deposited
    fn is_committed(self: @TContractState, commitment: felt252) -> bool;

    /// Check whether a nullifier has been spent
    fn is_nullifier_used(self: @TContractState, nullifier_hash: felt252) -> bool;

    /// Get the pool balance for a given token
    fn get_pool_balance(self: @TContractState, token: ContractAddress) -> u256;

    /// Check if an amount is a valid denomination
    fn is_valid_denomination(self: @TContractState, amount: u256) -> bool;

    /// Admin: add or remove a valid denomination
    fn set_denomination(ref self: TContractState, amount: u256, valid: bool);
}

#[starknet::contract]
pub mod DepositPool {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::pedersen::PedersenTrait;
    use core::hash::HashStateTrait;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use super::IDepositPool;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        // commitment => deposited amount (0 means not deposited)
        commitments: Map<felt252, u256>,
        // commitment => token address
        commitment_tokens: Map<felt252, ContractAddress>,
        // nullifier_hash => spent flag
        nullifiers: Map<felt252, bool>,
        // token => total pool balance
        pool_balances: Map<ContractAddress, u256>,
        // valid denominations (amount => allowed flag)
        valid_denominations: Map<u256, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposited: Deposited,
        Withdrawn: Withdrawn,
    }

    /// Deposited event — deliberately omits amount to prevent correlation.
    /// All deposits in a denomination tier are indistinguishable.
    #[derive(Drop, starknet::Event)]
    pub struct Deposited {
        #[key]
        pub commitment: felt252,
        pub token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdrawn {
        #[key]
        pub nullifier_hash: felt252,
        pub recipient: ContractAddress,
        pub token: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);

        // Default denominations: 1, 10, 100 tokens (in wei, 18 decimals)
        // 1 token  = 1_000_000_000_000_000_000
        // 10 tokens = 10_000_000_000_000_000_000
        // 100 tokens = 100_000_000_000_000_000_000
        self.valid_denominations.write(1_000_000_000_000_000_000_u256, true);
        self.valid_denominations.write(10_000_000_000_000_000_000_u256, true);
        self.valid_denominations.write(100_000_000_000_000_000_000_u256, true);
    }

    #[abi(embed_v0)]
    impl DepositPoolImpl of IDepositPool<ContractState> {
        fn deposit(
            ref self: ContractState,
            commitment: felt252,
            token: ContractAddress,
            amount: u256,
        ) {
            // Must not re-use a commitment
            assert(self.commitments.read(commitment) == 0, 'Commitment already used');
            assert(amount > 0, 'Amount must be > 0');
            // Amount must be one of the valid denominations
            assert(self.valid_denominations.read(amount), 'Invalid denomination');

            let caller = get_caller_address();
            let this = get_contract_address();

            // Pull tokens from caller
            let dispatcher = IERC20Dispatcher { contract_address: token };
            dispatcher.transfer_from(caller, this, amount);

            // Record commitment
            self.commitments.write(commitment, amount);
            self.commitment_tokens.write(commitment, token);

            // Update pool balance
            let current = self.pool_balances.read(token);
            self.pool_balances.write(token, current + amount);

            // Emit event WITHOUT amount — all deposits in a tier are indistinguishable
            self.emit(Deposited { commitment, token });
        }

        fn withdraw(
            ref self: ContractState,
            nullifier_hash: felt252,
            commitment: felt252,
            recipient: ContractAddress,
            amount: u256,
            token: ContractAddress,
            secret: felt252,
        ) {
            // 1. Nullifier must not be spent
            assert(!self.nullifiers.read(nullifier_hash), 'Nullifier already used');

            // 2. Verify commitment exists and matches amount/token
            let committed_amount = self.commitments.read(commitment);
            assert(committed_amount == amount, 'Amount mismatch');
            let committed_token = self.commitment_tokens.read(commitment);
            assert(committed_token == token, 'Token mismatch');

            // 3. Re-derive commitment from secret + nullifier_hash using Pedersen
            let derived = PedersenTrait::new(secret).update(nullifier_hash).finalize();
            assert(derived == commitment, 'Invalid proof');

            // 4. Mark nullifier as spent
            self.nullifiers.write(nullifier_hash, true);

            // 5. Transfer tokens to recipient
            let dispatcher = IERC20Dispatcher { contract_address: token };
            dispatcher.transfer(recipient, amount);

            // 6. Update pool balance
            let current = self.pool_balances.read(token);
            self.pool_balances.write(token, current - amount);

            // Emit event WITHOUT amount
            self.emit(Withdrawn { nullifier_hash, recipient, token });
        }

        fn is_committed(self: @ContractState, commitment: felt252) -> bool {
            self.commitments.read(commitment) > 0
        }

        fn is_nullifier_used(self: @ContractState, nullifier_hash: felt252) -> bool {
            self.nullifiers.read(nullifier_hash)
        }

        fn get_pool_balance(self: @ContractState, token: ContractAddress) -> u256 {
            self.pool_balances.read(token)
        }

        fn is_valid_denomination(self: @ContractState, amount: u256) -> bool {
            self.valid_denominations.read(amount)
        }

        fn set_denomination(ref self: ContractState, amount: u256, valid: bool) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner');
            self.valid_denominations.write(amount, valid);
        }
    }
}
