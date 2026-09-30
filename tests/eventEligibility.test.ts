/**
 * Unit tests for PEEP contract logic.
 *
 * These tests model the Compact contract's circuit behavior in TypeScript,
 * mirroring the ledger state transitions defined in event_eligibility_pass.compact.
 *
 * Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.5, 5.1
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { PassRecord } from '../src/peep-types.js';

// ─── Contract state simulator ─────────────────────────────────────────────────
//
// Models the Compact ledger and circuit logic so we can test state transitions
// without a running Midnight node.

interface LedgerState {
  eventId: string;
  eligibilityHash: string; // hex-encoded sha256 of the eligibility witness
  eventActive: boolean;
  passId: string;
  passActive: boolean;
  entryUsed: boolean;
}

/**
 * Simulates createEvent circuit.
 * Requirements: 2.1, 2.2, 2.3
 */
function createEvent(eventId: string, eligibilityHash: string): LedgerState {
  return {
    eventId,
    eligibilityHash,
    eventActive: true,
    passId: '',
    passActive: false,
    entryUsed: false,
  };
}

/**
 * Compute the eligibilityHash from a witness (mirrors sha256 in Compact).
 */
function hashWitness(witness: Buffer): string {
  return createHash('sha256').update(witness).digest('hex');
}

/**
 * Simulates verifyEligibilityAndIssuePass circuit.
 * Returns updated LedgerState on success, throws on failure.
 * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 5.1, 5.2
 */
function verifyEligibilityAndIssuePass(
  state: LedgerState,
  forEventId: string,
  newPassId: string,
  witness: Buffer,
): LedgerState {
  if (!state.eventActive) {
    throw new Error('EVENT_NOT_ACTIVE');
  }

  const witnessHash = hashWitness(witness);
  const eligible = witnessHash === state.eligibilityHash;

  if (!eligible) {
    throw new Error('ELIGIBILITY_FAILED');
  }

  // Return new state — witness bytes are NEVER stored in the ledger
  return {
    ...state,
    passId: newPassId,
    passActive: true,
    entryUsed: false,
  };
}

/**
 * Simulates markPassUsed circuit.
 * Returns updated LedgerState on success, throws on failure.
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */
function markPassUsed(
  state: LedgerState,
  forPassId: string,
  forEventId: string,
): LedgerState {
  if (!state.passActive) {
    throw new Error('INVALID_PASS');
  }
  if (state.entryUsed) {
    throw new Error('PASS_ALREADY_USED');
  }
  if (forEventId !== state.eventId) {
    throw new Error('WRONG_EVENT');
  }
  if (forPassId !== state.passId) {
    throw new Error('INVALID_PASS');
  }

  return { ...state, entryUsed: true };
}

/**
 * Convert LedgerState to PassRecord (the four public fields only).
 * Requirements: 3.3, 5.1
 */
