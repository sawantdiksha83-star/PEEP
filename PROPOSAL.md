# Private Event Eligibility Pass (PEEP)
## Product Proposal

---

## Product Description

The Private Event Eligibility Pass (PEEP) is a privacy-preserving event access system built on the **Midnight Network**. It allows participants to prove they satisfy an eligibility requirement (e.g., "I am a student at this university") to gain entry to an event — **without revealing any personal information** to the event organizer, the blockchain, or anyone else.

A participant submits a private credential (e.g., a hashed student ID) as a zero-knowledge witness to the on-chain eligibility circuit. If the witness satisfies the eligibility hash committed by the organizer, the system issues a digital event pass. The pass records only a pass ID, event ID, and status on the public ledger — nothing else. The organizer scans a QR code to verify the pass and mark it as used, preventing replay.

**Core principle: VERIFY ELIGIBILITY, NOT IDENTITY.**

---

## User Types

| User | Role | Interaction |
|---|---|---|
| **Participant** | Proves eligibility to attend an event | Connects Lace wallet, submits private credential, receives QR-code pass |
| **Organizer** | Creates events with eligibility requirements | Defines event ID + eligibility hash on-chain via `createEvent` |
| **Scanner** | Verifies passes at entry | Scans QR code, views pass status, marks pass as used |

---

## Why Midnight?

Midnight is uniquely suited for PEEP because of its native support for **selective disclosure** via zero-knowledge proofs. Specifically:

1. **Privacy by design** — Midnight's Compact language lets us run eligibility checks in a ZK circuit. The private witness (credential hash) is consumed by the circuit and never appears in ledger state or transaction data.
2. **`disclose()` primitive** — Only the eligibility boolean and pass ID cross from private to public context. Everything else stays off-chain.
3. **On-chain replay protection** — The ledger enforces `entryStatus` transitions (`NOT_USED → USED`), so replay protection cannot be bypassed by frontend-only logic.
4. **Composability** — The Compact contract is a minimal, auditable primitive that any frontend or backend can consume.
5. **No trusted third party** — Eligibility is verified by math (ZK proof), not by an organization that could be hacked or coerced into revealing participant data.

No other production-ready blockchain offers the combination of on-chain state management and native ZK witness inputs that Midnight provides.

---

## Data Model

### On-Chain Ledger State (Public)

| Field | Type | Description | Disclosed? |
|---|---|---|---|
| `eventId` | `Opaque<"string">` | Unique identifier for the event | Yes — always public |
| `eligibilityHash` | `Opaque<"string">` | Commitment to the eligibility requirement | Yes — always public |
| `eventActive` | `Boolean` | Whether the event is accepting passes | Yes — always public |
| `passId` | `Opaque<"string">` | Unique identifier for the issued pass | Yes — via `disclose()` |
| `passActive` | `Boolean` | Pass status: ACTIVE (`true`) / INVALID (`false`) | Yes — via `disclose()` |
| `entryUsed` | `Boolean` | Entry status: NOT_USED (`false`) / USED (`true`) | Yes — enforced by contract |

### Private State (Off-Chain, Never on Ledger)

| Field | Type | Description |
|---|---|---|
| `eligibilityWitness` | `Bytes<32>` | `H(privateCredential)` — consumed by ZK circuit only |
| Private Credential | (raw input) | Participant's personal data (student ID, etc.) — never leaves the browser |

### QR Code Payload (Minimum Data)

| Field | Description |
|---|---|
| `passId` | Pass identifier |
| `eventId` | Event identifier |

No PII, no witness, no credential in the QR code.

---

## Privacy Audit Table

| Data Item | Stored on Chain? | In QR Code? | In Error Messages? | In Browser Console? |
|---|---|---|---|---|
| Eligibility Witness (`Bytes<32>`) | No | No | No | No |
| Private Credential (raw) | No | No | No | No |
| Participant Name | No | No | No | No |
| Student ID | No | No | No | No |
| Email | No | No | No | No |
| Phone | No | No | No | No |
| College / Institution | No | No | No | No |
| Pass ID | Yes (public) | Yes | No | Public only |
| Event ID | Yes (public) | Yes | No | Public only |
| Pass Status | Yes (public) | No | No | Public only |
| Entry Status | Yes (public) | No | No | Public only |
| Eligibility Result (bool) | Yes (via `disclose()`) | No | No | Public only |

All privacy guarantees are enforced at the contract level — they cannot be bypassed by modifying the frontend.

---

## Mainnet Feasibility

| Consideration | Assessment |
|---|---|
| **Contract size** | Minimal — three circuits (`createEvent`, `verifyEligibilityAndIssuePass`, `markPassUsed`), one ledger with six fields |
| **Proof generation** | One ZK proof per pass issuance; proof server handles generation client-side or via hosted service |
| **Gas / fees** | Three transaction types; all are simple state transitions with no loops |
| **Scalability** | Each event+pass pair is an independent contract instance; horizontal scaling is straightforward |
| **Wallet requirement** | Requires Lace wallet with Midnight DApp connector; broadly available for Midnight testnet and mainnet |
| **Dependencies** | `@midnight-ntwrk/midnight-js-*` SDK packages, `fast-check` (testing only), `qrcode.react`, `@zxing/library` |
| **Regulatory** | No PII stored on-chain; GDPR/FERPA risk is minimal since personal data never leaves the participant's device |
| **Audit surface** | Smart contract is ~120 lines of Compact; small enough for a focused security audit |
| **Known limitations** | One pass per contract instance in current design; a production version would use a map/collection for multi-pass events |

The design is intended for a future Midnight Preview/Preprod testnet deployment; no deployment has been performed. Mainnet readiness requires the Midnight Network to reach production status and a security audit of the Compact contract.

---

## Summary

PEEP demonstrates that zero-knowledge proofs can solve a real, everyday problem — event access control — in a way that respects participant privacy by design, not by policy. It is a minimal, auditable, and composable primitive that can be extended to any eligibility-gated access scenario: student events, age-verified venues, employee-only facilities, and more.
