/// ZeroLink Deposit Pool Contract Tests
///
/// Test cases:
/// 1. Commitment is not found initially
/// 2. Nullifier is not used initially
/// 3. Pool balance starts at zero
/// 4. Deposit reverts on zero amount
/// 5. Deposit reverts on invalid denomination
/// 6. Valid denomination check works
/// 7. Withdraw reverts when no matching deposit
/// 8. Owner can add/remove denominations

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

fn USER() -> ContractAddress {
    contract_address_const::<'USER'>()
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
fn test_valid_denominations_set_by_constructor() {
    let pool = deploy_pool();
    // 1 token (1e18 wei)
    assert(pool.is_valid_denomination(1_000_000_000_000_000_000_u256), 'Should allow 1 token');
    // 10 tokens (10e18 wei)
    assert(pool.is_valid_denomination(10_000_000_000_000_000_000_u256), 'Should allow 10 tokens');
    // 100 tokens (100e18 wei)
    assert(pool.is_valid_denomination(100_000_000_000_000_000_000_u256), 'Should allow 100 tokens');
    // 5 tokens should NOT be valid
    assert(!pool.is_valid_denomination(5_000_000_000_000_000_000_u256), 'Should reject 5 tokens');
    // 0.5 tokens should NOT be valid
    assert(!pool.is_valid_denomination(500_000_000_000_000_000_u256), 'Should reject 0.5 tokens');
}

#[test]
#[should_panic(expected: ('Amount must be > 0',))]
fn test_deposit_reverts_zero_amount() {
    let pool = deploy_pool();

    start_cheat_caller_address(pool.contract_address, OWNER());
    pool.deposit(0x1234, STRK_TOKEN(), 0);
}

#[test]
#[should_panic(expected: ('Invalid denomination',))]
fn test_deposit_reverts_invalid_denomination() {
    let pool = deploy_pool();

    start_cheat_caller_address(pool.contract_address, OWNER());
    // 5 tokens is not a valid denomination
    pool.deposit(0x1234, STRK_TOKEN(), 5_000_000_000_000_000_000_u256);
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

#[test]
fn test_set_denomination_by_owner() {
    let pool = deploy_pool();

    // Add 0.1 token denomination
    start_cheat_caller_address(pool.contract_address, OWNER());
    pool.set_denomination(100_000_000_000_000_000_u256, true);
    stop_cheat_caller_address(pool.contract_address);

    assert(pool.is_valid_denomination(100_000_000_000_000_000_u256), 'Should allow new denom');

    // Remove it
    start_cheat_caller_address(pool.contract_address, OWNER());
    pool.set_denomination(100_000_000_000_000_000_u256, false);
    stop_cheat_caller_address(pool.contract_address);

    assert(!pool.is_valid_denomination(100_000_000_000_000_000_u256), 'Should be removed');
}

#[test]
#[should_panic(expected: ('Only owner',))]
fn test_set_denomination_reverts_non_owner() {
    let pool = deploy_pool();

    start_cheat_caller_address(pool.contract_address, USER());
    pool.set_denomination(100_000_000_000_000_000_u256, true);
}
