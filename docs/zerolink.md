🐙 PRIVATE-PAY — FULL TECHNICAL PRODUCT REQUIREMENTS DOCUMENT
0. SYSTEM OVERVIEW (GLOBAL)
Product Definition

Private-Pay is a stealth-payment infrastructure that enables private, unlinkable, untraceable crypto payments using:

Static payment links

Infinite stealth addresses

Client-side cryptography

Starknet settlement

Optional privacy amplification layers

Core Invariant (NEVER BREAK)

No component except the user ever knows the mapping between identity, payment, and funds.

1️⃣ FRONTEND PRD (React + Vite)
1.1 Frontend Objectives
Objective	Requirement
Privacy	100% stealth derivation client-side
UX	Stripe-like payment experience
Security	Zero private key leakage
Compatibility	Native Starknet wallet support
Recoverability	Deterministic rescan
1.2 Frontend Architecture
Frontend (React + Vite)
├── Wallet Connector
├── Key Management Layer
├── Stealth Address Engine
├── Payment Link Resolver
├── Transaction Monitor
├── Withdrawal Engine
├── Dashboard (Private)
└── Backend API Client

1.3 User Roles
Receiver

Creates payment link

Generates meta keys

Detects stealth payments

Withdraws funds

Sender

Opens payment link

Derives stealth address

Sends funds

1.4 Key Management (CRITICAL)
Keys Generated Client-Side
spendPrivKey   (secret)
spendPubKey
viewingPrivKey (secret)
viewingPubKey

Storage Requirements

Encrypted using WebCrypto

Stored in IndexedDB

Exportable as encrypted backup

NEVER sent to backend

1.5 Payment Link Flow (Receiver)

Wallet connects

Meta keys generated

Alias registered

Static payment link created

No address is ever generated at this stage.

1.6 Stealth Address Flow (Sender)

Fetch metaAddress

Generate ephemeral keypair

Compute ECDH shared secret

Hash → tweak

Derive stealth public key

Convert to Starknet address

Send funds

1.7 Payment Detection (Receiver)

Listen to Starknet events

For each event:

Compute shared secret

Derive stealth address

Check balance

If positive → payment detected

1.8 Withdrawal Flow

Derive stealth private key

Sign transaction

Transfer to:

Main wallet

Another stealth wallet

DarkPool (future)

1.9 Frontend Packages
Core
react
vite
typescript
zustand

Starknet Wallets
starknet
@starknet-react/core
@starknet-react/chains
@starknet-react/wallets
@argent/get-starknet

Cryptography
@noble/secp256k1
@noble/hashes
@noble/curves

Storage & Security
idb
crypto-js

2️⃣ BACKEND PRD (Node.js + PostgreSQL + Prisma)
2.1 Backend Philosophy

Backend is UX infrastructure only.

❌ No custody
❌ No cryptography
❌ No stealth derivation

2.2 Backend Architecture
Backend
├── API Gateway
├── Alias Registry
├── Event Indexer
├── Notification Engine
├── Rate Limiter
└── PostgreSQL (Prisma)

2.3 Backend Responsibilities
A. Alias → Meta Address Mapping

Stored:

Alias

spendPubKey

viewingPubKey

Not stored:

Private keys

Wallet addresses

Stealth addresses

B. Event Indexing (Optional, Non-Trusted)

Index Starknet events

Store ephemeral public keys

Speed up detection

Not required for correctness

C. Recovery Support

Allow rescan from block N

No decryption ever

2.4 Database Schema (Prisma)
model User {
  id            String   @id @default(uuid())
  alias         String   @unique
  spendPubKey   String
  viewingPubKey String
  createdAt     DateTime @default(now())
}

model StealthEvent {
  id            String   @id @default(uuid())
  ephemeralPub  String
  txHash        String
  blockNumber   Int
  createdAt     DateTime @default(now())
}

2.5 Backend Packages
node
express
typescript
dotenv
cors
helmet
zod
jsonwebtoken

Database
prisma
@prisma/client
pg

Starknet Indexing
starknet

3️⃣ CRYPTOGRAPHY & PRIVACY PRD (CORE PROTOCOL)
3.1 Cryptographic Goals
Goal	Mechanism
Unlinkability	Stealth addresses
Forward secrecy	Ephemeral keys
Detection privacy	Viewing keys
Spend privacy	Derived private keys
3.2 Cryptographic Primitives
Primitive	Purpose
secp256k1	Key derivation
ECDH	Shared secret
SHA-256 / Keccak	Tweaks
Elliptic addition	Key derivation
3.3 Stealth Address Derivation
Sender:
sharedSecret = ECDH(ephemeralPriv, viewingPub)
tweak = Hash(sharedSecret)
stealthPub = spendPub + tweak·G

Receiver:
sharedSecret = ECDH(viewingPriv, ephemeralPub)
stealthPriv = spendPriv + tweak

3.4 Security Guarantees

No address reuse

No sender-receiver link

No graph analysis

No backend trust

3.5 Threat Model
Covered

Chain analysis

Address clustering

Identity exposure

Not Covered (Phase-1)

Amount correlation

Timing attacks

4️⃣ STARKNET INTEGRATION PRD
4.1 Why Starknet

Account abstraction

Cheap transactions

Cairo security model

ZK-friendly future

4.2 Smart Contract Architecture
Starknet Contracts
├── StealthPayment.cairo
├── EventEmitter.cairo
└── TokenAdapter.cairo

4.3 Contract Responsibilities
A. Accept Payments

ETH / ERC-20

No recipient storage

B. Emit Events
event StealthPayment {
  ephemeral_pubkey: felt252,
  amount: u256
}

C. No State Linking

No mappings

No identity storage

4.4 Starknet Packages
Contracts
scarb
starknet-foundry

Frontend SDK
starknet
@starknet-react/core
@starknet-react/wallets

Testing
pytest
cairo-test

5️⃣ NON-FUNCTIONAL REQUIREMENTS
Category	Requirement
Scalability	Infinite stealth addresses
Security	Client-side crypto only
UX	≤2 clicks to pay
Recovery	Deterministic rescan
Compliance	Optional reporting