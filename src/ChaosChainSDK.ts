/**
 * ChaosChain SDK - Main Entry Point
 * Production-ready SDK for building verifiable AI agents with complete feature parity to Python SDK
 */

import { ethers } from 'ethers';
import { WalletManager } from './WalletManager';
import { ChaosAgent } from './ChaosAgent';
import { X402PaymentManager } from './X402PaymentManager';
import { PaymentManager, PaymentMethodCredentials } from './PaymentManager';
import { X402Server } from './X402Server';
import { GoogleAP2Integration, GoogleAP2IntegrationResult } from './GoogleAP2Integration';
import { A2AX402Extension } from './A2AX402Extension';
import { ProcessIntegrity } from './ProcessIntegrity';
import { AutoStorageManager, StorageBackend } from './StorageBackends';
// import { IPFSLocalStorage } from './providers/storage/IPFSLocal'; // Not used
import {
  ChaosChainSDKConfig,
  NetworkConfig,
  AgentRole,
  AgentMetadata,
  AgentRegistration,
  FeedbackParams,
  UploadResult,
  UploadOptions,
  ComputeProvider,
} from './types';
import { PaymentMethod } from './types';
import { getNetworkInfo, getContractAddresses } from './utils/networks';
//
import { GatewayClient } from './GatewayClient';
import { StudioClient } from './StudioClient';
import type { WorkflowStatus, ScoreSubmissionMode } from './types';

/**
 * Main ChaosChain SDK Class - Complete TypeScript implementation
 *
 * Features:
 * - ERC-8004 v1.0 on-chain identity, reputation, and validation
 * - x402 crypto payments (USDC/ETH)
 * - Traditional payments (cards, Google Pay, Apple Pay, PayPal)
 * - Google AP2 intent verification
 * - Process integrity with cryptographic proofs
 * - Pluggable storage providers (IPFS, Pinata, Irys, 0G)
 * - Pluggable compute providers
 * - A2A-x402 extension for multi-payment support
 * - HTTP 402 paywall server
 */
export class ChaosChainSDK {
  // Core components
  private walletManager: WalletManager;
  private chaosAgent: ChaosAgent;
  private x402PaymentManager?: X402PaymentManager;
  private paymentManager?: PaymentManager;
  private storageBackend: StorageBackend;
  private computeProvider?: ComputeProvider;
  private provider: ethers.Provider;

  // Advanced integrations
  public googleAP2?: GoogleAP2Integration;
  public a2aX402Extension?: A2AX402Extension;
  public processIntegrity?: ProcessIntegrity;

  // Gateway client for workflow submission (optional)
  public gateway: GatewayClient | null = null;

  // Studio client for direct on-chain operations
  public studio: StudioClient;

  // Configuration
  public readonly agentName: string;
  public readonly agentDomain: string;
  public readonly agentRole: AgentRole | string;
  public readonly network: NetworkConfig | string;
  public readonly networkInfo: ReturnType<typeof getNetworkInfo>;

  // Current agent ID (set after registration)
  private _agentId?: bigint;

