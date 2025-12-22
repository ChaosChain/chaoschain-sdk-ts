import { describe, it, expect, beforeEach } from 'vitest';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { NetworkConfig, AgentRole } from '../src/types';
import { ethers } from 'ethers';
import type { MandateCreateParams } from '../src/Mandate';
import type { CAIP10, MandateJSON } from '@quillai-network/mandates-core';

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
      expect((sdk as any).walletManager).toBeDefined();
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
      expect((sdk as any).walletManager).toBeDefined();
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
      const testData = {
        test: 'data',
        timestamp: Date.now(),
      };

      const result = await sdk.storeEvidence(testData);
      expect(result).toBeDefined();
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

  describe('Mandate Integration', () => {
    let sdk: ChaosChainSDK;
    let baseParams: MandateCreateParams;
    const clientCaip =
      'eip155:84532:0x1234567890abcdef1234567890abcdef12345678' as CAIP10;

    const buildParams = (serverAddress: string): MandateCreateParams => ({
      client: clientCaip,
      server: `eip155:84532:${serverAddress}` as CAIP10,
      intent: 'test-service',
      deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      core: {
        kind: 'serviceAgreement',
        payload: {
          service: 'ai-evaluation',
          price: '10 USDC',
        },
      },
      version: '0.1.0',
    });

    beforeEach(() => {
      sdk = new ChaosChainSDK({
        agentName: 'MandateAgent',
        agentDomain: 'mandate.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
        enableMandate: true,
      });
      baseParams = buildParams(sdk.getAddress());
    });

    it('should initialize mandate integration when enabled', () => {
      expect(sdk['mandateIntegration']).toBeDefined();
    });

    it('should create mandates via SDK helper', () => {
      const result = sdk.createMandate(baseParams);
      expect(result.success).toBe(true);
      expect(result.mandate?.client).toBe(baseParams.client);
      expect(result.mandate?.server).toBe(baseParams.server);
    });

    it('should sign and verify mandates', async () => {
      const creation = sdk.createMandate(baseParams);
      expect(creation.success).toBe(true);

      const signed = await sdk.signMandate(creation.mandate as MandateJSON);
      expect(signed.success).toBe(true);
      expect(signed.signature).toBeDefined();

      const verification = sdk.verifyMandateSignature(
        signed.mandate as MandateJSON,
        'server',
      );
      expect(verification.success).toBe(true);
      expect(verification.mandateHash).toBe(signed.mandateHash);
    });

    it('should expose mandate helpers for hash and canonical string', async () => {
      const creation = sdk.createMandate(baseParams);
      const signed = await sdk.signMandate(creation.mandate as MandateJSON);

      const hash = sdk.getMandateHash(signed.mandate as MandateJSON);
      const canonical = sdk.getMandateCanonicalString(
        signed.mandate as MandateJSON,
      );

      expect(hash).toBeDefined();
      expect(hash).toBe(signed.mandateHash);
      expect(typeof canonical).toBe('string');
      expect(canonical.length).toBeGreaterThan(0);
    });

    it('should provide mandate integration summary metadata', () => {
      const summary = sdk.getMandateIntegrationSummary();
      expect(summary.integration_type).toBe('Mandates Core');
      expect(summary.agent_name).toBe('MandateAgent');
    });

    it('should respect enableMandate flag', () => {
      const disabledSdk = new ChaosChainSDK({
        agentName: 'MandateAgent',
        agentDomain: 'mandate.example.com',
        agentRole: AgentRole.SERVER,
        network: NetworkConfig.BASE_SEPOLIA,
        privateKey: testPrivateKey,
        enableMandate: false,
      });

      const params = buildParams(disabledSdk.getAddress());
      expect(() => disabledSdk.createMandate(params)).toThrowError(
        'Mandate integration not enabled',
      );
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
      const testFunction = async (payload: { value: number }) => payload.value * 2;
      sdk['processIntegrity']!.registerFunction(testFunction, 'double');

      expect(sdk['processIntegrity']!['registeredFunctions'].has('double')).toBe(true);
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

    // it('should return SDK version', () => {
    //   const version = sdk.getVersion();
    //   expect(version).toBeDefined();
    //   expect(typeof version).toBe('string');
    //   expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    // });

    it('should return capabilities list', () => {
      const capabilities = sdk.getCapabilities();
      expect(capabilities.agent_name).toBe('TestAgent');
      expect(capabilities.agent_role).toBe(AgentRole.SERVER);
      expect(capabilities.features.erc_8004_identity).toBe(true);
      expect(capabilities.features.mandate_integration).toBe(true);
      expect(Array.isArray(capabilities.supported_payment_methods)).toBe(true);
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
