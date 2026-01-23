/**
 * Pinata IPFS Storage Provider
 * Cloud-based IPFS pinning service
 */

import axios from 'axios';
import { StorageProvider, UploadOptions, UploadResult } from '../../types';

export interface PinataConfig {
  apiKey?: string;
  apiSecret?: string;
  jwt?: string;
  gatewayUrl?: string;
}

export class PinataStorage implements StorageProvider {
  private apiKey?: string;
  private apiSecret?: string;
  private jwt?: string;
  private gatewayUrl: string;
  private apiUrl: string = 'https://api.pinata.cloud';

  constructor(config: PinataConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.jwt = config.jwt;
    this.gatewayUrl = config.gatewayUrl || 'https://gateway.pinata.cloud';

    if (!this.jwt && (!this.apiKey || !this.apiSecret)) {
      throw new Error('Pinata requires either JWT or API key/secret');
    }
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): Record<string, string> {
    if (this.jwt) {
      return {
        Authorization: `Bearer ${this.jwt}`,
      };
    }
    return {
      pinata_api_key: this.apiKey!,
      pinata_secret_api_key: this.apiSecret!,
    };
  }

  /**
   * Upload data to Pinata
   */
  async upload(data: Buffer | string | object, options?: UploadOptions): Promise<UploadResult> {
    try {
      let buffer: Buffer;

      // Convert data to buffer
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (typeof data === 'string') {
        buffer = Buffer.from(data, 'utf-8');
      } else {
        buffer = Buffer.from(JSON.stringify(data), 'utf-8');
      }

      // Create form data
      const formData = new FormData();
      const blob = new Blob([buffer], { type: options?.mime || 'application/octet-stream' });
      formData.append('file', blob, 'file');

      // Add metadata if provided
      if (options?.metadata) {
        formData.append('pinataMetadata', JSON.stringify(options.metadata));
      }

      // Upload to Pinata
      const response = await axios.post(`${this.apiUrl}/pinning/pinFileToIPFS`, formData, {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      });

      const cid = response.data.IpfsHash;

      return {
        cid,
        uri: `ipfs://${cid}`,
        size: response.data.PinSize,
      };
    } catch (error) {
      throw new Error(`Failed to upload to Pinata: ${(error as Error).message}`);
    }
  }

  /**
   * Download data from Pinata gateway
   */
  async download(cid: string): Promise<Buffer> {
    try {
      const response = await axios.get(`${this.gatewayUrl}/ipfs/${cid}`, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download from Pinata: ${(error as Error).message}`);
    }
  }

  /**
   * Pin existing IPFS content
   */
  async pin(cid: string): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/pinning/pinByHash`,
        {
          hashToPin: cid,
        },
        {
          headers: this.getHeaders(),
        }
      );
    } catch (error) {
      throw new Error(`Failed to pin content: ${(error as Error).message}`);
    }
  }

  /**
   * Unpin content
   */
  async unpin(cid: string): Promise<void> {
    try {
      await axios.delete(`${this.apiUrl}/pinning/unpin/${cid}`, {
        headers: this.getHeaders(),
      });
    } catch (error) {
      throw new Error(`Failed to unpin content: ${(error as Error).message}`);
    }
  }

  /**
   * Test authentication
   */
  async testAuthentication(): Promise<boolean> {
    try {
      await axios.get(`${this.apiUrl}/data/testAuthentication`, {
        headers: this.getHeaders(),
      });
      return true;
    } catch {
      return false;
    }
  }
}