  constructor(config: ChaosChainSDKConfig) {
    this.agentName = config.agentName;
    this.agentDomain = config.agentDomain;
    this.agentRole = config.agentRole;
    this.network = config.network;

    // Get network info
    this.networkInfo = getNetworkInfo(config.network);

    // Initialize provider
    const rpcUrl = config.rpcUrl || this.networkInfo.rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Initialize wallet
    this.walletManager = new WalletManager(
      {
        privateKey: config.privateKey,
        mnemonic: config.mnemonic,
        walletFile: config.walletFile,
      },
      this.provider
    );

    // Initialize ChaosAgent (ERC-8004)
    const contractAddresses = getContractAddresses(config.network);
    this.chaosAgent = new ChaosAgent(
      contractAddresses,
      this.walletManager.getWallet(),
      this.provider
    );

    // Initialize storage provider
    if (config.storageProvider) {
      this.storageBackend = config.storageProvider as any as StorageBackend;
    } else if (config.enableStorage !== false) {
      // Auto-detect available storage backends
      this.storageBackend = new AutoStorageManager();
    } else {
      // Dummy storage provider
      this.storageBackend = {
        put: async () => ({ cid: '', provider: 'none' }),
        get: async () => Buffer.from(''),
      };
    }

    // Initialize payment managers (if enabled)
    if (config.enablePayments !== false) {
      // Crypto payments (x402 with EIP-3009 + facilitator)
      this.x402PaymentManager = new X402PaymentManager(
        this.walletManager.getWallet(),
        typeof config.network === 'string' ? (config.network as NetworkConfig) : config.network,
        {
          facilitatorUrl: config.facilitatorUrl,
          apiKey: config.facilitatorApiKey,
          mode: config.facilitatorMode,
          agentId: config.agentId,
        }
      );

      // Traditional + crypto payments (multi-method)
      const paymentCredentials: PaymentMethodCredentials = {
        stripe_secret_key: process.env.STRIPE_SECRET_KEY,
        google_pay_merchant_id: process.env.GOOGLE_PAY_MERCHANT_ID,
        apple_pay_merchant_id: process.env.APPLE_PAY_MERCHANT_ID,
        paypal_client_id: process.env.PAYPAL_CLIENT_ID,
        paypal_client_secret: process.env.PAYPAL_CLIENT_SECRET,
      };

      this.paymentManager = new PaymentManager(
        this.agentName,
        typeof config.network === 'string' ? (config.network as NetworkConfig) : config.network,
        this.walletManager.getWallet(),
        paymentCredentials
      );

      // A2A-x402 Extension (multi-payment support)
      this.a2aX402Extension = new A2AX402Extension(
        this.agentName,
        typeof config.network === 'string' ? (config.network as NetworkConfig) : config.network,
        this.paymentManager
      );
    }

    // Initialize Google AP2 (if enabled)
    if (config.enableAP2 !== false) {
      this.googleAP2 = new GoogleAP2Integration(
        this.agentName,
        process.env.GOOGLE_AP2_MERCHANT_PRIVATE_KEY
      );
    }

    // Initialize compute provider (if provided)
    this.computeProvider = config.computeProvider;

    // Initialize Process Integrity (if enabled)
    if (config.enableProcessIntegrity !== false) {
      this.processIntegrity = new ProcessIntegrity(
        this.agentName,
        this.storageBackend as any,
        this.computeProvider as any
      );
    }

    // Initialize Gateway client (if config provided)
    if (config.gatewayConfig) {
      this.gateway = new GatewayClient(config.gatewayConfig);
      console.log(`🌐 Gateway client initialized: ${config.gatewayConfig.gatewayUrl}`);
    }

    // Initialize Studio client for direct on-chain operations
    this.studio = new StudioClient({
      provider: this.provider,
      signer: this.walletManager.getWallet(),
      network: typeof config.network === 'string' ? config.network : config.network,
    });

    console.log(`🚀 ChaosChain SDK initialized for ${this.agentName}`);
    console.log(`   Network: ${this.network}`);
    console.log(`   Wallet: ${this.walletManager.getAddress()}`);
    console.log(`   Features:`);
    console.log(`     - ERC-8004: ✅`);
    console.log(`     - x402 Payments: ${this.x402PaymentManager ? '✅' : '❌'}`);
    console.log(`     - Multi-Payment: ${this.paymentManager ? '✅' : '❌'}`);
    console.log(`     - Google AP2: ${this.googleAP2 ? '✅' : '❌'}`);
    console.log(`     - Process Integrity: ${this.processIntegrity ? '✅' : '❌'}`);
    console.log(`     - Storage: ✅`);
  }

  // ============================================================================
  // ERC-8004 Identity Methods
  // ============================================================================

  /**
   * Register agent identity on-chain
   */
  async registerIdentity(metadata?: AgentMetadata): Promise<AgentRegistration> {
    const meta: AgentMetadata = metadata || {
      name: this.agentName,
      domain: this.agentDomain,
      role: this.agentRole,
    };

    const registration = await this.chaosAgent.registerIdentity(meta);
    this._agentId = registration.agentId;

    console.log(`✅ Agent #${registration.agentId} registered on-chain`);
    return registration;
  }

  /**
   * Get agent metadata
   */
  async getAgentMetadata(agentId: bigint): Promise<AgentMetadata | null> {
    return this.chaosAgent.getAgentMetadata(agentId);
  }

  /**
   * Update agent metadata
   */
  async updateAgentMetadata(agentId: bigint, metadata: AgentMetadata): Promise<string> {
    return this.chaosAgent.updateAgentMetadata(agentId, metadata);
  }

