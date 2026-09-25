# Implementation Plan — Private Event Eligibility Pass (PEEP)

All work extends the existing `midnight_project` directory. No files are deleted. New files are added alongside existing ones.

---

- [x] 1. Set up project structure and shared types







  - Create `contracts/event_eligibility_pass.compact` placeholder
  - Create `src/peep-types.ts` with TypeScript types: `PassStatus`, `EntryStatus`, `PassRecord`, `EventRecord`, `QRPayload`
  - Add `tests/` directory and configure Node.js test runner in `package.json`
  - Add `vitest` or use Node `--test` runner; verify fast-check is accessible from tests
  - _Requirements: 1.4, 3.3, 5.1_

- [x] 2. Implement the Compact smart contract





  - [x] 2.1 Write `contracts/event_eligibility_pass.compact` with privacy documentation header


    - PUBLIC ledger fields: `eventId`, `eligibilityHash`, `eventActive`, `passId`, `passActive`, `entryUsed`
    - PRIVATE witness: `eligibilityWitness: Bytes<32>`
    - Circuits: `createEvent`, `verifyEligibilityAndIssuePass`, `markPassUsed`
    - Use `disclose()` only to move eligibility boolean and passId to ledger
    - Add inline comments: what is disclosed, why, what remains private
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 4.4, 5.1, 5.2_

  - [x] 2.2 Compile the contract


    - Run `compact compile contracts/event_eligibility_pass.compact contracts/managed/event_eligibility_pass`
    - Verify `contracts/managed/event_eligibility_pass/contract/index.js` is generated
    - Fix any Compact syntax errors (smallest fix per error)
    - _Requirements: 1.1, 2.1, 3.1_

- [x] 3. Implement shared TypeScript types and serialization utilities




  - [x] 3.1 Write `src/peep-types.ts`

    - `PassStatus`, `EntryStatus`, `PassRecord`, `EventRecord`, `QRPayload` interfaces
    - `serializeQRPayload(pass: PassRecord): string` — JSON encode passId + eventId only
    - `deserializeQRPayload(json: string): QRPayload` — JSON decode, validate fields
    - `serializePassRecord(pass: PassRecord): string` — JSON encode all four fields
    - `deserializePassRecord(json: string): PassRecord` — JSON decode, validate fields
    - _Requirements: 5.1, 5.3, 8.1, 8.2, 9.1, 9.2_

  - [x] 3.2 Write property test for QR payload round-trip (Property 8)






    - **Property 8: QR payload round-trip**
    - **Validates: Requirements 8.1, 8.2, 9.1, 9.2**
    - Use fast-check to generate arbitrary `{ passId: string, eventId: string }` values
    - Assert `deserializeQRPayload(serializeQRPayload(pass))` equals `{ passId, eventId }` with no extra fields
    - Tag: `// **Feature: private-event-eligibility-pass, Property 8: QR payload round-trip**`

  - [x] 3.3 Write property test for PassRecord serialization round-trip (Property 9)






    - **Property 9: PassRecord serialization round-trip**
    - **Validates: Requirements 9.1, 9.2, 9.3**
    - Use fast-check to generate arbitrary `PassRecord` values
    - Assert `deserializePassRecord(serializePassRecord(record))` deep-equals the original
    - Tag: `// **Feature: private-event-eligibility-pass, Property 9: PassRecord serialization round-trip**`

  - [x] 3.4 Write property test for PassRecord no PII fields (Property 4)






    - **Property 4: PassRecord contains no PII**
    - **Validates: Requirements 3.3, 5.1**
    - Use fast-check to generate arbitrary PassRecords
    - Assert the object has no `name`, `email`, `phone`, `studentId`, `college` keys
    - Tag: `// **Feature: private-event-eligibility-pass, Property 4: PassRecord contains no PII**`

- [x] 4. Implement the PEEP deploy and interaction scripts






  - [x] 4.1 Write `src/peep-deploy.ts`

    - Copy pattern from existing `src/deploy.ts`
    - Load `contracts/managed/event_eligibility_pass` compiled artifacts
    - Deploy contract, write deployment to `.midnight-state.json` under key `peep`
    - Record real contract address after successful deployment
    - _Requirements: 2.1, 2.3_

  - [x] 4.2 Write `src/peep-cli.ts`


    - Commands: `create-event <eventId> <eligibilityHash>`, `issue-pass <eventId> <passId> <witness>`, `mark-used <passId> <eventId>`, `verify <passId>`
    - Connect to deployed contract using `findDeployedContract`
    - Print only public data (passId, eventId, passStatus, entryStatus) — never print witness
    - _Requirements: 1.1, 3.1, 4.1, 5.4_

