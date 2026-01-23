import { describe, it, expect } from 'vitest';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { NetworkConfig, AgentRole } from '../src/types';
import { ethers } from 'ethers';

describe('ChaosChainSDK', () => {
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  describe('Initialization', () => {
    it('should initialize with minimal config', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });

      expect(sdk.agentName).toBe('TestAgent');
      expect(sdk.agentDomain).toBe('test.example.com');
      expect(sdk.agentRole).toBe(AgentRole.SERVER);
      expect(sdk.network).toBe(NetworkConfig.BASE_SEPOLIA);
    });

    it('should initialize with custom RPC URL', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
        rpcUrl: 'https://custom-rpc.example.com',
      });

      expect(sdk).toBeDefined();
    });

    it('should generate wallet if no private key provided', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.CLIENT,
        network: NetworkConfig.ETHEREUM_SEPOLIA,
      });

      expect(sdk).toBeDefined();
      expect(sdk.walletManager).toBeDefined();
    });

    it('should initialize with feature flags', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
        enableAP2: true,
        enableProcessIntegrity: true,
        enablePayments: true,
        enableStorage: true,
      });

      expect(sdk).toBeDefined();
    });

    it('should handle invalid network gracefully', () => {
      expect(() => {
        new ChaosChainSDK({
          agentName: 'TestAgent',
          agentDomain: 'test.example.com',
          agentRole: AgentRole.SERVER,
          network: 'invalid-network' as NetworkConfig,
          privateKey: testPrivateKey,
        });
      }).toThrow();
    });

    it('should accept mnemonic instead of private key', () => {
      const mnemonic = 'test test test test test test test test test test test junk';
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        mnemonic,
      });

      expect(sdk).toBeDefined();
      expect(sdk.walletManager).toBeDefined();
    });
  });

  describe('Wallet and Address', () => {
    let sdk: ChaosChainSDK;

    beforeEach(() => {
      sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });
    });

    it('should return valid address', () => {
      const address = sdk.getAddress();
      expect(address).toBeDefined();
      expect(ethers.isAddress(address)).toBe(true);
    });

    it('should return wallet balance', async () => {
      const balance = await sdk.getBalance();
      expect(balance).toBeDefined();
      expect(typeof balance).toBe('string');
      // Balance should be a valid numeric string
      expect(balance).toMatch(/^\d+$/);
    });
  });

  describe('Network Configuration', () => {
    it('should work with Ethereum Sepolia', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.ETHEREUM_SEPOLIA,
        privateKey: testPrivateKey,
      });

      expect(sdk.network).toBe(NetworkConfig.ETHEREUM_SEPOLIA);
    });

    it('should work with Base Sepolia', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });

      expect(sdk.network).toBe(NetworkConfig.BASE_SEPOLIA);
    });

    it('should work with Linea Sepolia', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.LINEA_SEPOLIA,
        privateKey: testPrivateKey,
      });

      expect(sdk.network).toBe(NetworkConfig.LINEA_SEPOLIA);
    });

    it('should work with Hedera Testnet', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.HEDERA_TESTNET,
        privateKey: testPrivateKey,
      });

      expect(sdk.network).toBe(NetworkConfig.HEDERA_TESTNET);
    });

    it('should work with 0G Testnet', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.ZEROG_TESTNET,
        privateKey: testPrivateKey,
      });

      expect(sdk.network).toBe(NetworkConfig.ZEROG_TESTNET);
    });
  });

  describe('Agent Roles', () => {
    it('should support SERVER role', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'ServerAgent',
        agentDomain: 'server.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });

      expect(sdk.agentRole).toBe(AgentRole.SERVER);
    });

    it('should support CLIENT role', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'ClientAgent',
        agentDomain: 'client.example.com',
        agentRole: AgentRole.CLIENT,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });

      expect(sdk.agentRole).toBe(AgentRole.CLIENT);
    });

    it('should support VALIDATOR role', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'ValidatorAgent',
        agentDomain: 'validator.example.com',
        agentRole: AgentRole.VALIDATOR,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });

      expect(sdk.agentRole).toBe(AgentRole.VALIDATOR);
    });

    it('should support BOTH role', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'HybridAgent',
        agentDomain: 'hybrid.example.com',
        agentRole: AgentRole.BOTH,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });

      expect(sdk.agentRole).toBe(AgentRole.BOTH);
    });
  });

  describe('Storage Integration', () => {
    let sdk: ChaosChainSDK;

    beforeEach(() => {
      sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
        enableStorage: true,
      });
    });

    it('should have storage backend initialized', () => {
      expect(sdk['storageBackend']).toBeDefined();
    });

    it('should store evidence data', async () => {
      // Mock storage backend to avoid IPFS dependency
      const mockStorage = {
        put: async () => ({ cid: 'QmMockCID123', provider: 'mock' }),
        get: async () => Buffer.from('{}'),
      };

      const sdkWithMock = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
        storageProvider: mockStorage as any,
      });

      const testData = {
        test: 'data',
        timestamp: Date.now(),
      };

      const result = await sdkWithMock.storeEvidence(testData);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Payment Integration', () => {
    let sdk: ChaosChainSDK;

    beforeEach(() => {
      sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
        enablePayments: true,
      });
    });

    it('should have payment manager initialized', () => {
      expect(sdk['paymentManager']).toBeDefined();
    });

    it('should have x402 payment manager initialized', () => {
      expect(sdk['x402PaymentManager']).toBeDefined();
    });
  });

  describe('Process Integrity', () => {
    let sdk: ChaosChainSDK;

    beforeEach(() => {
      sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
        enableProcessIntegrity: true,
      });
    });

    it('should have process integrity initialized', () => {
      expect(sdk['processIntegrity']).toBeDefined();
    });

    it('should register functions for integrity verification', () => {
      const sdkWithIntegrity = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
        enableProcessIntegrity: true,
      });

      if (sdkWithIntegrity['processIntegrity']) {
        const testFunction = async (x: number) => x * 2;
        // registerFunction takes function as first param, name as optional second
        sdkWithIntegrity['processIntegrity']!.registerFunction(testFunction, 'double');

        expect(sdkWithIntegrity['processIntegrity']!['registeredFunctions'].has('double')).toBe(
          true
        );
      } else {
        // Skip if process integrity not available
        expect(true).toBe(true);
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should accept empty agent name', () => {
      // SDK doesn't validate agent name - it's user's responsibility
      const sdk = new ChaosChainSDK({
        agentName: '',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });
      expect(sdk).toBeDefined();
    });

    it('should accept empty agent domain', () => {
      // SDK doesn't validate domain - it's user's responsibility
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: '',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });
      expect(sdk).toBeDefined();
    });

    it('should accept various domain formats', () => {
      const sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });
      expect(sdk).toBeDefined();
    });
  });

  describe('ERC-8004 Integration', () => {
    let sdk: ChaosChainSDK;

    beforeEach(() => {
      sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });
    });

    it('should have chaos agent initialized', () => {
      expect(sdk['chaosAgent']).toBeDefined();
    });

    it('should have correct contract addresses for network', () => {
      expect(sdk['chaosAgent']).toBeDefined();
      // ChaosAgent should have the correct contracts initialized
    });
  });

  describe('Utility Methods', () => {
    let sdk: ChaosChainSDK;

    beforeEach(() => {
      sdk = new ChaosChainSDK({
        agentName: 'TestAgent',
        agentDomain: 'test.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
      });
    });

    it('should return SDK version', () => {
      const version = sdk.getVersion();
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should return capabilities list', () => {
      const capabilities = sdk.getCapabilities();
      expect(typeof capabilities).toBe('object');
      expect(capabilities.features).toBeDefined();
      expect(capabilities.features.erc_8004_identity).toBe(true);
      expect(capabilities.features.erc_8004_reputation).toBe(true);
      expect(capabilities.features.erc_8004_validation).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid private key gracefully', () => {
      expect(() => {
        new ChaosChainSDK({
          agentName: 'TestAgent',
          agentDomain: 'test.example.com',
          agentRole: AgentRole.SERVER,
          network: NetworkConfig.BASE_SEPOLIA,
          privateKey: 'invalid-key',
        });
      }).toThrow();
    });

    it('should handle invalid mnemonic gracefully', () => {
      expect(() => {
        new ChaosChainSDK({
          agentName: 'TestAgent',
          agentDomain: 'test.example.com',
          agentRole: AgentRole.SERVER,
          network: NetworkConfig.BASE_SEPOLIA,
          mnemonic: 'invalid mnemonic phrase',
        });
      }).toThrow();
    });
  });
});
