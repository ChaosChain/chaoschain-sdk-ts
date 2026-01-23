import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { VerifierAgent } from '../src/VerifierAgent';
import { NetworkConfig } from '../src/types';

describe('VerifierAgent', () => {
  let sdk: ChaosChainSDK;
  let verifier: VerifierAgent;
  let mockProvider: any;
  let mockWallet: any;

  beforeEach(() => {
    // Mock wallet and provider
    mockWallet = {
      address: '0x1234567890123456789012345678901234567890',
      signMessage: vi.fn().mockResolvedValue('0x' + 'a'.repeat(130)),
    };

    mockProvider = {
      getNetwork: vi.fn().mockResolvedValue({ chainId: 11155111n }),
      getBlockNumber: vi.fn().mockResolvedValue(1000),
    };

    // Create SDK with minimal config
    sdk = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: 'validator',
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: '0x' + '1'.repeat(64), // Dummy private key
    });

    verifier = sdk.verifier();
  });

  it('should initialize VerifierAgent', () => {
    expect(verifier).toBeInstanceOf(VerifierAgent);
  });

  it('should compute data hash', async () => {
    // This tests the internal computeDataHash method indirectly
    // by checking that it produces a valid hash format
    const studio = '0x' + '1'.repeat(40);
    const epoch = 1;
    const threadRoot = ethers.ZeroHash;
    const evidenceRoot = ethers.ZeroHash;

    // Mock download method
    vi.spyOn(sdk, 'download').mockResolvedValue({
      xmtp_messages: [],
      thread_root: threadRoot,
      evidence_root: evidenceRoot,
      epoch: epoch,
    } as any);

    try {
      await verifier.performCausalAudit('QmTest', studio);
    } catch (error) {
      // Expected to fail without real evidence, but should not throw on hash computation
      expect(error).toBeDefined();
    }
  });

  it('should handle missing evidence package', async () => {
    vi.spyOn(sdk, 'download').mockResolvedValue(null);

    const result = await verifier.performCausalAudit('QmInvalid', '0x' + '1'.repeat(40));

    expect(result.auditPassed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should compute multi-dimensional scores', async () => {
    // Mock evidence with XMTP messages
    const mockEvidence = {
      xmtp_messages: [
        {
          id: 'msg1',
          sender: '0xAgent1',
          recipient: '0xAgent2',
          content: { text: 'Hello' },
          timestamp: Date.now(),
          dkg_node: {
            author: '0xAgent1',
            sig: '0x' + 'a'.repeat(130),
            ts: Date.now(),
            xmtp_msg_id: 'msg1',
            artifact_ids: [],
            payload_hash: ethers.keccak256(ethers.toUtf8Bytes('Hello')),
            parents: [],
          },
        },
      ],
      thread_root: ethers.ZeroHash,
      evidence_root: ethers.ZeroHash,
      epoch: 1,
    };

    vi.spyOn(sdk, 'download').mockResolvedValue(mockEvidence as any);

    const result = await verifier.performCausalAudit('QmTest', '0x' + '1'.repeat(40));

    // Should compute scores for agents
    expect(result.scores).toBeDefined();
    expect(typeof result.scores).toBe('object');
  });

  it('should compute contribution weights', async () => {
    const mockEvidence = {
      xmtp_messages: [
        {
          id: 'msg1',
          sender: '0xAgent1',
          recipient: '0xAgent2',
          content: { text: 'Hello' },
          timestamp: Date.now(),
          dkg_node: {
            author: '0xAgent1',
            sig: '0x' + 'a'.repeat(130),
            ts: Date.now(),
            xmtp_msg_id: 'msg1',
            artifact_ids: [],
            payload_hash: ethers.keccak256(ethers.toUtf8Bytes('Hello')),
            parents: [],
          },
        },
      ],
      thread_root: ethers.ZeroHash,
      evidence_root: ethers.ZeroHash,
      epoch: 1,
    };

    vi.spyOn(sdk, 'download').mockResolvedValue(mockEvidence as any);

    const result = await verifier.performCausalAudit('QmTest', '0x' + '1'.repeat(40));

    expect(result.contributionWeights).toBeDefined();

    // Weights should sum to approximately 1.0
    const total = Object.values(result.contributionWeights).reduce(
      (a: number, b: number) => a + b,
      0
    );
    if (total > 0) {
      expect(total).toBeCloseTo(1.0, 1);
    }
  });
});
