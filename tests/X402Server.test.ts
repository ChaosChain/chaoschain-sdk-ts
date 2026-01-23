import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { X402Server } from '../src/X402Server';
import { X402PaymentManager } from '../src/X402PaymentManager';
import { NetworkConfig } from '../src/types';
import { ethers } from 'ethers';

describe('X402Server', () => {
  let server: X402Server;
  let paymentManager: X402PaymentManager;
  let mockWallet: ethers.Wallet;

  beforeEach(() => {
    mockWallet = ethers.Wallet.createRandom();
    paymentManager = new X402PaymentManager(mockWallet, NetworkConfig.ETHEREUM_SEPOLIA, {});
    server = new X402Server(paymentManager, { port: 0 }); // Use random port
  });

  afterEach(async () => {
    if (server && server['server']) {
      try {
        await server.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }
  });

  it('should initialize X402Server', () => {
    expect(server).toBeInstanceOf(X402Server);
  });

  it('should register payment-protected endpoint', () => {
    const handler = (data: any) => ({ result: 'success', data });
    const decorated = server.requirePayment(10, 'Test endpoint', 'USDC')(handler);

    expect(decorated).toBe(handler);
    expect(server['endpoints'].size).toBeGreaterThan(0);
  });

  it('should start server', () => {
    server.start();
    expect(server['server']).toBeDefined();
  });

  it('should not start server twice', () => {
    server.start();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    server.start();
    expect(consoleSpy).toHaveBeenCalledWith('⚠️  Server already running');
    consoleSpy.mockRestore();
  });

  it('should stop server', async () => {
    server.start();
    expect(server['server']).toBeDefined();

    // Wait a bit for server to fully start
    await new Promise((resolve) => setTimeout(resolve, 50));

    await server.stop();
    // Server should be null after stopping
    expect(server['server']).toBeNull();
  });

  it('should handle stop when not running', async () => {
    await expect(server.stop()).resolves.not.toThrow();
  });

  it('should get server stats', () => {
    const handler = (data: any) => ({ result: 'success' });
    server.requirePayment(10, 'Test', 'USDC')(handler);

    const stats = server.getServerStats();

    expect(stats.running).toBe(false);
    expect(stats.endpoints.length).toBeGreaterThan(0);
    expect(stats.payments_cached).toBe(0);
    expect(stats.default_currency).toBe('USDC');
  });

  it('should clear payment cache', () => {
    server['paymentCache'].set('tx1', {} as any);
    expect(server['paymentCache'].size).toBe(1);

    server.clearPaymentCache();
    expect(server['paymentCache'].size).toBe(0);
  });

  it('should use custom host and port', () => {
    const customServer = new X402Server(paymentManager, {
      port: 8080,
      host: '127.0.0.1',
      defaultCurrency: 'ETH',
    });

    expect(customServer['config'].port).toBe(8080);
    expect(customServer['config'].host).toBe('127.0.0.1');
    expect(customServer['config'].defaultCurrency).toBe('ETH');
  });
});