- [x] 5. Implement contract logic unit tests and property tests





  - [x] 5.1 Write unit tests in `tests/eventEligibility.test.ts`


    - Test 1: Valid witness satisfies eligibility (eligible result returned)
    - Test 2: Invalid witness is rejected (no pass issued)
    - Test 3: Valid participant receives a pass linked to correct event ID
    - Test 4: Issued pass has ACTIVE status and NOT_USED entry status
    - Test 5: ACTIVE+NOT_USED pass transitions to USED after markPassUsed
    - Test 6: Calling markPassUsed on USED pass throws PASS_ALREADY_USED
    - Test 7: markPassUsed with wrong eventId throws WRONG_EVENT
    - Test 8: Pass ledger state contains no witness or PII fields
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.5, 5.1_

  - [x] 5.2 Write property test: witness never in public output (Property 1)






    - **Property 1: Eligibility witness is never in public output**
    - **Validates: Requirements 1.1, 1.3, 5.2**
    - Use fast-check to generate arbitrary witness byte arrays
    - Assert ledger state object keys do not contain the raw witness value
    - Tag: `// **Feature: private-event-eligibility-pass, Property 1: witness never in public output**`

  - [x] 5.3 Write property test: invalid witness produces no pass (Property 2)






    - **Property 2: Invalid witness produces no pass**
    - **Validates: Requirements 1.2, 1.5**
    - Use fast-check to generate witness values that don't match the eligibility hash
    - Assert that verifyEligibilityAndIssuePass throws/rejects for all such inputs
    - Tag: `// **Feature: private-event-eligibility-pass, Property 2: invalid witness produces no pass**`

  - [x] 5.4 Write property test: issued pass initial state (Property 3)






    - **Property 3: Pass issuance initial state**
    - **Validates: Requirements 3.1, 3.2**
    - Use fast-check to generate valid (eventId, passId, witness) tuples
    - Assert every issued pass has `passStatus = 'ACTIVE'` and `entryStatus = 'NOT_USED'`
    - Tag: `// **Feature: private-event-eligibility-pass, Property 3: issued pass initial state**`

  - [x] 5.5 Write property test: one-time entry (Property 5)






    - **Property 5: One-time entry — NOT_USED transitions to USED**
    - **Validates: Requirements 4.1**
    - Use fast-check to generate ACTIVE+NOT_USED passes
    - After markPassUsed, assert `entryStatus = 'USED'` and `passStatus = 'ACTIVE'`
    - Tag: `// **Feature: private-event-eligibility-pass, Property 5: NOT_USED transitions to USED**`

  - [x] 5.6 Write property test: replay protection (Property 6)






    - **Property 6: Replay protection — USED pass is rejected**
    - **Validates: Requirements 4.2, 4.4**
    - Use fast-check to generate USED passes
    - Assert markPassUsed always throws with PASS_ALREADY_USED message
    - Tag: `// **Feature: private-event-eligibility-pass, Property 6: replay protection**`

  - [x] 5.7 Write property test: wrong-event rejection (Property 7)






    - **Property 7: Wrong-event rejection**
    - **Validates: Requirements 4.5, 6.5**
    - Use fast-check to generate (passId, correctEventId, wrongEventId) triples where wrongEventId ≠ correctEventId
    - Assert markPassUsed with wrongEventId always throws with WRONG_EVENT message
    - Tag: `// **Feature: private-event-eligibility-pass, Property 7: wrong-event rejection**`

  - [x] 5.8 Write property test: error messages contain no private data (Property 10)






    - **Property 10: Error messages contain no private data**
    - **Validates: Requirements 5.4, 10.4**
    - Use fast-check to generate arbitrary witness/credential strings and trigger error paths
    - Assert all caught error message strings do not contain the witness or credential value
    - Tag: `// **Feature: private-event-eligibility-pass, Property 10: error messages contain no private data**`

- [x] 6. Checkpoint — Ensure all tests pass, ask the user if questions arise.