function toPassRecord(state: LedgerState): PassRecord {
  return {
    passId: state.passId,
    eventId: state.eventId,
    passStatus: state.passActive ? 'ACTIVE' : 'INVALID',
    entryStatus: state.entryUsed ? 'USED' : 'NOT_USED',
  };
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const EVENT_ID = 'event-001';
const PASS_ID = 'pass-abc';

// The eligibility credential (private — never on-chain)
const VALID_WITNESS = Buffer.from('correct-student-credential', 'utf8');
const INVALID_WITNESS = Buffer.from('wrong-credential', 'utf8');
const ELIGIBILITY_HASH = hashWitness(VALID_WITNESS);

let baseState: LedgerState;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PEEP contract logic', () => {
  beforeEach(() => {
    baseState = createEvent(EVENT_ID, ELIGIBILITY_HASH);
  });

  // Test 1: Valid witness satisfies eligibility — Requirements 1.1
  it('Test 1: valid witness satisfies eligibility check', () => {
    const newState = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      PASS_ID,
      VALID_WITNESS,
    );
    // Pass was issued — passActive signals eligibility confirmed
    assert.equal(newState.passActive, true);
  });

  // Test 2: Invalid witness is rejected — Requirements 1.2, 1.5
  it('Test 2: invalid witness is rejected and no pass is issued', () => {
    assert.throws(
      () => verifyEligibilityAndIssuePass(baseState, EVENT_ID, PASS_ID, INVALID_WITNESS),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'ELIGIBILITY_FAILED');
        return true;
      },
    );

    // Ledger state unchanged — no pass issued
    assert.equal(baseState.passActive, false);
    assert.equal(baseState.passId, '');
  });

  // Test 3: Valid participant receives a pass linked to correct event ID — Requirements 3.1
  it('Test 3: issued pass is linked to the correct event ID', () => {
    const newState = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      PASS_ID,
      VALID_WITNESS,
    );
    assert.equal(newState.passId, PASS_ID);
    assert.equal(newState.eventId, EVENT_ID);
  });

  // Test 4: Issued pass has ACTIVE status and NOT_USED entry status — Requirements 3.1, 3.2
  it('Test 4: issued pass has passStatus ACTIVE and entryStatus NOT_USED', () => {
    const newState = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      PASS_ID,
      VALID_WITNESS,
    );
    const record = toPassRecord(newState);
    assert.equal(record.passStatus, 'ACTIVE');
    assert.equal(record.entryStatus, 'NOT_USED');
  });

  // Test 5: ACTIVE+NOT_USED pass transitions to USED after markPassUsed — Requirements 4.1
  it('Test 5: ACTIVE+NOT_USED pass transitions to entryStatus USED after markPassUsed', () => {
    const issued = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      PASS_ID,
      VALID_WITNESS,
    );
    const used = markPassUsed(issued, PASS_ID, EVENT_ID);
    const record = toPassRecord(used);
    assert.equal(record.entryStatus, 'USED');
    assert.equal(record.passStatus, 'ACTIVE');
  });

  // Test 6: Calling markPassUsed on USED pass throws PASS_ALREADY_USED — Requirements 4.2, 4.4
  it('Test 6: calling markPassUsed on an already-USED pass throws PASS_ALREADY_USED', () => {
    const issued = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      PASS_ID,
      VALID_WITNESS,
    );
    const used = markPassUsed(issued, PASS_ID, EVENT_ID);

    assert.throws(
      () => markPassUsed(used, PASS_ID, EVENT_ID),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'PASS_ALREADY_USED');
        return true;
      },
    );
  });

  // Test 7: markPassUsed with wrong eventId throws WRONG_EVENT — Requirements 4.5
  it('Test 7: markPassUsed with a wrong eventId throws WRONG_EVENT', () => {
    const issued = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      PASS_ID,
      VALID_WITNESS,
    );

    assert.throws(
      () => markPassUsed(issued, PASS_ID, 'different-event-999'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'WRONG_EVENT');
        return true;
      },
    );
  });

  // ─── Edge case tests (Task 11.1) ───────────────────────────────────────────

  // Edge Case 1: Already-used pass attempt — explicit named test — Requirements 4.2
  it('Edge 1: already-used pass — markPassUsed throws PASS_ALREADY_USED', () => {
    const issued = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      PASS_ID,
      VALID_WITNESS,
    );
    const used = markPassUsed(issued, PASS_ID, EVENT_ID);

    // Second attempt must be rejected with the specific error code
    assert.throws(
      () => markPassUsed(used, PASS_ID, EVENT_ID),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'PASS_ALREADY_USED');
        return true;
      },
      'Second markPassUsed call must throw PASS_ALREADY_USED',
    );

    // Ledger state remains USED after the rejected second call
    assert.equal(used.entryUsed, true);
    assert.equal(used.passActive, true);
  });

  // Edge Case 2: INVALID pass markUsed attempt — Requirements 4.3
  it('Edge 2: markPassUsed on an INVALID pass throws INVALID_PASS', () => {
    // An INVALID pass has passActive = false
    const invalidPassState: LedgerState = {
      ...baseState,
      passId: PASS_ID,
      passActive: false, // INVALID
      entryUsed: false,
    };

    assert.throws(
      () => markPassUsed(invalidPassState, PASS_ID, EVENT_ID),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'INVALID_PASS');
        return true;
      },
      'markPassUsed on an INVALID pass must throw INVALID_PASS',
    );
  });

  // Edge Case 3: Pass for non-existent / inactive event — Requirements 4.5, 2.4
  it('Edge 3: verifyEligibilityAndIssuePass on an inactive event throws EVENT_NOT_ACTIVE', () => {
    // Event that has been deactivated
    const inactiveEventState: LedgerState = {
      ...baseState,
      eventActive: false,
    };

    assert.throws(
      () => verifyEligibilityAndIssuePass(inactiveEventState, EVENT_ID, PASS_ID, VALID_WITNESS),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'EVENT_NOT_ACTIVE');
        return true;
      },
      'Pass issuance against an inactive event must throw EVENT_NOT_ACTIVE',
    );
  });

  // Edge Case 4: Repeated eligibility verification with the same witness — Requirements 1.1, 3.1
  it('Edge 4: repeated eligibility verification with the same witness issues a second pass', () => {
    // First issuance
    const firstState = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      PASS_ID,
      VALID_WITNESS,
    );
    assert.equal(firstState.passActive, true);
    assert.equal(firstState.passId, PASS_ID);

    // Second issuance with same witness but a different pass ID (new application)
    const SECOND_PASS_ID = 'pass-xyz';
    const secondState = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      SECOND_PASS_ID,
      VALID_WITNESS,
    );
    assert.equal(secondState.passActive, true);
    assert.equal(secondState.passId, SECOND_PASS_ID);
    assert.equal(secondState.eventId, EVENT_ID);
  });

  // Test 8: Pass ledger state contains no witness or PII fields — Requirements 3.3, 5.1
  it('Test 8: ledger state and PassRecord contain no witness or PII fields', () => {
    const issued = verifyEligibilityAndIssuePass(
      baseState,
      EVENT_ID,
      PASS_ID,
      VALID_WITNESS,
    );

    // Ledger state must not contain the witness bytes
    const ledgerKeys = Object.keys(issued);
    const PII_AND_PRIVATE_KEYS = [
      'eligibilityWitness',
      'witness',
      'name',
      'email',
      'phone',
      'studentId',
      'college',
      'privateCredential',
    ];
    for (const forbidden of PII_AND_PRIVATE_KEYS) {
      assert.ok(
        !ledgerKeys.includes(forbidden),
        `Ledger state must not contain key: ${forbidden}`,
      );
    }

    // PassRecord derived from ledger must also contain no PII
    const record = toPassRecord(issued);
    const recordKeys = Object.keys(record);
    const ALLOWED_KEYS = new Set(['passId', 'eventId', 'passStatus', 'entryStatus']);
    for (const key of recordKeys) {
      assert.ok(ALLOWED_KEYS.has(key), `PassRecord must not contain key: ${key}`);
    }
  });
});
