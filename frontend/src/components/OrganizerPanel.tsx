/**
 * OrganizerPanel — scanner UI: verify a pass and mark it as used.
 *
 * Requirements: 4.1, 4.2, 6.2, 6.3
 *
 * Flow:
 *   1. Organizer scans / pastes a QR code via PassVerifier.
 *   2. If the pass is ACTIVE + NOT_USED, "Mark Used" button becomes available.
 *   3. On mark: calls markUsed, refreshes pass state.
 *   4. After marking: PassVerifier would show PASS ALREADY USED on next scan.
 */

import React, { useState, useCallback } from 'react';
import { PassVerifier } from './PassVerifier';
import type { VerificationResult } from './PassVerifier';
import type { PassRecord } from '../../../src/peep-types';
import type { UseMidnightReturn } from '../hooks/useMidnight';
import { mapSdkError } from '../hooks/useMidnight';

interface OrganizerPanelProps {
  getPassState: UseMidnightReturn['getPassState'];
  markUsed: UseMidnightReturn['markUsed'];
  connected: boolean;
  /** Optional: restrict verification to a specific event. Requirement 6.5 */
  expectedEventId?: string;
}

export function OrganizerPanel({
  getPassState,
  markUsed,
  connected,
  expectedEventId,
}: OrganizerPanelProps): React.ReactElement {
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [markedPass, setMarkedPass] = useState<PassRecord | null>(null);

  const handleVerificationResult = useCallback((result: VerificationResult) => {
    setLastResult(result);
    setMarkError(null);
    setMarkedPass(null);
  }, []);

  // "Mark Used" is only enabled when pass is ACTIVE + NOT_USED (Requirement 4.1)
  const canMark =
    lastResult?.status === 'ACCESS_GRANTED' &&
    lastResult.pass?.passStatus === 'ACTIVE' &&
    lastResult.pass?.entryStatus === 'NOT_USED';

  const handleMarkUsed = useCallback(async () => {
    if (!lastResult?.pass) return;
    setMarkError(null);
    setMarking(true);

    try {
      const updated = await markUsed(lastResult.pass.passId, lastResult.pass.eventId);
      setMarkedPass(updated);
      // After marking, update the last result to reflect the new state (Requirement 4.2)
      setLastResult((prev) =>
        prev
          ? {
              ...prev,
              status: 'PASS_ALREADY_USED',
              pass: updated,
            }
          : prev
      );
    } catch (err: unknown) {
      setMarkError(mapSdkError(err));
    } finally {
      setMarking(false);
    }
  }, [lastResult, markUsed]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Scan / Enter Pass</h3>
        <PassVerifier
          getPassState={getPassState}
          expectedEventId={expectedEventId}
          onResult={handleVerificationResult}
        />
      </div>

      {/* ── Entry action panel ─────────────────────────────────────────────
          Only shown once a pass has been looked up. Requirement 4.1, 4.2     */}
      {lastResult && (
        <div
          className={`rounded-xl border p-4 flex flex-col gap-3 ${
            canMark
              ? 'bg-green-50 border-green-300'
              : markedPass
              ? 'bg-gray-50 border-gray-300'
              : 'bg-gray-50 border-gray-200'
          }`}
          aria-label="Entry action panel"
        >
          {/* Pass lifecycle badge */}
          {canMark && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-800">
                ● Pass ready for entry
              </span>
              <span className="text-xs text-green-700 bg-green-100 border border-green-300 px-2 py-0.5 rounded-full font-medium">
                ACTIVE · NOT USED
              </span>
            </div>
          )}

          {markedPass && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700">
                ✓ Entry recorded
              </span>
              {/* Lifecycle: NOT USED → USED visual */}
              <div className="flex items-center gap-1 text-xs" aria-label="Pass transitioned to used">
                <span className="line-through text-gray-400">NOT USED</span>
                <span className="text-gray-500" aria-hidden="true">→</span>
                <span className="font-semibold text-gray-700 bg-gray-200 px-1.5 py-0.5 rounded">
                  USED
                </span>
              </div>
            </div>
          )}

          {/* Mark Used button — Requirement 4.1 */}
          {canMark && (
            <button
              onClick={handleMarkUsed}
              disabled={marking || !connected}
              className="inline-flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 w-full sm:w-auto"
              aria-label="Mark pass as used and record entry"
            >
              {marking ? (
                <>
                  <span
                    className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span>Recording entry…</span>
                </>
              ) : (
                'Mark Used'
              )}
            </button>
          )}

          {/* Confirmed mark — Requirement 4.2 */}
          {markedPass && (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-gray-700"
            >
              Entry status updated to{' '}
              <strong className="font-semibold">USED</strong>. Rescan to confirm.
            </p>
          )}

          {markError && (
            <div
              role="alert"
              aria-live="assertive"
              className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
            >
              {markError}
            </div>
          )}
        </div>
      )}

      {!connected && (
        <p className="text-xs text-amber-700 font-medium" role="status">
          Connect your wallet to mark passes as used.
        </p>
      )}
    </div>
  );
}
