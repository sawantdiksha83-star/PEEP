/**
 * QRCodePass — generates a QR code from a PassRecord for event entry scanning.
 *
 * Privacy guarantees (Requirements 8.1, 8.2, 5.3):
 *   - QR content encodes ONLY passId and eventId via serializeQRPayload.
 *   - No PII (name, email, phone, studentId, college, witness) is encoded.
 *   - serializeQRPayload enforces the minimum-data constraint at the type level.
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { serializeQRPayload } from '../../../src/peep-types';
import type { PassRecord } from '../../../src/peep-types';

interface QRCodePassProps {
  pass: PassRecord;
  /** QR code size in pixels. Defaults to 200. */
  size?: number;
}

export function QRCodePass({ pass, size = 200 }: QRCodePassProps): React.ReactElement {
  // serializeQRPayload encodes ONLY { passId, eventId } — no PII. Requirements: 8.1, 8.2
  const qrValue = serializeQRPayload(pass);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
        aria-label="QR code for event pass entry"
      >
        <QRCodeSVG
          value={qrValue}
          size={size}
          level="M"
          includeMargin={true}
          aria-label={`QR code for pass ${pass.passId}`}
        />
      </div>

      <p className="text-xs text-gray-500 text-center max-w-xs">
        Show this QR code to the event scanner for entry. It contains only your pass ID and event
        ID — no personal information.
      </p>
    </div>
  );
}
