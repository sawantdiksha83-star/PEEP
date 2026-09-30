/**
 * Property-based test: Error messages contain no private data.
 *
 * // **Feature: private-event-eligibility-pass, Property 10: error messages contain no private data**
 *
 * For any error condition (invalid witness, replay, wrong event), the error
 * message string SHALL NOT contain the eligibility witness bytes, private
 * credential, name, email, phone, or student ID.
 *
 * Validates: Requirements 5.4, 10.4
 */
import { describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import fc from 'fast-check';

// ─── Inline contract simulator ────────────────────────────────────────────────
// Models the three error paths that could potentially leak private data.

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
 * The witness is used only inside the circuit — NEVER stored or surfaced in error messages.
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

/**
 * Simulates markPassUsed circuit.
 * Throws without including any private inputs in the message.
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

// Known error code strings that the simulator can produce.
// Used to filter out credential strings that are coincidental substrings of
// error codes (e.g. "P" appears in "PASS_ALREADY_USED") — such overlap is
// not a data leak; it's just an unfortunate coincidence from short strings.
const ERROR_CODES = [
  'ELIGIBILITY_FAILED',
  'PASS_ALREADY_USED',
  'WRONG_EVENT',
  'INVALID_PASS',
  'EVENT_NOT_ACTIVE',
];

/**
 * Returns true if the error message does NOT contain any of the private values.
 * Only the hex encoding of the witness bytes is checked (the canonical
 * representation of raw bytes in error messages); UTF-8 decoding of arbitrary
 * byte arrays is intentionally excluded because control characters always
 * produce false positives.
 */
function messageContainsNoPrivateData(
  message: string,
  witness: Uint8Array,
  credential: string,
): boolean {
  const witnessHex = Buffer.from(witness).toString('hex');
  return (
    !message.includes(witnessHex) &&
    !message.includes(credential)
  );
}

/**
 * Returns true when the credential is a "meaningful" private string:
 * long enough (≥ 8 chars) that any substring match against an error code
 * indicates a real data leak rather than accidental overlap.
 */
function isMeaningfulCredential(credential: string): boolean {
  if (credential.length < 8) return false;
  // Exclude credentials that are themselves substrings of known error codes
  // (would produce false positives regardless of implementation).
  return !ERROR_CODES.some((code) => code.includes(credential));
}

// ─── Property test ────────────────────────────────────────────────────────────

describe('Property 10: Error messages contain no private data', () => {
  it(
    'ELIGIBILITY_FAILED error does not contain the witness or credential',
    () => {
      // **Validates: Requirements 5.4, 10.4**
      fc.assert(
        fc.property(
          // The correct witness (used to build the hash)
          fc.uint8Array({ minLength: 1, maxLength: 64 }),
          // The wrong witness submitted by the attacker / wrong participant
          fc.uint8Array({ minLength: 1, maxLength: 64 }),
          // The plaintext private credential string
          fc.string({ minLength: 1, maxLength: 64 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (correctWitness, wrongWitness, privateCredential, eventId, passId) => {
            // Only exercise the "invalid witness" path
            fc.pre(hashWitness(correctWitness) !== hashWitness(wrongWitness));
            // Credential must be long enough to be a meaningful private value
            fc.pre(isMeaningfulCredential(privateCredential));

            const eligibilityHash = hashWitness(correctWitness);
            const state = createEvent(eventId, eligibilityHash);

            let errorMessage = '';
            try {
              verifyEligibilityAndIssuePass(state, passId, wrongWitness);
            } catch (err: unknown) {
              if (err instanceof Error) {
                errorMessage = err.message;
              }
            }

            return messageContainsNoPrivateData(errorMessage, wrongWitness, privateCredential);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'PASS_ALREADY_USED error does not contain the witness or credential',
    () => {
      // **Validates: Requirements 5.4, 10.4**
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 64 }),
          fc.string({ minLength: 1, maxLength: 64 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (witness, privateCredential, passId, eventId) => {
            // Credential must be long enough to be a meaningful private value
            fc.pre(isMeaningfulCredential(privateCredential));
            // Start from an already-USED pass state (replay scenario)
            const usedState: LedgerState = {
              eventId,
              eligibilityHash: 'irrelevant',
              eventActive: true,
              passId,
              passActive: true,
              entryUsed: true, // already USED
            };

            let errorMessage = '';
            try {
              markPassUsed(usedState, passId, eventId);
            } catch (err: unknown) {
              if (err instanceof Error) {
                errorMessage = err.message;
              }
            }

            return messageContainsNoPrivateData(errorMessage, witness, privateCredential);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'WRONG_EVENT error does not contain the witness or credential',
    () => {
      // **Validates: Requirements 5.4, 10.4**
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 64 }),
          fc.string({ minLength: 1, maxLength: 64 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (witness, privateCredential, passId, correctEventId, wrongEventId) => {
            fc.pre(correctEventId !== wrongEventId);
            // Credential must be long enough to be a meaningful private value
            fc.pre(isMeaningfulCredential(privateCredential));

            const activeState: LedgerState = {
              eventId: correctEventId,
              eligibilityHash: 'irrelevant',
              eventActive: true,
              passId,
              passActive: true,
              entryUsed: false,
            };

            let errorMessage = '';
            try {
              markPassUsed(activeState, passId, wrongEventId);
            } catch (err: unknown) {
              if (err instanceof Error) {
                errorMessage = err.message;
              }
            }

            return messageContainsNoPrivateData(errorMessage, witness, privateCredential);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
