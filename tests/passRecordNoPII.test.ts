/**
 * Property-based test: PassRecord contains no PII fields.
 * Requirements: 3.3, 5.1
 */
import { describe, it } from 'node:test';
import fc from 'fast-check';
import type { PassRecord } from '../src/peep-types.js';

// **Feature: private-event-eligibility-pass, Property 4: PassRecord contains no PII**
describe('Property 4: PassRecord contains no PII', () => {
  it('PassRecord objects contain no name, email, phone, studentId, or college keys', () => {
    // Generates arbitrary PassRecord values and asserts that the object
    // only contains the four allowed public fields — no PII keys.
    // **Validates: Requirements 3.3, 5.1**
    const PII_KEYS = ['name', 'email', 'phone', 'studentId', 'college'];

    fc.assert(
      fc.property(
        fc.record({
          passId: fc.string({ minLength: 1 }),
          eventId: fc.string({ minLength: 1 }),
          passStatus: fc.constantFrom('ACTIVE' as const, 'INVALID' as const),
          entryStatus: fc.constantFrom('NOT_USED' as const, 'USED' as const),
        }),
        (record: PassRecord) => {
          const keys = Object.keys(record);
          return PII_KEYS.every((piiKey) => !keys.includes(piiKey));
        },
      ),
      { numRuns: 100 },
    );
  });
});
