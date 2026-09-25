/**
 * PEEP — Private Event Eligibility Pass
 * Shared TypeScript types for the PEEP system.
 *
 * Privacy model:
 *   - PassRecord contains ONLY public data (passId, eventId, passStatus, entryStatus)
 *   - No PII (name, email, phone, studentId, college) is stored here
 *   - QRPayload encodes the minimum data needed for verification
 */

// ─── Enums / union types ─────────────────────────────────────────────────────

/** Whether a pass is currently active or has been invalidated. */
export type PassStatus = 'ACTIVE' | 'INVALID';

/** Whether a pass has been consumed for entry. */
export type EntryStatus = 'NOT_USED' | 'USED';

// ─── Domain models ────────────────────────────────────────────────────────────

/** Public on-chain record for an event. Requirements: 2.1, 2.2, 2.3 */
export interface EventRecord {
  eventId: string;
  eligibilityHash: string; // hex-encoded Bytes<32> — commitment to eligibility requirement
  active: boolean;
}

/**
 * Public on-chain record for a pass.
 * Contains NO PII. Requirements: 3.3, 5.1
 */
export interface PassRecord {
  passId: string;
  eventId: string;
  passStatus: PassStatus;
  entryStatus: EntryStatus;
}

/**
 * Minimum data encoded in a QR code.
 * Contains only passId + eventId — no PII, no witness. Requirements: 8.1, 8.2
 */
export interface QRPayload {
  passId: string;
  eventId: string;
}

// ─── Serialization helpers ────────────────────────────────────────────────────

/**
 * Serialize a PassRecord to a QR payload JSON string.
 * Encodes ONLY passId and eventId — no other fields. Requirements: 8.1, 8.2, 9.1
 */
export function serializeQRPayload(pass: PassRecord): string {
  const payload: QRPayload = {
    passId: pass.passId,
    eventId: pass.eventId,
  };
  return JSON.stringify(payload);
}

/**
 * Deserialize a QR payload JSON string back to a QRPayload.
 * Validates that passId and eventId are present strings. Requirements: 8.2, 9.1, 9.2
 * @throws {Error} if the JSON is malformed or missing required fields
 */
export function deserializeQRPayload(json: string): QRPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('QR payload is not valid JSON');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)['passId'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['eventId'] !== 'string'
  ) {
    throw new Error('QR payload missing required fields: passId, eventId');
  }

  const obj = parsed as Record<string, unknown>;
  return {
    passId: obj['passId'] as string,
    eventId: obj['eventId'] as string,
  };
}

/**
 * Serialize a full PassRecord to a JSON string.
 * Encodes all four public fields. Requirements: 9.1, 9.2
 */
export function serializePassRecord(pass: PassRecord): string {
  return JSON.stringify({
    passId: pass.passId,
    eventId: pass.eventId,
    passStatus: pass.passStatus,
    entryStatus: pass.entryStatus,
  });
}

/**
 * Deserialize a JSON string back to a PassRecord.
 * Validates all four required fields. Requirements: 9.2, 9.3
 * @throws {Error} if the JSON is malformed or missing/invalid fields
 */
export function deserializePassRecord(json: string): PassRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('PassRecord is not valid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('PassRecord must be a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj['passId'] !== 'string') {
    throw new Error('PassRecord missing required field: passId');
  }
  if (typeof obj['eventId'] !== 'string') {
    throw new Error('PassRecord missing required field: eventId');
  }
  if (obj['passStatus'] !== 'ACTIVE' && obj['passStatus'] !== 'INVALID') {
    throw new Error('PassRecord passStatus must be ACTIVE or INVALID');
  }
  if (obj['entryStatus'] !== 'NOT_USED' && obj['entryStatus'] !== 'USED') {
    throw new Error('PassRecord entryStatus must be NOT_USED or USED');
  }

  return {
    passId: obj['passId'] as string,
    eventId: obj['eventId'] as string,
    passStatus: obj['passStatus'] as PassStatus,
    entryStatus: obj['entryStatus'] as EntryStatus,
  };
}
