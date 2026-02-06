/// ZeroLink Event Emitter Contract
/// 
/// Emits standardized events for stealth payment announcements
/// Indexers monitor this contract to detect payments

use starknet::ContractAddress;

#[starknet::interface]
pub trait IEventEmitter<TContractState> {
    /// Announce a stealth payment (called by StealthPayment contract)
    fn announce_payment(
        ref self: TContractState,
        stealth_address: ContractAddress,
        token: ContractAddress,
        amount: u256,
        ephemeral_pub_key_x: felt252,
        ephemeral_pub_key_y: felt252,
    );

    /// Get the authorized payment contract
    fn get_payment_contract(self: @TContractState) -> ContractAddress;
    
    /// Set authorized payment contract (owner only)
    fn set_payment_contract(ref self: TContractState, payment_contract: ContractAddress);

    /// Get total announcement count
    fn get_announcement_count(self: @TContractState) -> u256;
}

#[starknet::contract]
pub mod EventEmitter {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::IEventEmitter;

    #[storage]
    struct Storage {
        // Authorized payment contract
        payment_contract: ContractAddress,
        // Owner for admin functions
        owner: ContractAddress,
        // Announcement counter
        announcement_count: u256,
    }

    /// Main event that indexers listen for
    /// Contains all info needed for recipients to detect their payments
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        StealthPaymentAnnouncement: StealthPaymentAnnouncement,
        PaymentContractUpdated: PaymentContractUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StealthPaymentAnnouncement {
        /// The stealth address that received funds
        #[key]
        pub stealth_address: ContractAddress,
        /// Token contract (0x0 for ETH)
        #[key]
        pub token: ContractAddress,
        /// Amount transferred
        pub amount: u256,
        /// Ephemeral public key X coordinate
        pub ephemeral_pub_key_x: felt252,
        /// Ephemeral public key Y coordinate
        pub ephemeral_pub_key_y: felt252,
        /// Block timestamp
        pub timestamp: u64,
        /// Announcement index
        pub index: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PaymentContractUpdated {
        pub old_contract: ContractAddress,
        pub new_contract: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
    ) {
        self.owner.write(owner);
        self.announcement_count.write(0);
    }

    #[abi(embed_v0)]
    impl EventEmitterImpl of IEventEmitter<ContractState> {
        /// Announce a stealth payment
        /// Only authorized payment contract can call this
        fn announce_payment(
            ref self: ContractState,
            stealth_address: ContractAddress,
            token: ContractAddress,
            amount: u256,
            ephemeral_pub_key_x: felt252,
            ephemeral_pub_key_y: felt252,
        ) {
            // Verify caller is authorized payment contract
            let caller = get_caller_address();
            let authorized = self.payment_contract.read();
            assert(caller == authorized, 'Unauthorized caller');

            // Increment counter
            let index = self.announcement_count.read();
            self.announcement_count.write(index + 1);

            // Emit announcement event
            self.emit(StealthPaymentAnnouncement {
                stealth_address,
                token,
                amount,
                ephemeral_pub_key_x,
                ephemeral_pub_key_y,
                timestamp: get_block_timestamp(),
                index,
            });
        }

        fn get_payment_contract(self: @ContractState) -> ContractAddress {
            self.payment_contract.read()
        }

        fn set_payment_contract(ref self: ContractState, payment_contract: ContractAddress) {
            // Only owner can update
            let caller = get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner');

            let old = self.payment_contract.read();
            self.payment_contract.write(payment_contract);

            self.emit(PaymentContractUpdated {
                old_contract: old,
                new_contract: payment_contract,
            });
        }

        fn get_announcement_count(self: @ContractState) -> u256 {
            self.announcement_count.read()
        }
    }
}
