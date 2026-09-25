# Design Document — Private Event Eligibility Pass (PEEP)

## Overview

The Private Event Eligibility Pass (PEEP) is a privacy-preserving event access system on the Midnight Network. It allows Participants to prove event eligibility via a zero-knowledge proof without revealing personal identity. The Organizer/Scanner verifies the resulting on-chain Pass state to grant or deny entry.

Core principle: **VERIFY ELIGIBILITY, NOT IDENTITY.**

The system is built as a single Midnight project extending the existing `midnight_project` scaffold. It adds:
- A new Compact smart contract (`event_eligibility_pass.compact`)
- TypeScript backend scripts (deploy, interact)
- A Vite + React + TypeScript frontend (`frontend/`)
- A property-based test suite

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  PARTICIPANT (Browser)                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React Frontend (Vite + TypeScript)                      │  │
│  │  - WalletConnect   - EligibilityVerification             │  │
│  │  - EventPass       - QRCodePass                          │  │
│  │  - PassVerifier    - OrganizerPanel                      │  │
│  └───────────────┬──────────────────────────────────────────┘  │
│                  │ Midnight.js SDK (wallet-sdk 1.2.0)           │
└──────────────────┼──────────────────────────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │  Proof Server       │  (Docker :6300)
         │  ZK proof generation│
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  Midnight Node      │  (Docker :9944 or Preview/Preprod)
         │  Compact Contract   │
         │  event_eligibility  │
         │  _pass              │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │  Indexer (GraphQL)  │  (Docker :8088 or hosted)
         │  Public ledger data │
         └────────────────────┘
```

### Data Flow

```
PRIVATE INPUT (Eligibility Witness)
  ↓
Eligibility Circuit (ZK proof in Compact)
  ↓
disclose(eligible: Boolean)  ← only this crosses the privacy boundary
  ↓
Pass issued: { eventId, passId, passStatus: ACTIVE, entryStatus: NOT_USED }
  ↓
QR Code: { passId, eventId }  ← minimum data only
  ↓
Scanner verifies on-chain state → ACCESS GRANTED / DENIED
  ↓
markUsed() → entryStatus: USED  ← enforced by contract
```

---

## Components and Interfaces

### Smart Contract (`contracts/event_eligibility_pass.compact`)

The single Compact contract managing all on-chain state.

**Exported circuits:**
- `createEvent(eventId, eligibilityHash)` — Organizer creates an event
- `verifyEligibilityAndIssuePass(eventId, passId, witness)` — Participant proves eligibility; issues pass
- `markPassUsed(passId, eventId)` — Scanner marks pass as used (one-time entry)

### Backend TypeScript (`src/`)

| File | Purpose |
|---|---|
| `peep-types.ts` | Shared TypeScript types for PEEP (PassStatus, EntryStatus, PassRecord, EventRecord) |
| `peep-deploy.ts` | Deploy `event_eligibility_pass` contract |
| `peep-cli.ts` | CLI: create event, verify eligibility, issue pass, mark used |
| `network.ts` | Existing — multi-network config (unchanged) |
| `wallet.ts` | Existing — wallet SDK integration (unchanged) |

### Frontend (`frontend/src/`)

| File | Purpose |
|---|---|
| `components/WalletConnect.tsx` | Lace wallet connect/disconnect UI |
| `components/EligibilityVerification.tsx` | Private credential input → ZK proof → pass issuance |
| `components/EventPass.tsx` | Issued pass display (no PII) |
| `components/QRCodePass.tsx` | QR code generation from passId + eventId |
| `components/PassVerifier.tsx` | QR scan/input → on-chain lookup → VALID/INVALID |
| `components/OrganizerPanel.tsx` | Scanner UI: verify + mark used |
| `hooks/useMidnight.ts` | Midnight SDK hook (wallet, providers, contract interaction) |
| `App.tsx` | Tab-based layout: User | Organizer |
| `main.tsx` | Entry point |

### Test Suite (`tests/`)

| File | Purpose |
|---|---|
| `tests/eventEligibility.test.ts` | Unit + property-based tests using fast-check |

---

## Data Models

### On-Chain Ledger State (Public)

```compact
// Public — visible on blockchain
ledger eventId: Opaque<"string">;           // unique event identifier
ledger eligibilityHash: Opaque<"string">;   // commitment to eligibility requirement
ledger eventActive: Boolean;                // is the event accepting passes?
ledger passId: Opaque<"string">;            // unique pass identifier
ledger passActive: Boolean;                 // ACTIVE = true, INVALID = false
ledger entryUsed: Boolean;                  // NOT_USED = false, USED = true
```

### Private State (Off-Chain)

The Eligibility Witness is a hash of the Participant's private credential. It never appears in ledger state.

```
// Private — proof system only
witness eligibilityWitness: Bytes<32>   // H(privateCredential)
```

### TypeScript Types

```typescript
export type PassStatus = 'ACTIVE' | 'INVALID';
export type EntryStatus = 'NOT_USED' | 'USED';

export interface EventRecord {
  eventId: string;
  eligibilityHash: string;    // hex-encoded Bytes<32>
  active: boolean;
}

export interface PassRecord {
  passId: string;
  eventId: string;
  passStatus: PassStatus;
  entryStatus: EntryStatus;
}

