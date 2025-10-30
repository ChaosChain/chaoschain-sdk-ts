/**
 * X402 Payment Manager for ChaosChain SDK
 *
 * This module implements the Coinbase x402 HTTP 402 payment protocol,
 * enabling seamless cryptocurrency payments between AI agents.
 *
 * Based on: https://www.x402.org/ and https://github.com/coinbase/x402
 */

import { ethers } from 'ethers';
// import axios from 'axios'; // Not currently used
import { PaymentError } from './exceptions';
import { NetworkConfig } from './types';

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

/**
 * X402 Payment Manager - Coinbase HTTP 402 protocol implementation
 * 
 * Features:
 * - Real USDC/ETH transfers on Base, Ethereum, Optimism
 * - Automatic 2.5% protocol fee to ChaosChain treasury
 * - Cryptographic payment receipts
 * - Multi-network support
 */
export class X402PaymentManager {
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private network: NetworkConfig;
  private treasuryAddress: string;
  private protocolFeePercentage: number;
  private usdcAddresses: Record<string, string>;

  constructor(wallet: ethers.Wallet, network: NetworkConfig) {
    this.wallet = wallet;
    this.network = network;
    this.protocolFeePercentage = 0.025; // 2.5% ChaosChain fee

    // ChaosChain treasury addresses (per network)
    this.treasuryAddress = this.getTreasuryAddress(network);

    // USDC contract addresses
    this.usdcAddresses = {
      'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      'optimism-sepolia': '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
      'linea-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
    };

    // Get provider from wallet
    this.provider = wallet.provider as ethers.JsonRpcProvider;

    console.log(`✅ X402 Payment Manager initialized on ${network}`);
    console.log(`💰 Treasury: ${this.treasuryAddress}`);
    console.log(`📊 Protocol Fee: ${this.protocolFeePercentage * 100}%`);
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
   * Execute x402 payment on-chain
   */
  async executePayment(paymentRequest: X402PaymentRequest, recipientAddress: string): Promise<X402PaymentProof> {
    console.log(`💸 Executing x402 payment: ${paymentRequest.payment_id}`);
    console.log(`   Network: ${this.network}`);
    console.log(`   Recipient: ${recipientAddress}`);

    const currency = paymentRequest.currency.toUpperCase();
    const amount = paymentRequest.amount;
    const protocolFee = paymentRequest.protocol_fee;

    let mainTxHash: string;
    let feeTxHash: string | undefined;
    let chainId: number;

    try {
      // Get network details
      const networkInfo = await this.provider.getNetwork();
      chainId = Number(networkInfo.chainId);

      if (currency === 'ETH' || currency === 'NATIVE') {
        // Native token transfer
        const { mainTx, feeTx } = await this.executeNativePayment(recipientAddress, amount, protocolFee);
        mainTxHash = mainTx;
        feeTxHash = feeTx;
      } else if (currency === 'USDC') {
        // USDC transfer
        const { mainTx, feeTx } = await this.executeUsdcPayment(recipientAddress, amount, protocolFee);
        mainTxHash = mainTx;
        feeTxHash = feeTx;
      } else {
        throw new PaymentError(`Unsupported currency: ${currency}`);
      }

      // Get transaction receipt
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
        status: receipt?.status === 1 ? 'confirmed' : 'failed',
        confirmations: 1
      };

      console.log(`✅ x402 payment executed successfully`);
      console.log(`   Main TX: ${mainTxHash}`);
      if (feeTxHash) {
        console.log(`   Fee TX: ${feeTxHash}`);
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
   * Execute USDC payment
   */
  private async executeUsdcPayment(
    recipientAddress: string,
    amount: number,
    protocolFee: number
  ): Promise<{ mainTx: string; feeTx?: string }> {
    // Get USDC contract address
    const usdcAddress = this.usdcAddresses[this.network];
    if (!usdcAddress) {
      throw new PaymentError(`USDC not supported on ${this.network}`);
    }

    // USDC has 6 decimals
    const amountUsdc = ethers.parseUnits(amount.toString(), 6);
    const feeUsdc = ethers.parseUnits(protocolFee.toString(), 6);

    // ERC-20 ABI (transfer function)
    const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];

    // Create USDC contract instance
    const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, this.wallet);

    // Send main payment
    const mainTx = await usdcContract.transfer(recipientAddress, amountUsdc);
    await mainTx.wait();

    // Send protocol fee to treasury
    let feeTxHash: string | undefined;
    if (protocolFee > 0) {
      const feeTx = await usdcContract.transfer(this.treasuryAddress, feeUsdc);
      await feeTx.wait();
      feeTxHash = feeTx.hash;
    }

    return {
      mainTx: mainTx.hash,
      feeTx: feeTxHash
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
        payment_receipts: true
      }
    };
  }
}

