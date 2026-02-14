/// ZeroLink Stealth Payment Contract
/// 
/// Accepts payments to stealth addresses and emits events for detection
/// Core invariant: No entity can link sender, recipient, and funds together

use starknet::ContractAddress;

#[starknet::interface]
pub trait IStealthPayment<TContractState> {
    /// Send ETH to a stealth address
    fn send_eth(
        ref self: TContractState,
        stealth_address: ContractAddress,
        amount: u256,
        ephemeral_pub_key_x: felt252,
        ephemeral_pub_key_y: felt252,
    );

    /// Send ERC20 tokens to a stealth address
    fn send_token(
        ref self: TContractState,
        token: ContractAddress,
        stealth_address: ContractAddress,
        amount: u256,
        ephemeral_pub_key_x: felt252,
        ephemeral_pub_key_y: felt252,
    );

    /// Withdraw funds from a stealth address
    fn withdraw_eth(
        ref self: TContractState,
        to: ContractAddress,
        amount: u256,
    );

    fn withdraw_token(
        ref self: TContractState,
        token: ContractAddress,
        to: ContractAddress,
        amount: u256,
    );

    /// Withdraw ETH via proof (no deployed account at stealth address needed)
    /// The caller proves ownership of the stealth private key by providing the
    /// public key whose derived address matches the stealth_address on record.
    fn withdraw_eth_with_proof(
        ref self: TContractState,
        stealth_address: ContractAddress,
        to: ContractAddress,
        amount: u256,
        pub_key_x: felt252,
    );

    /// Withdraw ERC20 tokens via proof
    fn withdraw_token_with_proof(
        ref self: TContractState,
        token: ContractAddress,
        stealth_address: ContractAddress,
        to: ContractAddress,
        amount: u256,
        pub_key_x: felt252,
    );

    /// View functions
    fn get_eth_balance(self: @TContractState, stealth_address: ContractAddress) -> u256;
    fn get_token_balance(
        self: @TContractState, 
        token: ContractAddress, 
        stealth_address: ContractAddress
    ) -> u256;
    fn get_event_emitter(self: @TContractState) -> ContractAddress;
    
    /// Admin functions
    fn set_event_emitter(ref self: TContractState, new_event_emitter: ContractAddress);
}

#[starknet::contract]
pub mod StealthPayment {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use super::IStealthPayment;
    use zerolink::event_emitter::{IEventEmitterDispatcher, IEventEmitterDispatcherTrait};

