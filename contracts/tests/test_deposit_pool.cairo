/// ZeroLink Deposit Pool Contract Tests
///
/// Test cases:
/// 1. Commitment is not found initially
/// 2. Nullifier is not used initially
/// 3. Pool balance starts at zero

use starknet::ContractAddress;
use starknet::contract_address_const;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
};

use zerolink::deposit_pool::{IDepositPoolDispatcher, IDepositPoolDispatcherTrait};

// ─── Helpers ────────────────────────────────────────────────────────

fn OWNER() -> ContractAddress {
    contract_address_const::<'OWNER'>()
}

fn STRK_TOKEN() -> ContractAddress {
    // STRK ERC-20 on Sepolia
    contract_address_const::<0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d>()
}

fn deploy_pool() -> IDepositPoolDispatcher {
    let pool_class = declare("DepositPool").unwrap().contract_class();
    let (pool_addr, _) = pool_class.deploy(@array![OWNER().into()]).unwrap();
    IDepositPoolDispatcher { contract_address: pool_addr }
}

// ─── Tests ──────────────────────────────────────────────────────────

#[test]
fn test_commitment_not_found_initially() {
    let pool = deploy_pool();
    assert(!pool.is_committed(0x12345), 'Should not be committed');
}

#[test]
fn test_nullifier_not_used_initially() {
    let pool = deploy_pool();
    assert(!pool.is_nullifier_used(0xABCDE), 'Should not be used');
}

#[test]
fn test_pool_balance_starts_at_zero() {
    let pool = deploy_pool();
    let balance = pool.get_pool_balance(STRK_TOKEN());
    assert(balance == 0, 'Balance should start at 0');
}

#[test]
#[should_panic(expected: ('Amount must be > 0',))]
fn test_deposit_reverts_zero_amount() {
    let pool = deploy_pool();

    start_cheat_caller_address(pool.contract_address, OWNER());
    pool.deposit(0x1234, STRK_TOKEN(), 0);
}

#[test]
#[should_panic(expected: ('Amount mismatch',))]
fn test_withdraw_reverts_no_matching_deposit() {
    // Attempting to withdraw when nothing has been deposited
    // should fail with 'Amount mismatch' because committed_amount == 0
    let pool = deploy_pool();

    start_cheat_caller_address(pool.contract_address, OWNER());
    pool.withdraw(
        0xAABB,          // nullifier_hash
        0xCCDD,          // commitment
        OWNER(),         // recipient
        100,             // amount (won't match — nothing deposited)
        STRK_TOKEN(),    // token
        0xEEFF,          // secret
    );
}
