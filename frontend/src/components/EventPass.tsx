/**
 * EventPass — displays a participant's issued event pass.
 *
 * Privacy guarantees (Requirements 3.2, 3.3, 5.1, 6.2):
 *   - Displays ONLY: eventId, passId, Eligibility: VERIFIED, Pass status, Entry status.
 *   - NEVER displays: name, student ID, email, phone, college, or witness.
 *   - Accepts a PassRecord prop (which itself contains no PII by design).
 */

import React from 'react';
import type { PassRecord } from '../../../src/peep-types';

interface EventPassProps {
  pass: PassRecord;
}

// ─── Pass lifecycle steps ─────────────────────────────────────────────────────
// Visual indicator: ISSUED → ACTIVE → USED  (Requirements 6.2, 6.3)

type LifecycleStep = 'issued' | 'active' | 'used';

function getLifecycleStep(pass: PassRecord): LifecycleStep {
  if (pass.passStatus !== 'ACTIVE') return 'issued';
  if (pass.entryStatus === 'USED') return 'used';
  return 'active';
}

const LIFECYCLE_STEPS: Array<{ key: LifecycleStep; label: string }> = [
  { key: 'issued', label: 'Issued' },
  { key: 'active', label: 'Active' },
  { key: 'used', label: 'Used' },
];

const STEP_ORDER: Record<LifecycleStep, number> = { issued: 0, active: 1, used: 2 };

// ─── Component ────────────────────────────────────────────────────────────────

export function EventPass({ pass }: EventPassProps): React.ReactElement {
  const isActive = pass.passStatus === 'ACTIVE';
  const isUsed = pass.entryStatus === 'USED';
  const currentStep = getLifecycleStep(pass);
  const currentStepIndex = STEP_ORDER[currentStep];

  return (
    <article
      className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col gap-5 w-full max-w-sm"
      aria-label={`Event pass — status: ${pass.passStatus}, entry: ${pass.entryStatus}`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-gray-900">Event Pass</h2>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            isActive
              ? 'bg-green-50 text-green-800 border-green-300'
              : 'bg-red-50 text-red-700 border-red-300'
          }`}
          aria-label={`Pass status: ${pass.passStatus}`}
        >
          {isActive ? '● ACTIVE' : '✗ INVALID'}
        </span>
      </div>

      {/* ── Pass lifecycle indicator: ISSUED → ACTIVE → USED ───────────── */}
      <div aria-label={`Pass lifecycle: currently ${currentStep}`} role="img">
        <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
          Pass lifecycle
        </p>
        <div className="flex items-center gap-0" role="list">
          {LIFECYCLE_STEPS.map((step, i) => {
            const isDone = STEP_ORDER[step.key] < currentStepIndex;
            const isCurrent = step.key === currentStep;
            const isLast = i === LIFECYCLE_STEPS.length - 1;

            return (
              <React.Fragment key={step.key}>
                {/* Step node */}
                <div
                  role="listitem"
                  className="flex flex-col items-center gap-1 flex-shrink-0"
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      isCurrent
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : isDone
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                    aria-hidden="true"
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isCurrent
                        ? 'text-indigo-700'
                        : isDone
                        ? 'text-green-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line between steps */}
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className={`flex-1 h-0.5 mx-1 mb-4 rounded ${
                      STEP_ORDER[LIFECYCLE_STEPS[i + 1].key] <= currentStepIndex
                        ? 'bg-green-400'
                        : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Event ID ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Event</span>
        <span className="text-sm font-mono text-gray-800" aria-label="Event ID">
          {pass.eventId}
        </span>
      </div>

      {/* ── Pass ID ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pass ID</span>
        <span className="text-sm font-mono text-gray-800 break-all" aria-label="Pass ID">
          {pass.passId}
        </span>
      </div>

      {/* ── Eligibility badge ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Eligibility
        </span>
        <span
          className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-semibold px-2.5 py-1 rounded-full"
          aria-label="Eligibility: VERIFIED"
        >
          ✓ VERIFIED
        </span>
      </div>

      {/* ── Entry status ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Entry</span>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
            isUsed
              ? 'bg-gray-100 text-gray-700 border-gray-300'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
          aria-label={`Entry status: ${pass.entryStatus}`}
        >
          {isUsed ? 'USED' : 'NOT USED'}
        </span>
      </div>

      {/* ── Privacy notice ─────────────────────────────────────────────── */}
      <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
        Your identity is not disclosed. Only eligibility is verified.
      </p>
    </article>
  );
}
