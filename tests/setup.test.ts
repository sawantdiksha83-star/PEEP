/**
 * Smoke test — verifies the test runner and fast-check are working.
 * Requirements: 1.4 (test infrastructure)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

describe('Test infrastructure', () => {
  it('Node.js test runner is working', () => {
    assert.ok(true, 'test runner runs');
  });

  it('fast-check is accessible', () => {
    // Run a trivial property to confirm fast-check loads and executes
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return typeof n === 'number';
      }),
    );
  });
});
