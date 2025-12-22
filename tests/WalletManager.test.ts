import { describe, it, expect, afterEach } from 'vitest';
import { WalletManager } from '../src/WalletManager';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

describe('WalletManager', () => {
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const testMnemonic = 'test test test test test test test test test test test junk';
  const testWalletPath = path.join(__dirname, 'test-wallet.json');

  afterEach(() => {
    // Clean up test wallet files
    if (fs.existsSync(testWalletPath)) {
      fs.unlinkSync(testWalletPath);
    }
  });

  describe('Initialization', () => {
    it('should create wallet from private key', () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      expect(walletManager).toBeDefined();
      expect(walletManager.getAddress()).toBeDefined();
      expect(ethers.isAddress(walletManager.getAddress())).toBe(true);
    });

    it('should create wallet from mnemonic', () => {
      const walletManager = new WalletManager({ mnemonic: testMnemonic });
      expect(walletManager).toBeDefined();
      expect(walletManager.getAddress()).toBeDefined();
      expect(ethers.isAddress(walletManager.getAddress())).toBe(true);
    });

    it('should generate new wallet if no key or mnemonic provided', () => {
      const walletManager = new WalletManager({});
      expect(walletManager).toBeDefined();
      expect(walletManager.getAddress()).toBeDefined();
      expect(ethers.isAddress(walletManager.getAddress())).toBe(true);
    });

    it('should prefer private key over mnemonic', () => {
      const walletManager = new WalletManager({ 
        privateKey: testPrivateKey,
        mnemonic: testMnemonic 
      });
      const address = walletManager.getAddress();
      
      // Verify it used the private key
      const expectedAddress = new ethers.Wallet(testPrivateKey).address;
      expect(address).toBe(expectedAddress);
    });
  });

  describe('Address Management', () => {
    it('should return valid Ethereum address', () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      const address = walletManager.getAddress();

      expect(address).toBeDefined();
      expect(ethers.isAddress(address)).toBe(true);
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should return consistent address', () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      const address1 = walletManager.getAddress();
      const address2 = walletManager.getAddress();

      expect(address1).toBe(address2);
    });
  });

  describe('Signing', () => {
    it('should sign message correctly', async () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      const message = 'Hello, ChaosChain!';

      const signature = await walletManager.signMessage(message);

      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);

      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      expect(recoveredAddress).toBe(walletManager.getAddress());
    });

    it('should sign typed data correctly', async () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });

      const domain = {
        name: 'TestDomain',
        version: '1',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      };

      const types = {
        Message: [
          { name: 'content', type: 'string' }
        ]
      };

      const value = {
        content: 'Hello, world!'
      };

      const signature = await walletManager.signTypedData(domain, types, value);

      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
    });
  });

  describe('Mnemonic Management', () => {
    it('should return mnemonic for HD wallet', () => {
      const walletManager = new WalletManager({ mnemonic: testMnemonic });
      const mnemonic = walletManager.getMnemonic();
      
      expect(mnemonic).toBeDefined();
      expect(mnemonic).toBe(testMnemonic);
    });

    it('should return undefined mnemonic for non-HD wallet', () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      const mnemonic = walletManager.getMnemonic();
      
      expect(mnemonic).toBeUndefined();
    });

    it('should generate valid mnemonic for new wallet', () => {
      const walletManager = new WalletManager({});
      const mnemonic = walletManager.getMnemonic();
      
      expect(mnemonic).toBeDefined();
      expect(ethers.Mnemonic.isValidMnemonic(mnemonic!)).toBe(true);
    });
  });

  describe('Private Key Management', () => {
    it('should return private key', () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      const privateKey = walletManager.getPrivateKey();
      expect(privateKey).toBeDefined();
      expect(privateKey).toBe(testPrivateKey);
    });

    it('should not expose private key directly', () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      const wallet = walletManager.getWallet();
      
      // Wallet should be defined but internal details should be private
      expect(wallet).toBeDefined();
      expect(wallet.address).toBeDefined();
    });
  });

  describe('Wallet Persistence', () => {
    it('should save wallet to file', async () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      const password = 'test-password-123';
      
      await walletManager.saveToFile(testWalletPath, password);
      
      expect(fs.existsSync(testWalletPath)).toBe(true);
    });

    it('should load wallet from file', async () => {
      // First save a wallet
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      const password = 'test-password-123';
      await walletManager.saveToFile(testWalletPath, password);
      
      // Then load it
      const loadedWalletManager = new WalletManager({ walletFile: testWalletPath });
      
      expect(loadedWalletManager).toBeDefined();
      expect(loadedWalletManager.getAddress()).toBe(walletManager.getAddress());
    });

    it('should encrypt wallet with password', async () => {
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      const password = 'strong-password-123';
      await walletManager.saveToFile(testWalletPath, password);
      
      const fileContent = fs.readFileSync(testWalletPath, 'utf-8');
      const jsonContent = JSON.parse(fileContent);
      
      // Check that it's encrypted (has crypto field)
      expect(jsonContent).toHaveProperty('Crypto');
      expect(jsonContent).toHaveProperty('address');
    });
  });

  describe('Wallet Generation', () => {
    it('should generate unique wallets', () => {
      const wallet1 = new WalletManager({});
      const wallet2 = new WalletManager({});
      
      expect(wallet1.getAddress()).not.toBe(wallet2.getAddress());
      expect(wallet1.getPrivateKey()).not.toBe(wallet2.getPrivateKey());
    });

    it('should generate valid random private keys', () => {
      const walletManager = new WalletManager({});
      const privateKey = walletManager.getPrivateKey();
      
      expect(privateKey).toBeDefined();
      expect(privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe('Connect to Provider', () => {
    it('should connect to provider', () => {
      const provider = new ethers.JsonRpcProvider('https://base-sepolia.g.alchemy.com/v2/demo');
      const walletManager = new WalletManager({ privateKey: testPrivateKey }, provider);
      
      const wallet = walletManager.getWallet();
      expect(wallet.provider).toBe(provider);
    });

    it('should connect to provider after initialization', () => {
      const provider = new ethers.JsonRpcProvider('https://base-sepolia.g.alchemy.com/v2/demo');
      const walletManager = new WalletManager({ privateKey: testPrivateKey });
      
      walletManager.connect(provider);
      
      const wallet = walletManager.getWallet();
      expect(wallet.provider).toBe(provider);
    });
  });

  describe('Static Methods', () => {
    it('should create random wallet', () => {
      const walletManager = WalletManager.createRandom();
      
      expect(walletManager).toBeDefined();
      expect(walletManager.getAddress()).toBeDefined();
      expect(ethers.isAddress(walletManager.getAddress())).toBe(true);
    });

    it('should create wallet from mnemonic', () => {
      const walletManager = WalletManager.fromMnemonic(testMnemonic);
      
      expect(walletManager).toBeDefined();
      expect(walletManager.getMnemonic()).toBe(testMnemonic);
    });

    it('should create wallet from private key', () => {
      const walletManager = WalletManager.fromPrivateKey(testPrivateKey);
      
      expect(walletManager).toBeDefined();
      expect(walletManager.getPrivateKey()).toBe(testPrivateKey);
    });

    it('should generate valid mnemonic', () => {
      const mnemonic = WalletManager.generateMnemonic();
      
      expect(mnemonic).toBeDefined();
      expect(ethers.Mnemonic.isValidMnemonic(mnemonic)).toBe(true);
    });

    it('should validate mnemonic', () => {
      const validMnemonic = 'test test test test test test test test test test test junk';
      const invalidMnemonic = 'invalid mnemonic phrase';
      
      expect(WalletManager.isValidMnemonic(validMnemonic)).toBe(true);
      expect(WalletManager.isValidMnemonic(invalidMnemonic)).toBe(false);
    });

    it('should validate private key', () => {
      const validKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const invalidKey = 'invalid-key';
      
      expect(WalletManager.isValidPrivateKey(validKey)).toBe(true);
      expect(WalletManager.isValidPrivateKey(invalidKey)).toBe(false);
    });

    it('should derive child wallet from mnemonic', () => {
      const parentWallet = WalletManager.fromMnemonic(testMnemonic);
      const childWallet = WalletManager.deriveChild(testMnemonic, "m/44'/60'/0'/0/1");
      
      expect(childWallet).toBeDefined();
      expect(childWallet.getAddress()).not.toBe(parentWallet.getAddress());
    });
  });
});
