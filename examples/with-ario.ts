/**
 * Example using AR.IO Network (Arweave Turbo) storage
 *
 * This example demonstrates how to use ArioStorage for permanent
 * storage on Arweave via the Turbo service.
 *
 * Prerequisites:
 * - npm install @ardrive/turbo-sdk
 * - EVM private key (same key used for blockchain transactions)
 * - For files > 100KB, top up Turbo credits at https://turbo.ar.io
 */

import { ChaosChainSDK, ArioStorage, NetworkConfig, AgentRole } from '../src';

// Optional: load from .env file if dotenv is installed
try {
  const dotenv = require('dotenv');
  dotenv.config();
} catch {
  // dotenv not installed, using environment variables directly
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  // Initialize ArioStorage with options
  const arioStorage = new ArioStorage(privateKey, {
    gatewayUrl: 'https://arweave.net', // Arweave gateway for downloads
    appName: 'ChaosChain-Example', // Tag for identifying your uploads
  });

  // Initialize SDK with Ario storage
  const sdk = new ChaosChainSDK({
    agentName: 'ArioAgent',
    agentDomain: 'ario.example.com',
    agentRole: AgentRole.SERVER,
    network: NetworkConfig.BASE_SEPOLIA,
    privateKey: privateKey,
    storageProvider: arioStorage,
  });

  console.log('🚀 SDK initialized with AR.IO Network (Arweave Turbo) storage');
  console.log('📝 Note: Uploads < 100KB are free. Larger files require Turbo credits.');
  console.log('💳 Top up credits at: https://turbo.ar.io\n');

  // Upload data to Arweave
  console.log('📤 Uploading to Arweave via Turbo...');
  const data = {
    message: 'Hello from ChaosChain on Arweave!',
    timestamp: Date.now(),
    agent: 'ArioAgent',
    permanent: true,
  };

  const cid = await sdk.storeEvidence(data);

  console.log('✅ Permanently stored on Arweave!');
  console.log(`📦 Transaction ID: ${cid}`);
  console.log(`🌐 View at: https://arweave.net/${cid}`);

  // Download data back
  console.log('\n📥 Downloading from Arweave...');
  const downloaded = await sdk.download(cid);
  console.log('✅ Downloaded:', downloaded);

  console.log('\n✨ AR.IO Network example completed!');
  console.log('🔒 Your data is now permanently stored on Arweave.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   - Ensure @ardrive/turbo-sdk is installed: npm install @ardrive/turbo-sdk');
    console.error('   - For files > 100KB, top up credits at https://turbo.ar.io');
    console.error('   - Check your PRIVATE_KEY environment variable is set correctly');
    process.exit(1);
  });
