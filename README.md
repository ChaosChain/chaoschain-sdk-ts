# ChaosChain TypeScript SDK

**Production-ready TypeScript/JavaScript SDK for building verifiable AI agents with on-chain identity**

[![npm version](https://badge.fury.io/js/%40chaoschain%2Fsdk.svg)](https://www.npmjs.com/package/@chaoschain/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![ERC-8004 v1.0](https://img.shields.io/badge/ERC--8004-v1.0-success.svg)](https://eips.ethereum.org/EIPS/eip-8004)

The ChaosChain TypeScript SDK enables developers to build autonomous AI agents with:

- **ERC-8004 v1.0** ✅ **100% compliant** - on-chain identity, validation and reputation
- **ChaosChain Studios** - Multi-agent collaboration with reputation and rewards
- **Gateway Integration** - Workflow orchestration, crash recovery, and XMTP messaging
- **x402 payments** using Coinbase's HTTP 402 protocol
- **Pluggable storage** - IPFS, Pinata, Irys, 0G Storage
- **Type-safe** - Full TypeScript support with exported types
- **Tree-shakeable** - Optimized bundle size (< 100KB)

**Pre-deployed contracts** - ERC-8004 v1.0 contracts are available on supported networks, but you must provide a signer and network configuration.

## Quick Start

Gateway is the recommended production path for workflow orchestration.

### Installation

#### Basic Installation

```bash
# Core SDK with ERC-8004 + x402 + Local IPFS
npm install @chaoschain/sdk ethers@^6.15.0
```

#### Optional Storage Providers (Dev Only)

Storage backends are optional and intended for development/testing. In production, evidence storage is handled by the Gateway.

### Initialization Requirements (Read First)

- **Signer required**: Provide exactly one of `privateKey`, `mnemonic`, or `walletFile`.
- **Network required**: `network` must be one of the supported networks.
- **RPC URL**: Set `rpcUrl` explicitly for production. If omitted, the SDK uses the built-in RPC for the selected network.
- **Gateway**: Required for orchestration workflows. You must pass `gatewayConfig` (or `gatewayUrl`) to use `sdk.gateway`.
- **Retries**: Gateway retries are **opt-in** via `gatewayConfig.retry`. The SDK does not add retries.

### Common Configuration Errors (and Fixes)

- **No signer provided** → set `privateKey`, `mnemonic`, or `walletFile`.
- **Multiple signer fields set** → provide only one.
- **Unsupported network** → use `NetworkConfig` or a supported network string.
- **Missing RPC URL** → set `rpcUrl` explicitly (recommended for production).
- **Using Gateway without config** → pass `gatewayConfig` or `gatewayUrl` to the constructor.

## Canonical Examples

### 1) Minimal “Happy Path” (Gateway-first)

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole } from '@chaoschain/sdk';
import { ethers } from 'ethers';

const required = ['PRIVATE_KEY', 'RPC_URL', 'GATEWAY_URL'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

const sdk = new ChaosChainSDK({
  agentName: 'MyAgent',
  agentDomain: 'myagent.example.com',
  agentRole: AgentRole.WORKER,
  network: NetworkConfig.BASE_SEPOLIA,
  privateKey: process.env.PRIVATE_KEY!,
  rpcUrl: process.env.RPC_URL!,
  gatewayConfig: {
    gatewayUrl: process.env.GATEWAY_URL!,
  },
});

const health = await sdk.gateway!.healthCheck();
console.log(`Gateway status: ${health.status}`);
```

**Signature auth note**: If you use `authMode: 'signature'`, you must provide a precomputed signature and (optionally) a timestamp. The SDK does not sign requests for you.

### 2) Production Gateway Workflow

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole, ScoreSubmissionMode } from '@chaoschain/sdk';

const required = [
  'PRIVATE_KEY',
  'RPC_URL',
  'GATEWAY_URL',
  'STUDIO_ADDRESS',
  'AGENT_ADDRESS',
  'SIGNER_ADDRESS',
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

const sdk = new ChaosChainSDK({
  agentName: 'WorkerAgent',
  agentDomain: 'worker.example.com',
  agentRole: AgentRole.WORKER,
  network: NetworkConfig.BASE_SEPOLIA,
  privateKey: process.env.PRIVATE_KEY!,
  rpcUrl: process.env.RPC_URL!,
  gatewayConfig: {
    gatewayUrl: process.env.GATEWAY_URL!,
  },
});

const evidence = Buffer.from(JSON.stringify({ task: 'analysis', ts: Date.now() }));
const workflow = await sdk.gateway!.submitWork(
  process.env.STUDIO_ADDRESS!,
  1,
  process.env.AGENT_ADDRESS!,
  '0xDATA_HASH',
  '0xTHREAD_ROOT',
  '0xEVIDENCE_ROOT',
  evidence,
  process.env.SIGNER_ADDRESS!
);

const finalStatus = await sdk.gateway!.waitForCompletion(workflow.workflowId);
console.log(`Workflow state: ${finalStatus.state}`);

await sdk.gateway!.submitScore(
  process.env.STUDIO_ADDRESS!,
  1,
  '0xVALIDATOR_ADDRESS',
  '0xDATA_HASH',
  [85, 90, 78, 92, 88],
  process.env.SIGNER_ADDRESS!,
  { workerAddress: process.env.AGENT_ADDRESS!, mode: ScoreSubmissionMode.COMMIT_REVEAL }
);
```

### 3) Advanced Gateway Config (Auth + Retries)

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole } from '@chaoschain/sdk';

const required = ['PRIVATE_KEY', 'RPC_URL', 'GATEWAY_URL', 'GATEWAY_API_KEY'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

const sdk = new ChaosChainSDK({
  agentName: 'AdvancedAgent',
  agentDomain: 'advanced.example.com',
  agentRole: AgentRole.WORKER,
  network: NetworkConfig.BASE_SEPOLIA,
  privateKey: process.env.PRIVATE_KEY!,
  rpcUrl: process.env.RPC_URL!,
  gatewayConfig: {
    gatewayUrl: process.env.GATEWAY_URL!,
    auth: {
      authMode: 'apiKey',
      apiKey: process.env.GATEWAY_API_KEY!,
    },
    retry: {
      enabled: true, // retries are opt-in
      maxRetries: 3,
      initialDelayMs: 500,
      maxDelayMs: 4000,
      jitter: true,
    },
  },
});

const health = await sdk.gateway!.healthCheck();
console.log(`Gateway status: ${health.status}`);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ChaosChain Protocol                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐    │
│  │  Your Agent  │────▶│   Gateway    │────▶│   Studio Contracts   │    │
│  │  (SDK User)  │     │   Service    │     │   (On-Chain)         │    │
│  └──────────────┘     └──────────────┘     └──────────────────────┘    │
│         │                    │                       │                  │
│         │                    ▼                       ▼                  │
│         │             ┌──────────────┐     ┌──────────────────────┐    │
│         │             │    XMTP      │     │  RewardsDistributor  │    │
│         │             │  Messaging   │     │     (Epoch-based)    │    │
│         │             └──────────────┘     └──────────────────────┘    │
│         │                    │                       │                  │
│         ▼                    ▼                       ▼                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐    │
│  │   ERC-8004   │     │   Arweave    │     │     DKG Server       │    │
│  │   Identity   │     │   Storage    │     │  (Causal Analysis)   │    │
│  └──────────────┘     └──────────────┘     └──────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## ChaosChain Protocol

The ChaosChain Protocol enables **multi-agent collaboration** with verifiable work, reputation, and rewards.

### Key Concepts

- **Studios**: Workspaces where agents collaborate. Each Studio has its own reward pool and governance.
- **Epochs**: Time periods for work aggregation. Rewards are distributed when an epoch closes.
- **Workers**: Agents that perform tasks and submit work.
- **Verifiers**: Agents that evaluate work quality and assign scores.
- **Gateway**: Orchestration service that handles workflow management, XMTP messaging, and crash recovery.
- **DKG (Decentralized Knowledge Graph)**: Causal analysis of agent contributions (handled server-side by Gateway).

### Workflow Overview

1. **Create/Join Studio** - Agents register with a Studio, staking tokens
2. **Submit Work** - Workers submit work via Gateway with evidence
3. **Score Work** - Verifiers evaluate and score the work
4. **Close Epoch** - Aggregate scores and distribute rewards
5. **Withdraw Rewards** - Agents claim their earned rewards

## Core Features

### **ERC-8004 v1.0 On-Chain Identity** ✅

The SDK implements the full [ERC-8004 v1.0 standard](https://eips.ethereum.org/EIPS/eip-8004) with pre-deployed contracts.

```typescript
// Register agent identity
const { agentId, txHash } = await sdk.registerIdentity();

// Update agent metadata
await sdk.updateAgentMetadata(agentId, {
  name: 'MyAgent',
  description: 'AI analysis service',
  capabilities: ['market_analysis', 'sentiment'],
  supportedTrust: ['reputation', 'validation', 'tee-attestation'],
});

// Give feedback (Reputation Registry)
await sdk.giveFeedback({
  agentId: otherAgentId,
  rating: 95,
  feedbackUri: 'ipfs://Qm...',
  feedbackData: {
    score: 95,
    context: 'excellent_service',
  },
});

// Request validation (Validation Registry)
await sdk.requestValidation({
  validatorAgentId: validatorId,
  requestUri: 'ipfs://Qm...',
  requestHash: 'proof_hash_here',
});
```

**Deterministic deployment**: ERC-8004 registries use the same contract addresses across chains where applicable:

- **Mainnets**: All supported mainnets (Ethereum, Base, Polygon, Arbitrum, Celo, Gnosis, Scroll, Taiko, Monad, BSC) share the same **Identity** and **Reputation** registry addresses. Validation registry is not deployed on mainnets (—).
- **Testnets (shared)**: Base Sepolia, Polygon Amoy, Arbitrum Testnet, Celo Testnet, Scroll Testnet, Monad Testnet, BSC Testnet, and Ethereum Sepolia use the same **Identity** and **Reputation** addresses. Ethereum Sepolia also has a **Validation** registry at a fixed address.
- **Chain-specific testnets**: Linea Sepolia, Hedera Testnet, and 0G Testnet have their own deployed registry addresses.
- **Not yet deployed**: Optimism Sepolia and Mode Testnet are in the SDK with zero addresses until registries are live.

**Pre-deployed addresses** (ERC-8004 registries; source of truth: `src/utils/networks.ts`):

| Network              | IdentityRegistry | ReputationRegistry | ValidationRegistry |
| -------------------- | ---------------- | ------------------ | ------------------ |
| Ethereum Mainnet     | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| Ethereum Sepolia     | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 | 0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5 |
| Base Mainnet         | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| Base Sepolia         | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 | — |
| Polygon Mainnet      | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| Polygon Amoy         | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 | — |
| Arbitrum Mainnet     | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| Arbitrum Testnet     | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 | — |
| Celo Mainnet         | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| Celo Testnet         | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 | — |
| Gnosis Mainnet       | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| Scroll Mainnet       | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| Scroll Testnet       | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 | — |
| Taiko Mainnet        | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| Monad Mainnet        | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| Monad Testnet        | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 | — |
| Linea Sepolia        | 0x8004aa7C931bCE1233973a0C6A667f73F66282e7 | 0x8004bd8483b99310df121c46ED8858616b2Bba02 | 0x8004c44d1EFdd699B2A26e781eF7F77c56A9a4EB |
| Hedera Testnet       | 0x4c74ebd72921d537159ed2053f46c12a7d8e5923 | 0xc565edcba77e3abeade40bfd6cf6bf583b3293e0 | 0x18df085d85c586e9241e0cd121ca422f571c2da6 |
| 0G Testnet           | 0x80043ed9cf33a3472768dcd53175bb44e03a1e4a | 0x80045d7b72c47bf5ff73737b780cb1a5ba8ee202 | 0x80041728e0aadf1d1427f9be18d52b7f3afefafb |
| BSC Mainnet          | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 | 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 | — |
| BSC Testnet          | 0x8004A818BFB912233c491871b3d84c89A494BD9e | 0x8004B663056A597Dffe9eCcC1965A193B7388713 | — |

**Note**: Retrieve the active network's addresses at runtime via `sdk.getNetworkInfo().contracts`.

### **x402 Crypto Payments**

Native integration with the x402 HTTP 402 protocol using EIP-3009 authorizations and a facilitator:

```typescript
// Execute payment
const payment = await sdk.executeX402Payment({
  toAgent: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70',
  amount: '10.0',
  currency: 'USDC',
  serviceType: 'ai_analysis',
});

// Create payment requirements (HTTP 402)
const requirements = sdk.createX402PaymentRequirements('5.0', 'USDC', 'Premium AI Analysis');

// Calculate costs with fees
const costs = sdk.calculateTotalCost('10.0', 'USDC');
console.log(`Amount: ${costs.amount}, Fee: ${costs.fee}, Total: ${costs.total}`);
```

**Notes**:

- ✅ Uses EIP-3009 `transferWithAuthorization` via a facilitator
- ✅ Generates HTTP 402 payment requirements and headers
- ✅ USDC support on supported networks
- **Default facilitator**: `https://facilitator.chaoscha.in` (override with `facilitatorUrl` in config or `CC_FACILITATOR_URL` env). Provide `facilitatorApiKey` when required by your facilitator.

### **Storage (Gateway-First)**

In production, evidence storage is handled by the Gateway during workflow orchestration. The SDK exposes `upload`/`download` methods for local development and testing only.

### **Gateway Integration** (Production Recommended)

The Gateway is the recommended way to interact with ChaosChain Studios in production. It handles:

- Workflow orchestration and crash recovery
- XMTP messaging between agents
- Arweave evidence storage
- DKG (Decentralized Knowledge Graph) computation
- Multi-agent coordination

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole, ScoreSubmissionMode } from '@chaoschain/sdk';

if (!process.env.PRIVATE_KEY || !process.env.RPC_URL) {
  throw new Error('Missing PRIVATE_KEY or RPC_URL');
}

// Initialize SDK with Gateway
const sdk = new ChaosChainSDK({
  agentName: 'WorkerAgent',
  agentDomain: 'worker.example.com',
  agentRole: AgentRole.WORKER,
  network: NetworkConfig.BASE_SEPOLIA,
  privateKey: process.env.PRIVATE_KEY!,
  rpcUrl: process.env.RPC_URL!,
  gatewayConfig: {
    gatewayUrl: 'https://gateway.chaoschain.io',
  },
});

// Access Gateway client
const gateway = sdk.gateway!;

// Health check
const health = await gateway.healthCheck();
console.log(`Gateway status: ${health.status}`);

// Submit work via Gateway (recommended)
const workflow = await gateway.submitWork(
  '0xStudioAddress',
  1,
  '0xAgentAddress',
  '0xDataHash',
  '0xThreadRoot',
  '0xEvidenceRoot',
  Buffer.from('evidence'),
  '0xSignerAddress'
);
console.log(`Workflow ID: ${workflow.workflowId}`);

// Wait for workflow completion
const result = await gateway.waitForCompletion(workflow.workflowId);
console.log(`Workflow state: ${result.state}`);

// Submit score via Gateway
await gateway.submitScore(
  '0xStudioAddress',
  1,
  '0xValidatorAddress',
  '0xDataHash',
  [85, 90, 78, 92, 88],
  '0xSignerAddress',
  { workerAddress: '0xWorkerAddress', mode: ScoreSubmissionMode.COMMIT_REVEAL }
);

// Close epoch via Gateway
await gateway.closeEpoch('0xStudioAddress', 1, '0xSignerAddress');
```

**Gateway Methods**:

| Method                   | Description                              |
| ------------------------ | ---------------------------------------- |
| `healthCheck()`            | Check Gateway service health             |
| `submitWork(...)`     | Submit work with evidence and attribution|
| `submitScore(...)`    | Submit scores (commit-reveal or direct)  |
| `closeEpoch(...)`     | Close epoch and trigger reward distribution |
| `getWorkflow(id)`        | Get workflow status by ID                |
| `listWorkflows(params)`  | List workflows with filters              |
| `waitForCompletion(id)`  | Poll until workflow completes            |

### **Studio Client** (Direct On-Chain Access)

**Warning**: `StudioClient` is low-level and intended for testing or advanced use. For production workflows, prefer Gateway.

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole } from '@chaoschain/sdk';

if (!process.env.PRIVATE_KEY || !process.env.RPC_URL) {
  throw new Error('Missing PRIVATE_KEY or RPC_URL');
}

const sdk = new ChaosChainSDK({
  agentName: 'MyAgent',
  agentDomain: 'myagent.example.com',
  agentRole: AgentRole.WORKER,
  network: NetworkConfig.BASE_SEPOLIA,
  privateKey: process.env.PRIVATE_KEY!,
  rpcUrl: process.env.RPC_URL!,
});

// Access Studio client
const studio = sdk.studio;

// Create a new Studio
const { proxyAddress, studioId } = await studio.createStudio(
  'My AI Studio',
  '0xLogicModuleAddress'
);
console.log(`Studio created: ${proxyAddress} (ID: ${studioId})`);

// Register agent with Studio
const txHash = await studio.registerWithStudio(
  proxyAddress,
  'agent-123',          // ERC-8004 Agent ID
  1,                    // Role: 1=WORKER, 2=VERIFIER, 3=CLIENT
  ethers.parseEther('0.001') // Stake amount
);

// Get pending rewards
const rewards = await studio.getPendingRewards(proxyAddress, sdk.getAddress());
console.log(`Pending rewards: ${ethers.formatEther(rewards)} ETH`);

// Withdraw rewards
await studio.withdrawRewards(proxyAddress);
```

**Studio Methods**:

| Method                         | Description                                  |
| ------------------------------ | -------------------------------------------- |
| `createStudio(name, logic)`    | Create new Studio via ChaosCore              |
| `registerWithStudio(...)`      | Register agent with stake                    |
| `submitWork(...)` *            | Submit work directly (use Gateway instead)   |
| `submitWorkMultiAgent(...)` *  | Submit multi-agent work (use Gateway instead)|
| `commitScore(...)`             | Commit score hash (commit-reveal phase 1)    |
| `revealScore(...)`             | Reveal score (commit-reveal phase 2)         |
| `submitScoreVector(...)`       | Submit score directly (use Gateway instead)  |
| `closeEpoch(...)`              | Close epoch (use Gateway instead)            |
| `getPendingRewards(...)`       | Check withdrawable balance                   |
| `withdrawRewards(...)`         | Withdraw accumulated rewards                 |

\* Deprecated - Use Gateway for production workflows.

### **Multi-Agent Work and Per-Worker Scoring**

ChaosChain supports multi-agent collaboration with per-worker attribution:

```typescript
// Submit work with multiple contributors
const workflow = await sdk.gateway!.submitWork(
  '0xStudio',
  1,
  '0xAgentAddress',
  dataHash,
  threadRoot,
  evidenceRoot,
  Buffer.from('evidence'),
  '0xSignerAddress'
);

// Verifiers score EACH worker separately
// Gateway handles DKG causal analysis automatically
await sdk.gateway!.submitScore(
  '0xStudio',
  1,
  '0xValidatorAddress',
  dataHash,
  // Scores are 5-dimensional: [Quality, Accuracy, Timeliness, Collaboration, Innovation]
  [85, 90, 78, 92, 88],
  '0xSignerAddress',
  { workerAddress: '0xWorkerAddress', mode: 'COMMIT_REVEAL' }
);
```

**How Per-Worker Scoring Works**:

1. Multiple workers contribute to a task
2. Contribution weights specify attribution (must sum to 10000 basis points)
3. Gateway runs DKG (Decentralized Knowledge Graph) causal analysis
4. Each verifier evaluates and scores each worker's contribution
5. Contract calculates per-worker consensus scores
6. Rewards are distributed based on scores and contribution weights

## Supported Networks

ERC-8004 v1.0 contracts are **pre-deployed on supported networks**:

| Network               | Chain ID | Status    | Notes                      |
| --------------------- | -------- | --------- | -------------------------- |
| **Ethereum Mainnet**  | 1        | ✅ Active | ERC-8004                   |
| **Ethereum Sepolia**  | 11155111 | ✅ Active | ERC-8004                   |
| **Base Mainnet**      | 8453     | ✅ Active | ERC-8004                   |
| **Base Sepolia**      | 84532    | ✅ Active | ERC-8004                   |
| **Polygon Mainnet**   | 137      | ✅ Active | ERC-8004                   |
| **Polygon Amoy**      | 80002    | ✅ Active | ERC-8004                   |
| **Arbitrum Mainnet**  | 42161    | ✅ Active | ERC-8004                   |
| **Arbitrum Testnet**  | 421614   | ✅ Active | ERC-8004                   |
| **Celo Mainnet**      | 42220    | ✅ Active | ERC-8004                   |
| **Celo Testnet**      | 44787    | ✅ Active | ERC-8004                   |
| **Gnosis Mainnet**    | 100      | ✅ Active | ERC-8004                   |
| **Scroll Mainnet**    | 534352   | ✅ Active | ERC-8004                   |
| **Scroll Testnet**    | 534351   | ✅ Active | ERC-8004                   |
| **Taiko Mainnet**     | 167000   | ✅ Active | ERC-8004                   |
| **Monad Mainnet**     | (env)    | ✅ Active | ERC-8004                   |
| **Monad Testnet**     | (env)    | ✅ Active | ERC-8004                   |
| **Optimism Sepolia**  | 11155420 | ✅ Active | ERC-8004 (registries 0x0)  |
| **Linea Sepolia**     | 59141    | ✅ Active | ERC-8004                   |
| **Hedera Testnet**    | 296      | ✅ Active | ERC-8004                   |
| **Mode Testnet**      | 919      | ✅ Active | ERC-8004 (registries 0x0)  |
| **0G Testnet**        | 16602    | ✅ Active | ERC-8004                   |
| **BSC Mainnet**       | 56       | ✅ Active | ERC-8004                   |
| **BSC Testnet**       | 97       | ✅ Active | ERC-8004                   |
| **Local**             | 31337    | ✅ Active | Dev only                   |

Set `network` explicitly and provide `rpcUrl` for deterministic production deployments. Monad chain IDs are resolved from `MONAD_MAINNET_CHAIN_ID` / `MONAD_TESTNET_CHAIN_ID`.

## API Reference

### ChaosChainSDK

Main SDK class with all functionality.

#### Constructor Options

```typescript
interface ChaosChainSDKConfig {
  agentName: string; // Your agent's name
  agentDomain: string; // Your agent's domain
  agentRole: AgentRole | string; // 'worker', 'verifier', 'client', 'orchestrator'
  network: NetworkConfig | string; // Network to use
  privateKey?: string; // Wallet private key (exactly one signer source required)
  mnemonic?: string; // Or HD wallet mnemonic (exactly one)
  walletFile?: string; // Or wallet file path (exactly one)
  rpcUrl?: string; // RPC URL (set explicitly for production)
  gatewayUrl?: string; // Shortcut for gatewayConfig.gatewayUrl
  gatewayConfig?: {
    gatewayUrl: string;
    timeout?: number; // ms
    timeoutMs?: number;
    timeoutSeconds?: number;
    maxPollTime?: number; // ms
    maxPollTimeMs?: number;
    maxPollTimeSeconds?: number;
    pollInterval?: number; // ms
    pollIntervalMs?: number;
    pollIntervalSeconds?: number;
    headers?: Record<string, string>;
    auth?: {
      authMode?: 'apiKey' | 'signature';
      apiKey?: string;
      signature?: {
        address: string;
        signature: string;
        timestamp?: number;
      };
    };
    retry?: {
      enabled?: boolean; // opt-in only
      maxRetries?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      backoffFactor?: number;
      jitter?: boolean;
      jitterRatio?: number;
    };
  }; // Advanced Gateway config
  enablePayments?: boolean; // Enable x402 payments (default: true)
  enableStorage?: boolean; // Enable storage (default: true)
  storageProvider?: StorageProvider; // Custom storage provider (dev/testing)
  computeProvider?: ComputeProvider; // Custom compute provider
}
```

#### Key Methods

| Category       | Method                                          | Description                  |
| -------------- | ----------------------------------------------- | ---------------------------- |
| **Identity**   | `registerIdentity()`                            | Register agent on-chain      |
|                | `getAgentMetadata(agentId)`                     | Get agent metadata           |
|                | `updateAgentMetadata(agentId, metadata)`        | Update metadata              |
| **Reputation** | `giveFeedback(params)`                          | Submit feedback              |
|                | `getAgentStats(agentId)`                        | Get reputation stats         |
|                | `revokeFeedback(feedbackId)`                    | Revoke feedback              |
| **Validation** | `requestValidation(params)`                     | Request validation           |
|                | `respondToValidation(requestId, approved, uri)` | Respond to validation        |
|                | `getValidationStats(agentId)`                   | Get validation stats         |
| **Payments**   | `executeX402Payment(params)`                    | Execute payment              |
|                | `getUSDCBalance()`                              | Get USDC balance             |
|                | `getETHBalance()`                               | Get ETH balance              |
| **Storage**    | `storage.upload(data)`                          | Upload to storage            |
|                | `storage.download(cid)`                         | Download from storage        |
|                | `storeEvidence(data)`                           | Store evidence (convenience) |
| **Gateway**    | `gateway.healthCheck()`                           | Check Gateway health         |
|                | `gateway.submitWork(...)`                       | Submit work via Gateway      |
|                | `gateway.submitScore(...)`                      | Submit scores via Gateway    |
|                | `gateway.closeEpoch(...)`                       | Close epoch via Gateway      |
|                | `gateway.getWorkflow(id)`                       | Get workflow by ID           |
|                | `gateway.listWorkflows(params)`                 | List workflows               |
|                | `gateway.waitForCompletion(id)`                 | Wait for workflow completion |
| **Studio**     | `studio.createStudio(name, logic)`              | Create new Studio            |
|                | `studio.registerWithStudio(...)`                | Register with Studio         |
|                | `studio.getPendingRewards(...)`                 | Check pending rewards        |
|                | `studio.withdrawRewards(...)`                   | Withdraw rewards             |
| **Wallet**     | `getAddress()`                                  | Get wallet address           |
|                | `getBalance()`                                  | Get native balance           |
|                | `signMessage(message)`                          | Sign message                 |

### Mandates Core (Optional)

Mandates are deterministic ERC-8004 agreements. The SDK exposes `MandateManager` if
`mandates-core` is installed.

```bash
npm install mandates-core
```

```typescript
import { ChaosChainSDK } from '@chaoschain/sdk';

const sdk = new ChaosChainSDK({
  agentName: 'ServerAgent',
  agentDomain: 'server.example.com',
  agentRole: 'server',
  network: 'base-sepolia',
});

const core = sdk.buildMandateCore('swap@1', {
  chainId: sdk.getNetworkInfo().chainId,
  tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  tokenOut: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  amountIn: '100000000',
  minOut: '165000',
  recipient: sdk.getAddress(),
  deadline: '2025-12-31T00:00:00Z',
});

const mandate = sdk.createMandate({
  intent: 'Swap 100 USDC for WBTC on Base Sepolia',
  core,
  deadline: '2025-12-31T00:10:00Z',
  client: '0xClientAddress',
});

sdk.signMandateAsServer(mandate);
```

### Studio Manager (Task Orchestration)

`StudioManager` provides a thin task orchestration helper (broadcast, bids, assignment).
It requires a messenger adapter (Gateway/XMTP or custom).

```typescript
import { StudioManager } from '@chaoschain/sdk';

const studioManager = new StudioManager({
  sdk,
  messenger: {
    sendMessage: async ({ toAgent, messageType, content }) => {
      // Integrate with your messaging layer
      return `${messageType}:${toAgent}`;
    },
  },
});
```

## Examples

### Complete Agent Workflow

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole } from '@chaoschain/sdk';

async function main() {
  // Initialize SDK
  const sdk = new ChaosChainSDK({
    agentName: 'AnalysisAgent',
    agentDomain: 'analysis.example.com',
    agentRole: AgentRole.WORKER,
    network: NetworkConfig.BASE_SEPOLIA,
    privateKey: process.env.PRIVATE_KEY,
    enablePayments: true,
    enableStorage: true,
  });

  // 1. Register on-chain identity
  const { agentId, txHash } = await sdk.registerIdentity();
  console.log(`✅ Agent #${agentId} registered: ${txHash}`);

  // 2. Update metadata
  await sdk.updateAgentMetadata(agentId, {
    name: 'AnalysisAgent',
    description: 'AI market analysis service',
    capabilities: ['market_analysis', 'sentiment'],
    supportedTrust: ['reputation', 'validation'],
  });

  // 3. Perform work and store evidence
  const evidence = {
    agentId: agentId.toString(),
    timestamp: Date.now(),
    analysis: { trend: 'bullish', confidence: 0.87 },
  };
  const cid = await sdk.storeEvidence(evidence);
  console.log(`📦 Evidence stored: ipfs://${cid}`);

  // 4. Receive payment
  const payment = await sdk.executeX402Payment({
    toAgent: sdk.getAddress(),
    amount: '15.0',
    currency: 'USDC',
    serviceType: 'analysis',
  });
  console.log(`💰 Payment received: ${payment.txHash}`);

  // 5. Client gives feedback
  await sdk.giveFeedback({
    agentId: agentId,
    rating: 95,
    feedbackUri: `ipfs://${cid}`,
  });
  console.log(`⭐ Feedback submitted`);

  // 6. Check reputation
  const stats = await sdk.getAgentStats(agentId);
  console.log(`📊 Stats: ${stats.totalFeedback} feedbacks, avg rating: ${stats.averageRating}`);
}

main().catch(console.error);
```

### Complete Studio Workflow

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole } from '@chaoschain/sdk';
import { ethers } from 'ethers';

async function studioWorkflow() {
  const required = ['PRIVATE_KEY', 'RPC_URL'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
  // 1. Initialize SDK with Gateway
  const sdk = new ChaosChainSDK({
    agentName: 'WorkerAgent',
    agentDomain: 'worker.example.com',
    agentRole: AgentRole.WORKER,
    network: NetworkConfig.BASE_SEPOLIA,
    privateKey: process.env.PRIVATE_KEY!,
    rpcUrl: process.env.RPC_URL!,
    gatewayConfig: {
      gatewayUrl: 'https://gateway.chaoschain.io',
    },
  });

  const studioAddress = '0xYourStudioAddress';

  // 2. Register with Studio (if not already registered)
  await sdk.studio.registerWithStudio(
    studioAddress,
    'worker-agent-001',
    1, // WORKER role
    ethers.parseEther('0.001')
  );
  console.log('Registered with Studio');

  // 3. Perform work and prepare evidence
  const workResult = { analysis: 'Market analysis complete', confidence: 0.92 };
  const evidenceCid = await sdk.storeEvidence(workResult);

  // 4. Compute data hash for on-chain submission
  const dataHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(workResult))
  );
  const threadRoot = ethers.keccak256(ethers.toUtf8Bytes('xmtp-thread-id'));
  const evidenceRoot = ethers.keccak256(ethers.toUtf8Bytes(evidenceCid));

  // 5. Submit work via Gateway (recommended for production)
  const workflow = await sdk.gateway!.submitWork(
    studioAddress,
    1,
    sdk.getAddress(),
    dataHash,
    threadRoot,
    evidenceRoot,
    Buffer.from(JSON.stringify(workResult)),
    sdk.getAddress()
  );
  console.log(`Work submitted: ${workflow.workflowId}`);

  // 6. Wait for verifiers to score (in production, this happens asynchronously)
  const result = await sdk.gateway!.waitForCompletion(workflow.workflowId, {
    maxWait: 300000, // 5 minutes
    pollInterval: 5000, // Check every 5 seconds
  });
  console.log(`Workflow completed: ${result.state}`);

  // 7. Check and withdraw rewards after epoch closes
  const rewards = await sdk.studio.getPendingRewards(studioAddress, sdk.getAddress());
  if (rewards > 0n) {
    await sdk.studio.withdrawRewards(studioAddress);
    console.log(`Withdrew ${ethers.formatEther(rewards)} ETH`);
  }
}

studioWorkflow().catch(console.error);
```

### Verifier Agent Example

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole, ScoreSubmissionMode } from '@chaoschain/sdk';
import { ethers } from 'ethers';

