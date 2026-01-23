/**
 * Local IPFS Storage Provider
 * Uses HTTP API client to interact with local IPFS daemon
 */

import axios from 'axios';
import { StorageProvider, UploadOptions, UploadResult } from '../../types';

export class IPFSLocalStorage implements StorageProvider {
  private apiUrl: string;
  private gatewayUrl: string;

  constructor(
    apiUrl: string = 'http://localhost:5001',
    gatewayUrl: string = 'http://localhost:8080'
  ) {
    this.apiUrl = apiUrl;
    this.gatewayUrl = gatewayUrl;
  }

  /**
   * Upload data to local IPFS
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
      formData.append('file', blob);

      // Upload to IPFS
      const response = await axios.post(`${this.apiUrl}/api/v0/add`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        params: {
          pin: options?.pin !== false, // Pin by default
        },
      });

      const cid = response.data.Hash;

      return {
        cid,
        uri: `ipfs://${cid}`,
        size: response.data.Size,
      };
    } catch (error) {
      throw new Error(`Failed to upload to IPFS: ${(error as Error).message}`);
    }
  }

  /**
   * Download data from IPFS
   */
  async download(cid: string): Promise<Buffer> {
    try {
      const response = await axios.get(`${this.gatewayUrl}/ipfs/${cid}`, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to download from IPFS: ${(error as Error).message}`);
    }
  }

  /**
   * Pin content
   */
  async pin(cid: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/api/v0/pin/add`, null, {
        params: { arg: cid },
      });
    } catch (error) {
      throw new Error(`Failed to pin content: ${(error as Error).message}`);
    }
  }

  /**
   * Unpin content
   */
  async unpin(cid: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/api/v0/pin/rm`, null, {
        params: { arg: cid },
      });
    } catch (error) {
      throw new Error(`Failed to unpin content: ${(error as Error).message}`);
    }
  }

  /**
   * Check if IPFS daemon is running
   */
  async isAvailable(): Promise<boolean> {
    try {
      await axios.post(`${this.apiUrl}/api/v0/version`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get IPFS version
   */
  async getVersion(): Promise<string> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/v0/version`);
      return response.data.Version;
    } catch (error) {
      throw new Error(`Failed to get IPFS version: ${(error as Error).message}`);
    }
  }
}
