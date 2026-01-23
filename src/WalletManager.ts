/**
 * Wallet management for ChaosChain SDK
 * Handles private keys, HD wallets, and secure key storage
 */

import { ethers } from 'ethers';
import { WalletConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';
// import * as crypto from 'crypto';

export class WalletManager {
  private wallet: ethers.Wallet | ethers.HDNodeWallet;
  private provider?: ethers.Provider;

  constructor(config: WalletConfig, provider?: ethers.Provider) {
    this.wallet = this.initializeWallet(config);
    this.provider = provider;

    if (provider) {
      this.wallet = this.wallet.connect(provider) as ethers.Wallet | ethers.HDNodeWallet;
    }
  }

  /**
   * Initialize wallet from various sources
   */
  private initializeWallet(config: WalletConfig): ethers.Wallet | ethers.HDNodeWallet {
    if (config.privateKey) {
      return new ethers.Wallet(config.privateKey);
    }

    if (config.mnemonic) {
      return ethers.Wallet.fromPhrase(config.mnemonic);
    }

    if (config.walletFile) {
      try {
        const walletData = fs.readFileSync(config.walletFile, 'utf8');
        const data = JSON.parse(walletData);

        // Check if encrypted (has crypto field)
        if (data.crypto || data.Crypto) {
          throw new Error(
            'Encrypted wallets require password. Use WalletManager.loadFromFile() with password.'
          );
        }

        if (!data.privateKey) {
          throw new Error('Invalid wallet file: missing privateKey');
        }

        return new ethers.Wallet(data.privateKey);
      } catch (error) {
        throw new Error(`Failed to load wallet from file: ${(error as Error).message}`);
      }
    }

    // Generate new random wallet
    return ethers.Wallet.createRandom() as ethers.Wallet | ethers.HDNodeWallet;
  }

  /**
   * Static method to load wallet from encrypted file (with password)
   */
  static async loadFromFile(filePath: string, password: string): Promise<ethers.Wallet | ethers.HDNodeWallet> {
    try {
      const walletData = fs.readFileSync(filePath, 'utf8');

      // Try to parse as JSON first
      let data: any;
      try {
        data = JSON.parse(walletData);
      } catch {
        // If not JSON, might be encrypted format - try decrypting directly
        return await ethers.Wallet.fromEncryptedJson(walletData, password) as ethers.Wallet | ethers.HDNodeWallet;
      }

      // Check if encrypted format (has Crypto field)
      if (data.Crypto || data.crypto) {
        return await ethers.Wallet.fromEncryptedJson(walletData, password) as ethers.Wallet | ethers.HDNodeWallet;
      }

      // Plain JSON format - shouldn't need password
      if (!data.privateKey) {
        throw new Error('Invalid wallet file: missing privateKey');
      }

      return new ethers.Wallet(data.privateKey);
    } catch (error) {
      throw new Error(`Failed to load wallet from file: ${(error as Error).message}`);
    }
  }

  /**
   * Load wallet from encrypted file (private instance method)
   * @deprecated Use static WalletManager.loadFromFile() instead
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private loadFromFile(_filePath: string): ethers.Wallet {
    try {
      const walletData = fs.readFileSync(_filePath, 'utf8');
      const data = JSON.parse(walletData);

      if (data.encrypted) {
        throw new Error('Encrypted wallets require password (not yet implemented)');
      }

      return new ethers.Wallet(data.privateKey);
    } catch (error) {
      throw new Error(`Failed to load wallet from file: ${(error as Error).message}`);
    }
  }

  /**
   * Save wallet to encrypted file
   */
  async saveToFile(filePath: string, password?: string): Promise<void> {
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (password) {
      // Use ethers built-in encryption
      const encrypted = await this.wallet.encrypt(password);
      fs.writeFileSync(filePath, encrypted, 'utf8');
    } else {
      // Save unencrypted (not recommended for production)
      const data = {
        address: this.wallet.address,
        privateKey: this.wallet.privateKey,
        mnemonic: 'mnemonic' in this.wallet && this.wallet.mnemonic ? this.wallet.mnemonic.phrase : undefined,
        encrypted: false,
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
  }

  /**
   * Get wallet instance
   */
  getWallet(): ethers.Wallet | ethers.HDNodeWallet {
    return this.wallet;
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get private key (use with caution)
   */
  getPrivateKey(): string {
    return this.wallet.privateKey;
  }

  /**
   * Get mnemonic phrase (if available)
   */
  getMnemonic(): string | undefined {
    return 'mnemonic' in this.wallet && this.wallet.mnemonic ? this.wallet.mnemonic.phrase : undefined;
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message);
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    return this.wallet.signTypedData(domain, types, value);
  }

  /**
   * Get balance
   */
  async getBalance(): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Provider not set');
    }
    return this.provider.getBalance(this.wallet.address);
  }

  /**
   * Get nonce
   */
  async getNonce(): Promise<number> {
    if (!this.provider) {
      throw new Error('Provider not set');
    }
    return this.provider.getTransactionCount(this.wallet.address);
  }

  /**
   * Connect to a new provider
   */
  connect(provider: ethers.Provider): void {
    this.provider = provider;
    this.wallet = this.wallet.connect(provider) as ethers.Wallet | ethers.HDNodeWallet;
  }

  /**
   * Generate a new random wallet
   */
  static createRandom(): WalletManager {
    const wallet = ethers.Wallet.createRandom();
    return new WalletManager({ privateKey: wallet.privateKey });
  }

  /**
   * Create from mnemonic
   */
  static fromMnemonic(mnemonic: string, provider?: ethers.Provider): WalletManager {
    return new WalletManager({ mnemonic }, provider);
  }

  /**
   * Create from private key
   */
  static fromPrivateKey(privateKey: string, provider?: ethers.Provider): WalletManager {
    return new WalletManager({ privateKey }, provider);
  }

  /**
   * Generate new mnemonic
   */
  static generateMnemonic(): string {
    const wallet = ethers.Wallet.createRandom();
    return 'mnemonic' in wallet && wallet.mnemonic ? wallet.mnemonic.phrase : '';
  }

  /**
   * Validate mnemonic
   */
  static isValidMnemonic(mnemonic: string): boolean {
    try {
      ethers.Wallet.fromPhrase(mnemonic);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate private key
   */
  static isValidPrivateKey(privateKey: string): boolean {
    try {
      new ethers.Wallet(privateKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Derive child wallet from HD path
   */
  static deriveChild(mnemonic: string, path: string): WalletManager {
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
    return new WalletManager({ privateKey: hdNode.privateKey });
  }
}