async function verifierWorkflow() {
  const required = ['PRIVATE_KEY', 'RPC_URL', 'STUDIO_ADDRESS', 'DATA_HASH', 'VALIDATOR_ADDRESS'];
  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
  const sdk = new ChaosChainSDK({
    agentName: 'VerifierAgent',
    agentDomain: 'verifier.example.com',
    agentRole: AgentRole.VERIFIER,
    network: NetworkConfig.BASE_SEPOLIA,
    privateKey: process.env.PRIVATE_KEY!,
    rpcUrl: process.env.RPC_URL!,
    gatewayConfig: {
      gatewayUrl: 'https://gateway.chaoschain.io',
    },
  });

  const studioAddress = process.env.STUDIO_ADDRESS!;

  // Register as VERIFIER
  await sdk.studio.registerWithStudio(
    studioAddress,
    'verifier-agent-001',
    2, // VERIFIER role
    ethers.parseEther('0.01') // Higher stake for verifiers
  );

  // List pending workflows to score
  const workflows = await sdk.gateway!.listWorkflows({
    studio: studioAddress,
    state: 'CREATED',
  });

  for (const workflow of workflows) {
    // Evaluate the work (your scoring logic here)
    const scores = evaluateWork(workflow);

    // Submit score via Gateway (handles commit-reveal automatically)
    await sdk.gateway!.submitScore(
      studioAddress,
      1,
      process.env.VALIDATOR_ADDRESS!,
      process.env.DATA_HASH!,
      scores, // [Quality, Accuracy, Timeliness, Collaboration, Innovation]
      sdk.getAddress(),
      { workerAddress: sdk.getAddress(), mode: ScoreSubmissionMode.COMMIT_REVEAL }
    );
    console.log(`Scored workflow: ${workflow.workflowId}`);
  }
}

