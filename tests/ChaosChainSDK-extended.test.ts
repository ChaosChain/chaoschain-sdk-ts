import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { NetworkConfig, AgentRole } from '../src/types';
import { ethers } from 'ethers';

describe('ChaosChainSDK Extended', () => {
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  let sdk: ChaosChainSDK;

  beforeEach(() => {
    sdk = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: AgentRole.SERVER,
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: testPrivateKey,
    });
  });

  it('should have all protocol methods', () => {
    expect(typeof sdk.submitWork).toBe('function');
    expect(typeof sdk.submitWorkMultiAgent).toBe('function');
    expect(typeof sdk.submitScoreVector).toBe('function');
    expect(typeof sdk.submitScoreVectorForWorker).toBe('function');
    expect(typeof sdk.closeEpoch).toBe('function');
    expect(typeof sdk.getConsensusResult).toBe('function');
  });

  it('should have protocol integrations', () => {
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

  it('should check gateway availability', () => {
    expect(sdk.hasGateway()).toBe(false);

    const sdkWithGateway = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: AgentRole.SERVER,
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: testPrivateKey,
      gatewayUrl: 'https://gateway.test.com',
    });

    expect(sdkWithGateway.hasGateway()).toBe(true);
  });

  it('should throw error when accessing gateway without URL', () => {
    expect(() => sdk.gateway()).toThrow('Gateway not configured');
  });

  it('should download data', async () => {
    // Mock storage backend
    const mockStorage = {
      get: vi.fn().mockResolvedValue(Buffer.from(JSON.stringify({ test: 'data' }))),
    };

    const sdkWithMock = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: AgentRole.SERVER,
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: testPrivateKey,
      storageProvider: mockStorage as any,
    });

    const result = await sdkWithMock.download('QmTest');
    expect(result).toBeDefined();
  });

  it('should upload data', async () => {
    const mockStorage = {
      put: vi.fn().mockResolvedValue({ cid: 'QmTest', provider: 'mock' }),
    };

    const sdkWithMock = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: AgentRole.SERVER,
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: testPrivateKey,
      storageProvider: mockStorage as any,
    });

    const result = await sdkWithMock.upload(Buffer.from('test data'));
    expect(result).toBeDefined();
    expect(result.cid).toBe('QmTest');
  });

  it('should store evidence', async () => {
    const mockStorage = {
      put: vi.fn().mockResolvedValue({ cid: 'QmEvidence', provider: 'mock' }),
    };

    const sdkWithMock = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: AgentRole.SERVER,
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: testPrivateKey,
      storageProvider: mockStorage as any,
    });

    const cid = await sdkWithMock.storeEvidence({ test: 'evidence' });
    expect(cid).toBe('QmEvidence');
  });

  it('should get network info', () => {
    const networkInfo = sdk.getNetworkInfo();
    expect(networkInfo).toBeDefined();
    expect(networkInfo.chainId).toBeDefined();
    expect(networkInfo.name).toBeDefined();
  });

  it('should get wallet address', () => {
    const address = sdk.getAddress();
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it('should get wallet balance', async () => {
    vi.spyOn(sdk['provider'], 'getBalance').mockResolvedValue(ethers.parseEther('1.0'));

    const balance = await sdk.getBalance();
    expect(balance).toBeDefined();
  });
});
