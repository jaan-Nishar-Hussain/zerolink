# Contract Deployment Guide

## Prerequisites
- [Scarb](https://docs.swmansion.com/scarb/) installed
- [Starkli](https://book.starkli.rs/) installed
- A funded Starknet Sepolia account

## Build
```bash
scarb build
```

## Run Tests
```bash
snforge test
```

## Declare & Deploy

### 1. EventEmitter
```bash
starkli declare target/dev/zerolink_EventEmitter.contract_class.json
starkli deploy <EVENT_EMITTER_CLASS_HASH> <OWNER_ADDRESS>
```

### 2. StealthPayment
```bash
starkli declare target/dev/zerolink_StealthPayment.contract_class.json
starkli deploy <STEALTH_PAYMENT_CLASS_HASH> <EVENT_EMITTER_ADDRESS> <OWNER_ADDRESS>
```

### 3. TokenAdapter
```bash
starkli declare target/dev/zerolink_TokenAdapter.contract_class.json
starkli deploy <TOKEN_ADAPTER_CLASS_HASH> <OWNER_ADDRESS>
```

### 4. DepositPool
```bash
starkli declare target/dev/zerolink_DepositPool.contract_class.json
starkli deploy <DEPOSIT_POOL_CLASS_HASH> <OWNER_ADDRESS>
```

## Post-Deployment

1. **Authorize StealthPayment in EventEmitter:**
   ```bash
   starkli invoke <EVENT_EMITTER_ADDRESS> set_payment_contract <STEALTH_PAYMENT_ADDRESS>
   ```

2. **Update frontend config** — set contract addresses in `frontend/.env`

3. **Update backend config** — set contract addresses in `backend/.env`

4. **Create & fund the relayer account** (for sender privacy):
   - Deploy an OpenZeppelin account contract on Sepolia
   - Fund it with STRK for gas
   - Set `RELAYER_PRIVATE_KEY` and `RELAYER_ACCOUNT_ADDRESS` in `backend/.env`

## Current Sepolia Deployment

See `deployed_addresses.json` for the latest deployed addresses and class hashes.
