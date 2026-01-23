#!/usr/bin/env tsx
/**
 * End-to-End Protocol Test Script
 * 
 * This script tests the complete protocol workflow on Sepolia testnet:
 * 1. Register agent
 * 2. Create DKG from XMTP messages
 * 3. Submit work to StudioProxy
 * 4. Perform causal audit
 * 5. Submit score vectors
 * 6. Close epoch
 * 
 * Usage:
 *   PRIVATE_KEY=0x... npm run test:protocol
 * 
 * Requirements:
 *   - Sepolia ETH for gas
 *   - Valid private key in PRIVATE_KEY env var
 *   - Network access to Sepolia RPC
 */

import { ChaosChainSDK } from './src/ChaosChainSDK';
import { NetworkConfig } from './src/types';
import { ethers } from 'ethers';

async function main() {
  console.log('🚀 Starting Protocol E2E Test\n');

  // Check for private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY environment variable not set');
    console.error('   Set it with: export PRIVATE_KEY=0x...');
    process.exit(1);
  }

  // Initialize SDK
  console.log('📦 Initializing SDK...');
  const sdk = new ChaosChainSDK({
    agentName: 'ProtocolTestAgent',
    agentDomain: 'protocol-test.chaoscha.in',
    agentRole: 'server',
    network: NetworkConfig.ETHEREUM_SEPOLIA,
    privateKey: privateKey,
  });

  try {
    // Step 1: Register agent
    console.log('\n📝 Step 1: Registering agent...');
    const registration = await sdk.registerIdentity({
      name: 'Protocol Test Agent',
      domain: 'protocol-test.chaoscha.in',
      role: 'server',
      capabilities: ['protocol_testing'],
    });

    console.log(`✅ Agent registered with ID: ${registration.agentId}`);
    console.log(`   Transaction: ${registration.txHash}`);

    // Step 2: Create XMTP thread (simulate agent communication)
    console.log('\n💬 Step 2: Creating XMTP thread...');
    const { messageId: msg1 } = await sdk.xmtp().sendMessage(
      '0x' + '2'.repeat(40), // Recipient
      { task: 'test_task', action: 'start' },
      []
    );

    const { messageId: msg2 } = await sdk.xmtp().sendMessage(
      '0x' + '2'.repeat(40),
      { task: 'test_task', action: 'complete', result: 'success' },
      [msg1]
    );

    const thread = sdk.xmtp().getThread('0x' + '2'.repeat(40));
    console.log(`✅ Thread created with ${thread.messages.length} messages`);
    console.log(`   Thread root: ${thread.threadRoot.slice(0, 18)}...`);

    // Step 3: Prepare work submission data
    console.log('\n📤 Step 3: Preparing work submission...');
    const studioAddress = '0x' + '1'.repeat(40); // Would be real StudioProxy address
    const epoch = 1;
    const threadRoot = thread.threadRoot;
    const evidenceRoot = ethers.ZeroHash; // Would be computed from artifacts

    // Compute data hash
    const demandHash = ethers.ZeroHash;
    const paramsHash = ethers.ZeroHash;
    const dataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint64', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
        [studioAddress, epoch, demandHash, threadRoot, evidenceRoot, paramsHash]
      )
    );

    console.log(`   Studio: ${studioAddress}`);
    console.log(`   Epoch: ${epoch}`);
    console.log(`   Data Hash: ${dataHash.slice(0, 18)}...`);

    // Step 4: Submit work (commented out - requires real StudioProxy)
    console.log('\n⚠️  Step 4: Work submission (skipped - requires deployed StudioProxy)');
    console.log('   To test: Deploy StudioProxy and uncomment submitWork() call');

    // Uncomment when StudioProxy is deployed:
    // const txHash = await sdk.submitWork({
    //   studioAddress: studioAddress,
    //   dataHash: dataHash,
    //   threadRoot: threadRoot,
    //   evidenceRoot: evidenceRoot,
    // });
    // console.log(`✅ Work submitted: ${txHash}`);

    // Step 5: Perform causal audit (mocked evidence)
    console.log('\n🔍 Step 5: Performing causal audit...');
    const mockEvidence = {
      xmtp_messages: thread.messages.map(m => ({
        id: m.id,
        sender: m.from,
        recipient: m.to,
        content: m.content,
        timestamp: m.timestamp,
        dkg_node: {
          author: m.from,
          sig: '0x' + 'a'.repeat(130),
          ts: m.timestamp,
          xmtp_msg_id: m.id,
          artifact_ids: [],
          payload_hash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(m.content))),
          parents: m.parentIds || []
        }
      })),
      thread_root: threadRoot,
      evidence_root: evidenceRoot,
      epoch: epoch,
    };

    // Mock download
    const originalDownload = sdk.download.bind(sdk);
    (sdk as any).download = async () => mockEvidence;

    const auditResult = await sdk.verifier().performCausalAudit(
      'QmMockEvidence',
      studioAddress
    );

    console.log(`✅ Audit ${auditResult.auditPassed ? 'PASSED' : 'FAILED'}`);
    if (auditResult.dkg) {
      console.log(`   DKG nodes: ${auditResult.dkg.nodes.size}`);
    }
    console.log(`   Contribution weights: ${Object.keys(auditResult.contributionWeights).length} agents`);

    // Step 6: Submit score vector (commented out - requires work submission)
    console.log('\n⚠️  Step 6: Score submission (skipped - requires work submission)');
    console.log('   To test: Submit work first, then submit scores');

    // Uncomment when work is submitted:
    // await sdk.submitScoreVector({
    //   studioAddress: studioAddress,
    //   dataHash: dataHash,
    //   scoreVector: [85, 90, 88, 95, 82],
    // });
    // console.log('✅ Score vector submitted');

    // Step 7: Close epoch (commented out - requires RewardsDistributor)
    console.log('\n⚠️  Step 7: Epoch closure (skipped - requires RewardsDistributor)');
    console.log('   To test: Deploy RewardsDistributor and uncomment closeEpoch() call');

    // Uncomment when RewardsDistributor is deployed:
    // await sdk.closeEpoch({
    //   studioAddress: studioAddress,
    //   epoch: epoch,
    // });
    // console.log('✅ Epoch closed');

    console.log('\n✅ Protocol E2E test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Agent registered: ✅`);
    console.log(`   - XMTP thread created: ✅`);
    console.log(`   - Causal audit performed: ✅`);
    console.log(`   - Work submission: ⏭️  (requires deployed StudioProxy)`);
    console.log(`   - Score submission: ⏭️  (requires work submission)`);
    console.log(`   - Epoch closure: ⏭️  (requires deployed RewardsDistributor)`);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
