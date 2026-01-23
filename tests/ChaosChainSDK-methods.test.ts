import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { NetworkConfig, AgentRole } from '../src/types';
import { ethers } from 'ethers';

describe('ChaosChainSDK Methods', () => {
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

  describe('Agent Registration', () => {
    it('should have registerIdentity method', () => {
      expect(typeof sdk.registerIdentity).toBe('function');
    });

    it('should have getAgentMetadata method', () => {
      expect(typeof sdk.getAgentMetadata).toBe('function');
    });

    it('should have updateAgentMetadata method', () => {
      expect(typeof sdk.updateAgentMetadata).toBe('function');
    });
  });

  describe('Reputation Methods', () => {
    it('should have generateFeedbackAuthorization method', () => {
      expect(typeof sdk.generateFeedbackAuthorization).toBe('function');
    });

    it('should have giveFeedback method', () => {
      expect(typeof sdk.giveFeedback).toBe('function');
    });

    it('should have getReputationScore method', () => {
      expect(typeof sdk.getReputationScore).toBe('function');
    });

    it('should have readAllFeedback method', () => {
      expect(typeof sdk.readAllFeedback).toBe('function');
    });

    it('should have getFeedbackSummary method', () => {
      expect(typeof sdk.getFeedbackSummary).toBe('function');
    });

    it('should have getClients method', () => {
      expect(typeof sdk.getClients).toBe('function');
    });
  });

  describe('Validation Methods', () => {
    it('should have requestValidation method', () => {
      expect(typeof sdk.requestValidation).toBe('function');
    });

    it('should have respondToValidation method', () => {
      expect(typeof sdk.respondToValidation).toBe('function');
    });

    it('should have getValidationStatus method', () => {
      expect(typeof sdk.getValidationStatus).toBe('function');
    });

    it('should have getValidationSummary method', () => {
      expect(typeof sdk.getValidationSummary).toBe('function');
    });

    it('should have getValidationStats method', () => {
      expect(typeof sdk.getValidationStats).toBe('function');
    });
  });

  describe('Payment Methods', () => {
    it('should have executeX402Payment method', () => {
      expect(typeof sdk.executeX402Payment).toBe('function');
    });

    it('should have getX402PaymentHistory method', () => {
      expect(typeof sdk.getX402PaymentHistory).toBe('function');
    });

    it('should have getETHBalance method', () => {
      expect(typeof sdk.getETHBalance).toBe('function');
    });

    it('should have getUSDCBalance method', () => {
      expect(typeof sdk.getUSDCBalance).toBe('function');
    });
  });

  describe('Google AP2 Methods', () => {
    it('should have createCartMandate method', () => {
      expect(typeof sdk.createCartMandate).toBe('function');
    });

    it('should have verifyJwtToken method', () => {
      expect(typeof sdk.verifyJwtToken).toBe('function');
    });
  });

  describe('Process Integrity Methods', () => {
    it('should have executeWithIntegrityProof method', () => {
      expect(typeof sdk.executeWithIntegrityProof).toBe('function');
    });

    it('should have verifyIntegrityProof method', () => {
      expect(typeof sdk.verifyIntegrityProof).toBe('function');
    });
  });

  describe('Storage Methods', () => {
    it('should have upload method', () => {
      expect(typeof sdk.upload).toBe('function');
    });

    it('should have download method', () => {
      expect(typeof sdk.download).toBe('function');
    });

    it('should have storeEvidence method', () => {
      expect(typeof sdk.storeEvidence).toBe('function');
    });
  });
});
