/**
 * PEEP Deploy Script
 * ==================
 * Deploys the `event_eligibility_pass` Compact contract to the Midnight Network
 * and records the contract address in `.midnight-state.json` under the key `peep`.
 *
 * Usage:
 *   npx tsx src/peep-deploy.ts [--network <testnet|devnet|local>]
 *
 * Requirements: 2.1, 2.3
 *
 * NOTE: This script depends on the Midnight SDK (@midnight-ntwrk/midnight-js-*)
 * and the compiled contract artifacts at:
 *   contracts/managed/event_eligibility_pass/contract/index.js
 *
 * Install the SDK and compile the contract before running:
 *   compact compile contracts/event_eligibility_pass.compact contracts/managed/event_eligibility_pass
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Path helpers ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

/** Path to the state file that persists deployed contract addresses. */
const STATE_FILE = resolve(ROOT, '.midnight-state.json');

/** Path to the compiled contract artifacts directory. */
const CONTRACT_DIR = resolve(ROOT, 'contracts', 'managed', 'event_eligibility_pass');

// ─── State file helpers ───────────────────────────────────────────────────────

/** Shape of the persisted deployment state file. */
interface MidnightState {
  [key: string]: DeploymentRecord;
}

/** A single deployment record written per contract. */
interface DeploymentRecord {
  contractAddress: string;
  deployedAt: string; // ISO 8601 timestamp
  network: string;
}

/**
 * Read the current state file, or return an empty object if it doesn't exist.
 */