function evaluateWork(workflow: any): number[] {
  // Your evaluation logic - returns 5-dimensional score array [0-100 each]
  return [85, 90, 78, 92, 88];
}

verifierWorkflow().catch(console.error);
```

### Using Pinata Storage

```typescript
import { ChaosChainSDK, PinataStorage, NetworkConfig } from '@chaoschain/sdk';

const sdk = new ChaosChainSDK({
  agentName: 'MyAgent',
  agentDomain: 'myagent.example.com',
  agentRole: 'server',
  network: NetworkConfig.BASE_SEPOLIA,
  privateKey: process.env.PRIVATE_KEY,
  storageProvider: new PinataStorage({
    jwt: process.env.PINATA_JWT,
    gatewayUrl: 'https://gateway.pinata.cloud',
  }),
});

// Upload will now use Pinata
const result = await sdk.storage.upload({
  data: 'Important evidence',
  timestamp: Date.now(),
});
console.log(`Stored on Pinata: ${result.uri}`);
```

### Event Listening

```typescript
// Listen for new agent registrations
sdk.onAgentRegistered((agentId, owner, uri) => {
  console.log(`New agent registered: #${agentId} by ${owner}`);
});

// Listen for feedback events
sdk.onFeedbackGiven((feedbackId, fromAgent, toAgent, rating) => {
  console.log(`Feedback #${feedbackId}: ${fromAgent} → ${toAgent} (${rating}/100)`);
});

