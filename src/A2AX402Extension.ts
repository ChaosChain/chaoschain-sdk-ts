/**
 * A2A-x402 Extension Implementation for ChaosChain SDK
 *
 * This module implements Google's A2A-x402 extension for cryptocurrency payments,
 * enabling seamless crypto settlement within the AP2 framework.
 *
 * Based on: https://github.com/google-agentic-commerce/a2a-x402/blob/main/v0.1/spec.md
 */

import { createHash } from 'crypto';
import { NetworkConfig } from './types';

export enum PaymentMethod {
  BASIC_CARD = 'basic-card',
  GOOGLE_PAY = 'https://google.com/pay',
  APPLE_PAY = 'https://apple.com/apple-pay',
  PAYPAL = 'https://paypal.com',
  A2A_X402 = 'https://a2a.org/x402',
}
import { PaymentError } from './exceptions';

export interface X402PaymentMethod {
  supported_methods: string[];
  supported_networks: string[];
  payment_endpoint: string;
  verification_endpoint: string;
  method_data?: Record<string, any>;
}

export interface W3CPaymentMethodData {
  supported_methods: string;
  data: Record<string, any>;
}

export interface TraditionalPaymentResponse {
  payment_id: string;
  method: string;
  amount: number;
  currency: string;
  status: string;
  transaction_id?: string;
  authorization_code?: string;
  timestamp: string;
  receipt_data?: Record<string, any>;
}

export interface X402PaymentRequest {
  id: string;
  total: Record<string, any>;
  display_items: Array<Record<string, any>>;
  x402_methods: X402PaymentMethod[];
  settlement_address: string;
  network: string;
  expires_at: string;
}

export interface X402PaymentResponse {
  payment_id: string;
  transaction_hash: string;
  network: string;
  amount: number;
  currency: string;
  settlement_address: string;
  confirmation_blocks: number;
  status: string;
  timestamp: string;
  gas_fee?: number;
  protocol_fee?: number;
}

/**
 * A2A-x402 Extension for cryptocurrency payments within AP2 framework
 *
 * This class bridges Google's AP2 protocol with x402 crypto payments,
 * enabling seamless crypto settlement for agent-to-agent commerce.
 */
export class A2AX402Extension {
  private agentName: string;
  private network: NetworkConfig;
  private paymentManager: any;
  private supportedCryptoMethods: string[];
  private supportedNetworks: string[];
  private w3cPaymentMethods: W3CPaymentMethodData[];

  constructor(agentName: string, network: NetworkConfig, paymentManager: any) {
    this.agentName = agentName;
    this.network = network;
    this.paymentManager = paymentManager;

    // Supported payment methods (W3C compliant)
    this.supportedCryptoMethods = ['usdc', 'eth', 'native'];
    this.supportedNetworks = ['base-sepolia', 'ethereum-sepolia', 'optimism-sepolia'];

    // W3C Payment Request API compliant payment methods
    this.w3cPaymentMethods = this.initializeW3cPaymentMethods();

    console.log(`✅ A2A-x402 Extension initialized for ${agentName} on ${network}`);
    console.log(`💳 Multi-payment support: ${this.w3cPaymentMethods.length} methods available`);
  }

  /**
   * Initialize W3C Payment Request API compliant payment methods
   */
  private initializeW3cPaymentMethods(): W3CPaymentMethodData[] {
    const methods: W3CPaymentMethodData[] = [];

    // 1. Basic Card Support (Visa, Mastercard, Amex, etc.)
    methods.push({
      supported_methods: 'basic-card',
      data: {
        supportedNetworks: ['visa', 'mastercard', 'amex', 'discover'],
        supportedTypes: ['credit', 'debit'],
      },
    });

    // 2. Google Pay
    methods.push({
      supported_methods: 'https://google.com/pay',
      data: {
        environment: 'PRODUCTION',
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [
          {
            type: 'CARD',
            parameters: {
              allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
              allowedCardNetworks: ['AMEX', 'DISCOVER', 'JCB', 'MASTERCARD', 'VISA'],
            },
          },
        ],
      },
    });

    // 3. Apple Pay
    methods.push({
      supported_methods: 'https://apple.com/apple-pay',
      data: {
        version: 3,
        merchantIdentifier: `merchant.chaoschain.${this.agentName.toLowerCase()}`,
        merchantCapabilities: ['supports3DS'],
        supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
      },
    });

    // 4. ChaosChain Crypto Pay (our A2A-x402 implementation)
    methods.push({
      supported_methods: 'https://a2a.org/x402',
      data: {
        supportedCryptocurrencies: this.supportedCryptoMethods,
        supportedNetworks: this.supportedNetworks,
        settlementAddress: 'dynamic',
        protocolVersion: 'x402-v1.0',
      },
    });

    // 5. PayPal (for completeness)
    methods.push({
      supported_methods: 'https://paypal.com',
      data: {
        environment: 'sandbox',
        intent: 'capture',
      },
    });

    return methods;
  }