  /**
   * Get current agent ID
   */
  getAgentId(): bigint | undefined {
    return this._agentId;
  }

  // ============================================================================
  // ERC-8004 Reputation Methods
  // ============================================================================

  /**
   * Generate feedback authorization (EIP-191 signing)
   */
  async generateFeedbackAuthorization(
    agentId: bigint,
    clientAddress: string,
    indexLimit: bigint,
    expiry: bigint
  ): Promise<string> {
    return this.chaosAgent.generateFeedbackAuthorization(
      agentId,
      clientAddress,
      indexLimit,
      expiry
    );
  }

  /**
   * Give feedback to an agent
   */
  async giveFeedback(params: FeedbackParams): Promise<string> {
    return this.chaosAgent.giveFeedback(params);
  }

  /**
   * Submit feedback with payment proof (ERC-8004 reputation enrichment)
   */
  async submitFeedbackWithPayment(
    agentId: bigint,
    score: number,
    feedbackData: Record<string, any>,
    paymentProof: Record<string, any>
  ): Promise<{ feedbackTxHash: string; feedbackUri: string }> {
    // Store feedback data with payment proof
    const fullFeedbackData = {
      ...feedbackData,
      score,
      proof_of_payment: paymentProof,
      timestamp: new Date().toISOString(),
    };

    // Upload to storage
    const feedbackJson = JSON.stringify(fullFeedbackData);
    const result = await (this.storageBackend as any).put(
      Buffer.from(feedbackJson),
      'application/json'
    );
    const feedbackUri = `ipfs://${result.cid}`;

    // Submit feedback on-chain
    const txHash = await this.chaosAgent.giveFeedback({
      agentId,
      rating: score,
      feedbackUri,
    });

    console.log(`✅ Feedback submitted with payment proof`);
    console.log(`   TX: ${txHash}`);
    console.log(`   URI: ${feedbackUri}`);

    return { feedbackTxHash: txHash, feedbackUri };
  }

  /**
   * Get agent reputation score (ERC-8004 v1.0)
   */
  async getReputationScore(agentId: bigint): Promise<number> {
    const summary = await this.chaosAgent.getSummary(agentId, [], ethers.ZeroHash, ethers.ZeroHash);
    return summary.averageScore;
  }

  /**
   * Read all feedback for an agent
   */
  async readAllFeedback(
    agentId: bigint,
    clientAddresses: string[] = [],
    tag1: string = ethers.ZeroHash,
    tag2: string = ethers.ZeroHash,
    includeRevoked: boolean = false
  ) {
    return this.chaosAgent.readAllFeedback(agentId, clientAddresses, tag1, tag2, includeRevoked);
  }

  /**
   * Get feedback summary statistics
   */
  async getFeedbackSummary(
    agentId: bigint,
    clientAddresses: string[] = [],
    tag1: string = ethers.ZeroHash,
    tag2: string = ethers.ZeroHash
  ) {
    return this.chaosAgent.getSummary(agentId, clientAddresses, tag1, tag2);
  }

  /**
   * Get clients who gave feedback
   */
  async getClients(agentId: bigint): Promise<string[]> {
    return this.chaosAgent.getClients(agentId);
  }

  // ============================================================================
  // ERC-8004 Validation Methods
  // ============================================================================

  /**
   * Request validation from validator (ERC-8004 v1.0)
   */
  async requestValidation(
    validatorAddress: string,
    agentId: bigint,
    requestUri: string,
    requestHash: string
  ): Promise<string> {
    return this.chaosAgent.requestValidation(validatorAddress, agentId, requestUri, requestHash);
  }

  /**
   * Respond to validation request (ERC-8004 v1.0)
   */
  async respondToValidation(
    requestHash: string,
    response: number,
    responseUri: string,
    responseHash: string,
    tag?: string
  ): Promise<string> {
    return this.chaosAgent.respondToValidation(
      requestHash,
      response,
      responseUri,
      responseHash,
      tag
    );
  }

  /**
   * Get validation status
   */
  async getValidationStatus(requestHash: string) {
    return this.chaosAgent.getValidationStatus(requestHash);
  }