// QR payload — minimum data, no PII
export interface QRPayload {
  passId: string;
  eventId: string;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Eligibility witness is never in public output

*For any* valid or invalid eligibility witness, after calling `verifyEligibilityAndIssuePass`, the ledger state and all public outputs SHALL NOT contain the raw witness bytes.

**Validates: Requirements 1.1, 1.3, 5.2**

---

### Property 2: Invalid witness produces no pass

*For any* eligibility witness that does not satisfy the eligibility requirement hash, calling the eligibility circuit SHALL result in rejection (no pass issued, ledger state unchanged).

**Validates: Requirements 1.2, 1.5**

---

### Property 3: Pass issuance initial state

*For any* valid eligibility witness and event ID, when a pass is successfully issued, the resulting pass SHALL have `passStatus = ACTIVE` and `entryStatus = NOT_USED`.

**Validates: Requirements 3.1, 3.2**

---

### Property 4: Pass contains no PII

*For any* pass record, the PassRecord object SHALL NOT contain a name, email, phone, student ID, or college field — only `passId`, `eventId`, `passStatus`, and `entryStatus`.

**Validates: Requirements 3.3, 5.1**

---

### Property 5: One-time entry — NOT_USED transitions to USED

*For any* pass with `passStatus = ACTIVE` and `entryStatus = NOT_USED`, after `markPassUsed` is called, the pass SHALL have `entryStatus = USED` and `passStatus = ACTIVE`.

**Validates: Requirements 4.1**

---

### Property 6: Replay protection — USED pass is rejected

*For any* pass with `entryStatus = USED`, calling `markPassUsed` again SHALL be rejected with a PASS_ALREADY_USED error.

**Validates: Requirements 4.2, 4.4**

---

### Property 7: Wrong-event rejection

*For any* pass linked to Event A, calling `markPassUsed` with Event B's ID SHALL be rejected with a WRONG_EVENT error.

**Validates: Requirements 4.5, 6.5**

---

### Property 8: QR payload round-trip

*For any* PassRecord, serializing the QR payload to JSON and deserializing it SHALL produce an object equal to the original `{ passId, eventId }` with no additional fields.

**Validates: Requirements 8.1, 8.2, 9.1, 9.2**

---

### Property 9: Pass serialization round-trip

*For any* PassRecord, serializing it to JSON and deserializing it SHALL produce a PassRecord equal to the original with all four fields (`passId`, `eventId`, `passStatus`, `entryStatus`) preserved.

**Validates: Requirements 9.1, 9.2, 9.3**

---

### Property 10: Error messages contain no private data

*For any* error condition (invalid witness, replay, wrong event, network failure), the error message string SHALL NOT contain the eligibility witness bytes, private credential, name, email, phone, or student ID.

**Validates: Requirements 5.4, 10.4**

---

## Error Handling

| Condition | Contract behavior | Frontend message |
|---|---|---|
| Invalid eligibility witness | Transaction rejected | "Eligibility verification failed. Please check your credential." |
| Pass already used | Transaction rejected | "PASS ALREADY USED" |
| Invalid pass | Transaction rejected | "INVALID PASS" |
| Wrong event ID | Transaction rejected | "PASS NOT VALID FOR THIS EVENT" |
| Wallet not connected | Pre-flight check | "Please connect your wallet first." |
| Wallet rejected | Promise rejection | "Transaction rejected by wallet." |
| Wrong network | Wallet API | "Wrong network. Please switch to [network]." |
| Proof generation failed | Proof server error | "Proof generation failed. Ensure the proof server is running." |
| Network/indexer error | Fetch error | "Network error. Please try again." |

All error messages are sanitized — no private data is included in any user-visible message or console output.

---

## Testing Strategy

### Property-Based Testing Library

The project uses **fast-check** (already present in `node_modules`) for property-based testing.

Each property-based test:
- Runs a minimum of **100 iterations** (fast-check default is 100)
- Is tagged with a comment in the format: `// **Feature: private-event-eligibility-pass, Property N: <description>**`
- References the correctness property and requirement clause it validates

### Unit Tests

Unit tests cover:
- Specific eligibility circuit behavior with known inputs
- Pass state machine transitions
- QR payload construction and verification
- Error condition handling

### Property-Based Tests (one per property)

| Property | Test description |
|---|---|
| P1 | For any witness bytes, public output never contains raw witness |
| P2 | For any invalid witness, no pass is issued |
| P3 | For any valid issuance, initial state is ACTIVE + NOT_USED |
| P4 | For any PassRecord, no PII fields present |
| P5 | For any ACTIVE+NOT_USED pass, markUsed transitions to USED |
| P6 | For any USED pass, markUsed again is rejected |
| P7 | For any pass, wrong eventId is rejected |
| P8 | For any PassRecord, QR payload round-trips |
| P9 | For any PassRecord, full serialization round-trips |
| P10 | For any error, message contains no private data |

### Test File

`tests/eventEligibility.test.ts` — runs with Node.js test runner (`node --test`) or `tsx` since no separate test framework binary was configured in the existing scaffold. fast-check is used for all property tests.

### Dual Coverage

- Unit tests catch concrete bugs in specific scenarios
- Property tests verify universal correctness across generated inputs
- Together they provide comprehensive coverage of the PEEP contract logic
