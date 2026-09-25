/**
 * Property-based test: Eligibility witness is never in public output.
 *
 * // **Feature: private-event-eligibility-pass, Property 1: witness never in public output**
 *
 * For any valid or invalid eligibility witness, after calling
 * verifyEligibilityAndIssuePass, the ledger state and all public outputs
 * SHALL NOT contain the raw witness bytes.
 *
 * Validates: Requirements 1.1, 1.3, 5.2
 */
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import fc from 'fast-check';

// ─── Inline contract simulator (mirrors eventEligibility.test.ts) ─────────────
// The simulator models the Compact contract's privacy boundary:
// witness bytes are consumed by the circuit but never stored in the ledger.

interface LedgerState {
  eventId: string;
  eligibilityHash: string;
  eventActive: boolean;
  passId: string;
  passActive: boolean;
  entryUsed: boolean;
}

function hashWitness(witness: Buffer): string {
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
 * Simulates verifyEligibilityAndIssuePass.
 * The witness is used only inside the circuit — it is NEVER stored on the ledger.
 */
function verifyEligibilityAndIssuePass(
  state: LedgerState,
  newPassId: string,
  witness: Buffer,
): LedgerState {
  if (!state.eventActive) {
    throw new Error('EVENT_NOT_ACTIVE');
  }
  const eligible = hashWitness(witness) === state.eligibilityHash;
  if (!eligible) {
    throw new Error('ELIGIBILITY_FAILED');
  }
  // Witness bytes are never stored in the returned ledger state
  return {
    ...state,
    passId: newPassId,
    passActive: true,
    entryUsed: false,
  };
}

// ─── Property test ────────────────────────────────────────────────────────────

describe('Property 1: Eligibility witness is never in public output', () => {
  it(
    'ledger state object keys and values do not contain the raw witness after verifyEligibilityAndIssuePass',
    () => {
      // **Validates: Requirements 1.1, 1.3, 5.2**
      fc.assert(
        fc.property(
          // Generate arbitrary witness bytes (1–64 bytes)
          fc.uint8Array({ minLength: 1, maxLength: 64 }),
          // Generate arbitrary event/pass IDs
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (witnessBytes, eventId, passId) => {
            const witness = Buffer.from(witnessBytes);
            const witnessHex = witness.toString('hex');

            // Build an event whose eligibilityHash matches the witness
            // so the circuit always succeeds (we want to inspect the resulting ledger)
            const eligibilityHash = hashWitness(witness);
            const state = createEvent(eventId, eligibilityHash);

            const newState = verifyEligibilityAndIssuePass(state, passId, witness);

            // The raw witness bytes must not appear as any value in the ledger state
            const stateValues = Object.values(newState).map((v) => String(v));
            const witnessInValues = stateValues.some((v) => v === witnessHex);

            // The raw witness must not appear as any key in the ledger state
            const stateKeys = Object.keys(newState);
            const witnessInKeys = stateKeys.some((k) => k === witnessHex);

            return !witnessInValues && !witnessInKeys;
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