  /**
   * Get validation summary for an agent
   */
  async getValidationSummary(
    agentId: bigint,
    validatorAddresses: string[] = [],
    tag: string = ethers.ZeroHash
  ) {
    return this.chaosAgent.getValidationSummary(agentId, validatorAddresses, tag);
  }

  /**
   * Get validation stats (alias for getValidationSummary)
   */
  async getValidationStats(agentId: bigint) {
    return this.getValidationSummary(agentId);
  }

  // ============================================================================
  // x402 Crypto Payment Methods
  // ============================================================================

  /**
   * Create x402 payment request
   */
  createX402PaymentRequest(
    fromAgent: string,
    toAgent: string,
    amount: number,
    currency: string = 'USDC',
    serviceDescription: string = 'AI Agent Service'
  ): Record<string, any> {
    if (!this.x402PaymentManager) {
      throw new Error('x402 payments not enabled');
    }
    return this.x402PaymentManager.createPaymentRequest(
      fromAgent,
      toAgent,
      amount,
      currency,
      serviceDescription
    );
  }

  /**
   * Execute x402 crypto payment
   */
  async executeX402Payment(
    paymentRequest: Record<string, any>,
    recipientAddress: string
  ): Promise<Record<string, any>> {
    if (!this.x402PaymentManager) {
      throw new Error('x402 payments not enabled');
    }
    return this.x402PaymentManager.executePayment(paymentRequest as any, recipientAddress);
  }

  /**
   * Create x402 payment requirements (for receiving payments)
   */
  createX402PaymentRequirements(
    amount: number,
    currency: string = 'USDC',
    serviceDescription: string = 'AI Agent Service',
    evidenceCid?: string
  ): Record<string, any> {
    if (!this.x402PaymentManager) {
      throw new Error('x402 payments not enabled');
    }
    return this.x402PaymentManager.createPaymentRequirements(
      amount,
      currency,
      serviceDescription,
      evidenceCid
    );
  }

  /**
   * Create x402 paywall server
   */
  createX402PaywallServer(port: number = 8402): X402Server {
    if (!this.x402PaymentManager) {
      throw new Error('x402 payments not enabled');
    }
    return new X402Server(this.x402PaymentManager, { port });
  }

  /**
   * Get x402 payment history
   */
  async getX402PaymentHistory(limit: number = 10): Promise<any[]> {
    if (!this.x402PaymentManager) {
      throw new Error('x402 payments not enabled');
    }
    return this.x402PaymentManager.getPaymentHistory(limit);
  }

  /**
   * Calculate total cost including protocol fee (2.5%)
   */
  calculateTotalCost(
    amount: string,
    currency: string = 'USDC'
  ): { amount: string; fee: string; total: string; currency: string } {
    const amountNum = parseFloat(amount);
    const fee = amountNum * 0.025; // 2.5% protocol fee
    const total = amountNum + fee;

    return {
      amount: amountNum.toFixed(6),
      fee: fee.toFixed(6),
      total: total.toFixed(6),
      currency,
    };
  }

