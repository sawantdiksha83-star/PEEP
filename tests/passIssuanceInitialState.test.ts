/**
 * Property-based test: Pass issuance initial state.
 *
 * // **Feature: private-event-eligibility-pass, Property 3: issued pass initial state**
 *
 * For any valid eligibility witness and event ID, when a pass is successfully
 * issued, the resulting pass SHALL have passStatus = 'ACTIVE' and
 * entryStatus = 'NOT_USED'.
 *
 * Validates: Requirements 3.1, 3.2
 */
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import fc from 'fast-check';
import type { PassRecord } from '../src/peep-types.js';

// ─── Inline contract simulator ────────────────────────────────────────────────

interface LedgerState {
  eventId: string;
  eligibilityHash: string;
  eventActive: boolean;
  passId: string;
  passActive: boolean;
  entryUsed: boolean;
}

function hashWitness(witness: Uint8Array): string {
  return createHash('sha256').update(witness).digest('hex');
}

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
 * Simulates verifyEligibilityAndIssuePass circuit.
 * Witness is consumed by the circuit and never stored in ledger state.
 */
function verifyEligibilityAndIssuePass(
  state: LedgerState,
  newPassId: string,
  witness: Uint8Array,
): LedgerState {
  if (!state.eventActive) {
    throw new Error('EVENT_NOT_ACTIVE');
  }
  const eligible = hashWitness(witness) === state.eligibilityHash;
  if (!eligible) {
    throw new Error('ELIGIBILITY_FAILED');
  }
  return {
    ...state,
    passId: newPassId,
    passActive: true,
    entryUsed: false,
  };
}

/** Convert LedgerState to the public PassRecord view. */
function toPassRecord(state: LedgerState): PassRecord {
  return {
    passId: state.passId,
    eventId: state.eventId,
    passStatus: state.passActive ? 'ACTIVE' : 'INVALID',
    entryStatus: state.entryUsed ? 'USED' : 'NOT_USED',
  };
}

// ─── Property test ────────────────────────────────────────────────────────────

describe('Property 3: Pass issuance initial state', () => {
  it(
    'every issued pass has passStatus = ACTIVE and entryStatus = NOT_USED',
    () => {
      // **Validates: Requirements 3.1, 3.2**
      fc.assert(
        fc.property(
          // Generate arbitrary valid witness bytes
          fc.uint8Array({ minLength: 1, maxLength: 64 }),
          // Generate arbitrary event and pass IDs
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (witnessBytes, eventId, passId) => {
            // Build an event whose eligibilityHash matches the witness
            // so that verifyEligibilityAndIssuePass always succeeds
            const eligibilityHash = hashWitness(witnessBytes);
            const state = createEvent(eventId, eligibilityHash);

            const newState = verifyEligibilityAndIssuePass(state, passId, witnessBytes);
            const record = toPassRecord(newState);

            return (
              record.passStatus === 'ACTIVE' &&
              record.entryStatus === 'NOT_USED'
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
