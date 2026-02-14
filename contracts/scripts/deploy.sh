#!/bin/bash
# ZeroLink Contract Deployment Script
# Deploys contracts to Starknet Sepolia testnet

set -e

echo "🚀 ZeroLink Contract Deployment"
echo "================================"

# Configuration
NETWORK="sepolia"

# Check for private key
if [ -z "$STARKNET_PRIVATE_KEY" ]; then
    echo "❌ Error: STARKNET_PRIVATE_KEY environment variable not set"
    exit 1
fi

if [ -z "$STARKNET_ACCOUNT_ADDRESS" ]; then
    echo "❌ Error: STARKNET_ACCOUNT_ADDRESS environment variable not set"
    exit 1
fi

echo "📦 Building contracts..."
scarb build

echo ""
echo "🔐 Using account: $STARKNET_ACCOUNT_ADDRESS"
echo "🌐 Network: $NETWORK"
echo ""

# Import account
echo "📥 Importing account..."
# Using 'oz' as account type
sncast account import \
    --name zerolink \
    --address "$STARKNET_ACCOUNT_ADDRESS" \
    --private-key "$STARKNET_PRIVATE_KEY" \
    --type oz \
    --network sepolia \
    --silent || true

# Helper function to run sncast commands
run_sncast() {
    local cmd=$1
    shift
    # Using --network sepolia instead of --url
    sncast --account zerolink --wait $cmd --network sepolia "$@"
}

echo "📝 Step 1: Declaring EventEmitter contract..."
EVENT_EMITTER_DECLARE=$(run_sncast declare --contract-name EventEmitter 2>&1) || true
echo "$EVENT_EMITTER_DECLARE"

EVENT_EMITTER_CLASS_HASH=$(echo "$EVENT_EMITTER_DECLARE" | grep "class_hash:" | awk '{print $2}')
if [ -z "$EVENT_EMITTER_CLASS_HASH" ]; then
    EVENT_EMITTER_CLASS_HASH=$(echo "$EVENT_EMITTER_DECLARE" | grep -oE '0x[a-fA-F0-9]+' | head -1)
fi
echo "   Class hash: $EVENT_EMITTER_CLASS_HASH"

echo ""
echo "📝 Step 2: Deploying EventEmitter..."
EVENT_EMITTER_DEPLOY=$(run_sncast deploy --class-hash "$EVENT_EMITTER_CLASS_HASH" \
    --constructor-calldata "$STARKNET_ACCOUNT_ADDRESS" 2>&1) || true
echo "$EVENT_EMITTER_DEPLOY"

EVENT_EMITTER_ADDRESS=$(echo "$EVENT_EMITTER_DEPLOY" | grep "contract_address:" | awk '{print $2}')
echo "   Deployed at: $EVENT_EMITTER_ADDRESS"

echo ""
echo "📝 Step 3: Declaring StealthPayment contract..."
STEALTH_PAYMENT_DECLARE=$(run_sncast declare --contract-name StealthPayment 2>&1) || true
echo "$STEALTH_PAYMENT_DECLARE"

STEALTH_PAYMENT_CLASS_HASH=$(echo "$STEALTH_PAYMENT_DECLARE" | grep "class_hash:" | awk '{print $2}')
if [ -z "$STEALTH_PAYMENT_CLASS_HASH" ]; then
    STEALTH_PAYMENT_CLASS_HASH=$(echo "$STEALTH_PAYMENT_DECLARE" | grep -oE '0x[a-fA-F0-9]+' | head -1)
fi
echo "   Class hash: $STEALTH_PAYMENT_CLASS_HASH"

echo ""
echo "📝 Step 4: Deploying StealthPayment..."
STEALTH_PAYMENT_DEPLOY=$(run_sncast deploy --class-hash "$STEALTH_PAYMENT_CLASS_HASH" \
    --constructor-calldata "$EVENT_EMITTER_ADDRESS" "$STARKNET_ACCOUNT_ADDRESS" 2>&1) || true
echo "$STEALTH_PAYMENT_DEPLOY"

STEALTH_PAYMENT_ADDRESS=$(echo "$STEALTH_PAYMENT_DEPLOY" | grep "contract_address:" | awk '{print $2}')
echo "   Deployed at: $STEALTH_PAYMENT_ADDRESS"

