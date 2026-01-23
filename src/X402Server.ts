/**
 * X402 Paywall Server for ChaosChain SDK
 *
 * This module implements an HTTP 402 paywall server for protecting API endpoints
 * with cryptocurrency payments.
 */

import * as http from 'http';
import { X402PaymentManager, X402PaymentProof } from './X402PaymentManager';
// import { PaymentError } from './exceptions';

export interface X402EndpointConfig {
  path: string;
  amount: number;
  currency: string;
  description: string;
  handler: (data: any) => any;
}

export interface X402PaywallConfig {
  port: number;
  host?: string;
  defaultCurrency?: string;
}

/**
 * X402 Paywall Server - HTTP 402 payment-protected API
 *
 * Features:
 * - HTTP 402 Payment Required responses
 * - Automatic payment verification
 * - Per-endpoint payment requirements
 * - Payment receipt generation
 */
export class X402Server {
  private paymentManager: X402PaymentManager;
  private server: http.Server | null = null;
  private endpoints: Map<string, X402EndpointConfig> = new Map();
  private paymentCache: Map<string, X402PaymentProof> = new Map();
  private config: Required<X402PaywallConfig>;

  constructor(paymentManager: X402PaymentManager, config: X402PaywallConfig) {
    this.paymentManager = paymentManager;
    this.config = {
      port: config.port,
      host: config.host || '0.0.0.0',
      defaultCurrency: config.defaultCurrency || 'USDC',
    };

    console.log(`🔒 X402 Paywall Server initialized on port ${this.config.port}`);
  }

  /**
   * Register a payment-protected endpoint
   */
  requirePayment(amount: number, description: string, currency?: string) {
    return (handler: (data: any) => any) => {
      const path = `/${handler.name || 'endpoint'}`;

      const endpointConfig: X402EndpointConfig = {
        path,
        amount,
        currency: currency || this.config.defaultCurrency,
        description,
        handler,
      };

      this.endpoints.set(path, endpointConfig);
      console.log(
        `💰 Registered paywall endpoint: ${path} (${amount} ${currency || this.config.defaultCurrency})`
      );

      return handler;
    };
  }

  /**
   * Start the HTTP 402 server
   */
  start(): void {
    if (this.server) {
      console.warn('⚠️  Server already running');
      return;
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        console.error('❌ Request handler error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      });
    });

    this.server.listen(this.config.port, this.config.host, () => {
      console.log(
        `🚀 X402 Paywall Server running at http://${this.config.host}:${this.config.port}`
      );
      console.log(`📋 Registered endpoints: ${this.endpoints.size}`);
      this.endpoints.forEach((config, path) => {
        console.log(`   - ${path}: ${config.amount} ${config.currency} - ${config.description}`);
      });
    });
  }

  /**
   * Stop the server
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('🛑 X402 Paywall Server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    // Check if endpoint exists
    const endpointConfig = this.endpoints.get(path);
    if (!endpointConfig) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
      return;
    }

    // Check for X-PAYMENT header (official x402 spec)
    const xPaymentHeader = req.headers['x-payment'] as string;

    if (!xPaymentHeader) {
      // No payment provided - return 402 with payment requirements
      this.sendPaymentRequired(res, endpointConfig);
      return;
    }

    // Verify payment (X-PAYMENT header contains base64 encoded JSON payload)
    const isValidPayment = await this.verifyPayment(xPaymentHeader, endpointConfig);

    if (!isValidPayment) {
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or insufficient payment' }));
      return;
    }

    // Payment verified - execute endpoint
    try {
      // Parse request body
      let requestData: any = {};
      if (req.method === 'POST' || req.method === 'PUT') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        await new Promise((resolve) => req.on('end', resolve));
        const body = Buffer.concat(chunks).toString();
        requestData = body ? JSON.parse(body) : {};
      }

      // Execute handler
      const result = await endpointConfig.handler(requestData);

      // Send response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: result }));
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Send HTTP 402 Payment Required response
   * Official x402 spec: https://github.com/coinbase/x402
   */
  private sendPaymentRequired(res: http.ServerResponse, endpointConfig: X402EndpointConfig): void {
    const paymentRequirements = this.paymentManager.createPaymentRequirements(
      endpointConfig.amount,
      endpointConfig.currency,
      endpointConfig.description
    );

    // Official x402 402 response structure
    const response = {
      x402Version: 1,
      accepts: [paymentRequirements], // Array of acceptable payment requirements
      error: 'Payment Required',
    };

    res.writeHead(402, {
      'Content-Type': 'application/json',
    });

    res.end(JSON.stringify(response));
  }

