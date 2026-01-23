import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentManager, PaymentMethod } from '../src/PaymentManager';
import { NetworkConfig } from '../src/types';
import { ethers } from 'ethers';
import axios from 'axios';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    create: vi.fn(() => ({
      post: vi.fn(),
    })),
  },
}));

const mockedAxios = axios as any;

describe('PaymentManager', () => {
  let paymentManager: PaymentManager;
  let mockWallet: ethers.Wallet;

  beforeEach(() => {
    mockWallet = ethers.Wallet.createRandom();
    paymentManager = new PaymentManager(
      'TestAgent',
      NetworkConfig.ETHEREUM_SEPOLIA,
      mockWallet,
      {}
    );
  });

  it('should initialize PaymentManager', () => {
    expect(paymentManager).toBeInstanceOf(PaymentManager);
  });

  it('should initialize with Stripe credentials', () => {
    const pm = new PaymentManager('TestAgent', NetworkConfig.ETHEREUM_SEPOLIA, mockWallet, {
      stripe_secret_key: 'sk_test_123',
    });
    expect(pm).toBeDefined();
  });

  it('should initialize with PayPal credentials', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { access_token: 'paypal-token' },
    });

    const pm = new PaymentManager('TestAgent', NetworkConfig.ETHEREUM_SEPOLIA, mockWallet, {
      paypal_client_id: 'client-id',
      paypal_client_secret: 'client-secret',
    });

    // Wait for PayPal initialization
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(pm).toBeDefined();
  });

  it('should get supported payment methods', () => {
    const methods = paymentManager.getSupportedPaymentMethods();
    expect(Array.isArray(methods)).toBe(true);
    expect(methods.length).toBeGreaterThan(0);
  });

  it('should process basic card payment', () => {
    const pm = new PaymentManager('TestAgent', NetworkConfig.ETHEREUM_SEPOLIA, mockWallet, {
      stripe_secret_key: 'sk_test_123',
    });

    // processPayment doesn't exist, use executeTraditionalPayment
    const result = pm.executeTraditionalPayment(PaymentMethod.BASIC_CARD, 10, 'USD', {
      token: 'tok_123',
    });

    expect(result).toBeDefined();
    expect(result.payment_id).toBeDefined();
    expect(result.payment_method).toBe(PaymentMethod.BASIC_CARD);
  });

  it('should get payment methods status', () => {
    const pm = new PaymentManager('TestAgent', NetworkConfig.ETHEREUM_SEPOLIA, mockWallet, {
      stripe_secret_key: 'sk_test_123',
    });

    const status = pm.getPaymentMethodsStatus();
    expect(status[PaymentMethod.BASIC_CARD]).toBe(true);
    expect(status[PaymentMethod.A2A_X402]).toBe(true);
  });

  it('should validate credentials', async () => {
    const mockStripeInstance = {
      get: vi.fn().mockResolvedValue({ data: {} }),
    };
    mockedAxios.create.mockReturnValue(mockStripeInstance as any);

    const pm = new PaymentManager('TestAgent', NetworkConfig.ETHEREUM_SEPOLIA, mockWallet, {
      stripe_secret_key: 'sk_test_123',
    });

    const results = await pm.validateCredentials();
    expect(results).toBeDefined();
    expect(typeof results.stripe).toBe('boolean');
  });

  it('should create x402 payment request', () => {
    const request = paymentManager.createX402PaymentRequest(
      '0xFrom',
      '0xTo',
      10,
      'USDC',
      'Test service'
    );

    expect(request).toBeDefined();
    expect(request.amount).toBe(10);
    expect(request.currency).toBe('USDC');
  });

  it('should get payment stats', () => {
    const stats = paymentManager.getPaymentStats();
    expect(stats).toBeDefined();
    expect(stats.agent_name).toBe('TestAgent');
    expect(stats.supported_methods).toBeGreaterThan(0);
  });

  it('should execute traditional payment', () => {
    const result = paymentManager.executeTraditionalPayment(PaymentMethod.BASIC_CARD, 10, 'USD', {
      token: 'test',
    });

    expect(result).toBeDefined();
    expect(result.payment_method).toBe(PaymentMethod.BASIC_CARD);
    expect(result.amount).toBe(10);
  });

  it('should handle unsupported payment method', () => {
    expect(() => {
      paymentManager.executeTraditionalPayment('unsupported' as any, 10, 'USD', {});
    }).toThrow();
  });

  it('should process A2A-x402 payment', () => {
    const result = paymentManager.executeTraditionalPayment(PaymentMethod.A2A_X402, 10, 'USDC', {
      transaction_hash: '0xabc',
    });

    expect(result.payment_method).toBe(PaymentMethod.A2A_X402);
    expect(result.status).toContain('crypto');
  });
});
