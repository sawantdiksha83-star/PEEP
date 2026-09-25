/**
 * useMidnight — React hook for Midnight Network wallet and contract interaction.
 *
 * Privacy guarantees (Requirements 5.4, 7.1–7.5):
 *   - The eligibility witness is NEVER stored in hook state, React state,
 *     or local storage. It is accepted as a function argument, passed directly
 *     to the contract call, and goes out of scope immediately.
 *   - Only public data (passId, eventId, passStatus, entryStatus) is held in state.
 *   - The wallet address is shortened for display only.
 */

import { useState, useCallback } from 'react';
import type { PassRecord, PassStatus, EntryStatus } from '../../../src/peep-types';

// ─── Lace DApp Connector API types ───────────────────────────────────────────
// The Lace wallet injects window.midnight.mnLace in the browser.
// Requirements: 7.1, 7.2, 7.3, 7.4

interface LaceAPI {
  /** Request user permission to connect this dApp to their Lace wallet. */
  enable(): Promise<LaceWalletAPI>;
  /** Check if the dApp is already enabled. */
  isEnabled(): Promise<boolean>;
}

interface LaceWalletAPI {
  /** Returns the user's public key (used as wallet address display). */
  getChangeAddress(): Promise<string>;
  /** Returns the network the wallet is currently on. */
  getNetworkId(): Promise<number>;
}

// Shape injected by the Lace wallet extension
interface MidnightWindow {
  mnLace?: LaceAPI;
}

// ─── Ledger state types (mirrors contract ledger) ─────────────────────────────

interface LedgerState {
  passId: string;
  eventId: string;
  passActive: boolean;
  entryUsed: boolean;
}

// ─── Hook state ───────────────────────────────────────────────────────────────

export interface UseMidnightState {
  /** Shortened wallet address, or null when not connected. Requirements: 7.1 */
  walletAddress: string | null;
  /** Whether the wallet is currently connected. Requirements: 7.1 */
  connected: boolean;
  /** Current network name (e.g. "testnet", "devnet", "local"). Requirements: 7.4 */
  network: string | null;
  /** Last error message, or null. Never contains private data. Requirements: 5.4 */
  error: string | null;
}

export interface UseMidnightActions {
  /** Connect to the Lace wallet. Requirements: 7.1, 7.2, 7.3 */
  connectWallet(): Promise<void>;
  /** Disconnect and clear session state. Requirements: 7.5 */
  disconnectWallet(): void;
  /**
   * Query on-chain state for a passId.
   * Returns public pass data only. Requirements: 6.1
   */
  getPassState(passId: string): Promise<PassRecord | null>;
  /**
   * Verify eligibility with a private witness and issue a pass.
   *
   * PRIVACY: The `witness` parameter is passed directly to the ZK circuit.
   * It is never stored in React state, local storage, or logged.
   * Requirements: 1.1, 3.1, 5.4
   */
  issuePass(eventId: string, passId: string, witness: string): Promise<PassRecord>;
  /**
   * Mark a pass as used (one-time entry). Requirements: 4.1, 4.2
   */
  markUsed(passId: string, eventId: string): Promise<PassRecord>;
}

export type UseMidnightReturn = UseMidnightState & UseMidnightActions;

// ─── Network ID mapping ───────────────────────────────────────────────────────

const NETWORK_NAMES: Record<number, string> = {
  0: 'devnet',
  1: 'testnet',
  2: 'local',
};

function networkIdToName(id: number): string {
  return NETWORK_NAMES[id] ?? `network-${id}`;
}

// ─── Ledger → PassRecord ──────────────────────────────────────────────────────

function ledgerToPassRecord(state: LedgerState): PassRecord {
  return {
    passId: state.passId,
    eventId: state.eventId,
    passStatus: (state.passActive ? 'ACTIVE' : 'INVALID') as PassStatus,
    entryStatus: (state.entryUsed ? 'USED' : 'NOT_USED') as EntryStatus,
  };
}

// ─── Contract interaction stubs ───────────────────────────────────────────────
// These functions call the compiled Compact contract via the Midnight JS SDK.
// When @midnight-ntwrk packages are installed, replace the stub bodies with
// real SDK calls. The interfaces below match the SDK surface.
//
// SDK integration pattern:
//   import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
//   const contract = await findDeployedContract(providers, contractAddress);
//   await contract.callTx('verifyEligibilityAndIssuePass', eventId, passId, witness);
//   const state = await contract.queryState();

async function sdkIssuePass(
  _eventId: string,
  _passId: string,
  _witness: string // consumed by ZK circuit — never stored
): Promise<LedgerState> {
  void _eventId;
  void _passId;
  void _witness;
  // TODO: replace with real Midnight SDK call
  // The witness MUST NOT be logged or stored here
  throw new Error('Midnight SDK not installed. Install @midnight-ntwrk packages to enable on-chain transactions.');
}

async function sdkMarkUsed(
  _passId: string,
  _eventId: string
): Promise<LedgerState> {
  void _passId;
  void _eventId;
  // TODO: replace with real Midnight SDK call
  throw new Error('Midnight SDK not installed. Install @midnight-ntwrk packages to enable on-chain transactions.');
}

async function sdkGetPassState(_passId: string): Promise<LedgerState | null> {
  void _passId;
  // TODO: replace with real Midnight SDK indexer query
  throw new Error('Midnight SDK not installed. Install @midnight-ntwrk packages to enable on-chain queries.');
}

// ─── Structured error mapping ─────────────────────────────────────────────────

/**
 * Strip any potential witness/credential data from error messages.
 * Requirement 5.4: error messages SHALL NOT contain private data.
 */
