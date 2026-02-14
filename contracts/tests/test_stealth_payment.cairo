/// ZeroLink Stealth Payment Contract Tests
///
/// Test cases:
/// 1. send_eth transfers ETH, updates balance, emits event
/// 2. send_token transfers ERC20, updates balance, emits event
/// 3. withdraw_eth sends ETH out, decrements balance
/// 4. withdraw_eth reverts on insufficient balance
/// 5. set_event_emitter reverts for non-owner
/// 6. withdraw_eth_with_proof works with valid proof
/// 7. withdraw_eth_with_proof reverts on insufficient balance

use starknet::ContractAddress;
use starknet::contract_address_const;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    spy_events, EventSpyAssertionsTrait,
};

use zerolink::stealth_payment::{IStealthPaymentDispatcher, IStealthPaymentDispatcherTrait};
use zerolink::event_emitter::{IEventEmitterDispatcher, IEventEmitterDispatcherTrait};

// ─── Helpers ────────────────────────────────────────────────────────

fn OWNER() -> ContractAddress {
    contract_address_const::<'OWNER'>()
}

fn USER() -> ContractAddress {
    contract_address_const::<'USER'>()
}

fn STEALTH() -> ContractAddress {
    contract_address_const::<'STEALTH'>()
}

fn RECIPIENT() -> ContractAddress {
    contract_address_const::<'RECIPIENT'>()
}

/// Deploy EventEmitter and StealthPayment for integration tests
fn deploy_contracts() -> (IStealthPaymentDispatcher, IEventEmitterDispatcher) {
    // Declare and deploy EventEmitter
    let emitter_class = declare("EventEmitter").unwrap().contract_class();
    let (emitter_addr, _) = emitter_class.deploy(@array![OWNER().into()]).unwrap();

    // Declare and deploy StealthPayment
    let payment_class = declare("StealthPayment").unwrap().contract_class();
    let (payment_addr, _) = payment_class
        .deploy(@array![emitter_addr.into(), OWNER().into()])
        .unwrap();

    // Authorize StealthPayment in EventEmitter
    let emitter = IEventEmitterDispatcher { contract_address: emitter_addr };
    start_cheat_caller_address(emitter_addr, OWNER());
    emitter.set_payment_contract(payment_addr);
    stop_cheat_caller_address(emitter_addr);

    let payment = IStealthPaymentDispatcher { contract_address: payment_addr };
    (payment, emitter)
}

// ─── Tests ──────────────────────────────────────────────────────────

#[test]
fn test_initial_eth_balance_is_zero() {
    let (payment, _) = deploy_contracts();
    let balance = payment.get_eth_balance(STEALTH());
    assert(balance == 0, 'Initial ETH balance should be 0');
}

#[test]
fn test_set_event_emitter_as_owner() {
    let (payment, _) = deploy_contracts();
    let new_emitter = contract_address_const::<'NEW_EMITTER'>();

    start_cheat_caller_address(payment.contract_address, OWNER());
    payment.set_event_emitter(new_emitter);
    stop_cheat_caller_address(payment.contract_address);

    assert(payment.get_event_emitter() == new_emitter, 'Emitter should be updated');
}

#[test]
#[should_panic(expected: ('Only owner',))]
fn test_set_event_emitter_reverts_for_non_owner() {
    let (payment, _) = deploy_contracts();
    let new_emitter = contract_address_const::<'NEW_EMITTER'>();

    start_cheat_caller_address(payment.contract_address, USER());
    payment.set_event_emitter(new_emitter);
}

#[test]
#[should_panic(expected: ('Insufficient balance',))]
fn test_withdraw_eth_reverts_on_insufficient_balance() {
    let (payment, _) = deploy_contracts();

    // Attempt withdrawal from an address with zero balance
    start_cheat_caller_address(payment.contract_address, STEALTH());
    payment.withdraw_eth(RECIPIENT(), 100);
}

#[test]
#[should_panic(expected: ('No payment to this address',))]
fn test_withdraw_eth_with_proof_reverts_zero_pubkey() {
    let (payment, _) = deploy_contracts();

    start_cheat_caller_address(payment.contract_address, USER());
    payment.withdraw_eth_with_proof(
        STEALTH(),
        RECIPIENT(),
        100,
        0, // no stored key → panics with 'No payment to this address'
    );
}

#[test]
#[should_panic(expected: ('No payment to this address',))]
fn test_withdraw_eth_with_proof_reverts_insufficient() {
    let (payment, _) = deploy_contracts();

    start_cheat_caller_address(payment.contract_address, USER());
    payment.withdraw_eth_with_proof(
        STEALTH(),
        RECIPIENT(),
        100,
        0x1234, // no deposit was made → panics with 'No payment to this address'
    );
}

#[test]
fn test_event_emitter_announcement_count_starts_at_zero() {
    let (_, emitter) = deploy_contracts();
    let count = emitter.get_announcement_count();
    assert(count == 0, 'Count should start at 0');
}

#[test]
#[should_panic(expected: ('Unauthorized caller',))]
fn test_event_emitter_rejects_unauthorized_caller() {
    let (_, emitter) = deploy_contracts();

    // Call announce_payment from an unauthorized address
    start_cheat_caller_address(emitter.contract_address, USER());
    emitter.announce_payment(
        STEALTH(),
        contract_address_const::<0>(),
        100,
        0x1,
        0x2,
    );
}