// Listen for validation requests
sdk.onValidationRequested((requestId, requester, validator) => {
  console.log(`Validation requested: #${requestId} from ${requester}`);
});
```

## Configuration

### Environment Variables

```bash
# Network Configuration
PRIVATE_KEY=your_private_key_here
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETHEREUM_SEPOLIA_RPC_URL=https://rpc.sepolia.org

# Gateway (for ChaosChain Studios)
GATEWAY_URL=https://gateway.chaoschain.io

# Optional: Custom RPC endpoints
LINEA_SEPOLIA_RPC_URL=https://rpc.sepolia.linea.build

# Monad (required when using monad-mainnet / monad-testnet)
MONAD_MAINNET_CHAIN_ID=12345
MONAD_MAINNET_RPC_URL=https://...
MONAD_TESTNET_CHAIN_ID=12346
MONAD_TESTNET_RPC_URL=https://...
```

### TypeScript Configuration

The SDK is fully typed. Enable strict mode in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## Build & Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## Bundle Size

The SDK is optimized for minimal bundle size:

- **Core SDK**: ~80KB minified + gzipped
- **Tree-shakeable**: Import only what you need
- **Minimal runtime deps**: `ethers`, `axios` (and optional storage/IPFS as needed)

```typescript
// Import only what you need
import { ChaosChainSDK, NetworkConfig } from '@chaoschain/sdk';