  /**
   * Verify payment from X-PAYMENT header
   * Spec: X-PAYMENT contains base64 encoded JSON with:
   * { x402Version: number, scheme: string, network: string, payload: <scheme-specific> }
   */
  private async verifyPayment(
    xPaymentHeader: string,
    endpointConfig: X402EndpointConfig
  ): Promise<boolean> {
    try {
      // Decode base64 X-PAYMENT header
      const paymentPayloadJson = Buffer.from(xPaymentHeader, 'base64').toString('utf-8');
      const paymentPayload = JSON.parse(paymentPayloadJson);

      // Validate x402 version
      if (paymentPayload.x402Version !== 1) {
        console.error(`❌ Unsupported x402 version: ${paymentPayload.x402Version}`);
        return false;
      }

      // Validate scheme
      if (paymentPayload.scheme !== 'exact') {
        console.error(`❌ Unsupported payment scheme: ${paymentPayload.scheme}`);
        return false;
      }

      // Extract transaction hash from payload (scheme-specific)
      // For "exact" scheme on EVM, payload should contain transaction details
      const txHash = paymentPayload.payload?.transactionHash || paymentPayload.payload?.txHash;

      if (!txHash) {
        console.error(`❌ No transaction hash in payment payload`);
        return false;
      }

      // Check cache first
      const cachedPayment = this.paymentCache.get(txHash);
      if (cachedPayment) {
        console.log(`✅ Payment verified from cache: ${txHash}`);
        return true;
      }

      // Verify payment on-chain
      const mockProof: X402PaymentProof = {
        payment_id: txHash,
        transaction_hash: txHash,
        main_transaction_hash: txHash,
        from_address: '0x0000000000000000000000000000000000000000',
        to_address: '0x0000000000000000000000000000000000000000',
        treasury_address: '0x0000000000000000000000000000000000000000',
        amount: endpointConfig.amount,
        currency: endpointConfig.currency,
        protocol_fee: 0,
        network: 'base-sepolia' as any,
        chain_id: 84532,
        timestamp: new Date(),
        status: 'confirmed',
        confirmations: 1,
      };

      const isValid = await this.paymentManager.verifyPayment(mockProof);
      if (isValid) {
        // Cache the payment
        this.paymentCache.set(txHash, mockProof);
        console.log(`✅ Payment verified on-chain: ${txHash}`);
        return true;
      }

      console.error(`❌ Payment verification failed: ${txHash}`);
      return false;
    } catch (error) {
      console.error(`❌ Payment verification error: ${error}`);
      return false;
    }
  }

  /**
   * Get server statistics
   */
  getServerStats(): Record<string, any> {
    return {
      running: !!this.server,
      port: this.config.port,
      host: this.config.host,
      endpoints: Array.from(this.endpoints.entries()).map(([path, config]) => ({
        path,
        amount: config.amount,
        currency: config.currency,
        description: config.description,
      })),
      payments_cached: this.paymentCache.size,
      default_currency: this.config.defaultCurrency,
    };
  }

  /**
   * Clear payment cache
   */
  clearPaymentCache(): void {
    this.paymentCache.clear();
    console.log('🗑️  Payment cache cleared');
  }
}
