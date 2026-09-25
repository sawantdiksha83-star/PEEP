/**
 * PEEP CLI — Private Event Eligibility Pass
 * ==========================================
 * Command-line interface for interacting with the deployed PEEP contract.
 *
 * Commands:
 *   create-event <eventId> <eligibilityHash>
 *     Create a new event with a public eligibility requirement hash.
 *     Requirements: 2.1, 2.3
 *
 *   issue-pass <eventId> <passId> <witness>
 *     Verify eligibility using the private witness and issue a pass.
 *     The witness is used only inside the ZK proof — never printed.
 *     Requirements: 1.1, 3.1
 *
 *   mark-used <passId> <eventId>
 *     Mark an ACTIVE+NOT_USED pass as USED (one-time entry, replay protection).
 *     Requirements: 4.1
 *
 *   verify <passId>
 *     Look up a pass and print its public state (passId, eventId, passStatus, entryStatus).
 *     Requirements: 5.4
 *
 * Usage:
 *   npx tsx src/peep-cli.ts <command> [args...]
 *
 * Privacy guarantee:
 *   The witness argument is consumed by the ZK proof circuit and is NEVER
 *   printed, logged, or included in any output. Only public data is displayed.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PassRecord, PassStatus, EntryStatus } from './peep-types.js';

// ─── Path helpers ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const STATE_FILE = resolve(ROOT, '.midnight-state.json');
const CONTRACT_DIR = resolve(ROOT, 'contracts', 'managed', 'event_eligibility_pass');

// ─── State helpers ────────────────────────────────────────────────────────────

interface DeploymentRecord {
  contractAddress: string;
  deployedAt: string;
  network: string;
}

interface MidnightState {
  [key: string]: DeploymentRecord;
}

/**
 * Load the PEEP deployment record from `.midnight-state.json`.
 * Exits with an error if the contract has not been deployed yet.
 */
function loadDeploymentRecord(): DeploymentRecord {
  if (!existsSync(STATE_FILE)) {
    console.error('[peep-cli] Error: .midnight-state.json not found. Run peep-deploy.ts first.');
    process.exit(1);
  }

  let state: MidnightState;
  try {
    state = JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as MidnightState;
  } catch {
    console.error('[peep-cli] Error: could not parse .midnight-state.json.');
    process.exit(1);
  }

  const record = state['peep'];
  if (!record?.contractAddress) {
    console.error('[peep-cli] Error: no PEEP deployment found in .midnight-state.json. Run peep-deploy.ts first.');
    process.exit(1);
  }

  return record;
}

// ─── Midnight SDK type stubs ──────────────────────────────────────────────────
// Real implementations come from @midnight-ntwrk/midnight-js-* packages.

interface ContractInstance {
  contractAddress: string;
  callTx(circuit: string, ...args: unknown[]): Promise<unknown>;
  queryState(): Promise<LedgerState>;
}

interface LedgerState {
  eventId: string;
  eligibilityHash: string;
  eventActive: boolean;
  passId: string;
  passActive: boolean;
  entryUsed: boolean;
}

// ─── Contract connection ──────────────────────────────────────────────────────

/**
 * Connect to a deployed contract instance by its address.
 *
 * SDK integration: replace the stub body with:
 *
 *   import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
 *   return findDeployedContract(providers, contractAddress, contractModule);
 *
 * Requirements: 2.1
 */
