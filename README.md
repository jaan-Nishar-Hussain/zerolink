# 🔗 ZeroLink — Private Stealth Payments on Starknet

ZeroLink enables **private, unlinkable crypto payments** using stealth addresses on Starknet. Recipients share a static payment link; senders derive a one-time stealth address. No one — not even the backend — can link sender, recipient, and funds together.

## ✨ Features

| Feature | Status |
|---------|--------|
| Stealth address derivation (EIP-5564 style) | ✅ |
| Static payment links via alias registry | ✅ |
| Client-side key management (WebCrypto + IndexedDB) | ✅ |
| On-chain event indexing + SSE notifications | ✅ |
| Withdrawal via proof (no deployed account needed) | ✅ |
| Deposit pool for sender privacy | ✅ |
| Relayer for anonymous withdrawals | ✅ |
| Payment rescan / recovery | ✅ |

## 🏗️ Architecture

```
frontend/          React + Vite + TypeScript
├── crypto/        Stealth key derivation, ECDH, withdrawal
├── pages/         Pay, Withdraw, Transactions, Settings
└── lib/           API client, contracts, state

backend/           Node.js + Express + Prisma + PostgreSQL
├── routes/        Alias, Announcements, Notifications, Relay
├── indexer.ts     Starknet event poller
└── relayer.ts     Anonymous tx submitter

contracts/         Cairo (Starknet)
├── stealth_payment.cairo    Core payment + withdrawal
├── event_emitter.cairo      Announcement events
├── deposit_pool.cairo       Commitment-based sender privacy
└── token_adapter.cairo      ERC20 helpers
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Scarb + snforge (for contracts)

### Backend
```bash
cd backend
cp .env.example .env  # fill in your values
npm install
npx prisma migrate dev
npm run dev           # API on :3001
npm run indexer:dev   # event indexer
```

### Frontend
```bash
cd frontend
cp .env.example .env  # fill in your values
npm install
npm run dev           # Vite on :5173
```

### Contracts
```bash
cd contracts
scarb build
snforge test
```

## 🔐 Privacy Guarantees

- **Recipient hidden**: Stealth addresses are unique per payment — no address reuse
- **Sender hidden** (via deposit pool): Pedersen commitments break the on-chain link
- **Amount hidden**: Private amount layer obfuscates transaction values
- **Backend is untrusted**: All cryptography happens client-side

## 📄 License

MIT
