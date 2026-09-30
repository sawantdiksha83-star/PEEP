/**
 * EligibilityVerification — private credential input and eligibility verification UI.
 *
 * Privacy guarantees (Requirements 1.1, 1.2, 5.3, 5.4, 10.1, 10.2):
 *   - The private credential is hashed client-side before being passed as a witness.
 *   - The credential input field is cleared immediately after submission (success or failure).
 *   - No credential value ever appears in error messages or console output.
 *   - On success, a PassRecord (public data only) is passed to the parent callback.
 */

import React, { useState, useCallback, useRef } from 'react';
import type { PassRecord } from '../../../src/peep-types';
import type { UseMidnightReturn } from '../hooks/useMidnight';
import { mapSdkError } from '../hooks/useMidnight';

// ─── Known events ─────────────────────────────────────────────────────────────
// In production these would come from an on-chain query via the indexer.
// Requirements: 2.1, 2.3

export interface KnownEvent {
  eventId: string;
  name: string;
  eligibilityHash: string;
}

const DEFAULT_EVENTS: KnownEvent[] = [
  {
    eventId: 'event-001',
    name: 'Student Tech Summit 2026',
    eligibilityHash: '0xabc123',
  },
  {
    eventId: 'event-002',
    name: 'University Hackathon',
    eligibilityHash: '0xdef456',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hash the private credential client-side using SHA-256.
 * The raw credential NEVER leaves the browser. Requirements: 1.1, 5.3
 */
async function hashCredential(credential: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(credential);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EligibilityVerificationProps {
  /** issuePass from useMidnight. Requirements: 1.1, 3.1 */
  issuePass: UseMidnightReturn['issuePass'];
  /** Called with the issued PassRecord on success. */
  onPassIssued: (pass: PassRecord) => void;
  /** Whether the wallet is connected. */
  connected: boolean;
  /** Optional list of events; defaults to built-in list. */
  events?: KnownEvent[];
}

export function EligibilityVerification({
  issuePass,
  onPassIssued,
  connected,
  events = DEFAULT_EVENTS,
}: EligibilityVerificationProps): React.ReactElement {
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.eventId ?? '');
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ref to the credential input so we can clear and refocus it immediately.
  const credentialRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg(null);

      if (!selectedEventId) {
        setErrorMsg('Please select an event.');
        return;
      }
      if (!credential.trim()) {
        setErrorMsg('Please enter your private credential.');
        return;
      }

      setLoading(true);

      // Immediately capture and clear the credential field.
      // The raw value is held only in this local scope. Requirements: 5.4
      const rawCredential = credential;
      setCredential(''); // clear immediately — do not keep in state
      credentialRef.current?.focus();

      try {
        // Hash client-side; the witness sent to the circuit is H(credential).
        // The raw credential never leaves this function. Requirements: 1.1, 5.3
        const witness = await hashCredential(rawCredential);

        // Generate a deterministic passId from eventId + witness hash prefix.
        // In production this would be provided by the ZK proof / contract.
        const passId = `pass-${selectedEventId}-${witness.slice(0, 8)}`;

        const pass = await issuePass(selectedEventId, passId, witness);
        onPassIssued(pass);
      } catch (err: unknown) {
        // Requirement 10.2, 10.4: structured mapping — never expose credential
        setErrorMsg(mapSdkError(err));
      } finally {
        setLoading(false);
      }
    },
    [selectedEventId, credential, issuePass, onPassIssued]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      aria-label="Eligibility verification form"
    >
      {/* Event selection (Requirement 2.1) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="event-select" className="text-sm font-medium text-gray-700">
          Select Event
        </label>
        <select
          id="event-select"
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          disabled={loading || !connected}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"
          aria-label="Select event"
          aria-required="true"
        >
          {events.map((ev) => (
            <option key={ev.eventId} value={ev.eventId}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      {/* Private credential input — hashed before use, never stored */}
      <div className="flex flex-col gap-1">
        <label htmlFor="credential-input" className="text-sm font-medium text-gray-700">
          Private Credential
        </label>
        <input
          id="credential-input"
          ref={credentialRef}
          type="password"
          autoComplete="off"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          disabled={loading || !connected}
          placeholder="Enter your private credential"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"
          aria-label="Private credential"
          aria-required="true"
          aria-describedby="credential-hint"
        />
        <p id="credential-hint" className="text-xs text-gray-500">
          Your credential is hashed locally and never transmitted in raw form.
        </p>
      </div>

      {/* Error message — never contains credential (Requirement 5.4, 10.2) */}
      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
        >
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !connected}
        className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        aria-label="Verify eligibility and issue pass"
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
          'Verify Eligibility'
        )}
      </button>

      {!connected && (
        <p className="text-xs text-amber-600" role="status">
          Connect your wallet first to verify eligibility.
        </p>
      )}
    </form>
  );
}
