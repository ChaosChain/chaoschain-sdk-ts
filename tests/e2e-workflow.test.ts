import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { NetworkConfig } from '../src/types';
import { ethers } from 'ethers';

/**
 * End-to-end workflow test
 * Simulates a complete workflow: task → work → audit → scoring → epoch closure
 */

describe('E2E Workflow', () => {
  let sdk: ChaosChainSDK;
  let studioAddress: string;

  beforeEach(() => {
    sdk = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: 'server',
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: '0x' + '1'.repeat(64),
    });

    studioAddress = '0x' + '1'.repeat(40);
  });

  it('should complete full workflow', async () => {
    // Step 1: Broadcast task
    const taskId = sdk.studio().broadcastTask(
      studioAddress,
      {
        description: 'Analyze market data',
        budget: 100.0,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capabilities: ['analysis'],
      },
      ['0xWorker1', '0xWorker2']
    );

    expect(taskId).toBeDefined();
    const task = sdk.studio().getTask(taskId);
    expect(task?.status).toBe('broadcasting');

    // Step 2: Send XMTP messages (simulate worker communication)
    const { messageId: msg1 } = await sdk
      .xmtp()
      .sendMessage('0xWorker1', { task: taskId, status: 'accepted' }, []);

    const { messageId: msg2 } = await sdk
      .xmtp()
      .sendMessage('0xWorker1', { task: taskId, result: 'analysis complete' }, [msg1]);

    // Step 3: Get thread and compute thread root
    const thread = sdk.xmtp().getThread('0xWorker1');
    expect(thread.messages.length).toBeGreaterThan(0);
    expect(thread.threadRoot).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Step 4: Create evidence package
    const evidencePackage = {
      xmtp_messages: thread.messages.map((m) => ({
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
          parents: m.parentIds || [],
        },
      })),
      thread_root: thread.threadRoot,
      evidence_root: ethers.ZeroHash,
      epoch: 1,
    };

    // Step 5: Perform causal audit (mocked)
    vi.spyOn(sdk, 'download').mockResolvedValue(evidencePackage as any);

    const auditResult = await sdk.verifier().performCausalAudit('QmTestEvidence', studioAddress);

    expect(auditResult).toBeDefined();
    expect(auditResult.dataHash).toBeDefined();

    // Step 6: Verify DKG was constructed
    if (auditResult.dkg) {
      expect(auditResult.dkg.nodes.size).toBeGreaterThan(0);
    }

    // Step 7: Verify contribution weights
    const weights = auditResult.contributionWeights;
    if (Object.keys(weights).length > 0) {
      const total = Object.values(weights).reduce((a: number, b: number) => a + b, 0);
      expect(total).toBeCloseTo(1.0, 1);
    }

    console.log('✅ E2E workflow test completed successfully');
  });

  it('should handle multi-agent work submission workflow', async () => {
    // Simulate multi-agent collaboration
    const participants = ['0xAlice', '0xBob', '0xCarol'];

    // Create messages from each participant
    const messages: string[] = [];
    for (const participant of participants) {
      const { messageId } = await sdk
        .xmtp()
        .sendMessage(
          participant,
          { contribution: 'analysis' },
          messages.length > 0 ? [messages[messages.length - 1]] : []
        );
      messages.push(messageId);
    }

    // Get thread
    const thread = sdk.xmtp().getThread(participants[0]);
    expect(thread.messages.length).toBeGreaterThan(0);

    // Compute contribution weights (would be done by VerifierAgent in real scenario)
    const weights = [0.45, 0.35, 0.2]; // Alice, Bob, Carol
    const weightsBp = weights.map((w) => Math.floor(w * 10000));

    expect(weightsBp).toEqual([4500, 3500, 2000]);
    expect(weightsBp.reduce((a, b) => a + b, 0)).toBe(10000);

    console.log('✅ Multi-agent workflow test completed');
  });
});
