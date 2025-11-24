/**
 * X402 Payment Manager for ChaosChain SDK
 *
 * This module implements the Coinbase x402 HTTP 402 payment protocol with EIP-3009,
 * enabling seamless, gasless cryptocurrency payments between AI agents via facilitators.
 *
 * Based on: https://www.x402.org/ and https://github.com/coinbase/x402
 */

import { ethers } from 'ethers';
import { PaymentError } from './exceptions';
import { NetworkConfig } from './types';

// ============================================================================
// CORE TYPES
// ============================================================================

export interface X402PaymentRequest {
  payment_id: string;
  from_agent: string;
  to_agent: string;
  amount: number;
  currency: string;
  service_description: string;
  network: NetworkConfig;
  protocol_fee: number;
  created_at: string;
  settlement_address?: string;
}

export interface X402PaymentProof {
  payment_id: string;
  transaction_hash: string;
  main_transaction_hash: string;
  fee_transaction_hash?: string;
  from_address: string;
  to_address: string;
  treasury_address: string;
  amount: number;
  currency: string;
  protocol_fee: number;
  network: NetworkConfig;
  chain_id: number;
  block_number?: number;
  timestamp: Date;
  status: string;
  confirmations: number;
  fee_amount?: string;        // Fee in base units
  net_amount?: string;        // Net amount in base units
  evidence_hash?: string;     // ChaosChain Proof-of-Agency
}

/**
 * Official x402 Payment Requirements schema
 * Spec: https://github.com/coinbase/x402
 */
export interface X402PaymentRequirements {
  scheme: string;              // e.g., "exact"
  network: string;             // Network ID
  maxAmountRequired: string;   // uint256 as string
  resource: string;            // URL of resource
  description: string;         // Service description
  mimeType: string;            // Response MIME type
  outputSchema?: object | null; // Response schema
  payTo: string;               // Address to pay
  maxTimeoutSeconds: number;   // Max timeout
  asset: string;               // ERC-20 contract address (or 0x0 for ETH)
  extra: object | null;        // Extra info (EIP-3009 details for USDC)
}

// ============================================================================
// EIP-3009 TYPES
// ============================================================================

/**
 * EIP-3009 Payment Header
 * Transmitted as base64-encoded JSON in X-PAYMENT header
 */
export interface PaymentHeader {
  sender: string;              // Payer address
  nonce: string;               // Unique nonce (hex string)
  validAfter?: string;         // ISO timestamp or unix seconds
  validBefore?: string;        // ISO timestamp or unix seconds
  signature?: string;          // EIP-712 signature (hex string)
}

/**
 * EIP-3009 Transfer Authorization Parameters
 * Used for signing and on-chain execution
 */
export interface TransferAuthorizationParams {
  from: string;                // Payer address
  to: string;                  // Recipient address
  value: bigint;               // Amount in token base units
  validAfter: bigint;          // Unix timestamp (seconds)
  validBefore: bigint;         // Unix timestamp (seconds)
  nonce: string;               // Unique hex nonce (32 bytes)
}

// ============================================================================
// FACILITATOR TYPES
// ============================================================================

/**
 * Facilitator Configuration
 */
export interface X402FacilitatorConfig {
  facilitatorUrl?: string;     // Default: https://facilitator.chaoscha.in
  apiKey?: string;             // Optional API key
  mode?: 'managed' | 'decentralized';
  agentId?: string;            // ERC-8004 tokenId
}

/**
 * Facilitator Settlement Request
 */
export interface SettleRequest {
  x402Version: number;
  paymentHeader: PaymentHeader | string; // Object or base64 string
  paymentRequirements: X402PaymentRequirements;
  agentId?: string;            // ERC-8004 tokenId
}

/**
 * Facilitator Settlement Response
 */