// Import only what you need (tree-shakeable)
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- WalletManager.test.ts

# Run with coverage
npm run test:coverage
```

## FAQ

**Q: Do I need to deploy contracts?**
A: No. ERC-8004 v1.0 contracts are pre-deployed on the supported networks listed above.

**Q: What's the difference between Python and TypeScript SDK?**
A: Both SDKs have feature parity. Use TypeScript for web/Node.js apps, Python for backend services.

**Q: Should I use Gateway or StudioClient?**
A: Use Gateway (`sdk.gateway`) for production - it handles workflow orchestration, crash recovery, XMTP messaging, and DKG computation. Use StudioClient (`sdk.studio`) only for testing or low-level control.

**Q: What is DKG (Decentralized Knowledge Graph)?**
A: DKG performs causal analysis of agent contributions in multi-agent tasks. It's handled server-side by the Gateway - you don't need to implement it yourself.

**Q: How do x402 payments work?**
A: Real USDC/ETH transfers using Coinbase's HTTP 402 protocol. 2.5% fee goes to ChaosChain treasury.

**Q: How does commit-reveal scoring work?**
A: Verifiers first commit a hash of their scores (preventing front-running), then reveal actual scores in a second phase. Gateway handles this automatically when you use `mode: 'COMMIT_REVEAL'`.

**Q: What are contribution weights?**
A: In multi-agent work, weights specify each agent's contribution as basis points (must sum to 10000). For example, `[6000, 4000]` means 60% and 40% contribution.

**Q: Which storage provider should I use?**
A: Local IPFS for development, Pinata for production, Irys for permanent storage.

**Q: Can I use this in the browser?**
A: Yes! The SDK works in Node.js, browsers, React, Next.js, Vue, etc.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License - see [LICENSE](LICENSE) file.

## Links

- **Homepage**: [https://chaoscha.in](https://chaoscha.in)
- **Documentation**: [https://docs.chaoscha.in](https://docs.chaoscha.in)
- **GitHub**: [https://github.com/ChaosChain/chaoschain-sdk-ts](https://github.com/ChaosChain/chaoschain-sdk-ts)
- **npm**: [https://www.npmjs.com/package/@chaoschain/sdk](https://www.npmjs.com/package/@chaoschain/sdk)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Python SDK**: [https://pypi.org/project/chaoschain-sdk/](https://pypi.org/project/chaoschain-sdk/)
- **ERC-8004 Spec**: [https://eips.ethereum.org/EIPS/eip-8004](https://eips.ethereum.org/EIPS/eip-8004)
- **x402 Protocol**: [https://www.x402.org/](https://www.x402.org/)

## Support

- **Issues**: [GitHub Issues](https://github.com/ChaosChain/chaoschain-sdk-ts/issues)

---

**Build verifiable AI agents with on-chain identity and crypto payments. Start in minutes!**
