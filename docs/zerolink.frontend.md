# ZeroLink – Frontend PRD

## 1. Frontend Purpose

The ZeroLink frontend is a **privacy-first web application** that acts as the user’s only interface to create, receive, monitor, and withdraw private payments.

The frontend is **stateful for UX but stateless for security**:

* No private keys stored
* No sensitive cryptographic material persisted
* All cryptography happens client-side

**Frontend responsibility:**

> Translate complex cryptography and Starknet interactions into a simple, Stripe-like payment experience.

---

## 2. Design Principles

1. **Privacy by default** – no address exposure, no history leakage
2. **Minimal cognitive load** – users never see cryptographic terms
3. **Non-custodial UX** – user signs everything with their wallet
4. **Failure-safe** – frontend crash must never risk funds
5. **Composable** – future wallet / SDK integration ready

---

## 3. Tech Stack

### 3.1 Core Framework

* React (18+)
* Vite (build tool)
* TypeScript (strict mode enabled)

### 3.2 Starknet & Wallet Integration

* starknet.js (core Starknet SDK)
* get-starknet (wallet discovery & connection)
* @argent/get-starknet (Argent support)

### 3.3 Cryptography (Client-Side Only)

* @noble/secp256k1 (ECDH, key derivation)
* @noble/hashes (SHA3 / Keccak)
* bigint-buffer (BigInt ↔ buffer helpers)

### 3.4 State Management

* zustand (lightweight global state)
* immer (optional, for immutable updates)

### 3.5 Networking

* axios (typed API calls)
* eventsource-parser (optional, event streams)

### 3.6 Styling & UI

* tailwindcss
* clsx (conditional class handling)
* lucide-react (icons)

### 3.7 Utilities

* nanoid (secure random slugs)
* dayjs (timestamps)
* zod (runtime validation)

### 3.8 Build & Quality

* eslint
* prettier
* vitest (unit testing)

---

## 4. Core User Flows

### 4.1 Wallet Connection

**Supported wallets:**

* Braavos
* Argent

**Flow:**

1. User clicks “Connect Wallet”
2. Wallet signature verifies ownership
3. Session established (no auth tokens)

---

### 4.2 User Onboarding & Meta Address Setup

**Goal:**
Generate user’s stealth identity without exposing keys.

**Steps:**

1. Generate spend key pair (client-side)
2. Generate view key pair (client-side)
3. Store public keys as meta address
4. Encrypt private keys locally (session-based)

⚠️ Private keys are NEVER sent to backend.

---

### 4.3 Create Private Payment Link

**User action:**

* Click “Create Private Link”

**Frontend tasks:**

* Generate slug (username or random)
* Associate with meta address
* Call backend to persist link

**Result:**

```
https://zerolink.xyz/jaan
```

---

### 4.4 Send Payment via Link (Payer Flow)

**User action:**

* Open payment link
* Enter amount
* Click “Send Privately”

**Frontend cryptography:**

1. Generate ephemeral key pair
2. Compute ECDH shared secret
3. Derive stealth public key
4. Derive Starknet address
5. Send transaction to stealth address

User never sees the stealth address.

---

### 4.5 Private Inbox (Receiver Dashboard)

**Goal:**
Show incoming payments without revealing anything publicly.

**Frontend responsibilities:**

* Scan Starknet events
* Derive stealth addresses using view key
* Match payments locally

**UI shows:**

* Amount
* Timestamp
* Status (unclaimed / claimed)

---

### 4.6 Withdraw / Sweep Funds

**User action:**

* Select payment(s)
* Click “Withdraw”

**Frontend logic:**

1. Derive stealth private key
2. Sign transaction
3. Transfer to main wallet or re-stealth

---

## 5. UI Structure

```
/pages
  ├─ index.tsx          # Landing
  ├─ link/[slug].tsx    # Payment page
  ├─ dashboard.tsx      # Private inbox
  ├─ withdraw.tsx       # Withdrawal flow

/components
  ├─ WalletConnect
  ├─ PaymentForm
  ├─ PrivateInbox
  ├─ TxStatus

/lib
  ├─ crypto/
  ├─ stealth/
  ├─ starknet/

/store
  ├─ session.ts
```

---

## 6. State Management

### Local State Only

* Session keys
* View/spend private keys (memory only)
* Scan progress

### Never Stored

* Private keys (persistent)
* Full transaction history (server-side)

---

## 7. Privacy Guarantees (Frontend)

| Area          | Guarantee         |
| ------------- | ----------------- |
| URLs          | No sensitive data |
| Local storage | No private keys   |
| Network calls | Metadata only     |
| Logs          | Disabled in prod  |

---

## 8. Error Handling

* Wallet disconnect
* Failed transaction
* Scan interruption
* Backend unavailable

All errors must:

* Be user-readable
* Never expose cryptographic state

---

## 9. Performance Considerations

* Batch event scanning
* Progressive inbox loading
* Lazy cryptographic computation

---

## 10. Accessibility & UX

* Clear copy (no crypto jargon)
* Mobile-responsive
* One-action-per-screen

---

## 11. Security Considerations

* Strict CSP
* Disable analytics trackers
* No third-party scripts
* No address rendering in UI

---

## 12. Non-Goals (v1)

* No wallet replacement
* No fiat on/off ramp
* No notifications
* No cross-chain UX

---

## 13. Future Enhancements

* Background scanning via service workers
* Wallet plugin / extension
* Dark mode privacy UI
* Multi-device recovery UX

---

## 14. Definition of Done (Frontend)

* User can create a link
* Payer can send privately
* Receiver sees funds
* Funds withdrawn safely
* No wallet exposed on-chain