async function findDeployedContract(contractAddress: string): Promise<ContractInstance> {
  const contractIndexPath = resolve(CONTRACT_DIR, 'contract', 'index.js');

  if (!existsSync(contractIndexPath)) {
    throw new Error(
      `Compiled contract not found at: ${contractIndexPath}\n` +
      `Run: compact compile contracts/event_eligibility_pass.compact contracts/managed/event_eligibility_pass`
    );
  }

  // Dynamic import of compiled contract module
  await import(contractIndexPath);

  // ── SDK integration point ─────────────────────────────────────────────────
  // When @midnight-ntwrk packages are installed:
  //
  //   import { findDeployedContract as sdkFind } from '@midnight-ntwrk/midnight-js-contracts';
  //   import { createProviders } from './providers.js';
  //
  //   const providers = await createProviders(networkConfig);
  //   return sdkFind(providers, contractAddress, contractModule);
  // ─────────────────────────────────────────────────────────────────────────

  console.log(`[peep-cli] NOTE: Midnight SDK not installed. Using stub contract instance.`);
  console.log(`[peep-cli] Contract address: ${contractAddress}`);

  // Stub — replace with real SDK instance
  return {
    contractAddress,
    async callTx(circuit: string, ...args: unknown[]): Promise<unknown> {
      // Privacy: filter witness from log — only log circuit name and non-sensitive args
      const safeArgs = circuit === 'verifyEligibilityAndIssuePass' ? args.slice(0, 2) : args;
      console.log(`[peep-cli] callTx: ${circuit}(${safeArgs.map(String).join(', ')})`);
      return {};
    },
    async queryState(): Promise<LedgerState> {
      return {
        eventId: '',
        eligibilityHash: '',
        eventActive: false,
        passId: '',
        passActive: false,
        entryUsed: false,
      };
    },
  };
}

// ─── Ledger state → PassRecord conversion ────────────────────────────────────

/**
 * Convert a raw ledger state into a typed PassRecord.
 * Only the four public fields are included — no PII, no witness. Requirement 5.4.
 */
function ledgerStateToPassRecord(state: LedgerState): PassRecord {
  return {
    passId: state.passId,
    eventId: state.eventId,
    passStatus: state.passActive ? 'ACTIVE' : 'INVALID' as PassStatus,
    entryStatus: state.entryUsed ? 'USED' : 'NOT_USED' as EntryStatus,
  };
}

/**
 * Print a PassRecord to stdout.
 * Only public data is printed — never the witness or any PII. Requirement 5.4.
 */
