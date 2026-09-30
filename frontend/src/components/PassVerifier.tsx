/**
 * PassVerifier — QR input/scan → on-chain lookup → verification result.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 *
 * Note: @zxing/library camera scanning is not installed in this environment.
 * Camera scan is gated behind a feature flag; the text-input path is always available.
 */

import React, { useState, useCallback } from 'react';
import { deserializeQRPayload } from '../../../src/peep-types';
import type { PassRecord, QRPayload } from '../../../src/peep-types';
import type { UseMidnightReturn } from '../hooks/useMidnight';
import { mapSdkError } from '../hooks/useMidnight';

// ─── Verification result types ────────────────────────────────────────────────

export type VerificationStatus =
  | 'ACCESS_GRANTED'
  | 'PASS_ALREADY_USED'
  | 'INVALID_PASS'
  | 'WRONG_EVENT'
  | 'NOT_FOUND';

export interface VerificationResult {
  status: VerificationStatus;
  pass: PassRecord | null;
  payload: QRPayload | null;
}

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  ACCESS_GRANTED: {
    label: '✓ ACCESS GRANTED',
    color: 'text-green-800',
    bg: 'bg-green-50',
    border: 'border-green-300',
  },
  PASS_ALREADY_USED: {
    label: '✗ PASS ALREADY USED',
    color: 'text-red-800',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
  INVALID_PASS: {
    label: '✗ INVALID PASS',
    color: 'text-red-800',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
  WRONG_EVENT: {
    label: '✗ PASS NOT VALID FOR THIS EVENT',
    color: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
  },
  NOT_FOUND: {
    label: '✗ PASS NOT FOUND',
    color: 'text-red-800',
    bg: 'bg-red-50',
    border: 'border-red-300',
  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface PassVerifierProps {
  getPassState: UseMidnightReturn['getPassState'];
  /** Optional: if provided, check that the pass belongs to this event. Requirement 6.5 */
  expectedEventId?: string;
  /** Called when a pass is looked up successfully (for OrganizerPanel to use). */
  onResult?: (result: VerificationResult) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PassVerifier({
  getPassState,
  expectedEventId,
  onResult,
}: PassVerifierProps): React.ReactElement {
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const verify = useCallback(
    async (rawInput: string) => {
      setInputError(null);
      setResult(null);

      // Parse QR JSON — Requirements: 6.1, 8.3
      let payload: QRPayload;
      try {
        payload = deserializeQRPayload(rawInput.trim());
      } catch {
        setInputError('Invalid QR code format. Please enter a valid pass QR code.');
        return;
      }

      setLoading(true);
      try {
        const pass = await getPassState(payload.passId);

        let status: VerificationStatus;

        if (!pass) {
          // Requirement 6.4
          status = 'NOT_FOUND';
        } else if (pass.passStatus === 'INVALID') {
          // Requirement 6.4
          status = 'INVALID_PASS';
        } else if (expectedEventId && pass.eventId !== expectedEventId) {
          // Requirement 6.5
          status = 'WRONG_EVENT';
        } else if (pass.entryStatus === 'USED') {
          // Requirement 6.3
          status = 'PASS_ALREADY_USED';
        } else {
          // Requirement 6.2 — ACTIVE + NOT_USED
          status = 'ACCESS_GRANTED';
        }

        const verResult: VerificationResult = { status, pass, payload };
        setResult(verResult);
        onResult?.(verResult);
      } catch (err: unknown) {
        setInputError(mapSdkError(err));
      } finally {
        setLoading(false);
      }
    },
    [getPassState, expectedEventId, onResult]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (qrInput.trim()) verify(qrInput);
    },
    [qrInput, verify]
  );

  const cfg = result ? STATUS_CONFIG[result.status] : null;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-label="Pass verification form">
        <div className="flex flex-col gap-1">
          <label htmlFor="qr-input" className="text-sm font-medium text-gray-700">
            QR Code / Pass ID
          </label>
          <textarea
            id="qr-input"
            rows={3}
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            placeholder='Paste QR JSON here, e.g. {"passId":"...","eventId":"..."}'
            disabled={loading}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 resize-none"
            aria-label="QR code or pass JSON input"
          />
        </div>

        {inputError && (
          <p role="alert" className="text-sm text-red-700">
            {inputError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !qrInput.trim()}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          aria-label="Verify pass"
        >
          {loading ? (
            <>
              <span
                className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              Verifying…
            </>
          ) : (
            'Verify Pass'
          )}
        </button>
      </form>

      {/* Result display — Requirements 6.1–6.5 */}
      {result && cfg && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 flex flex-col gap-2 ${cfg.bg} ${cfg.border}`}
        >
          <p className={`text-base font-semibold ${cfg.color}`}>{cfg.label}</p>
          {result.pass && (
            <div className="text-sm text-gray-700 flex flex-col gap-1">
              <span>Pass ID: <span className="font-mono">{result.pass.passId}</span></span>
              <span>Event ID: <span className="font-mono">{result.pass.eventId}</span></span>
              <span>Status: {result.pass.passStatus}</span>
              <span>Entry: {result.pass.entryStatus}</span>
              {/* Requirement 6.6: no PII shown to scanner */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