- [x] 7. Implement the React frontend skeleton







  - [x] 7.1 Scaffold `frontend/` with Vite + React + TypeScript

    - `cd frontend && npm create vite@latest . -- --template react-ts`
    - Install: `qrcode.react`, `@zxing/library` (QR scan), Tailwind CSS
    - Configure `vite.config.ts` to proxy `/api` to the local indexer
    - Create directory structure: `src/components/`, `src/hooks/`
    - _Requirements: 6.1, 7.1_

  - [x] 7.2 Write `frontend/src/hooks/useMidnight.ts`


    - State: `walletAddress`, `connected`, `network`, `error`
    - Functions: `connectWallet()`, `disconnectWallet()`, `getPassState(passId)`, `issuePass(eventId, passId, witness)`, `markUsed(passId, eventId)`
    - Uses Midnight.js SDK wallet connection pattern (Lace DApp connector API)
    - Never stores or logs private witness/credential in hook state
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. Implement frontend components





  - [x] 8.1 Write `frontend/src/components/WalletConnect.tsx`


    - NOT CONNECTED state: show "Connect Wallet" button
    - CONNECTED state: show shortened address + "Disconnect" button
    - Error states: unavailable, rejected, wrong network
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 8.2 Write `frontend/src/components/EligibilityVerification.tsx`


    - Event selection dropdown (from known events)
    - Private credential input field (hashed client-side; never sent to chain raw)
    - "Verify Eligibility" button → calls `useMidnight.issuePass`
    - On success: passes PassRecord to parent (clears credential input immediately)
    - On failure: shows eligibility failed message (no credential in error)
    - _Requirements: 1.1, 1.2, 5.3, 5.4, 10.1, 10.2_

  - [x] 8.3 Write `frontend/src/components/EventPass.tsx`


    - Displays: event name, "Eligibility: VERIFIED", "Pass: ACTIVE", "Entry: NOT USED"
    - Does NOT display: name, student ID, email, phone, college, witness
    - Accepts `PassRecord` as prop
    - _Requirements: 3.2, 3.3, 5.1, 6.2_

  - [x] 8.4 Write `frontend/src/components/QRCodePass.tsx`


    - Generates QR from `serializeQRPayload(pass)` — passId + eventId only
    - Uses `qrcode.react` library
    - Does NOT encode any PII
    - _Requirements: 8.1, 8.2, 5.3_

  - [x] 8.5 Write `frontend/src/components/PassVerifier.tsx`


    - QR input (text field or camera scan via `@zxing/library`)
    - Parses QR JSON → calls `useMidnight.getPassState(passId)`
    - Displays result: ACCESS GRANTED / PASS ALREADY USED / INVALID PASS / WRONG EVENT
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 8.6 Write `frontend/src/components/OrganizerPanel.tsx`


    - Wraps PassVerifier
    - "Mark Used" button: calls `useMidnight.markUsed(passId, eventId)` only when pass is ACTIVE+NOT_USED
    - After marking: refreshes pass state, shows PASS ALREADY USED on rescan
    - _Requirements: 4.1, 4.2, 6.2, 6.3_

  - [x] 8.7 Write `frontend/src/App.tsx`


    - Tab layout: "Participant" | "Organizer"
    - Participant tab: WalletConnect → EligibilityVerification → EventPass → QRCodePass
    - Organizer tab: WalletConnect → OrganizerPanel
    - Privacy banner: "Your eligibility is verified without revealing your personal information."
    - _Requirements: 1.1, 5.1, 5.3, 5.4_

- [x] 9. Frontend privacy audit and build





  - [x] 9.1 Audit React state, local storage, console logs, QR content, and network requests


    - Remove any console.log of witness, credential, or PII
    - Ensure local storage contains only passId, eventId, passStatus, entryStatus
    - Verify QR JSON has no extra fields
    - _Requirements: 5.3, 5.4_

  - [x] 9.2 Run `npm install && npm run build` inside `frontend/`


    - Fix all TypeScript and build errors
    - Ensure production build succeeds with zero errors

- [x] 10. Checkpoint — Ensure all tests pass, ask the user if questions arise.






- [x] 11. Expand test suite with edge cases (Level 3)





  - [x] 11.1 Add edge case unit tests to `tests/eventEligibility.test.ts`


    - Already-used pass attempt (duplicate of P6 as explicit named test)
    - INVALID pass markUsed attempt
    - Pass for non-existent event
    - Repeated eligibility verification with same witness
    - Expired/revoked pass states (if supported by contract)
    - _Requirements: 4.2, 4.3, 4.5_

- [x] 12. Create CI/CD workflow





  - Write `.github/workflows/ci.yml`
    - Trigger: push to main, pull_request
    - Steps: checkout, setup Node 22, install deps, compile Compact contract, run tests, build frontend
    - Use `actions/setup-node@v4` with `node-version: '22'`
    - Use Docker service for proof server if needed for contract tests
    - _Requirements: all_

- [-] 13. Error handling review and UI/UX polish (Level 3)



  - [x] 13.1 Review all major operations and add structured error handling


    - Wrap all `useMidnight` calls with try/catch mapping SDK errors to user messages
    - Map wallet rejection, wrong network, invalid eligibility, proof failure, replay to specific messages
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 13.2 Apply responsive Tailwind CSS styling







    - Mobile-first layout, clear User/Organizer separation
    - Pass lifecycle visual indicators (ACTIVE → USED)
    - Accessibility: aria-labels, keyboard navigation, color-contrast
    - _Requirements: 6.1, 6.2, 6.3_



- [~] 14. Security audit and PROPOSAL.md












  - [ ] 14.1 Audit repository for secrets, private keys, and .env files











    - Verify `.gitignore` excludes `.env`, `.midnight-state.json`, `node_modules`, `dist`, `contracts/managed`
    - Ensure no seeds or private keys are committed
    - _Requirements: 5.4_

  - [ ] 14.2 Create `PROPOSAL.md`







    - Product description, user types, why Midnight, data model table, privacy audit table, mainnet feasibility
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 14.3 Update `README.md` with all required sections
    - Contract addresses (real or placeholder), what this does, privacy model, tech stack, setup, CI badge
    - _Requirements: all_

- [ ] 15. Final Checkpoint — Ensure all tests pass, ask the user if questions arise.