function printPassRecord(record: PassRecord): void {
  console.log('Pass record:');
  console.log(`  passId:      ${record.passId}`);
  console.log(`  eventId:     ${record.eventId}`);
  console.log(`  passStatus:  ${record.passStatus}`);
  console.log(`  entryStatus: ${record.entryStatus}`);
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * create-event <eventId> <eligibilityHash>
 *
 * Creates a new event on-chain. Both arguments are public.
 * Requirements: 2.1, 2.2, 2.3
 */
async function cmdCreateEvent(eventId: string, eligibilityHash: string): Promise<void> {
  if (!eventId || !eligibilityHash) {
    throw new Error('Usage: create-event <eventId> <eligibilityHash>');
  }

  const { contractAddress } = loadDeploymentRecord();
  const contract = await findDeployedContract(contractAddress);

  console.log(`[peep-cli] Creating event: eventId=${eventId}`);
  await contract.callTx('createEvent', eventId, eligibilityHash);
  console.log(`[peep-cli] Event created successfully.`);
  console.log(`  eventId:         ${eventId}`);
  console.log(`  eligibilityHash: ${eligibilityHash}`);
}

/**
 * issue-pass <eventId> <passId> <witness>
 *
 * Calls `verifyEligibilityAndIssuePass`. The witness is the private eligibility
 * input (H(privateCredential)) — it is passed to the ZK proof circuit and is
 * NEVER logged or printed. Only the resulting public pass state is displayed.
 *
 * Requirements: 1.1, 3.1, 5.4
 */
async function cmdIssuePass(eventId: string, passId: string, witness: string): Promise<void> {
  if (!eventId || !passId || !witness) {
    throw new Error('Usage: issue-pass <eventId> <passId> <witness>');
  }

  const { contractAddress } = loadDeploymentRecord();
  const contract = await findDeployedContract(contractAddress);

  // The witness is passed to the circuit but deliberately not logged.
  // Requirement 5.4: system SHALL NOT log private credential data.
  console.log(`[peep-cli] Issuing pass: eventId=${eventId}, passId=${passId}`);
  console.log(`[peep-cli] (Witness consumed by ZK circuit — not logged)`);

  await contract.callTx('verifyEligibilityAndIssuePass', eventId, passId, witness);

  const state = await contract.queryState();
  const record = ledgerStateToPassRecord(state);

  console.log(`[peep-cli] Pass issued successfully.`);
  printPassRecord(record);
}

/**
 * mark-used <passId> <eventId>
 *
 * Marks an ACTIVE+NOT_USED pass as USED (one-time entry / replay protection).
 * Requirements: 4.1, 4.2, 4.4
 */
async function cmdMarkUsed(passId: string, eventId: string): Promise<void> {
  if (!passId || !eventId) {
    throw new Error('Usage: mark-used <passId> <eventId>');
  }

  const { contractAddress } = loadDeploymentRecord();
  const contract = await findDeployedContract(contractAddress);

  console.log(`[peep-cli] Marking pass as used: passId=${passId}, eventId=${eventId}`);
  await contract.callTx('markPassUsed', passId, eventId);

  const state = await contract.queryState();
  const record = ledgerStateToPassRecord(state);

  console.log(`[peep-cli] Pass marked as used.`);
  printPassRecord(record);
}

/**
 * verify <passId>
 *
 * Queries the on-chain state for the given passId and prints its public state.
 * Only public data (passId, eventId, passStatus, entryStatus) is displayed.
 * Requirements: 5.4
 */
async function cmdVerify(passId: string): Promise<void> {
  if (!passId) {
    throw new Error('Usage: verify <passId>');
  }

  const { contractAddress } = loadDeploymentRecord();
  const contract = await findDeployedContract(contractAddress);

  console.log(`[peep-cli] Querying pass: passId=${passId}`);
  const state = await contract.queryState();
  const record = ledgerStateToPassRecord(state);

  if (record.passId !== passId) {
    console.log(`[peep-cli] INVALID PASS — passId not found on this contract instance.`);
    return;
  }

  printPassRecord(record);

  // Human-readable access result
  if (record.passStatus === 'ACTIVE' && record.entryStatus === 'NOT_USED') {
    console.log('[peep-cli] Result: ACCESS GRANTED');
  } else if (record.entryStatus === 'USED') {
    console.log('[peep-cli] Result: PASS ALREADY USED');
  } else if (record.passStatus === 'INVALID') {
    console.log('[peep-cli] Result: INVALID PASS');
  }
}

// ─── Usage ────────────────────────────────────────────────────────────────────

function printUsage(): void {
  console.log(`
PEEP CLI — Private Event Eligibility Pass

Commands:
  create-event <eventId> <eligibilityHash>    Create an event (Organizer)
  issue-pass <eventId> <passId> <witness>     Issue a pass after ZK eligibility check (Participant)
  mark-used <passId> <eventId>                Mark a pass as used at entry (Scanner)
  verify <passId>                             Look up a pass's public state (Scanner)

Examples:
  npx tsx src/peep-cli.ts create-event "hackathon-2026" "0xabc123..."
  npx tsx src/peep-cli.ts issue-pass "hackathon-2026" "pass-001" "<witness-hex>"
  npx tsx src/peep-cli.ts mark-used "pass-001" "hackathon-2026"
  npx tsx src/peep-cli.ts verify "pass-001"
  `.trim());
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'create-event':
      await cmdCreateEvent(args[0] ?? '', args[1] ?? '');
      break;
    case 'issue-pass':
      await cmdIssuePass(args[0] ?? '', args[1] ?? '', args[2] ?? '');
      break;
    case 'mark-used':
      await cmdMarkUsed(args[0] ?? '', args[1] ?? '');
      break;
    case 'verify':
      await cmdVerify(args[0] ?? '');
      break;
    default:
      console.error(`[peep-cli] Unknown command: "${command}"`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  // Privacy: never include witness or credential in error output. Requirement 5.4.
  const message = err instanceof Error ? err.message : String(err);
  // Sanitize: strip any hex strings longer than 20 chars that might be witness data
  const sanitized = message.replace(/0x[0-9a-fA-F]{20,}/g, '[REDACTED]');
  console.error(`[peep-cli] Error: ${sanitized}`);
  process.exit(1);
});