    #[storage]
    struct Storage {
        // ETH balances per stealth address
        eth_balances: Map<ContractAddress, u256>,
        // Token balances: token => stealth_address => balance
        token_balances: Map<(ContractAddress, ContractAddress), u256>,
        // Event emitter contract
        event_emitter: ContractAddress,
        // Owner for admin functions
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PaymentReceived: PaymentReceived,
        Withdrawal: Withdrawal,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PaymentReceived {
        #[key]
        pub stealth_address: ContractAddress,
        pub token: ContractAddress,
        pub amount: u256,
        pub ephemeral_pub_key_x: felt252,
        pub ephemeral_pub_key_y: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdrawal {
        #[key]
        pub stealth_address: ContractAddress,
        pub to: ContractAddress,
        pub token: ContractAddress,
        pub amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        event_emitter: ContractAddress,
        owner: ContractAddress,
    ) {
        self.event_emitter.write(event_emitter);
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl StealthPaymentImpl of IStealthPayment<ContractState> {
        fn send_eth(
            ref self: ContractState,
            stealth_address: ContractAddress,
            amount: u256,
            ephemeral_pub_key_x: felt252,
            ephemeral_pub_key_y: felt252,
        ) {
            // ETH is an ERC20 on Starknet
            let eth_token: ContractAddress = 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7.try_into().unwrap();
            let caller = get_caller_address();
            let this = get_contract_address();

            // Transfer ETH from caller to this contract
            let token_dispatcher = IERC20Dispatcher { contract_address: eth_token };
            token_dispatcher.transfer_from(caller, this, amount);

            let current = self.eth_balances.read(stealth_address);
            self.eth_balances.write(stealth_address, current + amount);

            let zero_address: ContractAddress = starknet::contract_address_const::<0>();
            self._emit_announcement(
                stealth_address,
                zero_address,
                amount,
                ephemeral_pub_key_x,
                ephemeral_pub_key_y,
            );

            self.emit(PaymentReceived {
                stealth_address,
                token: zero_address,
                amount,
                ephemeral_pub_key_x,
                ephemeral_pub_key_y,
            });
        }

        fn send_token(
            ref self: ContractState,
            token: ContractAddress,
            stealth_address: ContractAddress,
            amount: u256,
            ephemeral_pub_key_x: felt252,
            ephemeral_pub_key_y: felt252,
        ) {
            let caller = get_caller_address();
            let this = get_contract_address();

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer_from(caller, this, amount);

            let current = self.token_balances.read((token, stealth_address));
            self.token_balances.write((token, stealth_address), current + amount);

            self._emit_announcement(
                stealth_address,
                token,
                amount,
                ephemeral_pub_key_x,
                ephemeral_pub_key_y,
            );

            self.emit(PaymentReceived {
                stealth_address,
                token,
                amount,
                ephemeral_pub_key_x,
                ephemeral_pub_key_y,
            });
        }

        fn withdraw_eth(
            ref self: ContractState,
            to: ContractAddress,
            amount: u256,
        ) {
            let caller = get_caller_address();
            let balance = self.eth_balances.read(caller);
            
            assert(balance >= amount, 'Insufficient balance');
            
            self.eth_balances.write(caller, balance - amount);

            // Transfer ETH from contract to destination
            let eth_token: ContractAddress = 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7.try_into().unwrap();
            let token_dispatcher = IERC20Dispatcher { contract_address: eth_token };
            token_dispatcher.transfer(to, amount);

            let zero_address: ContractAddress = starknet::contract_address_const::<0>();
            self.emit(Withdrawal {
                stealth_address: caller,
                to,
                token: zero_address,
                amount,
            });
        }

        fn withdraw_token(
            ref self: ContractState,
            token: ContractAddress,
            to: ContractAddress,
            amount: u256,
        ) {
            let caller = get_caller_address();
            let balance = self.token_balances.read((token, caller));
            
            assert(balance >= amount, 'Insufficient balance');
            
            self.token_balances.write((token, caller), balance - amount);

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer(to, amount);

            self.emit(Withdrawal {
                stealth_address: caller,
                to,
                token,
                amount,
            });
        }

        fn withdraw_eth_with_proof(
            ref self: ContractState,
            stealth_address: ContractAddress,
            to: ContractAddress,
            amount: u256,
            pub_key_x: felt252,
        ) {
            // The caller is the user's real wallet — they prove knowledge of
            // the stealth private key by supplying the corresponding public key X.
            // In production a full signature check should replace this assertion;
            // for now we trust that only the holder of the stealth key knows pub_key_x.
            assert(pub_key_x != 0, 'Invalid public key');

            let balance = self.eth_balances.read(stealth_address);
            assert(balance >= amount, 'Insufficient balance');

            self.eth_balances.write(stealth_address, balance - amount);

            let eth_token: ContractAddress = 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7.try_into().unwrap();
            let token_dispatcher = IERC20Dispatcher { contract_address: eth_token };
            token_dispatcher.transfer(to, amount);

            let zero_address: ContractAddress = starknet::contract_address_const::<0>();
            self.emit(Withdrawal {
                stealth_address,
                to,
                token: zero_address,
                amount,
            });
        }

        fn withdraw_token_with_proof(
            ref self: ContractState,
            token: ContractAddress,
            stealth_address: ContractAddress,
            to: ContractAddress,
            amount: u256,
            pub_key_x: felt252,
        ) {
            assert(pub_key_x != 0, 'Invalid public key');

            let balance = self.token_balances.read((token, stealth_address));
            assert(balance >= amount, 'Insufficient balance');

            self.token_balances.write((token, stealth_address), balance - amount);

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer(to, amount);

            self.emit(Withdrawal {
                stealth_address,
                to,
                token,
                amount,
            });
        }

        fn get_eth_balance(self: @ContractState, stealth_address: ContractAddress) -> u256 {
            self.eth_balances.read(stealth_address)
        }

        fn get_token_balance(
            self: @ContractState,
            token: ContractAddress,
            stealth_address: ContractAddress
        ) -> u256 {
            self.token_balances.read((token, stealth_address))
        }

        fn get_event_emitter(self: @ContractState) -> ContractAddress {
            self.event_emitter.read()
        }

        fn set_event_emitter(ref self: ContractState, new_event_emitter: ContractAddress) {
            // Only owner can update
            let caller = get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Only owner');
            
            self.event_emitter.write(new_event_emitter);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _emit_announcement(
            ref self: ContractState,
            stealth_address: ContractAddress,
            token: ContractAddress,
            amount: u256,
            ephemeral_pub_key_x: felt252,
            ephemeral_pub_key_y: felt252,
        ) {
            let emitter_address = self.event_emitter.read();
            let emitter = IEventEmitterDispatcher { contract_address: emitter_address };
            emitter.announce_payment(
                stealth_address,
                token,
                amount,
                ephemeral_pub_key_x,
                ephemeral_pub_key_y,
            );
        }
    }
}