echo ""
echo "📝 Step 5: Declaring TokenAdapter contract..."
TOKEN_ADAPTER_DECLARE=$(run_sncast declare --contract-name TokenAdapter 2>&1) || true
echo "$TOKEN_ADAPTER_DECLARE"

TOKEN_ADAPTER_CLASS_HASH=$(echo "$TOKEN_ADAPTER_DECLARE" | grep "class_hash:" | awk '{print $2}')
if [ -z "$TOKEN_ADAPTER_CLASS_HASH" ]; then
    TOKEN_ADAPTER_CLASS_HASH=$(echo "$TOKEN_ADAPTER_DECLARE" | grep -oE '0x[a-fA-F0-9]+' | head -1)
fi
echo "   Class hash: $TOKEN_ADAPTER_CLASS_HASH"

echo ""
echo "📝 Step 6: Deploying TokenAdapter..."
TOKEN_ADAPTER_DEPLOY=$(run_sncast deploy --class-hash "$TOKEN_ADAPTER_CLASS_HASH" \
    --constructor-calldata "$STARKNET_ACCOUNT_ADDRESS" 2>&1) || true
echo "$TOKEN_ADAPTER_DEPLOY"

TOKEN_ADAPTER_ADDRESS=$(echo "$TOKEN_ADAPTER_DEPLOY" | grep "contract_address:" | awk '{print $2}')
echo "   Deployed at: $TOKEN_ADAPTER_ADDRESS"

echo ""
echo "📝 Step 7: Configuring EventEmitter with StealthPayment..."
run_sncast invoke --contract-address "$EVENT_EMITTER_ADDRESS" \
    --function set_payment_contract \
    --calldata "$STEALTH_PAYMENT_ADDRESS" 2>&1 || true

echo ""
echo "📝 Step 8: Declaring DepositPool contract..."
DEPOSIT_POOL_DECLARE=$(run_sncast declare --contract-name DepositPool 2>&1) || true
echo "$DEPOSIT_POOL_DECLARE"

DEPOSIT_POOL_CLASS_HASH=$(echo "$DEPOSIT_POOL_DECLARE" | grep "class_hash:" | awk '{print $2}')
if [ -z "$DEPOSIT_POOL_CLASS_HASH" ]; then
    DEPOSIT_POOL_CLASS_HASH=$(echo "$DEPOSIT_POOL_DECLARE" | grep -oE '0x[a-fA-F0-9]+' | head -1)
fi
echo "   Class hash: $DEPOSIT_POOL_CLASS_HASH"

echo ""
echo "📝 Step 9: Deploying DepositPool..."
DEPOSIT_POOL_DEPLOY=$(run_sncast deploy --class-hash "$DEPOSIT_POOL_CLASS_HASH" \
    --constructor-calldata "$STARKNET_ACCOUNT_ADDRESS" 2>&1) || true
echo "$DEPOSIT_POOL_DEPLOY"

DEPOSIT_POOL_ADDRESS=$(echo "$DEPOSIT_POOL_DEPLOY" | grep "contract_address:" | awk '{print $2}')
echo "   Deployed at: $DEPOSIT_POOL_ADDRESS"

echo ""
echo "✅ Deployment Complete!"
echo "========================"
echo ""
echo "Contract Addresses:"
echo "  EventEmitter:    $EVENT_EMITTER_ADDRESS"
echo "  StealthPayment:  $STEALTH_PAYMENT_ADDRESS"
echo "  TokenAdapter:    $TOKEN_ADAPTER_ADDRESS"
echo "  DepositPool:     $DEPOSIT_POOL_ADDRESS"

# Save to file
cat > deployed_addresses.json << EOF
{
  "network": "$NETWORK",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {
    "EventEmitter": "$EVENT_EMITTER_ADDRESS",
    "StealthPayment": "$STEALTH_PAYMENT_ADDRESS",
    "TokenAdapter": "$TOKEN_ADAPTER_ADDRESS",
    "DepositPool": "$DEPOSIT_POOL_ADDRESS"
  }
}
EOF

echo ""
echo "📄 Addresses saved to deployed_addresses.json"
