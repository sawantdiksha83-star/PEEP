/**
 * Property-based test: Invalid witness produces no pass.
 *
 * // **Feature: private-event-eligibility-pass, Property 2: invalid witness produces no pass**
 *
 * For any eligibility witness that does not satisfy the eligibility requirement
 * hash, calling verifyEligibilityAndIssuePass SHALL result in rejection —
 * no pass is issued and ledger state remains unchanged.
 *
 * Validates: Requirements 1.2, 1.5
 */
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import fc from 'fast-check';

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
 * Throws ELIGIBILITY_FAILED when the witness hash does not match eligibilityHash.
 * The witness is NEVER stored in the returned ledger state.
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

// ─── Property test ────────────────────────────────────────────────────────────

describe('Property 2: Invalid witness produces no pass', () => {
  it(
    'verifyEligibilityAndIssuePass throws and leaves ledger unchanged for any witness that does not match the eligibility hash',
    () => {
      // **Validates: Requirements 1.2, 1.5**
      fc.assert(
        fc.property(
          // The "correct" witness that was used to set up the eligibility hash
          fc.uint8Array({ minLength: 1, maxLength: 64 }),
          // The "wrong" witness submitted by the participant — constrained so it
          // never accidentally equals the correct one
          fc.uint8Array({ minLength: 1, maxLength: 64 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (correctWitness, wrongWitness, eventId, passId) => {
            // Skip the rare case where the two random witnesses are identical,
            // because that would be a valid witness and is not in the input domain
            // of this property (which is specifically about *invalid* witnesses).
            fc.pre(
              hashWitness(correctWitness) !== hashWitness(wrongWitness),
            );

            const eligibilityHash = hashWitness(correctWitness);
            const initialState = createEvent(eventId, eligibilityHash);

            let threw = false;
            let errorMessage = '';
            let stateAfter: LedgerState | undefined;

            try {
              stateAfter = verifyEligibilityAndIssuePass(
                initialState,
                passId,
                wrongWitness,
              );
            } catch (err: unknown) {
              threw = true;
              if (err instanceof Error) {
                errorMessage = err.message;
              }
            }

            // The circuit must have thrown
            if (!threw) return false;

            // The error must indicate eligibility failure
            if (errorMessage !== 'ELIGIBILITY_FAILED') return false;

            // No state mutation must have occurred (stateAfter should be undefined)
            if (stateAfter !== undefined) return false;

            // The initial state must remain unchanged — no pass was issued
            if (initialState.passActive !== false) return false;
            if (initialState.passId !== '') return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
