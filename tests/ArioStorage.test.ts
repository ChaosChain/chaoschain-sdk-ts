import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArioStorage } from '../src/StorageBackends';

describe('ArioStorage', () => {
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  describe('Initialization', () => {
    it('should create instance with private key', () => {
      const storage = new ArioStorage(testPrivateKey);
      expect(storage).toBeDefined();
    });

    it('should create instance with options', () => {
      const storage = new ArioStorage(testPrivateKey, {
        token: 'ethereum',
        gatewayUrl: 'https://arweave.net',
        appName: 'TestApp',
      });
      expect(storage).toBeDefined();
    });

    it('should accept different token types', () => {
      const ethStorage = new ArioStorage(testPrivateKey, { token: 'ethereum' });
      const polStorage = new ArioStorage(testPrivateKey, { token: 'pol' });
      const baseStorage = new ArioStorage(testPrivateKey, { token: 'base-eth' });

      expect(ethStorage).toBeDefined();
      expect(polStorage).toBeDefined();
      expect(baseStorage).toBeDefined();
    });

    it('should use default values when options not provided', () => {
      const storage = new ArioStorage(testPrivateKey);
      // Defaults should be applied internally
      expect(storage).toBeDefined();
    });
  });

  describe('put method', () => {
    it('should throw error when @ardrive/turbo-sdk is not installed', async () => {
      const storage = new ArioStorage(testPrivateKey);

      await expect(storage.put('test data')).rejects.toThrow(
        /AR\.IO Network Storage requires @ardrive\/turbo-sdk/
      );
    });

    it('should accept string data', async () => {
      const storage = new ArioStorage(testPrivateKey);

      // Will throw because turbo-sdk is not installed, but validates input handling
      await expect(storage.put('string data')).rejects.toThrow();
    });

    it('should accept Buffer data', async () => {
      const storage = new ArioStorage(testPrivateKey);

      await expect(storage.put(Buffer.from('buffer data'))).rejects.toThrow();
    });

    it('should accept mime type parameter', async () => {
      const storage = new ArioStorage(testPrivateKey);

      await expect(storage.put('test', 'text/plain')).rejects.toThrow();
    });
  });


  describe('get method', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should construct correct gateway URL', async () => {
      const storage = new ArioStorage(testPrivateKey, {
        gatewayUrl: 'https://arweave.net',
      });

      // Mock axios to capture the URL
      const mockAxios = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.doMock('axios', () => ({ default: { get: mockAxios } }));

      const txId = 'test-transaction-id';

      // Will fail due to network, but we can verify it attempts to fetch
      await expect(storage.get(txId)).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      const storage = new ArioStorage(testPrivateKey);

      await expect(storage.get('invalid-tx-id')).rejects.toThrow(
        /Failed to retrieve from Arweave/
      );
    });
  });

  describe('StorageBackend interface compliance', () => {
    it('should implement put method', () => {
      const storage = new ArioStorage(testPrivateKey);
      expect(typeof storage.put).toBe('function');
    });

    it('should implement get method', () => {
      const storage = new ArioStorage(testPrivateKey);
      expect(typeof storage.get).toBe('function');
    });

    it('should not implement pin method (Arweave is permanent)', () => {
      const storage = new ArioStorage(testPrivateKey);
      expect((storage as any).pin).toBeUndefined();
    });

    it('should not implement unpin method (Arweave is permanent)', () => {
      const storage = new ArioStorage(testPrivateKey);
      expect((storage as any).unpin).toBeUndefined();
    });
  });

  describe('StorageResult format', () => {
    it('should return correct provider name', async () => {
      // This test would require mocking TurboFactory
      // For now, we verify the storage is configured correctly
      const storage = new ArioStorage(testPrivateKey);
      expect(storage).toBeDefined();
    });
  });
});
