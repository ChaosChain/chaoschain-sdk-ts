/**
 * x402 Payment Protocol Implementation
 * HTTP 402 Payment Required - Coinbase Protocol
 */

import { ethers } from 'ethers';
import { X402PaymentParams, X402Payment, PaymentReceipt } from './types';
import { ERC20_ABI, getUSDCAddress } from './utils/contracts';

export class X402PaymentManager {
  private signer: ethers.Signer;
  private provider: ethers.Provider;
  private network: string;
  private treasuryAddress: string;
  private feePercentage: number;

  constructor(
    signer: ethers.Signer,
    provider: ethers.Provider,
    network: string,
    treasuryAddress: string = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1', // ChaosChain treasury
    feePercentage: number = 2.5
  ) {
    this.signer = signer;
    this.provider = provider;
    this.network = network;
    this.treasuryAddress = treasuryAddress;
    this.feePercentage = feePercentage;
  }

  /**
   * Execute x402 payment
   */
  async executePayment(params: X402PaymentParams): Promise<X402Payment> {
    const { toAgent, amount, currency = 'USDC', serviceType, metadata } = params;

    // Parse amount
    const amountBigInt = ethers.parseUnits(amount, currency === 'ETH' ? 18 : 6);

    // Calculate fee
    const feeAmount = (amountBigInt * BigInt(Math.floor(this.feePercentage * 100))) / 10000n;
    const netAmount = amountBigInt - feeAmount;

    let mainTxHash: string;
    let feeTxHash: string | undefined;

    if (currency === 'ETH') {
      // ETH payment
      mainTxHash = await this.sendETH(toAgent, netAmount);
      if (feeAmount > 0n) {
        feeTxHash = await this.sendETH(this.treasuryAddress, feeAmount);
      }
    } else if (currency === 'USDC') {
      // USDC payment
      mainTxHash = await this.sendUSDC(toAgent, netAmount);
      if (feeAmount > 0n) {
        feeTxHash = await this.sendUSDC(this.treasuryAddress, feeAmount);
      }
    } else {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    const from = await this.signer.getAddress();

    return {
      from,
      to: toAgent,
      amount,
      currency,
      txHash: mainTxHash,
      timestamp: Date.now(),
      feeAmount: ethers.formatUnits(feeAmount, currency === 'ETH' ? 18 : 6),
      feeTxHash,
    };
  }

  /**
   * Send ETH
   */
  private async sendETH(to: string, amount: bigint): Promise<string> {
    const tx = await this.signer.sendTransaction({
      to,
      value: amount,
    });
    const receipt = await tx.wait();
    return receipt!.hash;
  }

  /**
   * Send USDC (ERC-20)
   */
  private async sendUSDC(to: string, amount: bigint): Promise<string> {
    const usdcAddress = getUSDCAddress(this.network);

    if (usdcAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error(`USDC not available on network: ${this.network}`);
    }

    const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, this.signer);

    const tx = await usdcContract.transfer(to, amount);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Get USDC balance
   */
  async getUSDCBalance(address?: string): Promise<string> {
    const usdcAddress = getUSDCAddress(this.network);
    if (usdcAddress === '0x0000000000000000000000000000000000000000') {
      return '0';
    }

    const usdcContract = new ethers.Contract(
      usdcAddress,
      ERC20_ABI,
      this.provider
    );

    const addr = address || (await this.signer.getAddress());
    const balance = await usdcContract.balanceOf(addr);
    return ethers.formatUnits(balance, 6);
  }

  /**
   * Get ETH balance
   */
  async getETHBalance(address?: string): Promise<string> {
    const addr = address || (await this.signer.getAddress());
    const balance = await this.provider.getBalance(addr);
    return ethers.formatEther(balance);
  }

  /**
   * Approve USDC spending
   */
  async approveUSDC(spender: string, amount: string): Promise<string> {
    const usdcAddress = getUSDCAddress(this.network);
    if (usdcAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error(`USDC not available on network: ${this.network}`);
    }

    const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, this.signer);
    const amountBigInt = ethers.parseUnits(amount, 6);

    const tx = await usdcContract.approve(spender, amountBigInt);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Create payment receipt
   */
  createReceipt(payment: X402Payment): PaymentReceipt {
    const receiptData = {
      from: payment.from,
      to: payment.to,
      amount: payment.amount,
      currency: payment.currency,
      timestamp: payment.timestamp,
      txHash: payment.txHash,
    };

    // Create deterministic payment ID
    const paymentId = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(receiptData))
    );