export interface SettleResponse {
  success: boolean;
  error: string | null;
  txHash: string | null;
  txHashFee?: string;          // Fee transaction hash
  networkId: string | null;
  consensusProof?: string;     // CRE consensus proof
  timestamp?: number;
  feeAmount?: string;          // Fee in base units
  netAmount?: string;          // Net amount in base units
  status?: 'pending' | 'partial_settlement' | 'confirmed' | 'failed';
  evidenceHash?: string;       // Proof-of-Agency evidence
  proofOfAgency?: string;      // ValidationRegistry tx hash
}

/**
 * X402 Payment Manager - Coinbase HTTP 402 protocol with EIP-3009
 * 
 * Features:
 * - ✅ EIP-3009 gasless transfers via facilitator
 * - ✅ Signature-based payment authorization
 * - ✅ Automatic protocol fee collection
 * - ✅ Multi-network support (Base, Ethereum, Optimism, Linea)
 * - ✅ ChaosChain Proof-of-Agency integration
 */
export class X402PaymentManager {
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private network: NetworkConfig;
  private treasuryAddress: string;
  private protocolFeePercentage: number;
  private usdcAddresses: Record<string, string>;
  private facilitatorUrl: string;
  private facilitatorApiKey?: string;
  private facilitatorMode: 'managed' | 'decentralized';
  private agentId?: string;

  constructor(
    wallet: ethers.Wallet,
    network: NetworkConfig,
    facilitatorConfig: X402FacilitatorConfig = {}
  ) {
    this.wallet = wallet;
    this.network = network;
    this.protocolFeePercentage = 0.025; // 2.5% ChaosChain fee

    // ChaosChain treasury addresses (per network)
    this.treasuryAddress = this.getTreasuryAddress(network);

    // USDC contract addresses (EIP-3009 compatible)
    this.usdcAddresses = {
      'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      'optimism-sepolia': '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
      'linea-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
    };

    // Facilitator configuration
    this.facilitatorUrl = facilitatorConfig.facilitatorUrl ||
      process.env.CC_FACILITATOR_URL ||
      'https://facilitator.chaoscha.in';
    this.facilitatorApiKey = facilitatorConfig.apiKey || process.env.CC_API_KEY;
    this.facilitatorMode = facilitatorConfig.mode || 'managed';
    this.agentId = facilitatorConfig.agentId;

    // Get provider from wallet
    this.provider = wallet.provider as ethers.JsonRpcProvider;

    console.log(`✅ X402 Payment Manager initialized (EIP-3009 mode)`);
    console.log(`🌐 Network: ${network}`);
    console.log(`💰 Treasury: ${this.treasuryAddress}`);
    console.log(`📊 Protocol Fee: ${this.protocolFeePercentage * 100}%`);
    console.log(`🔗 Facilitator: ${this.facilitatorUrl}`);
    console.log(`⚙️  Mode: ${this.facilitatorMode}`);
    if (this.agentId) {
      console.log(`🤖 Agent ID: ${this.agentId}`);
    }
  }

  /**
   * Get ChaosChain treasury address for network
   */
  private getTreasuryAddress(network: NetworkConfig): string {
    const treasuries: Record<string, string> = {
      'base-sepolia': '0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
      'ethereum-sepolia': '0x8004a6090Cd10A7288092483047B097295Fb8847',
      'optimism-sepolia': '0x8004a6090Cd10A7288092483047B097295Fb8847',
      'linea-sepolia': '0x8004aa7C931bCE1233973a0C6A667f73F66282e7'
    };

    return treasuries[network] || treasuries['base-sepolia'];
  }

  /**
   * Get chain ID for network
   */
  private getChainId(network: NetworkConfig): number {
    const chainIds: Record<string, number> = {
      'base-sepolia': 84532,
      'ethereum-sepolia': 11155111,
      'optimism-sepolia': 11155420,
      'linea-sepolia': 59141,
      'base': 8453,
      'ethereum': 1,
      'optimism': 10,
      'linea': 59144
    };

    return chainIds[network] || 84532;
  }

  // ============================================================================
  // EIP-3009 SIGNING METHODS
  // ============================================================================

