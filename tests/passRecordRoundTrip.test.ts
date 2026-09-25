/**
 * Property-based tests for PassRecord serialization round-trip.
 * Requirements: 9.1, 9.2, 9.3
 */
import { describe, it } from 'node:test';
import fc from 'fast-check';
import { serializePassRecord, deserializePassRecord } from '../src/peep-types.js';
import type { PassRecord } from '../src/peep-types.js';

// **Feature: private-event-eligibility-pass, Property 9: PassRecord serialization round-trip**
describe('Property 9: PassRecord serialization round-trip', () => {
  it('deserializePassRecord(serializePassRecord(record)) deep-equals the original record', () => {
    // Generates arbitrary PassRecord values across all valid field combinations
    // and asserts the full round-trip is lossless.
    // **Validates: Requirements 9.1, 9.2, 9.3**
    fc.assert(
      fc.property(
        fc.record({
          passId: fc.string({ minLength: 1 }),
          eventId: fc.string({ minLength: 1 }),
          passStatus: fc.constantFrom('ACTIVE' as const, 'INVALID' as const),
          entryStatus: fc.constantFrom('NOT_USED' as const, 'USED' as const),
        }),
        (record: PassRecord) => {
          const result = deserializePassRecord(serializePassRecord(record));

          return (
            result.passId === record.passId &&
            result.eventId === record.eventId &&
            result.passStatus === record.passStatus &&
            result.entryStatus === record.entryStatus
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
