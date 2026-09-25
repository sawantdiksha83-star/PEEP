/**
 * Property-based test: Replay protection — USED pass is rejected.
 *
 * // **Feature: private-event-eligibility-pass, Property 6: replay protection**
 *
 * For any pass with entryStatus = USED, calling markPassUsed again SHALL be
 * rejected with a PASS_ALREADY_USED error.
 *
 * Validates: Requirements 4.2, 4.4
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
 * Throws PASS_ALREADY_USED when entryUsed is already true (Requirement 4.2, 4.4).
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

describe('Property 6: Replay protection — USED pass is rejected', () => {
  it(
    'markPassUsed always throws PASS_ALREADY_USED for any USED pass',
    () => {
      // **Validates: Requirements 4.2, 4.4**
      fc.assert(
        fc.property(
          // Generate arbitrary pass IDs and event IDs
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (passId, eventId) => {
            // Construct a ledger state where the pass is already USED
            const usedPassState: LedgerState = {
              eventId,
              eligibilityHash: 'irrelevant-for-this-property',
              eventActive: true,
              passId,
              passActive: true,  // ACTIVE
              entryUsed: true,   // USED — replay scenario
            };

            // Pre-condition: confirm state is ACTIVE + USED
            const preRecord = toPassRecord(usedPassState);
            fc.pre(preRecord.passStatus === 'ACTIVE' && preRecord.entryStatus === 'USED');

            let threw = false;
            let errorMessage = '';

            try {
              markPassUsed(usedPassState, passId, eventId);
            } catch (err: unknown) {
              threw = true;
              if (err instanceof Error) {
                errorMessage = err.message;
              }
            }

            // Must have thrown
            if (!threw) return false;

            // Error must be PASS_ALREADY_USED
            if (errorMessage !== 'PASS_ALREADY_USED') return false;

            // Ledger state must be unchanged after the rejected call
            if (usedPassState.entryUsed !== true) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