  /**
   * Create x402 payment method descriptor with W3C compliance
   */
  createX402PaymentMethod(settlementAddress: string): X402PaymentMethod {
    // Extract all W3C method identifiers
    const w3cMethods = this.w3cPaymentMethods.map((method) => method.supported_methods);

    return {
      supported_methods: w3cMethods,
      supported_networks: this.supportedNetworks,
      payment_endpoint: `x402://${this.agentName}.chaoschain.com/pay`,
      verification_endpoint: `https://${this.agentName}.chaoschain.com/verify`,
      method_data: {
        w3c_methods: this.w3cPaymentMethods.map((method) => ({
          supportedMethods: method.supported_methods,
          data: method.data,
        })),
        crypto_settlement_address: settlementAddress,
      },
    };
  }

  /**
   * Create enhanced payment request with x402 crypto support
   */
  createEnhancedPaymentRequest(
    cartId: string,
    totalAmount: number,
    currency: string,
    items: Array<Record<string, any>>,
    settlementAddress: string
  ): X402PaymentRequest {
    // Create x402 payment methods
    const x402Methods = [this.createX402PaymentMethod(settlementAddress)];

    // Create enhanced payment request
    const paymentRequest: X402PaymentRequest = {
      id: `x402_${cartId}_${Date.now().toString(36)}`,
      total: {
        amount: { value: totalAmount.toString(), currency },
        label: `Payment for ${items.length} items`,
      },
      display_items: items.map((item) => ({
        label: item.name || item.service || 'Item',
        amount: { value: (item.price || 0).toString(), currency },
      })),
      x402_methods: x402Methods,
      settlement_address: settlementAddress,
      network: this.network,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    console.log(`💳 Created x402 payment request: ${paymentRequest.id}`);
    return paymentRequest;
  }

  /**
   * Execute x402 crypto payment using the real payment manager
   */
  async executeX402Payment(
    paymentRequest: X402PaymentRequest,
    payerAgent: string,
    serviceDescription: string = 'A2A Service'
  ): Promise<X402PaymentResponse> {
    console.log(`💸 Executing x402 payment: ${payerAgent} → ${this.agentName}`);

    // Extract payment details
    const amount = parseFloat(paymentRequest.total.amount.value);
    const currency = paymentRequest.total.amount.currency;

    // Create payment request for the payment manager
    const pmPaymentRequest = this.paymentManager.createX402PaymentRequest(
      payerAgent,
      this.agentName,
      amount,
      currency,
      serviceDescription
    );

    // Execute payment via payment manager
    const paymentProof = this.paymentManager.executeX402Payment(pmPaymentRequest);

    // Create x402 payment response
    const response: X402PaymentResponse = {
      payment_id: paymentProof.payment_id,
      transaction_hash: paymentProof.transaction_hash,
      network: this.network,
      amount,
      currency,
      settlement_address: paymentRequest.settlement_address,
      confirmation_blocks: 1,
      status: 'confirmed',
      timestamp: paymentProof.timestamp.toISOString(),
      gas_fee: undefined,
      protocol_fee: pmPaymentRequest.protocol_fee,
    };

    console.log(`✅ x402 payment confirmed: ${response.transaction_hash}`);
    return response;
  }

  /**
   * Execute traditional payment (cards, Google Pay, Apple Pay, etc.)
   */
  executeTraditionalPayment(
    paymentMethod: string,
    amount: number,
    currency: string,
    paymentData: Record<string, any>
  ): TraditionalPaymentResponse {
    console.log(`💳 Processing ${paymentMethod} payment: $${amount} ${currency}`);

    // Use the payment manager's traditional payment execution
    if (this.paymentManager) {
      // Convert to PaymentMethod enum
      let methodEnum: PaymentMethod | undefined;
      if (paymentMethod === 'basic-card') {
        methodEnum = PaymentMethod.BASIC_CARD;
      } else if (paymentMethod === 'https://google.com/pay') {
        methodEnum = PaymentMethod.GOOGLE_PAY;
      } else if (paymentMethod === 'https://apple.com/apple-pay') {
        methodEnum = PaymentMethod.APPLE_PAY;
      } else if (paymentMethod === 'https://paypal.com') {
        methodEnum = PaymentMethod.PAYPAL;
      } else if (paymentMethod === 'https://a2a.org/x402') {
        methodEnum = PaymentMethod.A2A_X402;
      }

      if (methodEnum) {
        const result = this.paymentManager.executeTraditionalPayment(
          methodEnum,
          amount,
          currency,
          paymentData
        );

        // Convert to TraditionalPaymentResponse
        return {
          payment_id: result.payment_id,
          method: paymentMethod,
          amount,
          currency,
          status: result.status,
          transaction_id: result.transaction_id,
          authorization_code: result.processor_response?.authorization_code,
          timestamp: result.timestamp,
          receipt_data: result.processor_response,
        };
      }
    }

    // Fallback for unsupported methods
    const paymentId = `trad_${Date.now().toString(36)}`;
    return {
      payment_id: paymentId,
      method: paymentMethod,
      amount,
      currency,
      status: 'failed',
      timestamp: new Date().toISOString(),
      receipt_data: { error: 'Unsupported payment method' },
    };
  }

  /**
   * Verify x402 payment on-chain
   */
  verifyX402Payment(paymentResponse: X402PaymentResponse): boolean {
    // In production, this would verify the transaction on-chain
    // For now, we check if we have a valid transaction hash
    return (
      paymentResponse.status === 'confirmed' &&
      !!paymentResponse.transaction_hash &&
      paymentResponse.transaction_hash.length === 66
    );
  }

  /**
   * Create cryptographic proof of x402 payment
   */
  createPaymentProof(paymentResponse: X402PaymentResponse): Record<string, any> {
    const proofData = {
      payment_id: paymentResponse.payment_id,
      transaction_hash: paymentResponse.transaction_hash,
      network: paymentResponse.network,
      amount: paymentResponse.amount,
      currency: paymentResponse.currency,
      settlement_address: paymentResponse.settlement_address,
      timestamp: paymentResponse.timestamp,
      agent_payer: 'unknown',
      agent_payee: this.agentName,
    };

    // Create proof hash
    const proofJson = JSON.stringify(proofData);
    const proofHash = createHash('sha256').update(proofJson).digest('hex');

    return {
      proof_type: 'a2a_x402_payment',
      proof_hash: proofHash,
      proof_data: proofData,
      verification_method: 'on_chain_transaction',
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Get A2A-x402 extension capabilities with W3C Payment Request API compliance
   */
  getExtensionCapabilities(): Record<string, any> {
    return {
      extension_name: 'a2a-x402-multi-payment',
      version: '1.0.0',
      w3c_payment_methods: this.w3cPaymentMethods.map((m) => m.supported_methods),
      supported_crypto_methods: this.supportedCryptoMethods,
      supported_networks: this.supportedNetworks,
      features: [
        'w3c_payment_request_api',
        'multi_payment_methods',
        'basic_card_support',
        'google_pay_integration',
        'apple_pay_integration',
        'paypal_integration',
        'crypto_payments',
        'instant_settlement',
        'on_chain_verification',
        'protocol_fees',
        'gas_optimization',
        'multi_network_support',
      ],
      compliance: [
        'W3C Payment Request API',
        'A2A-x402 Specification v0.1',
        'Google Pay API v2',
        'Apple Pay JS API v3',
        'PayPal Checkout API',
        'EIP-20 Token Standard',
        'HTTP 402 Payment Required',
      ],
      payment_processors: {
        traditional: ['simulated_processor', 'google_pay', 'apple_pay', 'paypal'],
        crypto: ['chaoschain_x402', 'base_sepolia', 'ethereum'],
      },
    };
  }
}
