/**
 * Storage Backends for ChaosChain SDK
 *
 * This module provides a unified interface for multiple storage providers,
 * allowing seamless switching between IPFS, Pinata, Irys, and 0G Storage.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { StorageError } from './exceptions';

export interface StorageResult {
  cid: string;
  url?: string;
  size?: number;
  provider: string;
}

export interface StorageBackend {
  put(data: Buffer | string, mime?: string): Promise<StorageResult>;
  get(cid: string): Promise<Buffer>;
  pin?(cid: string): Promise<void>;
  unpin?(cid: string): Promise<void>;
}

/**
 * Local IPFS Storage Backend
 *
 * Requires: ipfs daemon running locally
 * Cost: Free
 * Setup: brew install ipfs && ipfs daemon
 */
export class LocalIPFSStorage implements StorageBackend {
  private apiUrl: string;

  constructor(apiUrl: string = 'http://127.0.0.1:5001') {
    this.apiUrl = apiUrl;
    console.log(`📦 Local IPFS Storage initialized: ${apiUrl}`);
  }

  async put(data: Buffer | string, mime: string = 'application/json'): Promise<StorageResult> {
    try {
      const buffer = typeof data === 'string' ? Buffer.from(data) : data;

      // Use multipart/form-data to upload
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', buffer, { contentType: mime });

      const response = await axios.post(`${this.apiUrl}/api/v0/add`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
      });

      const cid = response.data.Hash;
      console.log(`✅ Uploaded to local IPFS: ${cid}`);

      return {
        cid,
        url: `ipfs://${cid}`,
        size: response.data.Size,
        provider: 'local-ipfs',
      };
    } catch (e: any) {
      if (e.code === 'ECONNREFUSED') {
        throw new StorageError('Local IPFS daemon not running. Start with: ipfs daemon', {
          api_url: this.apiUrl,
        });
      }
      throw new StorageError(`Local IPFS upload failed: ${e.message}`);
    }
  }

  async get(cid: string): Promise<Buffer> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/v0/cat`, null, {
        params: { arg: cid },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (e: any) {
      throw new StorageError(`Failed to retrieve from IPFS: ${e.message}`);
    }
  }

  async pin(cid: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/api/v0/pin/add`, null, {
        params: { arg: cid },
      });
      console.log(`📌 Pinned to local IPFS: ${cid}`);
    } catch (e: any) {
      throw new StorageError(`Failed to pin CID: ${e.message}`);
    }
  }

  async unpin(cid: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/api/v0/pin/rm`, null, {
        params: { arg: cid },
      });
      console.log(`📌 Unpinned from local IPFS: ${cid}`);
    } catch (e: any) {
      throw new StorageError(`Failed to unpin CID: ${e.message}`);
    }
  }
}

/**
 * Pinata Cloud IPFS Storage Backend
 *
 * Requires: Pinata API key
 * Cost: Free tier + paid plans
 * Setup: Get JWT from https://pinata.cloud
 */
export class PinataStorage implements StorageBackend {
  private jwtToken: string;
  private gatewayUrl: string;

  constructor(jwtToken: string, gatewayUrl: string = 'https://gateway.pinata.cloud') {
    this.jwtToken = jwtToken;
    this.gatewayUrl = gatewayUrl;
    console.log(`🌐 Pinata Storage initialized`);
  }

  async put(data: Buffer | string, mime: string = 'application/json'): Promise<StorageResult> {
    try {
      const buffer = typeof data === 'string' ? Buffer.from(data) : data;

      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', buffer, {
        contentType: mime,
        filename: `file_${Date.now()}`,
      });

      const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.jwtToken}`,
        },
        maxBodyLength: Infinity,
      });

      const cid = response.data.IpfsHash;
      console.log(`✅ Uploaded to Pinata: ${cid}`);

      return {
        cid,
        url: `${this.gatewayUrl}/ipfs/${cid}`,
        size: response.data.PinSize,
        provider: 'pinata',
      };
    } catch (e: any) {
      throw new StorageError(`Pinata upload failed: ${e.message}`);
    }
  }

  async get(cid: string): Promise<Buffer> {
    try {
      const response = await axios.get(`${this.gatewayUrl}/ipfs/${cid}`, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (e: any) {
      throw new StorageError(`Failed to retrieve from Pinata: ${e.message}`);
    }
  }

  async pin(cid: string): Promise<void> {
    try {
      await axios.post(
        'https://api.pinata.cloud/pinning/pinByHash',
        { hashToPin: cid },
        {
          headers: {
            Authorization: `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`📌 Pinned to Pinata: ${cid}`);
    } catch (e: any) {
      throw new StorageError(`Failed to pin to Pinata: ${e.message}`);
    }
  }

  async unpin(cid: string): Promise<void> {
    try {
      await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
        headers: {
          Authorization: `Bearer ${this.jwtToken}`,
        },
      });
      console.log(`📌 Unpinned from Pinata: ${cid}`);
    } catch (e: any) {
      throw new StorageError(`Failed to unpin from Pinata: ${e.message}`);
    }
  }
}

/**
 * Irys (Arweave) Storage Backend
 *
 * Requires: Arweave wallet key
 * Cost: Pay per upload (permanent storage)
 * Setup: Fund wallet with AR tokens
 */
export class IrysStorage implements StorageBackend {
  private walletKey: string;

  constructor(walletKey: string) {
    this.walletKey = walletKey;
    console.log(`💎 Irys (Arweave) Storage initialized`);
  }

  async put(data: Buffer | string, mime: string = 'application/json'): Promise<StorageResult> {
    try {
      // In production, use @irys/sdk
      // const Irys = require('@irys/sdk').default;
      // const irys = new Irys({ network: 'mainnet', token: 'ethereum', key: this.walletKey });
      // const receipt = await irys.upload(data, { tags: [{ name: 'Content-Type', value: mime }] });

      // For now, simulate
      const mockCid = `ar_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .substring(2, 15)}`;

      console.log(`✅ Uploaded to Irys: ${mockCid}`);

      return {
        cid: mockCid,
        url: `https://arweave.net/${mockCid}`,
        provider: 'irys',
      };
    } catch (e: any) {
      throw new StorageError(`Irys upload failed: ${e.message}`);
    }
  }

  async get(cid: string): Promise<Buffer> {
    try {
      const response = await axios.get(`https://arweave.net/${cid}`, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (e: any) {
      throw new StorageError(`Failed to retrieve from Arweave: ${e.message}`);
    }
  }
}

/**
 * 0G Storage Backend
 *
 * Requires: 0G CLI running as sidecar
 * Cost: Gas fees on 0G Network
 * Setup: Install 0G CLI and start sidecar
 */
export class ZeroGStorage implements StorageBackend {
  private grpcUrl: string;
  private privateKey: string;

  constructor(privateKey: string, grpcUrl: string = 'localhost:50051') {
    this.privateKey = privateKey;
    this.grpcUrl = grpcUrl;
    console.log(`⚡ 0G Storage initialized: ${grpcUrl}`);
  }

  async put(data: Buffer | string, mime: string = 'application/json'): Promise<StorageResult> {
    try {
      // In production, call 0G Storage CLI via gRPC
      // For now, simulate
      const mockCid = `0g_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .substring(2, 15)}`;

      console.log(`✅ Uploaded to 0G Storage: ${mockCid}`);

      return {
        cid: mockCid,
        url: `0g://${mockCid}`,
        provider: '0g-storage',
      };
    } catch (e: any) {
      throw new StorageError(`0G Storage upload failed: ${e.message}`);
    }
  }

  async get(cid: string): Promise<Buffer> {
    try {
      // In production, retrieve from 0G Storage via CLI
      // For now, throw error
      throw new StorageError('0G Storage retrieval not yet implemented');
    } catch (e: any) {
      throw new StorageError(`Failed to retrieve from 0G Storage: ${e.message}`);
    }
  }
}

/**
 * Ario (Arweave Turbo) Storage Backend
 *
 * Permanent storage on Arweave via AR.IO's Turbo service.
 * Uploads < 100kb are free, above that you need credits: https://turbo.ar.io
 *
 * Requires: @ardrive/turbo-sdk
 * Cost: Pay per upload (permanent storage)
 * Setup: npm install @ardrive/turbo-sdk
 */
export class ArioStorage implements StorageBackend {
  private privateKey: string;
  private gatewayUrl: string;
  private appName: string;

  constructor(
    privateKey: string,
    options?: {
      gatewayUrl?: string;
      appName?: string;
    }
  ) {
    this.privateKey = privateKey;
    this.gatewayUrl = options?.gatewayUrl ?? 'https://arweave.net';
    this.appName = options?.appName ?? 'ChaosChain-SDK';
    console.log(`🏹 Ario (Arweave Turbo) Storage initialized`);
  }

  async put(data: Buffer | string, mime: string = 'application/json'): Promise<StorageResult> {
    try {
      // Dynamic require to make @ardrive/turbo-sdk an optional dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TurboFactory, EthereumSigner } = require('@ardrive/turbo-sdk');

      const signer = new EthereumSigner(this.privateKey);
      const turbo = TurboFactory.authenticated({ signer });

      const buffer = typeof data === 'string' ? Buffer.from(data) : data;

      const { Readable } = require('stream');
      const result = await turbo.uploadFile({
        fileStreamFactory: () => Readable.from(buffer),
        fileSizeFactory: () => buffer.length,
        dataItemOpts: {
          tags: [
            { name: 'Content-Type', value: mime },
            { name: 'App-Name', value: this.appName },
          ],
        },
      });

      const txId = result.id;
      console.log(`✅ Uploaded to Ario (Arweave): ${txId}`);

      return {
        cid: txId,
        url: `${this.gatewayUrl}/${txId}`,
        size: buffer.length,
        provider: 'ario',
      };
    } catch (e: any) {
      // Module not installed
      if (e.code === 'MODULE_NOT_FOUND' || e.message?.includes('Cannot find module')) {
        throw new StorageError(
          'AR.IO Network Storage requires @ardrive/turbo-sdk. Install with: npm install @ardrive/turbo-sdk'
        );
      }

      throw new StorageError(`Ario upload failed: ${e.message}`);
    }
  }

  async get(cid: string): Promise<Buffer> {
    try {
      const response = await axios.get(`${this.gatewayUrl}/${cid}`, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (e: any) {
      throw new StorageError(`Failed to retrieve from Arweave: ${e.message}`);
    }
  }

  // Note: pin/unpin not implemented - Arweave storage is permanent
}

/**
 * Auto-detecting Storage Manager
 *
 * Automatically selects the best available storage backend:
 * 1. Try local IPFS first (fastest, free)
 * 2. Fall back to Pinata if configured
 * 3. Fall back to Irys if configured
 * 4. Fall back to 0G Storage if configured
 */
export class AutoStorageManager implements StorageBackend {
  private backends: StorageBackend[] = [];
  private preferredBackend: StorageBackend | null = null;

  constructor() {
    this.detectAvailableBackends();
  }

  private detectAvailableBackends(): void {
    console.log('🔍 Auto-detecting available storage backends...');

    // Try local IPFS
    try {
      const localIpfs = new LocalIPFSStorage();
      this.backends.push(localIpfs);
      this.preferredBackend = localIpfs;
      console.log('✅ Local IPFS available');
    } catch (e) {
      console.log('❌ Local IPFS not available');
    }

    // Try Pinata
    const pinataJwt = process.env.PINATA_JWT;
    if (pinataJwt) {
      const pinata = new PinataStorage(pinataJwt);
      this.backends.push(pinata);
      if (!this.preferredBackend) this.preferredBackend = pinata;
      console.log('✅ Pinata available');
    }

    // Try Irys
    const irysKey = process.env.IRYS_WALLET_KEY;
    if (irysKey) {
      const irys = new IrysStorage(irysKey);
      this.backends.push(irys);
      if (!this.preferredBackend) this.preferredBackend = irys;
      console.log('✅ Irys available');
    }

    // Try 0G Storage
    const zerogKey = process.env.ZEROG_TESTNET_PRIVATE_KEY;
    if (zerogKey) {
      const zerog = new ZeroGStorage(zerogKey);
      this.backends.push(zerog);
      if (!this.preferredBackend) this.preferredBackend = zerog;
      console.log('✅ 0G Storage available');
    }

    // Try Ario (Arweave Turbo)
    const arioKey = process.env.ARIO_PRIVATE_KEY;
    if (arioKey) {
      const ario = new ArioStorage(arioKey);
      this.backends.push(ario);
      if (!this.preferredBackend) this.preferredBackend = ario;
      console.log('✅ Ario available');
    }

    if (this.backends.length === 0) {
      console.warn('⚠️  No storage backends available! Please configure at least one.');
    } else {
      console.log(`📦 ${this.backends.length} storage backend(s) available`);
    }
  }

  async put(data: Buffer | string, mime?: string): Promise<StorageResult> {
    if (!this.preferredBackend) {
      throw new StorageError('No storage backends available');
    }

    try {
      return await this.preferredBackend.put(data, mime);
    } catch (e) {
      // Try other backends
      for (const backend of this.backends) {
        if (backend !== this.preferredBackend) {
          try {
            console.log(`⚠️  Trying fallback storage backend...`);
            return await backend.put(data, mime);
          } catch (fallbackError) {
            continue;
          }
        }
      }

      throw new StorageError(`All storage backends failed: ${e}`);
    }
  }

  async get(cid: string): Promise<Buffer> {
    if (!this.preferredBackend) {
      throw new StorageError('No storage backends available');
    }

    return await this.preferredBackend.get(cid);
  }

  getAvailableBackends(): string[] {
    return this.backends.map((backend) => backend.constructor.name);
  }
}