    // Sign the receipt
    const message = `Payment Receipt\nID: ${paymentId}\nFrom: ${payment.from}\nTo: ${payment.to}\nAmount: ${payment.amount} ${payment.currency}\nTx: ${payment.txHash}`;
    
    // Note: Signature must be created asynchronously, so we return unsigned here
    return {
      paymentId,
      ...receiptData,
      signature: '', // Will be filled by signReceipt
    };
  }

  /**
   * Sign payment receipt
   */
  async signReceipt(receipt: PaymentReceipt): Promise<PaymentReceipt> {
    const message = `Payment Receipt\nID: ${receipt.paymentId}\nFrom: ${receipt.from}\nTo: ${receipt.to}\nAmount: ${receipt.amount} ${receipt.currency}\nTx: ${receipt.txHash}`;
    
    const signature = await this.signer.signMessage(message);

    return {
      ...receipt,
      signature,
    };
  }

  /**
   * Verify payment receipt
   */
  async verifyReceipt(receipt: PaymentReceipt): Promise<boolean> {
    try {
      const message = `Payment Receipt\nID: ${receipt.paymentId}\nFrom: ${receipt.from}\nTo: ${receipt.to}\nAmount: ${receipt.amount} ${receipt.currency}\nTx: ${receipt.txHash}`;

      const recoveredAddress = ethers.verifyMessage(message, receipt.signature);
      return recoveredAddress.toLowerCase() === receipt.from.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * Verify transaction on chain
   */
  async verifyTransaction(txHash: string): Promise<boolean> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return false;

      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt !== null && receipt.status === 1;
    } catch {
      return false;
    }
  }

  /**
   * Get payment requirements (HTTP 402 response)
   * Spec: https://github.com/coinbase/x402
   */
  async createPaymentRequirements(
    amount: string,
    currency: string = 'USDC',
    resource: string = '/',
    description?: string
  ): Promise<{
    statusCode: 402;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }> {
    const address = await this.signer.getAddress();
    const usdcAddress = currency === 'USDC' ? getUSDCAddress(this.network) : '0x0000000000000000000000000000000000000000';

    // Official x402 paymentRequirements schema
    const paymentRequirements = {
      scheme: 'exact', // x402 scheme for exact payment amount
      network: this.network,
      maxAmountRequired: ethers.parseUnits(amount, currency === 'ETH' ? 18 : 6).toString(),
      resource: resource,
      description: description || 'Payment required for service',
      mimeType: 'application/json',
      outputSchema: null,
      payTo: address,
      maxTimeoutSeconds: 60,
      asset: currency === 'USDC' ? usdcAddress : '0x0000000000000000000000000000000000000000',
      extra: currency === 'USDC' ? {
        name: 'USD Coin',
        version: '2'
      } : null
    };

    return {
      statusCode: 402,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        x402Version: 1,
        accepts: [paymentRequirements], // Must be array per spec
        error: 'Payment Required'
      },
    };
  }

  /**
   * Calculate total cost with fees
   */
  calculateTotalCost(amount: string, currency: string = 'USDC'): {
    amount: string;
    fee: string;
    total: string;
  } {
    const decimals = currency === 'ETH' ? 18 : 6;
    const amountBigInt = ethers.parseUnits(amount, decimals);
    const feeAmount = (amountBigInt * BigInt(Math.floor(this.feePercentage * 100))) / 10000n;
    const totalAmount = amountBigInt + feeAmount;

    return {
      amount: ethers.formatUnits(amountBigInt, decimals),
      fee: ethers.formatUnits(feeAmount, decimals),
      total: ethers.formatUnits(totalAmount, decimals),
    };
  }

  /**
   * Set treasury address
   */
  setTreasuryAddress(address: string): void {
    this.treasuryAddress = address;
  }

  /**
   * Set fee percentage
   */
  setFeePercentage(percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Fee percentage must be between 0 and 100');
    }
    this.feePercentage = percentage;
  }

  /**
   * Get current fee percentage
   */
  getFeePercentage(): number {
    return this.feePercentage;
  }
}

