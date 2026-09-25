/**
 * WalletConnect — Lace wallet connection UI component.
 *
 * States (Requirements 7.1–7.5):
 *   - NOT CONNECTED: "Connect Wallet" button
 *   - CONNECTED: shortened address + "Disconnect" button
 *   - Error states: unavailable, rejected, wrong network
 */

import React from 'react';
import type { UseMidnightReturn } from '../hooks/useMidnight';

interface WalletConnectProps {
  /** Slice of the useMidnight hook relevant to wallet state. */
  wallet: Pick<
    UseMidnightReturn,
    'walletAddress' | 'connected' | 'network' | 'error' | 'connectWallet' | 'disconnectWallet'
  >;
}

export function WalletConnect({ wallet }: WalletConnectProps): React.ReactElement {
  const { walletAddress, connected, network, error, connectWallet, disconnectWallet } = wallet;

  return (
    <div className="flex flex-col gap-2">
      {connected && walletAddress ? (
        // ── CONNECTED state (Requirement 7.1) ──────────────────────────────
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full"
            aria-label="Wallet connected"
          >
            ● Connected
          </span>
          <span className="font-mono text-sm text-gray-700" aria-label="Wallet address">
            {walletAddress}
          </span>
          {network && (
            <span className="text-xs text-gray-500" aria-label="Network name">
              {network}
            </span>
          )}
          <button
            onClick={disconnectWallet}
            className="ml-auto text-sm text-red-700 hover:text-red-900 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 rounded"
            aria-label="Disconnect wallet"
          >
            Disconnect
          </button>
        </div>
      ) : (
        // ── NOT CONNECTED state (Requirement 7.1) ─────────────────────────
        <button
          onClick={connectWallet}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          aria-label="Connect Lace wallet"
        >
          Connect Wallet
        </button>
      )}

      {/* ── Error states (Requirements 7.2, 7.3, 7.4) ─────────────────── */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
        >
          {error}
          {/* Requirement 7.2: link to install Lace if unavailable */}
          {error.toLowerCase().includes('unavailable') && (
            <a
              href="https://lacewallet.io"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline text-red-800 hover:text-red-900"
              aria-label="Install Lace wallet"
            >
              Install Lace
            </a>
          )}
        </div>
      )}
    </div>
  );
}
