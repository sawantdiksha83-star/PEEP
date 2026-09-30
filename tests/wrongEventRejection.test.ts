/**
 * Property-based test: Wrong-event rejection.
 *
 * // **Feature: private-event-eligibility-pass, Property 7: wrong-event rejection**
 *
 * For any pass linked to Event A, calling markPassUsed with Event B's ID
 * SHALL be rejected with a WRONG_EVENT error.
 *
 * Validates: Requirements 4.5, 6.5
 */
import { describe, it } from 'node:test';
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

/**
 * Simulates markPassUsed circuit.
 * Throws WRONG_EVENT when the supplied eventId does not match the pass's
 * recorded eventId (Requirement 4.5, 6.5).
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

describe('Property 7: Wrong-event rejection', () => {
  it(
    'markPassUsed always throws WRONG_EVENT when eventId does not match the pass',
    () => {
      // **Validates: Requirements 4.5, 6.5**
      fc.assert(
        fc.property(
          // Generate arbitrary passId, correctEventId, wrongEventId triples
          // where wrongEventId ≠ correctEventId
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (passId, correctEventId, wrongEventId) => {
            // Pre-condition: the two event IDs must differ
            fc.pre(wrongEventId !== correctEventId);

            // Construct an ACTIVE + NOT_USED ledger state for correctEventId
            const state: LedgerState = {
              eventId: correctEventId,
              eligibilityHash: 'irrelevant-for-this-property',
              eventActive: true,
              passId,
              passActive: true,  // ACTIVE
              entryUsed: false,  // NOT_USED
            };

            // Pre-condition: confirm the pass is in the expected initial state
            const preRecord = toPassRecord(state);
            fc.pre(
              preRecord.passStatus === 'ACTIVE' &&
              preRecord.entryStatus === 'NOT_USED',
            );

            let threw = false;
            let errorMessage = '';

            try {
              markPassUsed(state, passId, wrongEventId);
            } catch (err: unknown) {
              threw = true;
              if (err instanceof Error) {
                errorMessage = err.message;
              }
            }

            // Must have thrown
            if (!threw) return false;

            // Error must be WRONG_EVENT
            if (errorMessage !== 'WRONG_EVENT') return false;

            // Ledger state must be unchanged — entry not consumed
            if (state.entryUsed !== false) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