  /**
   * Generate unique nonce for EIP-3009 transfer authorization
   * Returns 32-byte hex string (0x-prefixed)
   */
  private generateNonce(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  /**
   * Sign EIP-3009 Transfer Authorization
   * 
   * This creates an EIP-712 signature for USDC's transferWithAuthorization function.
   * The facilitator will use this signature to execute a gasless transfer on-chain.
   * 
   * Spec: https://eips.ethereum.org/EIPS/eip-3009
   */
  async signTransferAuthorization(
    params: TransferAuthorizationParams
  ): Promise<string> {
    const usdcAddress = this.usdcAddresses[this.network];
    if (!usdcAddress) {
      throw new PaymentError(`USDC not supported on ${this.network}`);
    }

    // EIP-712 domain for USDC contract
    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId: this.getChainId(this.network),
      verifyingContract: usdcAddress
    };

    // EIP-712 types for transferWithAuthorization
    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    // Message to sign
    const message = {
      from: params.from,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter,
      validBefore: params.validBefore,
      nonce: params.nonce
    };

    // Sign with EIP-712
    const signature = await this.wallet.signTypedData(domain, types, message);

    console.log(`🔏 EIP-3009 signature generated`);
    console.log(`   From: ${params.from}`);
    console.log(`   To: ${params.to}`);
    console.log(`   Value: ${params.value.toString()}`);
    console.log(`   Nonce: ${params.nonce}`);

    return signature;
  }

  // ============================================================================
  // FACILITATOR CLIENT METHODS
  // ============================================================================

  /**
   * Call facilitator API endpoint
   */
  private async callFacilitator(endpoint: string, body: any): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add API key if configured
    if (this.facilitatorApiKey) {
      headers['X-CC-ApiKey'] = this.facilitatorApiKey;
    }

