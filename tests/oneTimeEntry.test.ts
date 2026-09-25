/**
 * Property-based test: One-time entry — NOT_USED transitions to USED.
 *
 * // **Feature: private-event-eligibility-pass, Property 5: NOT_USED transitions to USED**
 *
 * For any pass with passStatus = ACTIVE and entryStatus = NOT_USED,
 * after markPassUsed is called, the pass SHALL have entryStatus = USED
 * and passStatus = ACTIVE.
 *
 * Validates: Requirements 4.1
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

describe('Property 5: One-time entry — NOT_USED transitions to USED', () => {
  it(
    'after markPassUsed on an ACTIVE+NOT_USED pass, entryStatus = USED and passStatus = ACTIVE',
    () => {
      // **Validates: Requirements 4.1**
      fc.assert(
        fc.property(
          // Generate arbitrary pass IDs and event IDs
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (passId, eventId) => {
            // Construct an ACTIVE + NOT_USED ledger state directly
            const activeNotUsedState: LedgerState = {
              eventId,
              eligibilityHash: 'irrelevant-for-this-property',
              eventActive: true,
              passId,
              passActive: true,   // ACTIVE
              entryUsed: false,   // NOT_USED
            };

            const afterUsed = markPassUsed(activeNotUsedState, passId, eventId);
            const record = toPassRecord(afterUsed);

            return (
              record.entryStatus === 'USED' &&
              record.passStatus === 'ACTIVE'
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
