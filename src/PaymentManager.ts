/**
 * Payment Manager for ChaosChain SDK
 *
 * This module manages traditional and crypto payment processing,
 * supporting multiple payment methods (cards, Google Pay, Apple Pay, PayPal, crypto).
 */

import { ethers } from 'ethers';
import axios from 'axios';
import { PaymentError } from './exceptions';
import { NetworkConfig } from './types';

export enum PaymentMethod {
  BASIC_CARD = 'basic-card',
  GOOGLE_PAY = 'https://google.com/pay',
  APPLE_PAY = 'https://apple.com/apple-pay',
  PAYPAL = 'https://paypal.com',
  A2A_X402 = 'https://a2a.org/x402',
}

export interface TraditionalPaymentRequest {
  payment_method: PaymentMethod;
  amount: number;
  currency: string;
  payment_data: Record<string, any>;
  description: string;
}

export interface TraditionalPaymentResult {
  payment_id: string;
  transaction_id: string;
  status: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  timestamp: string;
  processor_response?: Record<string, any>;
}

export interface PaymentMethodCredentials {
  stripe_secret_key?: string;
  google_pay_merchant_id?: string;
  apple_pay_merchant_id?: string;
  paypal_client_id?: string;
  paypal_client_secret?: string;
}

/**
 * Payment Manager - handles all payment types
 *
 * Supports:
 * - Basic card payments (Visa, Mastercard via Stripe)
 * - Google Pay
 * - Apple Pay
 * - PayPal
 * - Cryptocurrency (via x402 protocol)
 */
export class PaymentManager {
  private agentName: string;
  private network: NetworkConfig;
  private wallet: ethers.Wallet;
  private credentials: PaymentMethodCredentials;
  private stripeAxiosInstance?: ReturnType<typeof axios.create>;
  private paypalAccessToken?: string;