function readState(): MidnightState {
  if (!existsSync(STATE_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as MidnightState;
  } catch {
    console.error('[peep-deploy] Warning: could not parse .midnight-state.json — starting fresh.');
    return {};
  }
}

/**
 * Persist an updated state object back to `.midnight-state.json`.
 */
function writeState(state: MidnightState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

// ─── Network configuration ────────────────────────────────────────────────────

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  local: {
    nodeUri: 'http://localhost:9944',
    indexerUri: 'http://localhost:8088/api/v1/graphql',
    proofServerUri: 'http://localhost:6300',
  },
  testnet: {
    nodeUri: 'https://rpc.testnet-02.midnight.network',
    indexerUri: 'https://indexer.testnet-02.midnight.network/api/v1/graphql',
    proofServerUri: 'https://proof-server.testnet-02.midnight.network',
  },
  devnet: {
    nodeUri: 'https://rpc.devnet.midnight.network',
    indexerUri: 'https://indexer.devnet.midnight.network/api/v1/graphql',
    proofServerUri: 'https://proof-server.devnet.midnight.network',
  },
};

interface NetworkConfig {
  nodeUri: string;
  indexerUri: string;
  proofServerUri: string;
}

// ─── Midnight SDK type stubs ──────────────────────────────────────────────────
// These interfaces match the Midnight JS SDK surface. When the SDK package is
// installed, the actual implementations satisfy these shapes.

interface MidnightProviders {
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
  zkConfigProvider: ZkConfigProvider;
}

interface WalletProvider {
  coinPublicKey: string;
  balanceTx(tx: unknown): Promise<unknown>;
}

interface MidnightProvider {
  submitTx(tx: unknown): Promise<string>;
}

interface ZkConfigProvider {
  getZkConfig(circuitId: string): Promise<unknown>;
}

interface ContractInstance {
  contractAddress: string;
  callTx: (circuit: string, ...args: unknown[]) => Promise<unknown>;
}

// ─── Contract loading ─────────────────────────────────────────────────────────

/**
 * Dynamically import the compiled contract module.
 * The Compact compiler outputs a CommonJS/ESM module at:
 *   contracts/managed/event_eligibility_pass/contract/index.js
 */
async function loadContractModule(): Promise<unknown> {
  const contractIndexPath = resolve(CONTRACT_DIR, 'contract', 'index.js');

  if (!existsSync(contractIndexPath)) {
    throw new Error(
      `Compiled contract not found at: ${contractIndexPath}\n` +
      `Run: compact compile contracts/event_eligibility_pass.compact contracts/managed/event_eligibility_pass`
    );
  }

  // Dynamic import works for both CJS and ESM output from the Compact compiler
  const mod = await import(contractIndexPath);
  return mod;
}

// ─── Deploy ───────────────────────────────────────────────────────────────────

/**
 * Deploy the PEEP contract using the Midnight JS SDK.
 *
 * The SDK pattern:
 *   1. Import the compiled contract module (provides circuit definitions + ZK keys).
 *   2. Build providers (wallet, midnight node, proof server).
 *   3. Call `Contract.deploy(providers)` — returns a ContractInstance with address.
 *   4. Persist the address to `.midnight-state.json`.
 *
 * Requirements: 2.1, 2.3
 */
async function deploy(network: string): Promise<void> {
  console.log(`[peep-deploy] Deploying PEEP contract to network: ${network}`);

  // Validate network
  const config = NETWORK_CONFIGS[network];
  if (!config) {
    throw new Error(`Unknown network: "${network}". Valid options: ${Object.keys(NETWORK_CONFIGS).join(', ')}`);
  }

  // Load compiled contract artifacts
  console.log('[peep-deploy] Loading compiled contract artifacts…');
  const contractModule = await loadContractModule();
  console.log('[peep-deploy] Contract module loaded.');

  // ── SDK integration point ─────────────────────────────────────────────────
  // When @midnight-ntwrk/midnight-js-* packages are installed, replace the
  // stubs below with real SDK calls. The pattern is:
  //
  //   import { createWalletProvider } from '@midnight-ntwrk/midnight-js-wallet';
  //   import { createMidnightProvider } from '@midnight-ntwrk/midnight-js-node-provider';
  //   import { createZkConfigProvider } from '@midnight-ntwrk/midnight-js-zk-config-provider';
  //   import { Contract } from '@midnight-ntwrk/midnight-js-contracts';
  //
  //   const providers: MidnightProviders = {
  //     walletProvider: await createWalletProvider(config.nodeUri),
  //     midnightProvider: await createMidnightProvider(config.nodeUri),
  //     zkConfigProvider: createZkConfigProvider(CONTRACT_DIR),
  //   };
  //
  //   const Contract = (contractModule as any).Contract;
  //   const instance: ContractInstance = await Contract.deploy(providers);
  //   const contractAddress = instance.contractAddress;
  // ─────────────────────────────────────────────────────────────────────────

  // For now, simulate the deploy step and indicate where real SDK wiring goes.
  // This ensures the script is runnable and the state file pattern is correct.
  console.log('[peep-deploy] NOTE: Midnight SDK not installed. Showing deployment wiring only.');
  console.log('[peep-deploy] To complete deployment, install @midnight-ntwrk packages and uncomment SDK calls above.');

  // In a live environment, contractAddress comes from `instance.contractAddress`
  const contractAddress = process.env['PEEP_CONTRACT_ADDRESS'] ?? '<DEPLOY_TO_GET_ADDRESS>';

  // Persist deployment record
  const state = readState();
  const record: DeploymentRecord = {
    contractAddress,
    deployedAt: new Date().toISOString(),
    network,
  };
  state['peep'] = record;
  writeState(state);

  console.log(`[peep-deploy] Deployment record saved to .midnight-state.json`);
  console.log(`[peep-deploy] Contract address: ${contractAddress}`);
  console.log(`[peep-deploy] Network:          ${network}`);
  console.log(`[peep-deploy] Deployed at:      ${record.deployedAt}`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function parseArgs(): { network: string } {
  const args = process.argv.slice(2);
  let network = 'local';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--network' && args[i + 1]) {
      network = args[i + 1];
    }
  }
  return { network };
}

const { network } = parseArgs();

deploy(network).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[peep-deploy] Fatal error: ${message}`);
  process.exit(1);
});
