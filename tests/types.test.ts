import { describe, it, expect } from 'vitest';
import {
  NetworkConfig,
  AgentRole,
  AgentMetadata,
  StorageProvider,
  ComputeProvider,
  IntegrityProof,
  TEEAttestation,
  UploadResult,
  FeedbackParams,
  FeedbackRecord,
  ValidationRequest,
  ValidationRequestParams,
  VerificationMethod,
} from '../src/types';

describe('Type Exports', () => {
  describe('NetworkConfig Enum', () => {
    it('should export NetworkConfig enum', () => {
      expect(NetworkConfig).toBeDefined();
    });

    it('should have Ethereum Sepolia', () => {
      expect(NetworkConfig.ETHEREUM_SEPOLIA).toBe('ethereum-sepolia');
    });

    it('should have Base Sepolia', () => {
      expect(NetworkConfig.BASE_SEPOLIA).toBe('base-sepolia');
    });

    it('should have Linea Sepolia', () => {
      expect(NetworkConfig.LINEA_SEPOLIA).toBe('linea-sepolia');
    });

    it('should have Hedera Testnet', () => {
      expect(NetworkConfig.HEDERA_TESTNET).toBe('hedera-testnet');
    });

    it('should have 0G Testnet', () => {
      expect(NetworkConfig.ZEROG_TESTNET).toBe('0g-testnet');
    });

    it('should have all required networks', () => {
      const networks = Object.values(NetworkConfig);
      expect(networks.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('AgentRole Enum', () => {
    it('should export AgentRole enum', () => {
      expect(AgentRole).toBeDefined();
    });

    // DEPRECATED
    it('should have SERVER role', () => {
      expect(AgentRole.SERVER).toBe('worker');
    });

    it('should have CLIENT role', () => {
      expect(AgentRole.CLIENT).toBe('client');
    });

    // DEPRECATED
    it('should have VALIDATOR role', () => {
      expect(AgentRole.VALIDATOR).toBe('verifier');
    });
  });

  describe('AgentMetadata Interface', () => {
    it('should accept valid agent metadata', () => {
      const metadata: AgentMetadata = {
        name: 'TestAgent',
        domain: 'test.example.com',
        role: AgentRole.SERVER,
        capabilities: ['analysis', 'verification'],
        version: '1.0.0',
      };

      expect(metadata.name).toBe('TestAgent');
      expect(metadata.domain).toBe('test.example.com');
      expect(metadata.role).toBe(AgentRole.SERVER);
      expect(metadata.capabilities).toEqual(['analysis', 'verification']);
      expect(metadata.version).toBe('1.0.0');
    });

    it('should accept minimal metadata', () => {
      const metadata: AgentMetadata = {
        name: 'MinimalAgent',
        domain: 'minimal.example.com',
        role: AgentRole.CLIENT,
      };

      expect(metadata.name).toBe('MinimalAgent');
      expect(metadata.capabilities).toBeUndefined();
      expect(metadata.version).toBeUndefined();
    });

    it('should support optional fields', () => {
      const metadata: AgentMetadata = {
        name: 'TestAgent',
        domain: 'test.example.com',
        role: AgentRole.SERVER,
      };

      // These should be optional
      expect(metadata.capabilities).toBeUndefined();
      expect(metadata.version).toBeUndefined();
    });
  });

  describe('StorageProvider Interface', () => {
    it('should define required methods', () => {
      const mockStorage: StorageProvider = {
        upload: async () => ({ cid: 'QmTest', size: 100, uri: 'ipfs://QmTest' }),
        download: async () => Buffer.from('test'),
        pin: async () => { },
        unpin: async () => { },
      };

      expect(mockStorage.upload).toBeDefined();
      expect(mockStorage.download).toBeDefined();
      expect(mockStorage.pin).toBeDefined();
      expect(mockStorage.unpin).toBeDefined();
    });

    it('should support upload results', async () => {
      const mockStorage: StorageProvider = {
        upload: async () => ({ cid: 'QmTest123', size: 256, uri: 'ipfs://QmTest123' }),
        download: async () => Buffer.from('test'),
        pin: async () => { },
        unpin: async () => { },
      };

      const result: UploadResult = await mockStorage.upload(Buffer.from('test'));
      expect(result.cid).toBe('QmTest123');
      expect(result.size).toBe(256);
      expect(result.uri).toBe('ipfs://QmTest123');
    });
  });

  describe('ComputeProvider Interface', () => {
    it('should define required methods', () => {
      const mockCompute: ComputeProvider = {
        inference: async () => ({ result: 'test' }),
        getModels: async () => ['model1', 'model2'],
      };

      expect(mockCompute.inference).toBeDefined();
      expect(mockCompute.getModels).toBeDefined();
    });

    it('should support inference execution', async () => {
      const mockCompute: ComputeProvider = {
        inference: async (model: string, input: unknown) => ({
          result: `Processed ${input} with ${model}`,
        }),
        getModels: async () => ['gpt-4', 'claude-3'],
      };

      const result = (await mockCompute.inference('gpt-4', 'test input')) as any;
      expect(result.result).toContain('test input');
      expect(result.result).toContain('gpt-4');
    });
  });

  describe('IntegrityProof Interface', () => {
    it('should accept valid integrity proof', () => {
      const proof: IntegrityProof = {
        proofId: 'proof-123',
        functionName: 'analyzeData',
        //inputs: { data: 'test' },
        //outputs: { result: 'analyzed' },
        codeHash: '0x' + '1'.repeat(64),
        executionHash: '0x' + '2'.repeat(64),
        timestamp: new Date(),
        agentName: 'TestAgent',
        verificationStatus: 'verified',
        //signature: '0x' + '3'.repeat(130),
      };

      expect(proof.proofId).toBe('proof-123');
      expect(proof.functionName).toBe('analyzeData');
      expect(proof.codeHash).toMatch(/^0x/);
      expect(proof.executionHash).toMatch(/^0x/);
      expect(proof.agentName).toBe('TestAgent');
      expect(proof.verificationStatus).toBe('verified');
    });

    it('should support TEE attestation', () => {
      const teeAttestation: TEEAttestation = {
        jobId: 'job-123',
        provider: 'phala',
        executionHash: '0xhash',
        verificationMethod: 'tee-ml' as VerificationMethod,
        attestationData: '0x' + '2'.repeat(256),
        //publicKey: '0x' + '3'.repeat(128),
        timestamp: new Date().toISOString(),
      };

      const proof: IntegrityProof = {
        proofId: 'proof-456',
        functionName: 'teeFunction',
        //inputs: {},
        //outputs: {},
        codeHash: '0x' + '5'.repeat(64),
        executionHash: '0x' + '6'.repeat(64),
        timestamp: new Date(),
        agentName: 'TestAgent',
        verificationStatus: 'verified',
        //signature: '0x' + '4'.repeat(130),
        teeAttestation,
      };

      expect(proof.teeAttestation).toBeDefined();
      expect(proof.teeAttestation?.provider).toBe('phala');
      expect(proof.teeAttestation?.attestationData).toMatch(/^0x/);
      //expect(proof.teeAttestation?.publicKey).toMatch(/^0x/);
    });
  });

  describe('TEEAttestation Interface', () => {
    it('should support phala provider', () => {
      const attestation: TEEAttestation = {
        jobId: 'job-123',
        provider: 'phala',
        attestationData: '0xdata',
        verificationMethod: 'tee-ml' as VerificationMethod,
        executionHash: '0xhash',
        //publicKey: '0xkey',
        timestamp: new Date().toISOString(),
      };

      expect(attestation.provider).toBe('phala');
    });

    it('should support sgx provider', () => {
      const attestation: TEEAttestation = {
        jobId: 'job-123',
        provider: 'sgx',
        attestationData: '0xdata',
        executionHash: '0xhash',
        //publicKey: '0xkey',
        verificationMethod: 'tee-ml' as VerificationMethod,
        timestamp: new Date().toISOString(),
      };

      expect(attestation.provider).toBe('sgx');
    });

    it('should support nitro provider', () => {
      const attestation: TEEAttestation = {
        jobId: 'job-123',
        provider: 'nitro',
        executionHash: '0xhash',
        verificationMethod: 'zk-ml' as VerificationMethod,
        attestationData: '0xdata',

        //publicKey: '0xkey',
        timestamp: new Date().toISOString(),
      };

      expect(attestation.provider).toBe('nitro');
    });
  });

  describe('FeedbackParams Interface', () => {
    it('should accept valid feedback params', () => {
      const feedback: FeedbackParams = {
        agentId: 123n,
        rating: 95,
        feedbackUri: 'ipfs://QmFeedback',
        feedbackData: {
          comment: 'Excellent service',
          context: 'analysis',
        },
      };

      expect(feedback.agentId).toBe(123n);
      expect(feedback.rating).toBe(95);
      expect(feedback.feedbackUri).toBe('ipfs://QmFeedback');
    });

    it('should support optional feedbackData', () => {
      const feedback: FeedbackParams = {
        agentId: 456n,
        rating: 80,
        feedbackUri: 'ipfs://QmFeedback2',
      };

      expect(feedback.feedbackData).toBeUndefined();
    });
  });

  describe('FeedbackRecord Interface', () => {
    it('should accept valid feedback record', () => {
      const record: FeedbackRecord = {
        feedbackId: 1n,
        fromAgent: 123n,
        toAgent: 456n,
        rating: 95,
        feedbackUri: 'ipfs://QmFeedback',
        timestamp: Date.now(),
        revoked: false,
      };

      expect(record.feedbackId).toBe(1n);
      expect(record.fromAgent).toBe(123n);
      expect(record.toAgent).toBe(456n);
      expect(record.revoked).toBe(false);
    });
  });

  describe('ValidationRequest Interface', () => {
    it('should accept valid validation request', () => {
      const request: ValidationRequest = {
        requestId: 1n,
        requester: 123n,
        validator: 456n,
        requestUri: 'ipfs://QmValidation',
        requestHash: '0x' + '5'.repeat(64),
        status: 0, // PENDING
        timestamp: Date.now(),
      };

      expect(request.requestId).toBe(1n);
      expect(request.requester).toBe(123n);
      expect(request.validator).toBe(456n);
      expect(request.requestUri).toBe('ipfs://QmValidation');
      expect(request.requestHash).toMatch(/^0x/);
    });

    it('should support optional responseUri', () => {
      const request: ValidationRequest = {
        requestId: 2n,
        requester: 789n,
        validator: 456n,
        requestUri: 'ipfs://QmRequest',
        requestHash: '0x' + '6'.repeat(64),
        status: 1, // APPROVED
        responseUri: 'ipfs://QmResponse',
        timestamp: Date.now(),
      };

      expect(request.responseUri).toBe('ipfs://QmResponse');
      expect(request.status).toBe(1);
      expect(request.timestamp).toBeGreaterThan(0);
    });
  });

  describe('ValidationRequestParams Interface', () => {
    it('should accept valid validation request params', () => {
      const params: ValidationRequestParams = {
        validatorAgentId: 456n,
        requestUri: 'ipfs://QmValidation',
        requestHash: '0x' + '7'.repeat(64),
      };

      expect(params.validatorAgentId).toBe(456n);
      expect(params.requestUri).toBe('ipfs://QmValidation');
      expect(params.requestHash).toMatch(/^0x/);
    });
  });

  describe('Type Safety', () => {
    it('should enforce NetworkConfig type', () => {
      const network: NetworkConfig = NetworkConfig.BASE_SEPOLIA;
      expect(network).toBe('base-sepolia');
    });

    // DEPRECATED
    it('should enforce AgentRole type', () => {
      const role: AgentRole = AgentRole.VALIDATOR;
      expect(role).toBe('verifier');
    });

    it('should enforce bigint for agent IDs', () => {
      const agentId: bigint = 123n;
      expect(typeof agentId).toBe('bigint');
    });

    it('should enforce string for addresses', () => {
      const address: string = '0x' + '7'.repeat(40);
      expect(typeof address).toBe('string');
      expect(address.length).toBe(42);
    });
  });

  describe('UploadResult Interface', () => {
    it('should accept valid upload result', () => {
      const result: UploadResult = {
        cid: 'QmTest123',
        size: 1024,
        uri: 'ipfs://QmTest123',
        timestamp: Date.now(),
      };

      expect(result.cid).toBe('QmTest123');
      expect(result.size).toBe(1024);
      expect(result.uri).toBe('ipfs://QmTest123');
    });

    it('should support optional fields', () => {
      const result: UploadResult = {
        cid: 'QmTest456',
        size: 2048,
        uri: 'ipfs://QmTest456',
        timestamp: Date.now(),
      };

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Export Completeness', () => {
    it('should export all required types', () => {
      expect(NetworkConfig).toBeDefined();
      expect(AgentRole).toBeDefined();
    });

    it('should export all enums', () => {
      expect(typeof NetworkConfig).toBe('object');
      expect(typeof AgentRole).toBe('object');
    });

    it('should have proper enum values', () => {
      const networkValues = Object.values(NetworkConfig);
      const roleValues = Object.values(AgentRole);

      expect(networkValues.length).toBeGreaterThan(0);
      expect(roleValues.length).toBeGreaterThan(0);

      expect(networkValues.every((v) => typeof v === 'string')).toBe(true);
      expect(roleValues.every((v) => typeof v === 'string')).toBe(true);
    });
  });
});
