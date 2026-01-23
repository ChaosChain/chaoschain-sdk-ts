import { describe, it, expect } from 'vitest';
import { ChaosAgent } from '../src/ChaosAgent';
import { ethers } from 'ethers';
import { getContractAddresses } from '../src/utils/networks';

describe('ChaosAgent', () => {
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  describe('Initialization', () => {
    it('should initialize with signer and contract addresses for Ethereum Sepolia', () => {
      const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('ethereum-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(agent).toBeDefined();
    });

    it('should initialize for Base Sepolia', () => {
      const provider = new ethers.JsonRpcProvider('https://base-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('base-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(agent).toBeDefined();
    });

    it('should initialize for Linea Sepolia', () => {
      const provider = new ethers.JsonRpcProvider('https://linea-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('linea-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(agent).toBeDefined();
    });
  });

  describe('ERC-8004 Compliance', () => {
    it('should have registerIdentity method', () => {
      const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('ethereum-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(typeof agent.registerIdentity).toBe('function');
    });

    it('should have giveFeedback method', () => {
      const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('ethereum-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(typeof agent.giveFeedback).toBe('function');
    });

    it('should have requestValidation method', () => {
      const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('ethereum-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(typeof agent.requestValidation).toBe('function');
    });

    it('should have respondToValidation method', () => {
      const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('ethereum-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(typeof agent.respondToValidation).toBe('function');
    });

    it('should have getAgentMetadata method', () => {
      const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('ethereum-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(typeof agent.getAgentMetadata).toBe('function');
    });

    it('should have setAgentUri method', () => {
      const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('ethereum-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(typeof agent.setAgentUri).toBe('function');
    });

    it('should have generateFeedbackAuthorization method', () => {
      const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('ethereum-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(typeof agent.generateFeedbackAuthorization).toBe('function');
    });
  });

  describe('Contract Addresses', () => {
    it('should use correct network for Ethereum Sepolia', () => {
      const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('ethereum-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(agent).toBeDefined();
      expect(addresses.identity).toBeDefined();
      expect(addresses.reputation).toBeDefined();
      expect(addresses.validation).toBeDefined();
    });

    it('should use correct network for Base Sepolia', () => {
      const provider = new ethers.JsonRpcProvider('https://base-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('base-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(agent).toBeDefined();
      expect(addresses.identity).toBe('0x8004AA63c570c570eBF15376c0dB199918BFe9Fb');
      expect(addresses.reputation).toBe('0x8004bd8daB57f14Ed299135749a5CB5c42d341BF');
      expect(addresses.validation).toBe('0x8004C269D0A5647E51E121FeB226200ECE932d55');
    });

    it('should use correct network for Linea Sepolia', () => {
      const provider = new ethers.JsonRpcProvider('https://linea-sepolia.g.alchemy.com/v2/demo');
      const signer = new ethers.Wallet(testPrivateKey, provider);
      const addresses = getContractAddresses('linea-sepolia');
      const agent = new ChaosAgent(addresses, signer, provider);

      expect(agent).toBeDefined();
      expect(addresses.identity).toBe('0x8004aa7C931bCE1233973a0C6A667f73F66282e7');
      expect(addresses.reputation).toBe('0x8004bd8483b99310df121c46ED8858616b2Bba02');
      expect(addresses.validation).toBe('0x8004c44d1EFdd699B2A26e781eF7F77c56A9a4EB');
    });
  });
});
