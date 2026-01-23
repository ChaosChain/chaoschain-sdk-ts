import { describe, it, expect, vi, beforeEach } from 'vitest';
import { X402PaymentManager } from '../src/X402PaymentManager';
import { ethers } from 'ethers';

describe('X402PaymentManager (EIP-3009)', () => {
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const testRecipient = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  let provider: ethers.JsonRpcProvider;
  let wallet: ethers.Wallet;

  beforeEach(() => {
    provider = new ethers.JsonRpcProvider('https://base-sepolia.g.alchemy.com/v2/demo');
    wallet = new ethers.Wallet(testPrivateKey, provider);
  });

  describe('Initialization', () => {
    it('should initialize with wallet and network', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      expect(paymentManager).toBeDefined();
    });

    it('should initialize with facilitator config', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia', {
        facilitatorUrl: 'http://localhost:8402',
        mode: 'managed',
        agentId: '8004#123',
      });

      expect(paymentManager).toBeDefined();
    });

    it('should use default facilitator URL if not provided', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      expect(paymentManager).toBeDefined();
      // Default is https://facilitator.chaoscha.in
    });
  });

  describe('Payment Request Creation', () => {
    it('should create payment request with USDC', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const request = paymentManager.createPaymentRequest(
        'AliceAgent',
        'BobAgent',
        10.0,
        'USDC',
        'Test payment'
      );

      expect(request).toBeDefined();
      expect(request.payment_id).toBeDefined();
      expect(request.payment_id).toMatch(/^x402_/);
      expect(request.from_agent).toBe('AliceAgent');
      expect(request.to_agent).toBe('BobAgent');
      expect(request.amount).toBe(10.0);
      expect(request.currency).toBe('USDC');
      expect(request.service_description).toBe('Test payment');
      expect(request.network).toBe('base-sepolia');
    });

    it('should include protocol fee in request', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const request = paymentManager.createPaymentRequest('Alice', 'Bob', 100.0, 'USDC', 'Test');

      expect(request.protocol_fee).toBeDefined();
      expect(request.protocol_fee).toBe(2.5); // 2.5% of 100
    });

    it('should calculate 2.5% protocol fee correctly', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const request = paymentManager.createPaymentRequest('Alice', 'Bob', 100.0, 'USDC');

      const expectedFee = 2.5; // 2.5% of 100
      expect(request.protocol_fee).toBe(expectedFee);
    });

    it('should generate unique payment IDs', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const request1 = paymentManager.createPaymentRequest('Alice', 'Bob', 10.0, 'USDC');
      const request2 = paymentManager.createPaymentRequest('Alice', 'Bob', 10.0, 'USDC');

      expect(request1.payment_id).not.toBe(request2.payment_id);
    });

    it('should include timestamp in request', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const request = paymentManager.createPaymentRequest('Alice', 'Bob', 10.0, 'USDC');

      expect(request.created_at).toBeDefined();
      expect(new Date(request.created_at).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Protocol Fee Calculation', () => {
    it('should calculate fee correctly for various amounts', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const testCases = [
        { amount: 100, expectedFee: 2.5 },
        { amount: 1000, expectedFee: 25 },
        { amount: 50, expectedFee: 1.25 },
      ];

      testCases.forEach(({ amount, expectedFee }) => {
        const request = paymentManager.createPaymentRequest('Alice', 'Bob', amount, 'USDC');
        expect(request.protocol_fee).toBe(expectedFee);
      });
    });

    it('should handle very small amounts', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const request = paymentManager.createPaymentRequest('Alice', 'Bob', 0.01, 'USDC');

      expect(request.protocol_fee).toBeDefined();
      expect(request.protocol_fee).toBeGreaterThan(0);
    });

    it('should handle very large amounts', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const request = paymentManager.createPaymentRequest('Alice', 'Bob', 1000000, 'USDC');

      expect(request.protocol_fee).toBeDefined();
      const fee = request.protocol_fee;
      expect(fee).toBe(25000); // 2.5% of 1,000,000
    });
  });

  describe('Multi-Currency Support', () => {
    it('should support USDC', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const request = paymentManager.createPaymentRequest('Alice', 'Bob', 100.0, 'USDC');

      expect(request.currency).toBe('USDC');
    });

    it('should support ETH', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const request = paymentManager.createPaymentRequest('Alice', 'Bob', 1.0, 'ETH');

      expect(request.currency).toBe('ETH');
    });
  });

  describe('Payment Requirements', () => {
    it('should create payment requirements with correct schema', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const requirements = paymentManager.createPaymentRequirements(10.0, 'USDC', 'Test service');

      expect(requirements).toBeDefined();
      expect(requirements.scheme).toBe('exact');
      expect(requirements.network).toBe('base-sepolia');
      expect(requirements.maxAmountRequired).toBeDefined();
      expect(requirements.payTo).toBe(wallet.address);
      expect(requirements.asset).toBeDefined(); // USDC contract address
      expect(requirements.maxTimeoutSeconds).toBe(60);
      expect(requirements.mimeType).toBe('application/json');
    });

    it('should include EIP-3009 extra data for USDC', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const requirements = paymentManager.createPaymentRequirements(10.0, 'USDC');

      expect(requirements.extra).toBeDefined();
      expect(requirements.extra).toHaveProperty('name');
      expect(requirements.extra).toHaveProperty('version');
    });

    it('should use correct USDC address for network', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const requirements = paymentManager.createPaymentRequirements(10.0, 'USDC');

      expect(requirements.asset).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
    });
  });

  describe('EIP-3009 Signature Generation', () => {
    it('should generate transfer authorization signature', async () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const params = {
        from: wallet.address,
        to: testRecipient,
        value: ethers.parseUnits('10.0', 6), // 10 USDC
        validAfter: BigInt(Math.floor(Date.now() / 1000)),
        validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
        nonce: ethers.hexlify(ethers.randomBytes(32)),
      };

      const signature = await paymentManager.signTransferAuthorization(params);

      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(signature.length).toBeGreaterThan(130); // Signature should be ~132 chars
    });
  });

  describe('Payment Stats', () => {
    it('should return payment statistics', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const stats = paymentManager.getPaymentStats();

      expect(stats).toBeDefined();
      expect(stats.network).toBe('base-sepolia');
      expect(stats.wallet_address).toBe(wallet.address);
      expect(stats.treasury_address).toBeDefined();
      expect(stats.protocol_fee_percentage).toBe(2.5);
      expect(stats.supported_currencies).toContain('ETH');
      expect(stats.supported_currencies).toContain('USDC');
      expect(stats.features).toBeDefined();
      expect(stats.features.instant_settlement).toBe(true);
      expect(stats.features.on_chain_verification).toBe(true);
      expect(stats.features.gasless_transfers).toBe(true);
    });
  });

  describe('Payment History', () => {
    it('should return payment history', async () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const history = await paymentManager.getPaymentHistory();

      expect(Array.isArray(history)).toBe(true);
      // Empty by default since no payments made yet
    });

    it('should support limit parameter', async () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');

      const history = await paymentManager.getPaymentHistory(5);

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Network Support', () => {
    it('should support base-sepolia', () => {
      const paymentManager = new X402PaymentManager(wallet, 'base-sepolia');
      expect(paymentManager).toBeDefined();
    });

    it('should support ethereum-sepolia', () => {
      const paymentManager = new X402PaymentManager(wallet, 'ethereum-sepolia');
      expect(paymentManager).toBeDefined();
    });

    it('should support optimism-sepolia', () => {
      const paymentManager = new X402PaymentManager(wallet, 'optimism-sepolia');
      expect(paymentManager).toBeDefined();
    });

    it('should support linea-sepolia', () => {
      const paymentManager = new X402PaymentManager(wallet, 'linea-sepolia');
      expect(paymentManager).toBeDefined();
    });
  });
});