  /**
   * Get ETH balance
   */
  async getETHBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.getAddress());
    return ethers.formatEther(balance);
  }

  /**
   * Get USDC balance (if USDC contract exists on network)
   */
  async getUSDCBalance(): Promise<string> {
    if (!this.x402PaymentManager) {
      throw new Error('x402 payments not enabled - cannot get USDC balance');
    }
    // This would need USDC contract address for the network
    // For now, return placeholder
    return '0.0';
  }

  // ============================================================================
  // Traditional Payment Methods (Cards, Google Pay, Apple Pay, PayPal)
  // ============================================================================

  /**
   * Execute traditional payment
   */
  executeTraditionalPayment(
    paymentMethod: PaymentMethod,
    amount: number,
    currency: string,
    paymentData: Record<string, any>
  ): Record<string, any> {
    if (!this.paymentManager) {
      throw new Error('Payment manager not enabled');
    }
    return this.paymentManager.executeTraditionalPayment(
      paymentMethod,
      amount,
      currency,
      paymentData
    );
  }

  /**
   * Get supported payment methods
   */
  getSupportedPaymentMethods(): PaymentMethod[] {
    if (!this.paymentManager) {
      return [];
    }
    return this.paymentManager.getSupportedPaymentMethods();
  }

  /**
   * Get payment methods status
   */
  getPaymentMethodsStatus(): Record<string, boolean> {
    if (!this.paymentManager) {
      return {};
    }
    return this.paymentManager.getPaymentMethodsStatus();
  }

  // ============================================================================
  // Google AP2 Intent Verification Methods
  // ============================================================================

  /**
   * Create Google AP2 intent mandate
   */
  createIntentMandate(
    userDescription: string,
    merchants?: string[],
    skus?: string[],
    requiresRefundability: boolean = false,
    expiryMinutes: number = 60
  ): GoogleAP2IntegrationResult {
    if (!this.googleAP2) {
      throw new Error('Google AP2 not enabled');
    }
    return this.googleAP2.createIntentMandate(
      userDescription,
      merchants,
      skus,
      requiresRefundability,
      expiryMinutes
    );
  }

  /**
   * Create Google AP2 cart mandate with JWT signing
   */
  async createCartMandate(
    cartId: string,
    items: Array<{ name: string; price: number }>,
    totalAmount: number,
    currency: string = 'USD',
    merchantName?: string,
    expiryMinutes: number = 15
  ): Promise<GoogleAP2IntegrationResult> {
    if (!this.googleAP2) {
      throw new Error('Google AP2 not enabled');
    }
    return this.googleAP2.createCartMandate(
      cartId,
      items,
      totalAmount,
      currency,
      merchantName,
      expiryMinutes
    );
  }

  /**
   * Verify JWT token
   */
  async verifyJwtToken(token: string): Promise<Record<string, any>> {
    if (!this.googleAP2) {
      throw new Error('Google AP2 not enabled');
    }
    return this.googleAP2.verifyJwtToken(token);
  }

  // ============================================================================
  // Process Integrity Methods
  // ============================================================================

  /**
   * Register function for integrity verification
   */
  registerFunction(func: (...args: any[]) => Promise<any>): void {
    if (!this.processIntegrity) {
      throw new Error('Process integrity not enabled');
    }
    this.processIntegrity.registerFunction(func);
  }

  /**
   * Execute function with integrity proof
   */
  async executeWithIntegrityProof(
    functionName: string,
    args: Record<string, any>
  ): Promise<{ result: any; proof: Record<string, any> }> {
    if (!this.processIntegrity) {
      throw new Error('Process integrity not enabled');
    }
    const [result, proof] = await this.processIntegrity.executeWithProof(functionName, args);
    return { result, proof: proof as any };
  }

  /**
   * Verify integrity proof
   */
  async verifyIntegrityProof(_proof: Record<string, any>): Promise<boolean> {
    if (!this.processIntegrity) {
      throw new Error('Process integrity not enabled');
    }
    // TODO: Implement verifyProof in ProcessIntegrity
    return true;
  }

  // ============================================================================
  // Storage Methods
  // ============================================================================

  /**
   * Upload data to storage
   */
  async upload(data: any, _options?: UploadOptions): Promise<UploadResult> {
    const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
    const buffer = Buffer.from(jsonData);

    const result = await this.storageBackend.put(buffer, 'application/json');

    return {
      cid: result.cid,
      uri: result.url || `ipfs://${result.cid}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Download data from storage
   */
  async download(cid: string): Promise<any> {
    const buffer = await this.storageBackend.get(cid);
    const data = buffer.toString('utf-8');

    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  /**
   * Store evidence (convenience method)
   */
  async storeEvidence(evidenceData: Record<string, any>): Promise<string> {
    const result = await (this.storageBackend as any).put(
      Buffer.from(JSON.stringify(evidenceData)),
      'application/json'
    );
    console.log(`📦 Stored evidence: ${result.cid}`);
    return result.cid;
  }

  // ============================================================================
  // Wallet & Network Methods
  // ============================================================================

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.walletManager.getAddress();
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<bigint> {
    return this.walletManager.getBalance();
  }

  /**
   * Get network info
   */
  getNetworkInfo() {
    return this.networkInfo;
  }

  /**
   * Get SDK version
   */
  getVersion(): string {
    return '0.1.3';
  }

  /**
   * Get SDK capabilities summary
   */
  getCapabilities(): Record<string, any> {
    return {
      agent_name: this.agentName,
      agent_domain: this.agentDomain,
      agent_role: this.agentRole,
      network: this.network,
      wallet_address: this.walletManager.getAddress(),
      agent_id: this._agentId ? this._agentId.toString() : undefined,
      features: {
        erc_8004_identity: true,
        erc_8004_reputation: true,
        erc_8004_validation: true,
        x402_crypto_payments: !!this.x402PaymentManager,
        traditional_payments: !!this.paymentManager,
        google_ap2_intents: !!this.googleAP2,
        process_integrity: !!this.processIntegrity,
        storage: true,
        compute: !!this.computeProvider,
      },
      supported_payment_methods: this.paymentManager
        ? this.paymentManager.getSupportedPaymentMethods()
        : [],
      storage_backends:
        this.storageBackend instanceof AutoStorageManager
          ? (this.storageBackend as AutoStorageManager).getAvailableBackends()
          : [this.storageBackend.constructor.name],
    };
  }

  /**
   * Check if Gateway is configured.
   */
  isGatewayEnabled(): boolean {
    return this.gateway !== null;
  }

  /**
   * Get Gateway client instance.
   * @throws Error if Gateway is not configured
   */
  getGateway(): GatewayClient {
    if (!this.gateway) {
      throw new Error(`Gateway not configured pass gatewayConfig to SDK constructor`);
    }
    return this.gateway;
  }

  /**
   * Submit work via Gateway.
   *
   * The Gateway handles XMTP, DKG, Arweave archival, and on-chain submission.
   */
  async submitWorkViaGateway(
    studioAddress: string,
    epoch: number,
    agentAddress: string,
    dataHash: string,
    threadRoot: string,
    evidenceRoot: string,
    evidenceContent: Buffer | string,
    signerAddress: string
  ): Promise<WorkflowStatus> {
    return this.getGateway().submitWork(
      studioAddress,
      epoch,
      agentAddress,
      dataHash,
      threadRoot,
      evidenceRoot,
      evidenceContent,
      signerAddress
    );
  }

  /**
   * Submit score via Gateway.
   */
  async submitScoreViaGateway(
    studioAddress: string,
    epoch: number,
    validatorAddress: string,
    dataHash: string,
    scores: number[],
    signerAddress: string,
    options?: {
      workerAddress?: string;
      salt?: string;
      mode?: ScoreSubmissionMode;
    }
  ): Promise<WorkflowStatus> {
    return this.getGateway().submitScore(
      studioAddress,
      epoch,
      validatorAddress,
      dataHash,
      scores,
      signerAddress,
      options
    );
  }

  /**
   * Close epoch via Gateway.
   * WARNING: This is economically final and cannot be undone.
   */
  async closeEpochViaGateway(
    studioAddress: string,
    epoch: number,
    signerAddress: string
  ): Promise<WorkflowStatus> {
    return this.getGateway().closeEpoch(studioAddress, epoch, signerAddress);
  }

  /**
   * Wait for workflow completion.
   */
  async waitWorkflow(
    workflowId: string,
    options?: {
      maxWait?: number;
      pollInterval?: number;
      onProgress?: (status: WorkflowStatus) => void;
    }
  ): Promise<WorkflowStatus> {
    return this.getGateway().waitForCompletion(workflowId, options);
  }

  // ============================================================================
  // Studio Direct On-Chain Methods
  // ============================================================================

  /**
   * Create a new Studio on ChaosChain.
   * @see StudioClient.createStudio for full documentation
   */
  async createStudio(
    name: string,
    logicModuleAddress: string
  ): Promise<{ proxyAddress: string; studioId: bigint }> {
    return this.studio.createStudio(name, logicModuleAddress);
  }

  /**
   * Register agent with a Studio.
   * @see StudioClient.registerWithStudio for full documentation
   */
  async registerWithStudio(
    studioAddress: string,
    agentId: string,
    role: number,
    stakeAmount?: bigint
  ): Promise<string> {
    return this.studio.registerWithStudio(studioAddress, agentId, role, stakeAmount);
  }

  /**
   * Get pending rewards for an account.
   * @see StudioClient.getPendingRewards for full documentation
   */
  async getStudioPendingRewards(studioAddress: string, account: string): Promise<bigint> {
    return this.studio.getPendingRewards(studioAddress, account);
  }

  /**
   * Withdraw pending rewards from a Studio.
   * @see StudioClient.withdrawRewards for full documentation
   */
  async withdrawStudioRewards(studioAddress: string): Promise<string> {
    return this.studio.withdrawRewards(studioAddress);
  }
}