    // Add idempotency key for settlement calls
    if (endpoint.includes('/settle')) {
      const idempotencyKey = `${this.agentId || 'anon'}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      headers['Idempotency-Key'] = idempotencyKey;
    }

    console.log(`🔗 Calling facilitator: ${this.facilitatorUrl}${endpoint}`);

    try {
      const response = await fetch(`${this.facilitatorUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new PaymentError(`Facilitator error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (e: any) {
      throw new PaymentError(`Facilitator call failed: ${e.message}`);
    }
  }

  /**
   * Settle payment with facilitator (EIP-3009 execution)
   * 
   * The facilitator will:
   * 1. Verify the EIP-712 signature
   * 2. Call USDC.transferWithAuthorization() on-chain
   * 3. Sponsor the gas fees
   * 4. Return the transaction hash
   */
  async settleWithFacilitator(
    paymentHeader: PaymentHeader,
    paymentRequirements: X402PaymentRequirements
  ): Promise<SettleResponse> {
    const request: SettleRequest = {
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
      agentId: this.agentId
    };

    console.log(`💸 Settling payment with facilitator...`);
    console.log(`   Amount: ${paymentRequirements.maxAmountRequired}`);
    console.log(`   Asset: ${paymentRequirements.asset}`);
    console.log(`   PayTo: ${paymentRequirements.payTo}`);

    const response = await this.callFacilitator('/settle', request);

    if (!response.success) {
      throw new PaymentError(`Settlement failed: ${response.error}`);
    }

    console.log(`✅ Settlement successful`);
    console.log(`   TX Hash: ${response.txHash}`);
    if (response.txHashFee) {
      console.log(`   Fee TX Hash: ${response.txHashFee}`);
    }
    if (response.feeAmount) {
      console.log(`   Fee: ${response.feeAmount} (${response.netAmount} net)`);
    }

    return response;
  }

  /**
   * Create x402 payment request
   */
  createPaymentRequest(
    fromAgent: string,
    toAgent: string,
    amount: number,
    currency: string = 'USDC',
    serviceDescription: string = 'AI Agent Service'
  ): X402PaymentRequest {
    const paymentId = `x402_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
    const protocolFee = amount * this.protocolFeePercentage;

    const request: X402PaymentRequest = {
      payment_id: paymentId,
      from_agent: fromAgent,
      to_agent: toAgent,
      amount,
      currency,
      service_description: serviceDescription,
      network: this.network,
      protocol_fee: protocolFee,
      created_at: new Date().toISOString()
    };

    console.log(`📄 Created x402 payment request: ${paymentId}`);
    console.log(`   From: ${fromAgent} → To: ${toAgent}`);
    console.log(`   Amount: ${amount} ${currency} + ${protocolFee.toFixed(4)} ${currency} fee`);

    return request;
  }

  /**
   * Execute x402 payment (EIP-3009 mode)
   * 
   * This method uses EIP-3009 + facilitator for gasless, signature-based payments
   */
  async executePayment(paymentRequest: X402PaymentRequest, recipientAddress: string): Promise<X402PaymentProof> {
    console.log(`💸 Executing x402 payment (EIP-3009): ${paymentRequest.payment_id}`);
    console.log(`   Network: ${this.network}`);
    console.log(`   Recipient: ${recipientAddress}`);

    const currency = paymentRequest.currency.toUpperCase();
    const amount = paymentRequest.amount;
    const protocolFee = paymentRequest.protocol_fee;

    let mainTxHash: string;
    let feeTxHash: string | undefined;
    let feeAmount: string | undefined;
    let netAmount: string | undefined;
    let chainId: number;

    try {
      // Get network details
      const networkInfo = await this.provider.getNetwork();
      chainId = Number(networkInfo.chainId);

      if (currency === 'ETH' || currency === 'NATIVE') {
        // Native token transfer (old flow, TODO: add EIP-3009 for ETH)
        const { mainTx, feeTx } = await this.executeNativePayment(recipientAddress, amount, protocolFee);
        mainTxHash = mainTx;
        feeTxHash = feeTx;
      } else if (currency === 'USDC') {
        // USDC transfer (NEW: EIP-3009 + facilitator)
        const result = await this.executeUsdcPayment(recipientAddress, amount, protocolFee);
        mainTxHash = result.mainTx;
        feeTxHash = result.feeTx;
        feeAmount = result.feeAmount;
        netAmount = result.netAmount;
      } else {
        throw new PaymentError(`Unsupported currency: ${currency}`);
      }

      // Get transaction receipt (may be pending if just submitted)
      const receipt = await this.provider.getTransactionReceipt(mainTxHash);

      // Create payment proof
      const proof: X402PaymentProof = {
        payment_id: paymentRequest.payment_id,
        transaction_hash: mainTxHash,
        main_transaction_hash: mainTxHash,
        fee_transaction_hash: feeTxHash,
        from_address: this.wallet.address,
        to_address: recipientAddress,
        treasury_address: this.treasuryAddress,
        amount,
        currency,
        protocol_fee: protocolFee,
        network: this.network,
        chain_id: chainId,
        block_number: receipt?.blockNumber,
        timestamp: new Date(),
        status: receipt?.status === 1 ? 'confirmed' : 'pending',
        confirmations: receipt ? 1 : 0,
        fee_amount: feeAmount,
        net_amount: netAmount
      };

      console.log(`✅ x402 payment executed successfully (EIP-3009)`);
      console.log(`   Main TX: ${mainTxHash}`);
      if (feeTxHash) {
        console.log(`   Fee TX: ${feeTxHash}`);
      }
      if (feeAmount && netAmount) {
        console.log(`   Fee: ${feeAmount} | Net: ${netAmount}`);
      }

      return proof;
    } catch (e: any) {
      throw new PaymentError(`x402 payment failed: ${e.message}`, { payment_id: paymentRequest.payment_id });
    }
  }

  /**
   * Execute native token (ETH) payment
   */
  private async executeNativePayment(
    recipientAddress: string,
    amount: number,
    protocolFee: number
  ): Promise<{ mainTx: string; feeTx?: string }> {
    // Convert to wei
    const amountWei = ethers.parseEther(amount.toString());
    const feeWei = ethers.parseEther(protocolFee.toString());

    // Send main payment
    const mainTx = await this.wallet.sendTransaction({
      to: recipientAddress,
      value: amountWei
    });
    await mainTx.wait();

    // Send protocol fee to treasury
    let feeTxHash: string | undefined;
    if (protocolFee > 0) {
      const feeTx = await this.wallet.sendTransaction({
        to: this.treasuryAddress,
        value: feeWei
      });
      await feeTx.wait();
      feeTxHash = feeTx.hash;
    }

    return {
      mainTx: mainTx.hash,
      feeTx: feeTxHash
    };
  }

  /**
   * Execute USDC payment using EIP-3009 + Facilitator
   * 
   * NEW FLOW (EIP-3009 compliant):
   * 1. Generate EIP-712 signature for transferWithAuthorization
   * 2. Send signature to facilitator
   * 3. Facilitator executes on-chain (gas-sponsored)
   * 4. Return transaction hash
   * 
   * Benefits:
   * - ✅ Gasless (facilitator pays gas)
   * - ✅ Single signature (no approve + transfer)
   * - ✅ Facilitator manages fee collection
   */
  private async executeUsdcPayment(
    recipientAddress: string,
    amount: number,
    protocolFee: number
  ): Promise<{ mainTx: string; feeTx?: string; feeAmount?: string; netAmount?: string }> {
    // Get USDC contract address
    const usdcAddress = this.usdcAddresses[this.network];
    if (!usdcAddress) {
      throw new PaymentError(`USDC not supported on ${this.network}`);
    }

    // USDC has 6 decimals
    const totalAmountWei = ethers.parseUnits(amount.toString(), 6);
    const feeWei = ethers.parseUnits(protocolFee.toString(), 6);

    console.log(`💳 Preparing EIP-3009 payment authorization...`);
    console.log(`   Total: ${amount} USDC`);
    console.log(`   Fee: ${protocolFee} USDC`);
    console.log(`   Net: ${(amount - protocolFee).toFixed(6)} USDC`);

    // Generate unique nonce for this transfer
    const nonce = this.generateNonce();

    // Set validity window (now to 1 hour from now)
    const now = BigInt(Math.floor(Date.now() / 1000));
    const validAfter = now;
    const validBefore = now + BigInt(3600); // 1 hour

    // Create transfer authorization parameters
    // NOTE: In managed mode, facilitator handles fee splitting
    // We authorize the full amount to the recipient
    const authParams: TransferAuthorizationParams = {
      from: this.wallet.address,
      to: recipientAddress,
      value: totalAmountWei, // Full amount (facilitator splits fee)
      validAfter,
      validBefore,
      nonce
    };

    // Sign EIP-712 authorization
    const signature = await this.signTransferAuthorization(authParams);

    // Create payment header for facilitator
    const paymentHeader: PaymentHeader = {
      sender: this.wallet.address,
      nonce: nonce,
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      signature
    };

    // Create payment requirements for facilitator
    const paymentRequirements: X402PaymentRequirements = {
      scheme: 'exact',
      network: this.network,
      maxAmountRequired: totalAmountWei.toString(),
      resource: '/',
      description: 'ChaosChain x402 Payment',
      mimeType: 'application/json',
      outputSchema: null,
      payTo: recipientAddress,
      maxTimeoutSeconds: 3600,
      asset: usdcAddress,
      extra: {
        name: 'USD Coin',
        version: '2',
        // ChaosChain fee configuration
        protocolFee: feeWei.toString(),
        treasuryAddress: this.treasuryAddress,
        feePercentage: this.protocolFeePercentage * 100
      }
    };

    // Settle with facilitator
    const settleResponse = await this.settleWithFacilitator(paymentHeader, paymentRequirements);

    if (!settleResponse.success || !settleResponse.txHash) {
      throw new PaymentError(`EIP-3009 settlement failed: ${settleResponse.error}`);
    }

    return {
      mainTx: settleResponse.txHash,
      feeTx: settleResponse.txHashFee,
      feeAmount: settleResponse.feeAmount,
      netAmount: settleResponse.netAmount
    };
  }

  /**
   * Verify x402 payment on-chain
   */
  async verifyPayment(paymentProof: X402PaymentProof): Promise<boolean> {
    try {
      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(paymentProof.main_transaction_hash);

      if (!receipt) {
        console.error(`❌ Transaction not found: ${paymentProof.main_transaction_hash}`);
        return false;
      }

      // Verify transaction status
      if (receipt.status !== 1) {
        console.error(`❌ Transaction failed: ${paymentProof.main_transaction_hash}`);
        return false;
      }

      // Verify recipient
      const tx = await this.provider.getTransaction(paymentProof.main_transaction_hash);
      if (tx?.to?.toLowerCase() !== paymentProof.to_address.toLowerCase()) {
        console.error(`❌ Recipient mismatch`);
        return false;
      }

      console.log(`✅ Payment verified on-chain: ${paymentProof.main_transaction_hash}`);
      return true;
    } catch (e) {
      console.error(`❌ Payment verification failed: ${e}`);
      return false;
    }
  }

  /**
   * Create payment requirements for receiving payments
   * Official x402 spec: https://github.com/coinbase/x402
   */
  createPaymentRequirements(
    amount: number,
    currency: string = 'USDC',
    serviceDescription: string = 'AI Agent Service',
    resource: string = '/'
  ): X402PaymentRequirements {
    // Get USDC address for asset field
    const asset = currency === 'USDC' ? this.usdcAddresses[this.network] : '0x0000000000000000000000000000000000000000';

    // Official x402 paymentRequirements schema
    return {
      scheme: 'exact', // x402 scheme for exact payment amount
      network: this.network,
      maxAmountRequired: ethers.parseUnits(amount.toString(), currency === 'USDC' ? 6 : 18).toString(),
      resource: resource,
      description: serviceDescription,
      mimeType: 'application/json',
      outputSchema: null,
      payTo: this.wallet.address,
      maxTimeoutSeconds: 60,
      asset: asset || '0x0000000000000000000000000000000000000000',
      extra: currency === 'USDC' && asset ? {
        name: 'USD Coin',
        version: '2'
      } : null
    };
  }

  /**
   * Get payment history (from on-chain events)
   */
  async getPaymentHistory(limit: number = 10): Promise<X402PaymentProof[]> {
    // In production, query blockchain events
    // For now, return empty array
    console.log(`📊 Payment history: querying last ${limit} payments...`);
    return [];
  }

  /**
   * Create cryptographic receipt for payment
   */
  createPaymentReceipt(paymentProof: X402PaymentProof): Record<string, any> {
    const receiptData = {
      payment_id: paymentProof.payment_id,
      transaction_hash: paymentProof.main_transaction_hash,
      from_address: paymentProof.from_address,
      to_address: paymentProof.to_address,
      amount: paymentProof.amount,
      currency: paymentProof.currency,
      protocol_fee: paymentProof.protocol_fee,
      network: paymentProof.network,
      chain_id: paymentProof.chain_id,
      timestamp: paymentProof.timestamp.toISOString(),
      status: paymentProof.status
    };

    // Create receipt hash
    const crypto = require('crypto');
    const receiptJson = JSON.stringify(receiptData);
    const receiptHash = crypto.createHash('sha256').update(receiptJson).digest('hex');

    return {
      receipt_type: 'x402_payment',
      receipt_hash: receiptHash,
      receipt_data: receiptData,
      verification_url: `https://explorer.base.org/tx/${paymentProof.main_transaction_hash}`,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Get payment statistics
   */
  getPaymentStats(): Record<string, any> {
    return {
      network: this.network,
      wallet_address: this.wallet.address,
      treasury_address: this.treasuryAddress,
      protocol_fee_percentage: this.protocolFeePercentage * 100,
      supported_currencies: ['ETH', 'USDC'],
      features: {
        instant_settlement: true,
        on_chain_verification: true,
        protocol_fees: true,
        multi_currency: true,
        payment_receipts: true,
        gasless_transfers: true // NEW: EIP-3009 gasless transfers
      }
    };
  }
}