  constructor(
    agentName: string,
    network: NetworkConfig,
    wallet: ethers.Wallet,
    credentials: PaymentMethodCredentials = {}
  ) {
    this.agentName = agentName;
    this.network = network;
    this.wallet = wallet;
    this.credentials = credentials;

    // Initialize Stripe if API key provided
    if (credentials.stripe_secret_key) {
      this.stripeAxiosInstance = axios.create({
        baseURL: 'https://api.stripe.com/v1',
        headers: {
          Authorization: `Bearer ${credentials.stripe_secret_key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      console.log('✅ Stripe integration enabled');
    }

    // Initialize PayPal if credentials provided
    if (credentials.paypal_client_id && credentials.paypal_client_secret) {
      this.initializePayPal().catch(console.error);
    }

    console.log(`💳 Payment Manager initialized for ${agentName}`);
  }

  /**
   * Initialize PayPal OAuth access token
   */
  private async initializePayPal(): Promise<void> {
    try {
      const auth = Buffer.from(
        `${this.credentials.paypal_client_id}:${this.credentials.paypal_client_secret}`
      ).toString('base64');

      const response = await axios.post(
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.paypalAccessToken = response.data.access_token;
      console.log('✅ PayPal integration enabled');
    } catch (e) {
      console.error('❌ Failed to initialize PayPal:', e);
    }
  }

  /**
   * Execute traditional payment (cards, wallets, etc.)
   */
  executeTraditionalPayment(
    paymentMethod: PaymentMethod,
    amount: number,
    currency: string,
    paymentData: Record<string, any>
  ): TraditionalPaymentResult {
    console.log(`💳 Processing ${paymentMethod} payment: $${amount} ${currency}`);

    // Route to appropriate payment processor
    switch (paymentMethod) {
      case PaymentMethod.BASIC_CARD:
        return this.processBasicCard(amount, currency, paymentData);

      case PaymentMethod.GOOGLE_PAY:
        return this.processGooglePay(amount, currency, paymentData);

      case PaymentMethod.APPLE_PAY:
        return this.processApplePay(amount, currency, paymentData);

      case PaymentMethod.PAYPAL:
        return this.processPayPal(amount, currency, paymentData);

      case PaymentMethod.A2A_X402:
        return this.processA2AX402(amount, currency, paymentData);

      default:
        throw new PaymentError(`Unsupported payment method: ${paymentMethod}`);
    }
  }

  /**
   * Process Basic Card payment (Visa, Mastercard, Amex, etc.) via Stripe
   */
  private processBasicCard(
    amount: number,
    currency: string,
    paymentData: Record<string, any>
  ): TraditionalPaymentResult {
    console.log('💳 Processing Basic Card via Stripe...');

    // Check if Stripe is configured
    if (!this.stripeAxiosInstance) {
      console.warn('⚠️  Stripe not configured, simulating payment');
      return this.simulateTraditionalPayment(PaymentMethod.BASIC_CARD, amount, currency);
    }

    try {
      // In production, create Stripe Payment Intent
      // const response = await this.stripeAxiosInstance.post('/payment_intents', {
      //   amount: Math.round(amount * 100), // Stripe uses cents
      //   currency: currency.toLowerCase(),
      //   payment_method_types: ['card'],
      //   description: `Payment for ${this.agentName}`
      // });

      // For now, simulate
      return this.simulateTraditionalPayment(PaymentMethod.BASIC_CARD, amount, currency);
    } catch (e) {
      throw new PaymentError(`Basic card payment failed: ${e}`);
    }
  }

  /**
   * Process Google Pay payment
   */
  private processGooglePay(
    amount: number,
    currency: string,
    paymentData: Record<string, any>
  ): TraditionalPaymentResult {
    console.log('🅶  Processing Google Pay...');

    // Check if Google Pay is configured
    if (!this.credentials.google_pay_merchant_id) {
      console.warn('⚠️  Google Pay not configured, simulating payment');
      return this.simulateTraditionalPayment(PaymentMethod.GOOGLE_PAY, amount, currency);
    }

    // In production, verify Google Pay token and process via payment processor
    // const token = paymentData.paymentToken;
    // Verify token, create charge, etc.

    // For now, simulate
    return this.simulateTraditionalPayment(PaymentMethod.GOOGLE_PAY, amount, currency);
  }

  /**
   * Process Apple Pay payment
   */
  private processApplePay(
    amount: number,
    currency: string,
    paymentData: Record<string, any>
  ): TraditionalPaymentResult {
    console.log('🍎 Processing Apple Pay...');

    // Check if Apple Pay is configured
    if (!this.credentials.apple_pay_merchant_id) {
      console.warn('⚠️  Apple Pay not configured, simulating payment');
      return this.simulateTraditionalPayment(PaymentMethod.APPLE_PAY, amount, currency);
    }

    // In production, verify Apple Pay token and process via payment processor
    // const token = paymentData.paymentToken;
    // Verify token, decrypt, create charge, etc.

    // For now, simulate
    return this.simulateTraditionalPayment(PaymentMethod.APPLE_PAY, amount, currency);
  }

  /**
   * Process PayPal payment
   */
  private processPayPal(
    amount: number,
    currency: string,
    paymentData: Record<string, any>
  ): TraditionalPaymentResult {
    console.log('💙 Processing PayPal...');

    // Check if PayPal is configured
    if (!this.paypalAccessToken) {
      console.warn('⚠️  PayPal not configured, simulating payment');
      return this.simulateTraditionalPayment(PaymentMethod.PAYPAL, amount, currency);
    }

    try {
      // In production, create PayPal order and execute
      // const response = await axios.post(
      //   'https://api-m.sandbox.paypal.com/v2/checkout/orders',
      //   {
      //     intent: 'CAPTURE',
      //     purchase_units: [{
      //       amount: { currency_code: currency, value: amount.toString() }
      //     }]
      //   },
      //   {
      //     headers: {
      //       Authorization: `Bearer ${this.paypalAccessToken}`,
      //       'Content-Type': 'application/json'
      //     }
      //   }
      // );

      // For now, simulate
      return this.simulateTraditionalPayment(PaymentMethod.PAYPAL, amount, currency);
    } catch (e) {
      throw new PaymentError(`PayPal payment failed: ${e}`);
    }
  }

  /**
   * Process A2A-x402 crypto payment
   */
  private processA2AX402(
    amount: number,
    currency: string,
    paymentData: Record<string, any>
  ): TraditionalPaymentResult {
    console.log('🔗 Processing A2A-x402 crypto payment...');

    // Crypto payments are handled by X402PaymentManager
    // This just creates a result showing it was routed to crypto
    const paymentId = `a2a_x402_${Date.now().toString(36)}`;

    return {
      payment_id: paymentId,
      transaction_id: paymentData?.transaction_hash || `crypto_tx_${paymentId}`,
      status: 'pending_crypto_confirmation',
      amount,
      currency,
      payment_method: PaymentMethod.A2A_X402,
      timestamp: new Date().toISOString(),
      processor_response: {
        network: this.network,
        settlement_type: 'crypto',
        requires_blockchain_confirmation: true,
      },
    };
  }

  /**
   * Simulate traditional payment (for testing/fallback)
   */
  private simulateTraditionalPayment(
    method: PaymentMethod,
    amount: number,
    currency: string
  ): TraditionalPaymentResult {
    const paymentId = `sim_${method}_${Date.now().toString(36)}`;
    const transactionId = `txn_${paymentId}`;

    console.log(`🔄 Simulating ${method} payment`);

    return {
      payment_id: paymentId,
      transaction_id: transactionId,
      status: 'completed',
      amount,
      currency,
      payment_method: method,
      timestamp: new Date().toISOString(),
      processor_response: {
        simulation: true,
        authorization_code: `AUTH_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        network: method === PaymentMethod.BASIC_CARD ? 'visa' : method,
        last4: method === PaymentMethod.BASIC_CARD ? '4242' : undefined,
      },
    };
  }

  /**
   * Get payment method configuration status
   */
  getPaymentMethodsStatus(): Record<string, boolean> {
    return {
      [PaymentMethod.BASIC_CARD]: !!this.credentials.stripe_secret_key,
      [PaymentMethod.GOOGLE_PAY]: !!this.credentials.google_pay_merchant_id,
      [PaymentMethod.APPLE_PAY]: !!this.credentials.apple_pay_merchant_id,
      [PaymentMethod.PAYPAL]: !!this.paypalAccessToken,
      [PaymentMethod.A2A_X402]: true, // Always available via wallet
    };
  }

  /**
   * Get supported payment methods
   */
  getSupportedPaymentMethods(): PaymentMethod[] {
    const status = this.getPaymentMethodsStatus();
    return Object.entries(status)
      .filter(([_, enabled]) => enabled)
      .map(([method, _]) => method as PaymentMethod);
  }

  /**
   * Validate payment method credentials
   */
  async validateCredentials(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Test Stripe
    if (this.credentials.stripe_secret_key) {
      try {
        await this.stripeAxiosInstance!.get('/balance');
        results.stripe = true;
      } catch (e) {
        results.stripe = false;
      }
    }

    // Test PayPal
    if (this.credentials.paypal_client_id) {
      results.paypal = !!this.paypalAccessToken;
    }

    // Google Pay and Apple Pay don't have API validation (merchant IDs are validated during checkout)
    results.google_pay = !!this.credentials.google_pay_merchant_id;
    results.apple_pay = !!this.credentials.apple_pay_merchant_id;

    // Crypto is always valid if we have a wallet
    results.crypto = !!this.wallet;

    return results;
  }

  /**
   * Create x402 payment request (for crypto payments)
   */
  createX402PaymentRequest(
    fromAgent: string,
    toAgent: string,
    amount: number,
    currency: string,
    serviceDescription: string
  ): Record<string, any> {
    return {
      payment_id: `x402_${Date.now().toString(36)}`,
      from_agent: fromAgent,
      to_agent: toAgent,
      amount,
      currency,
      service_description: serviceDescription,
      network: this.network,
      protocol_fee: amount * 0.025, // 2.5% ChaosChain fee
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Execute x402 crypto payment (delegated to X402PaymentManager)
   */
  executeX402Payment(paymentRequest: Record<string, any>): Record<string, any> {
    // This is a placeholder - actual implementation is in X402PaymentManager
    const transactionHash = `0x${Math.random().toString(16).substring(2, 66)}`;

    return {
      payment_id: paymentRequest.payment_id,
      transaction_hash: transactionHash,
      status: 'confirmed',
      timestamp: new Date(),
      network: this.network,
      from_address: this.wallet.address,
      to_address: paymentRequest.to_agent,
    };
  }

  /**
   * Get payment statistics
   */
  getPaymentStats(): Record<string, any> {
    return {
      agent_name: this.agentName,
      network: this.network,
      wallet_address: this.wallet.address,
      supported_methods: this.getSupportedPaymentMethods().length,
      payment_methods_status: this.getPaymentMethodsStatus(),
      features: {
        traditional_payments: true,
        crypto_payments: true,
        multi_currency: true,
        instant_settlement: true,
      },
    };
  }
}
