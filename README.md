# ChaosChain TypeScript SDK

**Production-ready TypeScript/JavaScript SDK for building verifiable AI agents with on-chain identity**

[![npm version](https://badge.fury.io/js/%40chaoschain%2Fsdk.svg)](https://www.npmjs.com/package/@chaoschain/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![ERC-8004 v1.0](https://img.shields.io/badge/ERC--8004-v1.0-success.svg)](https://eips.ethereum.org/EIPS/eip-8004)

The ChaosChain TypeScript SDK enables developers to build autonomous AI agents with:

- **ERC-8004 v1.0** ✅ **100% compliant** - on-chain identity, validation and reputation
- **x402 payments** using Coinbase's HTTP 402 protocol
- **Pluggable storage** - IPFS, Pinata, Irys, AR.IO Network (Arweave), 0G Storage
- **Type-safe** - Full TypeScript support with exported types
- **Tree-shakeable** - Optimized bundle size (< 100KB)

**Zero setup required** - all ERC-8004 v1.0 contracts are pre-deployed on 5 networks!

## Quick Start

### Installation

#### Basic Installation

```bash
# Core SDK with ERC-8004 + x402 + Local IPFS
npm install @chaoschain/sdk ethers@^6.9.0
```

#### With Optional Storage Providers

```bash
# Pinata (cloud IPFS)
npm install @chaoschain/sdk @pinata/sdk

# Irys (Arweave permanent storage)
npm install @chaoschain/sdk @irys/sdk

# AR.IO Network (Arweave permanent storage)
npm install @chaoschain/sdk @ardrive/turbo-sdk
```

### Basic Usage

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole } from '@chaoschain/sdk';

// Initialize SDK
const sdk = new ChaosChainSDK({
  agentName: 'MyAgent',
  agentDomain: 'myagent.example.com',
  agentRole: AgentRole.SERVER,
  network: NetworkConfig.BASE_SEPOLIA,
  privateKey: process.env.PRIVATE_KEY,
  enablePayments: true,
  enableStorage: true,
});

// 1. Register on-chain identity (ERC-8004)
const { agentId, txHash } = await sdk.registerIdentity();
console.log(`✅ Agent #${agentId} registered on-chain`);

// 2. Execute x402 payment
const payment = await sdk.executeX402Payment({
  toAgent: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70',
  amount: '1.5',
  currency: 'USDC',
});
console.log(`💰 Payment sent: ${payment.txHash}`);

// 3. Store evidence on IPFS
const cid = await sdk.storeEvidence({
  agentId: agentId.toString(),
  timestamp: Date.now(),
  result: 'analysis complete',
});
console.log(`📦 Evidence stored: ipfs://${cid}`);

// 4. Give feedback to another agent
const feedbackTx = await sdk.giveFeedback({
  agentId: 123n,
  rating: 95,
  feedbackUri: `ipfs://${cid}`,
});
console.log(`⭐ Feedback submitted: ${feedbackTx}`);
```

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

**Pre-deployed addresses**:

#### Sepolia

- Identity: [`0x8004a6090Cd10A7288092483047B097295Fb8847`](https://sepolia.etherscan.io/address/0x8004a6090Cd10A7288092483047B097295Fb8847)
- Reputation: [`0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E`](https://sepolia.etherscan.io/address/0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E)
- Validation: [`0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5`](https://sepolia.etherscan.io/address/0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5)

#### Base Sepolia

- Identity: [`0x8004AA63c570c570eBF15376c0dB199918BFe9Fb`](https://sepolia.basescan.org/address/0x8004AA63c570c570eBF15376c0dB199918BFe9Fb)
- Reputation: [`0x8004bd8daB57f14Ed299135749a5CB5c42d341BF`](https://sepolia.basescan.org/address/0x8004bd8daB57f14Ed299135749a5CB5c42d341BF)
- Validation: [`0x8004C269D0A5647E51E121FeB226200ECE932d55`](https://sepolia.basescan.org/address/0x8004C269D0A5647E51E121FeB226200ECE932d55)

#### Linea Sepolia

- Identity: [`0x8004aa7C931bCE1233973a0C6A667f73F66282e7`](https://sepolia.lineascan.build/address/0x8004aa7C931bCE1233973a0C6A667f73F66282e7)
- Reputation: [`0x8004bd8483b99310df121c46ED8858616b2Bba02`](https://sepolia.lineascan.build/address/0x8004bd8483b99310df121c46ED8858616b2Bba02)
- Validation: [`0x8004c44d1EFdd699B2A26e781eF7F77c56A9a4EB`](https://sepolia.lineascan.build/address/0x8004c44d1EFdd699B2A26e781eF7F77c56A9a4EB)

#### Hedera Testnet

- **IdentityRegistry**: `0x4c74ebd72921d537159ed2053f46c12a7d8e5923`
- **ReputationRegistry**: `0xc565edcba77e3abeade40bfd6cf6bf583b3293e0`
- **ValidationRegistry**: `0x18df085d85c586e9241e0cd121ca422f571c2da6`

#### 0G Galileo Testnet

- **IdentityRegistry**: [`0x80043ed9cf33a3472768dcd53175bb44e03a1e4a`](https://chainscan-galileo.0g.ai/address/0x80043ed9cf33a3472768dcd53175bb44e03a1e4a)
- **ReputationRegistry**: [`0x80045d7b72c47bf5ff73737b780cb1a5ba8ee202`](https://chainscan-galileo.0g.ai/address/0x80045d7b72c47bf5ff73737b780cb1a5ba8ee202)
- **ValidationRegistry**: [`0x80041728e0aadf1d1427f9be18d52b7f3afefafb`](https://chainscan-galileo.0g.ai/address/0x80041728e0aadf1d1427f9be18d52b7f3afefafb)

#### BSC Testnet:

- **IdentityRegistry**: `0xabbd26d86435b35d9c45177725084ee6a2812e40`
- **ReputationRegistry**:`0xeced1af52a0446275e9e6e4f6f26c99977400a6a`
- **ValidationRegistry**: `0x7866bd057f09a4940fe2ce43320518c8749a921e`

### **x402 Crypto Payments**

Native integration with Coinbase's x402 HTTP 402 protocol:

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

**Features**:

- ✅ Direct USDC transfers (Base, Ethereum, Linea)
- ✅ Automatic 2.5% protocol fee to ChaosChain
- ✅ ETH and USDC support
- ✅ Payment receipts and verification

### **Pluggable Storage Providers**

Choose your storage backend:

```typescript
import { ChaosChainSDK, IPFSLocalStorage, PinataStorage } from '@chaoschain/sdk';

// Local IPFS (default)
const sdk = new ChaosChainSDK({
  agentName: 'MyAgent',
  network: 'base-sepolia',
  privateKey: process.env.PRIVATE_KEY,
  // Uses LocalIPFS by default
});

// Or use Pinata
const sdk = new ChaosChainSDK({
  agentName: 'MyAgent',
  network: 'base-sepolia',
  privateKey: process.env.PRIVATE_KEY,
  storageProvider: new PinataStorage({
    jwt: process.env.PINATA_JWT,
    gatewayUrl: 'https://gateway.pinata.cloud',
  }),
});

// Upload data
const result = await sdk.storage.upload({ data: 'evidence' });
console.log(`Uploaded to: ${result.uri}`);

// Download data
const data = await sdk.storage.download(result.cid);
```

**Storage Options**:

| Provider          | Cost    | Setup         | Best For          |
| ----------------- | ------- | ------------- | ----------------- |
| **Local IPFS**    | 🆓 Free | `ipfs daemon` | Development       |
| **Pinata**        | 💰 Paid | API keys      | Production        |
| **Irys**          | 💰 Paid | Wallet key    | Permanent storage |
| **AR.IO Network** | 💰 Paid | EVM wallet    | Permanent storage |

## Supported Networks

ERC-8004 v1.0 contracts are **pre-deployed on 5 networks**:

| Network              | Chain ID | Status    | Features                     |
| -------------------- | -------- | --------- | ---------------------------- |
| **Ethereum Sepolia** | 11155111 | ✅ Active | ERC-8004 + x402 USDC         |
| **Base Sepolia**     | 84532    | ✅ Active | ERC-8004 + x402 USDC         |
| **Linea Sepolia**    | 59141    | ✅ Active | ERC-8004 + x402 USDC         |
| **Hedera Testnet**   | 296      | ✅ Active | ERC-8004                     |
| **0G Testnet**       | 16600    | ✅ Active | ERC-8004 + Storage + Compute |

Simply change the `network` parameter - no other configuration needed!

## API Reference

### ChaosChainSDK

Main SDK class with all functionality.

#### Constructor Options

```typescript
interface ChaosChainSDKConfig {
  agentName: string; // Your agent's name
  agentDomain: string; // Your agent's domain
  agentRole: AgentRole | string; // 'server', 'client', 'validator', 'both'
  network: NetworkConfig | string; // Network to use
  privateKey?: string; // Wallet private key
  mnemonic?: string; // Or HD wallet mnemonic
  rpcUrl?: string; // Custom RPC URL (optional)
  enablePayments?: boolean; // Enable x402 payments (default: true)
  enableStorage?: boolean; // Enable storage (default: true)
  storageProvider?: StorageProvider; // Custom storage provider
  computeProvider?: ComputeProvider; // Custom compute provider
  walletFile?: string; // Load wallet from file
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
| **Wallet**     | `getAddress()`                                  | Get wallet address           |
|                | `getBalance()`                                  | Get native balance           |
|                | `signMessage(message)`                          | Sign message                 |

## Examples

### Complete Agent Workflow

```typescript
import { ChaosChainSDK, NetworkConfig, AgentRole } from '@chaoschain/sdk';

async function main() {
  // Initialize SDK
  const sdk = new ChaosChainSDK({
    agentName: 'AnalysisAgent',
    agentDomain: 'analysis.example.com',
    agentRole: AgentRole.SERVER,
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

### Using AR.IO Network Storage (Arweave)

```typescript
import { ChaosChainSDK, ArioStorage, NetworkConfig } from '@chaoschain/sdk';

const sdk = new ChaosChainSDK({
  agentName: 'MyAgent',
  agentDomain: 'myagent.example.com',
  agentRole: 'server',
  network: NetworkConfig.BASE_SEPOLIA,
  privateKey: process.env.PRIVATE_KEY,
  storageProvider: new ArioStorage(process.env.PRIVATE_KEY, {
    appName: 'MyApp',
  }),
});

// Upload will be permanently stored on Arweave
const result = await sdk.storage.upload({
  data: 'Permanent evidence',
  timestamp: Date.now(),
});
console.log(`Stored on Arweave: ${result.uri}`);
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

# Storage Providers
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=https://gateway.pinata.cloud

# Optional: Custom RPC endpoints
LINEA_SEPOLIA_RPC_URL=https://rpc.sepolia.linea.build
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
- **Zero dependencies** in production (ethers, axios, dotenv, zod)

```typescript
// Import only what you need
import { ChaosChainSDK, NetworkConfig } from '@chaoschain/sdk';

// Or import storage providers separately
import { PinataStorage } from '@chaoschain/sdk/providers/storage';
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
A: No! All ERC-8004 v1.0 contracts are pre-deployed on 5 networks.

**Q: What's the difference between Python and TypeScript SDK?**  
A: Both SDKs have feature parity. Use TypeScript for web/Node.js apps, Python for backend services.

**Q: How do x402 payments work?**  
A: Real USDC/ETH transfers using Coinbase's HTTP 402 protocol. 2.5% fee goes to ChaosChain treasury.

**Q: Which storage provider should I use?**
A: Local IPFS for development, Pinata for production, AR.IO Network or Irys for permanent storage on Arweave.

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
- **Python SDK**: [https://pypi.org/project/chaoschain-sdk/](https://pypi.org/project/chaoschain-sdk/)
- **ERC-8004 Spec**: [https://eips.ethereum.org/EIPS/eip-8004](https://eips.ethereum.org/EIPS/eip-8004)
- **x402 Protocol**: [https://www.x402.org/](https://www.x402.org/)

## Support

- **Issues**: [GitHub Issues](https://github.com/ChaosChain/chaoschain-sdk-ts/issues)
- **Discord**: [ChaosChain Community]
- **Email**: sumeet.chougule@nethermind.io

---

**Build verifiable AI agents with on-chain identity and crypto payments. Start in minutes!**
