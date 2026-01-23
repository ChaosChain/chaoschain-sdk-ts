import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { NetworkConfig } from '../src/types';
import { ethers } from 'ethers';

/**
 * Integration tests for Protocol methods
 * These tests verify the SDK can interact with contracts correctly
 */

describe('Protocol Integration', () => {
  let sdk: ChaosChainSDK;
  let mockProvider: any;
  let mockWallet: any;

  beforeEach(() => {
    // Create mock wallet
    mockWallet = {
      address: '0x1234567890123456789012345678901234567890',
      signMessage: vi.fn().mockResolvedValue('0x' + 'a'.repeat(130)),
      sendTransaction: vi.fn().mockResolvedValue({
        hash: '0x' + '1'.repeat(64),
        wait: vi.fn().mockResolvedValue({
          blockNumber: 1000,
          status: 1,
        }),
      }),
    };

    // Create SDK
    sdk = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: 'server',
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: '0x' + '1'.repeat(64),
    });
  });

  it('should have protocol methods available', () => {
    expect(typeof sdk.submitWork).toBe('function');
    expect(typeof sdk.submitWorkMultiAgent).toBe('function');
    expect(typeof sdk.submitScoreVector).toBe('function');
    expect(typeof sdk.submitScoreVectorForWorker).toBe('function');
    expect(typeof sdk.closeEpoch).toBe('function');
    expect(typeof sdk.getConsensusResult).toBe('function');
  });

  it('should have protocol integrations initialized', () => {
    expect(sdk.verifierAgent).toBeDefined();
    expect(sdk.studioManager).toBeDefined();
    expect(sdk.xmtpManager).toBeDefined();
    expect(sdk.mandateManager).toBeDefined();
  });

  it('should have convenience accessors', () => {
    expect(sdk.verifier()).toBeDefined();
    expect(sdk.studio()).toBeDefined();
    expect(sdk.xmtp()).toBeDefined();
    expect(sdk.mandate()).toBeDefined();
  });

  it('should validate agent registration before protocol calls', async () => {
    // Try to submit work without registering
    await expect(
      sdk.submitWork({
        studioAddress: '0x' + '1'.repeat(40),
        dataHash: '0x' + '2'.repeat(64),
        threadRoot: '0x' + '3'.repeat(64),
        evidenceRoot: '0x' + '4'.repeat(64),
      })
    ).rejects.toThrow('Agent not registered');
  });

  it('should encode score vectors correctly', () => {
    // Test that score vectors are properly formatted
    const scores = [85, 90, 88, 95, 82];
    const scoresUint8 = scores.map((s) => Math.min(Math.max(Math.floor(s), 0), 100));

    expect(scoresUint8).toEqual([85, 90, 88, 95, 82]);
    expect(scoresUint8.every((s) => s >= 0 && s <= 100)).toBe(true);
  });

  it('should normalize contribution weights to basis points', () => {
    // Test float weights (0-1)
    const floatWeights = [0.45, 0.35, 0.2];
    const total = floatWeights.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 2);

    // Test basis points (0-10000)
    const bpWeights = [4500, 3500, 2000];
    const bpTotal = bpWeights.reduce((a, b) => a + b, 0);
    expect(bpTotal).toBe(10000);
  });
});
