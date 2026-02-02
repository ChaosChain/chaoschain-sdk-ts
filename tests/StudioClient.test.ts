/**
 * StudioClient Tests
 *
 * Tests for direct on-chain Studio operations via StudioClient.
 * These methods are for testing/development - use Gateway for production.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import { StudioClient } from '../src/StudioClient';
import { ContractError } from '../src/exceptions';

// Mock getContractAddresses
vi.mock('../src/utils/contracts', () => ({
  CHAOS_CORE_ABI: [],
  STUDIO_PROXY_ABI: [],
  REWARDS_DISTRIBUTOR_ABI: [],
  getContractAddresses: vi.fn(),
}));

import { getContractAddresses } from '../src/utils/contracts';

describe('StudioClient', () => {
  let mockProvider: any;
  let mockSigner: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProvider = {
      getBalance: vi.fn().mockResolvedValue(BigInt(1000000000000000000)),
    };

    mockSigner = {
      getAddress: vi.fn().mockResolvedValue('0xSignerAddress'),
    };

    // Default mock for getContractAddresses
    vi.mocked(getContractAddresses).mockReturnValue({
      chaos_core: '0xChaosCoreAddress',
      rewards_distributor: '0xRewardsDistributorAddress',
    } as any);
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });
      expect(client).toBeInstanceOf(StudioClient);
    });
  });

  // ===========================================================================
  // Validation Tests (no contract interaction needed)
  // ===========================================================================

  describe('registerWithStudio validation', () => {
    it('should throw ContractError if stake is zero', async () => {
      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      await expect(
        client.registerWithStudio('0xStudio', 'agent-123', 1, 0n)
      ).rejects.toThrow('Stake amount must be > 0');
    });
  });

  describe('submitWorkMultiAgent validation', () => {
    it('should throw ContractError if weights do not sum to 10000', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      const participants = ['0xAgent1', '0xAgent2'];
      const weights = [5000, 4000]; // Sum = 9000

      await expect(
        client.submitWorkMultiAgent(
          '0xStudio',
          '0xDataHash',
          '0xThreadRoot',
          '0xEvidenceRoot',
          participants,
          weights
        )
      ).rejects.toThrow('Contribution weights must sum to 10000, got 9000');
    });

    it('should throw ContractError if participants and weights have different lengths', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      const participants = ['0xAgent1', '0xAgent2', '0xAgent3'];
      const weights = [5000, 5000]; // 2 weights, 3 participants

      await expect(
        client.submitWorkMultiAgent(
          '0xStudio',
          '0xDataHash',
          '0xThreadRoot',
          '0xEvidenceRoot',
          participants,
          weights
        )
      ).rejects.toThrow('Participants (3) and weights (2) must have same length');
    });
  });

  describe('createStudio validation', () => {
    it('should throw ContractError if ChaosCore address not found', async () => {
      vi.mocked(getContractAddresses).mockReturnValue(undefined as any);

      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'unknown-network',
      });

      await expect(client.createStudio('Test', '0xLogic')).rejects.toThrow(ContractError);
    });
  });

  describe('closeEpoch validation', () => {
    it('should throw ContractError if RewardsDistributor address not found', async () => {
      vi.mocked(getContractAddresses).mockReturnValue({
        chaos_core: '0xChaosCoreAddress',
        // No rewards_distributor
      } as any);

      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'unknown-network',
      });

      await expect(client.closeEpoch('0xStudio', 5)).rejects.toThrow(ContractError);
    });
  });

  // ===========================================================================
  // Helper Methods (pure functions, no mocking needed)
  // ===========================================================================

  describe('computeScoreCommitment', () => {
    it('should compute keccak256 commitment hash', () => {
      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      const scores = [80, 90, 75];
      const salt = '0x' + '1'.repeat(64);
      const dataHash = '0x' + '2'.repeat(64);

      const result = client.computeScoreCommitment(scores, salt, dataHash);

      expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should return different hashes for different scores', () => {
      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      const salt = '0x' + '1'.repeat(64);
      const dataHash = '0x' + '2'.repeat(64);

      const hash1 = client.computeScoreCommitment([80, 90], salt, dataHash);
      const hash2 = client.computeScoreCommitment([85, 95], salt, dataHash);

      expect(hash1).not.toBe(hash2);
    });

    it('should return different hashes for different salts', () => {
      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      const scores = [80, 90];
      const dataHash = '0x' + '2'.repeat(64);

      const hash1 = client.computeScoreCommitment(scores, '0x' + '1'.repeat(64), dataHash);
      const hash2 = client.computeScoreCommitment(scores, '0x' + '3'.repeat(64), dataHash);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('encodeScoreVector', () => {
    it('should ABI-encode score array', () => {
      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      const scores = [80, 90, 75];
      const result = client.encodeScoreVector(scores);

      expect(result).toMatch(/^0x/);
      expect(result.length).toBeGreaterThan(2);
    });

    it('should produce decodable output', () => {
      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      const scores = [80, 90, 75];
      const encoded = client.encodeScoreVector(scores);

      // Decode and verify (ethers returns bigint)
      const abiCoder = new ethers.AbiCoder();
      const decoded = abiCoder.decode(['uint8[]'], encoded);
      const decodedNumbers = decoded[0].map((n: bigint) => Number(n));

      expect(decodedNumbers).toEqual(scores);
    });
  });

  describe('generateSalt', () => {
    it('should generate 32-byte hex string', () => {
      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      const salt = client.generateSalt();

      expect(salt).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should generate unique salts', () => {
      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      const salt1 = client.generateSalt();
      const salt2 = client.generateSalt();

      expect(salt1).not.toBe(salt2);
    });
  });

  // ===========================================================================
  // Deprecation Warnings
  // ===========================================================================

  describe('deprecation warnings', () => {
    it('submitWork should log deprecation warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      // This will fail because we can't mock the contract, but the warning should be logged first
      try {
        await client.submitWork('0xStudio', '0xHash', '0xThread', '0xEvidence');
      } catch {
        // Expected to fail
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
      consoleSpy.mockRestore();
    });

    it('submitWorkMultiAgent should log deprecation warning', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const client = new StudioClient({
        provider: mockProvider,
        signer: mockSigner,
        network: 'ethereum-sepolia',
      });

      // This will fail at validation, but the warning should be logged first
      try {
        await client.submitWorkMultiAgent(
          '0xStudio',
          '0xHash',
          '0xThread',
          '0xEvidence',
          ['0xAgent1', '0xAgent2'],
          [5000, 5000]
        );
      } catch {
        // Expected to fail
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
      consoleSpy.mockRestore();
    });
  });
});

// ===========================================================================
// Integration-style tests for commit-reveal pattern
// ===========================================================================

describe('StudioClient Commit-Reveal Pattern', () => {
  it('should generate commitment that can be verified with reveal', () => {
    const mockProvider = { getBalance: vi.fn() };
    const mockSigner = { getAddress: vi.fn() };

    vi.mocked(getContractAddresses).mockReturnValue({
      chaos_core: '0xChaosCoreAddress',
      rewards_distributor: '0xRewardsDistributorAddress',
    } as any);

    const client = new StudioClient({
      provider: mockProvider as any,
      signer: mockSigner as any,
      network: 'ethereum-sepolia',
    });

    const scores = [85, 90, 78];
    const salt = client.generateSalt();
    const dataHash = '0x' + 'a'.repeat(64);

    // Generate commitment
    const commitment = client.computeScoreCommitment(scores, salt, dataHash);

    // Encode score vector for reveal
    const scoreVector = client.encodeScoreVector(scores);

    // Verify the commitment matches what we'd compute manually
    const abiCoder = new ethers.AbiCoder();
    const encoded = abiCoder.encode(['uint8[]', 'bytes32', 'bytes32'], [scores, salt, dataHash]);
    const expectedCommitment = ethers.keccak256(encoded);

    expect(commitment).toBe(expectedCommitment);
    expect(scoreVector).toBeDefined();
  });
});
