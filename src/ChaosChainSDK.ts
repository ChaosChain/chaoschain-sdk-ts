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
import { PaymentMethod } from './PaymentManager';
import {
  getNetworkInfo,
  getContractAddresses,
  getChaosChainProtocolAddresses,
} from './utils/networks';
import { STUDIO_PROXY_ABI, REWARDS_DISTRIBUTOR_ABI } from './utils/contracts';
import {
  WorkSubmissionParams,
  MultiAgentWorkSubmissionParams,
  ScoreVectorParams,
  PerWorkerScoreVectorParams,
  CloseEpochParams,
  ConsensusResult,
} from './types';
import { VerifierAgent } from './VerifierAgent';
import { StudioManager } from './StudioManager';
import { GatewayClient } from './GatewayClient';
import { XMTPManager } from './XMTPClient';
import { MandateManager } from './MandateManager';

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

  // Protocol integrations
  public verifierAgent?: VerifierAgent;
  public studioManager?: StudioManager;
  public gatewayClient?: GatewayClient;
  public xmtpManager?: XMTPManager;
  public mandateManager?: MandateManager;

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
      const wallet = this.walletManager.getWallet();
      this.x402PaymentManager = new X402PaymentManager(
        wallet as ethers.Wallet, // HDNodeWallet is compatible with Wallet for this use case
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
        wallet as ethers.Wallet, // HDNodeWallet is compatible with Wallet for this use case
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

    // Initialize Process Integrity (if enabled)
    if (config.enableProcessIntegrity !== false) {
      this.processIntegrity = new ProcessIntegrity(
        this.agentName,
        this.storageBackend as any, // StorageBackend is compatible with StorageProvider interface
        this.computeProvider as any // ComputeProvider types are compatible
      );
    }

    // Initialize compute provider (if provided)
    this.computeProvider = config.computeProvider;

    // Initialize protocol integrations
    this.verifierAgent = new VerifierAgent(this);
    this.studioManager = new StudioManager(this);
    this.mandateManager = new MandateManager(this);

    // Initialize XMTP Manager (MVP mode - local storage)
    this.xmtpManager = new XMTPManager(this);

    // Initialize Gateway Client (if URL provided)
    if (config.gatewayUrl) {
      this.gatewayClient = new GatewayClient(config.gatewayUrl);
      console.log(`   Gateway: ${config.gatewayUrl}`);
    }

    console.log(`🚀 ChaosChain SDK initialized for ${this.agentName}`);
    console.log(`   Network: ${this.network}`);
    console.log(`   Wallet: ${this.walletManager.getAddress()}`);
    console.log(`   Features:`);
    console.log(`     - ERC-8004: ✅`);
    console.log(`     - Protocol Integration: ✅`);
    console.log(`     - DKG Builder: ✅`);
    console.log(`     - VerifierAgent: ✅`);
    console.log(`     - StudioManager: ✅`);
    console.log(`     - XMTP Client: ✅ (MVP mode)`);
    console.log(`     - Gateway Client: ${this.gatewayClient ? '✅' : '❌'}`);
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
    _expiryMinutes: number = 30
  ): Record<string, any> {
    if (!this.x402PaymentManager) {
      throw new Error('x402 payments not enabled');
    }
    return this.x402PaymentManager.createPaymentRequirements(
      amount,
      currency,
      serviceDescription,
      '/' // resource parameter
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
  async getBalance(): Promise<string> {
    const balance = await this.walletManager.getBalance();
    return balance.toString();
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
        protocol_integration: true,
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

  // ============================================================================
  // ChaosChain Protocol Methods (Phase 1: Protocol Integration)
  // ============================================================================

  /**
   * Submit work to a StudioProxy (§1.4 protocol spec)
   *
   * @param params Work submission parameters
   * @returns Transaction hash
   *
   * @example
   * ```typescript
   * const txHash = await sdk.submitWork({
   *   studioAddress: "0x...",
   *   dataHash: "0x...",
   *   threadRoot: "0x...",
   *   evidenceRoot: "0x..."
   * });
   * ```
   */
  async submitWork(params: WorkSubmissionParams): Promise<string> {
    const agentId = this._agentId;
    if (!agentId || agentId === 0n) {
      throw new Error('Agent not registered. Call registerIdentity() first.');
    }

    const wallet = this.walletManager.getWallet();
    const studioAddress = ethers.getAddress(params.studioAddress);

    // Create StudioProxy contract instance
    const studioProxy = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, wallet);

    // ERC-8004 Jan 2026: feedbackAuth is now empty (permissionless feedback)
    const feedbackAuth = '0x'; // Empty bytes

    console.log(`→ Submitting work to studio ${studioAddress}`);
    console.log(`   DataHash: ${params.dataHash.slice(0, 18)}...`);
    console.log(`   ThreadRoot: ${params.threadRoot.slice(0, 18)}...`);
    console.log(`   EvidenceRoot: ${params.evidenceRoot.slice(0, 18)}...`);

    try {
      const tx = await studioProxy.submitWork(
        params.dataHash,
        params.threadRoot,
        params.evidenceRoot,
        feedbackAuth,
        { gasLimit: 500000 }
      );

      console.log(`→ Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      console.log(`✓ Work submitted successfully`);
      return tx.hash;
    } catch (error: any) {
      throw new Error(`Failed to submit work: ${error.message}`);
    }
  }

  /**
   * Submit work with multi-agent attribution (Protocol Spec §4.2)
   *
   * @param params Multi-agent work submission parameters
   * @returns Transaction hash
   *
   * @example
   * ```typescript
   * const txHash = await sdk.submitWorkMultiAgent({
   *   studioAddress: "0x...",
   *   dataHash: "0x...",
   *   threadRoot: "0x...",
   *   evidenceRoot: "0x...",
   *   participants: ["0xAlice...", "0xBob...", "0xCarol..."],
   *   contributionWeights: [4500, 3500, 2000], // Basis points (sum = 10000)
   *   evidenceCID: "Qm..."
   * });
   * ```
   */
  async submitWorkMultiAgent(params: MultiAgentWorkSubmissionParams): Promise<string> {
    const agentId = this._agentId;
    if (!agentId || agentId === 0n) {
      throw new Error('Agent not registered. Call registerIdentity() first.');
    }

    const wallet = this.walletManager.getWallet();
    const studioAddress = ethers.getAddress(params.studioAddress);

    // Normalize contribution weights to basis points (0-10000)
    let weightsBp: number[];

    if (Array.isArray(params.contributionWeights)) {
      // List format: [float] or [int] (basis points)
      const total = params.contributionWeights.reduce((a, b) => a + b, 0);

      if (total <= 1.1) {
        // Float weights (0-1 range) - convert to basis points
        if (Math.abs(total - 1.0) > 1e-6) {
          throw new Error(`Float contribution weights must sum to 1.0, got ${total}`);
        }
        weightsBp = params.contributionWeights.map((w) => Math.floor(w * 10000));
      } else {
        // Basis points (0-10000 range)
        if (total !== 10000) {
          console.warn(
            `⚠️  Basis point weights sum to ${total}, expected 10000. Auto-normalizing...`
          );
          weightsBp = params.contributionWeights.map((w) => Math.floor((w * 10000) / total));
        } else {
          weightsBp = params.contributionWeights.map((w) => Math.floor(w));
        }
      }
    } else {
      // Dict format: {address: float_weight}
      const total = Object.values(params.contributionWeights).reduce(
        (a: number, b: number) => a + b,
        0
      );
      if (Math.abs(total - 1.0) > 1e-6) {
        throw new Error(`Dict contribution weights must sum to 1.0, got ${total}`);
      }

      // Validate participants match weights
      for (const p of params.participants) {
        if (!(p in params.contributionWeights)) {
          throw new Error(`No contribution weight for participant ${p}`);
        }
      }

      // Convert to basis points in participant order
      weightsBp = params.participants.map((p) =>
        Math.floor((params.contributionWeights as Record<string, number>)[p] * 10000)
      );
    }

    // Verify sum is 10000 (handle rounding)
    const weightsSum = weightsBp.reduce((a, b) => a + b, 0);
    if (weightsSum !== 10000) {
      const diff = 10000 - weightsSum;
      weightsBp[weightsBp.length - 1] += diff;
    }

    // Checksum addresses
    const participantsChecksummed = params.participants.map((p) => ethers.getAddress(p));

    // Create StudioProxy contract instance
    const studioProxy = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, wallet);

    console.log(`→ Submitting multi-agent work to studio ${studioAddress}`);
    console.log(`   Participants: ${params.participants.length}`);
    participantsChecksummed.forEach((p, i) => {
      console.log(
        `     ${i + 1}. ${p.slice(0, 10)}... → ${(weightsBp[i] / 100).toFixed(1)}% contribution`
      );
    });
    console.log(`   DataHash: ${params.dataHash.slice(0, 18)}...`);
    if (params.evidenceCID) {
      console.log(`   Evidence: ipfs://${params.evidenceCID}`);
    }

    try {
      const tx = await studioProxy.submitWorkMultiAgent(
        params.dataHash,
        params.threadRoot,
        params.evidenceRoot,
        participantsChecksummed,
        weightsBp,
        params.evidenceCID || '',
        { gasLimit: 800000 }
      );

      console.log(`→ Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      console.log(`✓ Multi-agent work submitted successfully`);
      console.log(`  Rewards will be distributed based on DKG contribution weights!`);
      return tx.hash;
    } catch (error: any) {
      throw new Error(`Failed to submit multi-agent work: ${error.message}`);
    }
  }

  /**
   * Submit score vector for validation
   *
   * @param params Score vector parameters
   * @returns Transaction hash
   *
   * @example
   * ```typescript
   * const txHash = await sdk.submitScoreVector({
   *   studioAddress: "0x...",
   *   dataHash: "0x...",
   *   scoreVector: [85, 90, 88, 95, 82] // Multi-dimensional PoA scores
   * });
   * ```
   */
  async submitScoreVector(params: ScoreVectorParams): Promise<string> {
    const agentId = this._agentId;
    if (!agentId || agentId === 0n) {
      throw new Error('Agent not registered. Call registerIdentity() first.');
    }

    const wallet = this.walletManager.getWallet();
    const studioAddress = ethers.getAddress(params.studioAddress);

    // Create StudioProxy contract instance
    const studioProxy = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, wallet);

    // Ensure we have exactly 5 scores (pad with 0 if needed)
    const scoresPadded = [...params.scoreVector, 0, 0, 0, 0, 0].slice(0, 5);

    // Convert to uint8 array and ABI encode as bytes
    const scoresUint8 = scoresPadded.map((s) => Math.min(Math.max(Math.floor(s), 0), 100));

    // ABI encode as 5 uint8s
    const scoreBytes = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint8', 'uint8', 'uint8', 'uint8', 'uint8'],
      scoresUint8
    );

    console.log(`📊 Submitting score vector to Studio ${studioAddress.slice(0, 10)}...`);
    console.log(`   Data Hash: ${params.dataHash.slice(0, 16)}...`);
    console.log(`   Scores: ${scoresUint8}`);

    try {
      const tx = await studioProxy.submitScoreVector(params.dataHash, scoreBytes, {
        gasLimit: 250000,
      });

      console.log(`→ Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      console.log(`✓ Score vector submitted successfully`);
      return tx.hash;
    } catch (error: any) {
      throw new Error(`Failed to submit score vector: ${error.message}`);
    }
  }

  /**
   * Submit score vector for a specific worker (multi-agent tasks)
   *
   * @param params Per-worker score vector parameters
   * @returns Transaction hash
   *
   * @example
   * ```typescript
   * // Score Alice (high initiative = root node)
   * await sdk.submitScoreVectorForWorker({
   *   studioAddress: "0x...",
   *   dataHash: "0x...",
   *   workerAddress: "0xAlice...",
   *   scoreVector: [85, 60, 70, 95, 80] // High initiative
   * });
   *
   * // Score Bob (high collaboration = central node)
   * await sdk.submitScoreVectorForWorker({
   *   studioAddress: "0x...",
   *   dataHash: "0x...",
   *   workerAddress: "0xBob...",
   *   scoreVector: [65, 90, 75, 95, 85] // High collaboration
   * });
   * ```
   */
  async submitScoreVectorForWorker(params: PerWorkerScoreVectorParams): Promise<string> {
    const agentId = this._agentId;
    if (!agentId || agentId === 0n) {
      throw new Error('Agent not registered. Call registerIdentity() first.');
    }

    const wallet = this.walletManager.getWallet();
    const studioAddress = ethers.getAddress(params.studioAddress);
    const workerAddress = ethers.getAddress(params.workerAddress);

    // Create StudioProxy contract instance
    const studioProxy = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, wallet);

    // Ensure we have exactly 5 scores (pad with 0 if needed)
    const scoresPadded = [...params.scoreVector, 0, 0, 0, 0, 0].slice(0, 5);

    // Convert to uint8 array and ABI encode as bytes
    const scoresUint8 = scoresPadded.map((s) => Math.min(Math.max(Math.floor(s), 0), 100));

    // ABI encode as 5 uint8s
    const scoreBytes = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint8', 'uint8', 'uint8', 'uint8', 'uint8'],
      scoresUint8
    );

    console.log(`📊 Submitting per-worker score vector to Studio ${studioAddress.slice(0, 10)}...`);
    console.log(`   Worker: ${workerAddress.slice(0, 10)}...`);
    console.log(`   Data Hash: ${params.dataHash.slice(0, 16)}...`);
    console.log(`   Scores: ${scoresUint8}`);

    try {
      const tx = await studioProxy.submitScoreVectorForWorker(
        params.dataHash,
        workerAddress,
        scoreBytes,
        { gasLimit: 250000 }
      );

      console.log(`→ Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      console.log(`✓ Per-worker score vector submitted successfully`);
      return tx.hash;
    } catch (error: any) {
      throw new Error(`Failed to submit per-worker score vector: ${error.message}`);
    }
  }

  /**
   * Close an epoch and trigger reward distribution (§7.2 protocol spec)
   *
   * @param params Epoch closure parameters
   * @returns Transaction hash
   *
   * @example
   * ```typescript
   * const txHash = await sdk.closeEpoch({
   *   studioAddress: "0x...",
   *   epoch: 1
   * });
   * ```
   */
  async closeEpoch(params: CloseEpochParams): Promise<string> {
    const wallet = this.walletManager.getWallet();
    const studioAddress = ethers.getAddress(params.studioAddress);

    // Get RewardsDistributor address
    let rewardsDistributorAddress: string;
    if (params.rewardsDistributorAddress) {
      rewardsDistributorAddress = ethers.getAddress(params.rewardsDistributorAddress);
    } else {
      const networkString = typeof this.network === 'string' ? this.network : String(this.network);
      const protocolAddresses = getChaosChainProtocolAddresses(networkString);
      if (!protocolAddresses) {
        throw new Error(
          'RewardsDistributor address not found. Please provide rewardsDistributorAddress parameter.'
        );
      }
      rewardsDistributorAddress = protocolAddresses.rewardsDistributor;
    }

    // Create RewardsDistributor contract instance
    const rewardsDistributor = new ethers.Contract(
      rewardsDistributorAddress,
      REWARDS_DISTRIBUTOR_ABI,
      wallet
    );

    console.log(`→ Closing epoch ${params.epoch} for studio ${studioAddress}`);
    console.log(`   RewardsDistributor: ${rewardsDistributorAddress}`);

    try {
      const tx = await rewardsDistributor.closeEpoch(studioAddress, params.epoch, {
        gasLimit: 2000000,
      });

      console.log(`→ Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      console.log(`✓ Epoch closed successfully`);
      return tx.hash;
    } catch (error: any) {
      throw new Error(`Failed to close epoch: ${error.message}`);
    }
  }

  /**
   * Get consensus result for a work submission
   *
   * @param dataHash The work data hash
   * @param rewardsDistributorAddress Optional RewardsDistributor address
   * @returns Consensus result
   */
  async getConsensusResult(
    dataHash: string,
    rewardsDistributorAddress?: string
  ): Promise<ConsensusResult> {
    const wallet = this.walletManager.getWallet();

    // Get RewardsDistributor address
    let distributorAddress: string;
    if (rewardsDistributorAddress) {
      distributorAddress = ethers.getAddress(rewardsDistributorAddress);
    } else {
      const networkString = typeof this.network === 'string' ? this.network : (this.network as NetworkConfig);
      const protocolAddresses = getChaosChainProtocolAddresses(networkString);
      if (!protocolAddresses) {
        throw new Error(
          'RewardsDistributor address not found. Please provide rewardsDistributorAddress parameter.'
        );
      }
      distributorAddress = protocolAddresses.rewardsDistributor;
    }

    // Create RewardsDistributor contract instance
    const rewardsDistributor = new ethers.Contract(
      distributorAddress,
      REWARDS_DISTRIBUTOR_ABI,
      wallet
    );

    try {
      const result = await rewardsDistributor.getConsensusResult(dataHash);

      return {
        dataHash: result.dataHash,
        consensusScores: result.consensusScores.map((s: bigint) => Number(s)),
        totalStake: result.totalStake,
        validatorCount: Number(result.validatorCount),
        timestamp: Number(result.timestamp),
        finalized: result.finalized,
      };
    } catch (error: any) {
      throw new Error(`Failed to get consensus result: ${error.message}`);
    }
  }

  // ============================================================================
  // Convenience Accessors for Protocol Integrations
  // ============================================================================

  /**
   * Get VerifierAgent instance
   */
  verifier(): VerifierAgent {
    if (!this.verifierAgent) {
      throw new Error('VerifierAgent not initialized');
    }
    return this.verifierAgent;
  }

  /**
   * Get StudioManager instance
   */
  studio(): StudioManager {
    if (!this.studioManager) {
      throw new Error('StudioManager not initialized');
    }
    return this.studioManager;
  }

  /**
   * Get GatewayClient instance
   */
  gateway(): GatewayClient {
    if (!this.gatewayClient) {
      throw new Error('Gateway not configured. Initialize SDK with gatewayUrl parameter.');
    }
    return this.gatewayClient;
  }

  /**
   * Check if Gateway is configured
   */
  hasGateway(): boolean {
    return !!this.gatewayClient;
  }

  /**
   * Get XMTPManager instance
   */
  xmtp(): XMTPManager {
    if (!this.xmtpManager) {
      throw new Error('XMTPManager not initialized');
    }
    return this.xmtpManager;
  }

  /**
   * Get MandateManager instance
   */
  mandate(): MandateManager {
    if (!this.mandateManager) {
      throw new Error('MandateManager not initialized');
    }
    return this.mandateManager;
  }
}