function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Redact long hex strings that might be witness or credential bytes
  return raw.replace(/0x[0-9a-fA-F]{20,}/g, '[REDACTED]');
}

/**
 * Map raw SDK / network errors to user-readable messages.
 * All branches return messages that contain no private data.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export function mapSdkError(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();

  // Requirement 10.1 — wallet rejection
  if (
    raw.includes('user declined') ||
    raw.includes('user rejected') ||
    raw.includes('rejected') ||
    raw.includes('denied')
  ) {
    return 'Transaction rejected by wallet.';
  }

  // Requirement 10.2 — invalid eligibility / witness mismatch
  if (
    raw.includes('eligibility') ||
    raw.includes('witness') ||
    raw.includes('credential') ||
    raw.includes('proof failed') ||
    raw.includes('circuit')
  ) {
    return 'Eligibility verification failed. Please check your credential.';
  }

  // Requirement 10.5 — proof server not running
  if (
    raw.includes('proof server') ||
    raw.includes('proof generation') ||
    raw.includes('prover') ||
    raw.includes('econnrefused') ||
    raw.includes('proof')
  ) {
    return 'Proof generation failed. Ensure the proof server is running.';
  }

  // Requirement 4.2 — replay / already-used
  if (raw.includes('pass_already_used') || raw.includes('already used') || raw.includes('replay')) {
    return 'PASS ALREADY USED';
  }

  // Requirement 4.5 — wrong event
  if (raw.includes('wrong_event') || raw.includes('wrong event')) {
    return 'PASS NOT VALID FOR THIS EVENT';
  }

  // Requirement 4.3 — invalid pass
  if (raw.includes('invalid_pass') || raw.includes('invalid pass')) {
    return 'INVALID PASS';
  }

  // Wrong network (Requirement 7.4)
  if (raw.includes('network') && (raw.includes('wrong') || raw.includes('switch'))) {
    return 'Wrong network. Please switch your wallet to the correct Midnight network.';
  }

  // Requirement 10.3 — generic network error
  if (
    raw.includes('network') ||
    raw.includes('fetch') ||
    raw.includes('timeout') ||
    raw.includes('offline') ||
    raw.includes('indexer')
  ) {
    return 'Network error. Please try again.';
  }

  // Wallet not available (Requirement 7.2)
  if (raw.includes('sdk not installed') || raw.includes('@midnight-ntwrk')) {
    return 'Midnight SDK not installed. Install @midnight-ntwrk packages to enable on-chain transactions.';
  }

  // Requirement 10.4 — fallback: sanitize but don't expose private data
  return sanitizeError(err);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useMidnight — hook for Midnight Network wallet connection and contract calls.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function useMidnight(): UseMidnightReturn {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [network, setNetwork] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── connectWallet ──────────────────────────────────────────────────────────
  const connectWallet = useCallback(async (): Promise<void> => {
    setError(null);

    const lace = (window as unknown as MidnightWindow).mnLace;

    // Requirement 7.2: wallet not available
    if (!lace) {
      setError('Wallet unavailable. Please install the Lace wallet extension.');
      return;
    }

    try {
      // Requirement 7.1: request connection
      const api = await lace.enable();

      const address = await api.getChangeAddress();
      const networkId = await api.getNetworkId();
      const networkName = networkIdToName(networkId);

      // Shorten address for display only — full address never logged
      const shortened = `${address.slice(0, 8)}…${address.slice(-6)}`;

      setWalletAddress(shortened);
      setNetwork(networkName);
      setConnected(true);
    } catch (err: unknown) {
      // Requirements 7.3, 7.4, 10.1–10.4: map to structured user-readable message
      setError(mapSdkError(err));
      setConnected(false);
      setWalletAddress(null);
      setNetwork(null);
    }
  }, []);

  // ── disconnectWallet ───────────────────────────────────────────────────────
  // Requirement 7.5: clear all session state on disconnect
  const disconnectWallet = useCallback((): void => {
    setWalletAddress(null);
    setConnected(false);
    setNetwork(null);
    setError(null);
  }, []);

  // ── getPassState ───────────────────────────────────────────────────────────
  const getPassState = useCallback(async (passId: string): Promise<PassRecord | null> => {
    setError(null);
    try {
      const ledger = await sdkGetPassState(passId);
      if (!ledger) return null;
      return ledgerToPassRecord(ledger);
    } catch (err: unknown) {
      setError(mapSdkError(err));
      return null;
    }
  }, []);

  // ── issuePass ──────────────────────────────────────────────────────────────
  // PRIVACY: witness is a function parameter only — never touched by useState.
  // It flows into sdkIssuePass (which calls the ZK circuit) and is never held
  // in any state variable or logged. Requirements: 1.1, 5.4
  const issuePass = useCallback(
    async (eventId: string, passId: string, witness: string): Promise<PassRecord> => {
      setError(null);
      try {
        const ledger = await sdkIssuePass(eventId, passId, witness);
        return ledgerToPassRecord(ledger);
      } catch (err: unknown) {
        const msg = mapSdkError(err);
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  // ── markUsed ───────────────────────────────────────────────────────────────
  const markUsed = useCallback(
    async (passId: string, eventId: string): Promise<PassRecord> => {
      setError(null);
      try {
        const ledger = await sdkMarkUsed(passId, eventId);
        return ledgerToPassRecord(ledger);
      } catch (err: unknown) {
        const msg = mapSdkError(err);
        setError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  return {
    walletAddress,
    connected,
    network,
    error,
    connectWallet,
    disconnectWallet,
    getPassState,
    issuePass,
    markUsed,
  };
}
