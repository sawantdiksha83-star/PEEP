/**
 * Property-based tests for QR payload serialization round-trip.
 * Requirements: 8.1, 8.2, 9.1, 9.2
 */
import { describe, it } from 'node:test';
import fc from 'fast-check';
import { serializeQRPayload, deserializeQRPayload } from '../src/peep-types.js';
import type { PassRecord } from '../src/peep-types.js';

// **Feature: private-event-eligibility-pass, Property 8: QR payload round-trip**
describe('Property 8: QR payload round-trip', () => {
  it('deserializeQRPayload(serializeQRPayload(pass)) equals { passId, eventId } with no extra fields', () => {
    // Generates arbitrary PassRecord values (all four fields) to confirm
    // that serializeQRPayload only encodes passId + eventId, and that
    // deserializing that JSON gives back exactly those two fields.
    // **Validates: Requirements 8.1, 8.2, 9.1, 9.2**
    fc.assert(
      fc.property(
        fc.record({
          passId: fc.string({ minLength: 1 }),
          eventId: fc.string({ minLength: 1 }),
          passStatus: fc.constantFrom('ACTIVE' as const, 'INVALID' as const),
          entryStatus: fc.constantFrom('NOT_USED' as const, 'USED' as const),
        }),
        (pass: PassRecord) => {
          const result = deserializeQRPayload(serializeQRPayload(pass));

          // Must equal the original passId and eventId
          if (result.passId !== pass.passId) return false;
          if (result.eventId !== pass.eventId) return false;

          // Must have no extra fields beyond passId and eventId
          const keys = Object.keys(result);
          if (keys.length !== 2) return false;
          if (!keys.includes('passId')) return false;
          if (!keys.includes('eventId')) return false;

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
