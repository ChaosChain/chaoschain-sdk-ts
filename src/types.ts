/**
 * ChaosChain SDK Type Definitions
 * TypeScript types and interfaces for building verifiable AI agents
 */

import { ethers } from 'ethers';

// ============================================================================
// Core Enums
// ============================================================================

/**
 * Supported blockchain networks with pre-deployed ERC-8004 contracts
 */
export enum NetworkConfig {
  ETHEREUM_SEPOLIA = 'ethereum-sepolia',
  BASE_SEPOLIA = 'base-sepolia',
  OPTIMISM_SEPOLIA = 'optimism-sepolia',
  LINEA_SEPOLIA = 'linea-sepolia',
  HEDERA_TESTNET = 'hedera-testnet',
  MODE_TESTNET = 'mode-testnet',
  ZEROG_TESTNET = '0g-testnet',
  BSC_TESTNET = 'bsc-testnet',
  LOCAL = 'local',
}

/**
 * W3C-compliant payment methods supported by the SDK.
 */
export enum PaymentMethod {
  BASIC_CARD = 'basic-card',
  GOOGLE_PAY = 'https://google.com/pay',
  APPLE_PAY = 'https://apple.com/apple-pay',
  PAYPAL = 'https://paypal.com',
  A2A_X402 = 'https://a2a.org/x402',
  DIRECT_TRANSFER = 'direct-transfer',
}

/**
 * Agent role in the ChaosChain network
 */
export enum AgentRole {
  WORKER = 'worker',
  VERIFIER = 'verifier',
  CLIENT = 'client',
  ORCHESTRATOR = 'orchestrator',
}

// Legacy aliases for backward compatibility (deprecated)
/** @deprecated Use AgentRole.WORKER instead */
export const AgentRoleSERVER = AgentRole.WORKER;
/** @deprecated Use AgentRole.VERIFIER instead */
export const AgentRoleVALIDATOR = AgentRole.VERIFIER;

// ============================================================================
// Contract Types
// ============================================================================

/**
 * ERC-8004 contract addresses for a network
 */
export interface ContractAddresses {
  identity: string;
  reputation: string;
  validation: string;
  identityRegistry?: string;
  reputationRegistry?: string;
  validationRegistry?: string;
  identity_registry?: string;
  reputation_registry?: string;
  validation_registry?: string;
  rewardsDistributor?: string | null;
  chaosCore?: string | null;
  rewards_distributor?: string | null;
  chaos_core?: string | null;
  network?: NetworkConfig | null;
}

/**
 * Network configuration with RPC and contract addresses
 */
export interface NetworkInfo {
  chainId: number;
  name: string;
  rpcUrl: string;
  contracts: ContractAddresses;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent metadata structure (ERC-8004 compliant)
 */
export interface AgentMetadata {
  name: string;
  domain: string;
  role: AgentRole | string;
  capabilities?: string[];
  version?: string;
  description?: string;
  image?: string;
  contact?: string;
  supportedTrust?: string[];
}

/**
 * Agent registration result
 */
export interface AgentRegistration {
  agentId: bigint;
  txHash: string;
  owner: string;
}

// ============================================================================
// ERC-8004 Reputation Types
// ============================================================================

/**
 * Feedback submission parameters
 */
export interface FeedbackParams {
  agentId: bigint;
  rating: number;
  feedbackUri: string;
  feedbackData?: Record<string, unknown>;
}

/**
 * Feedback record
 */
export interface FeedbackRecord {
  feedbackId: bigint;
  fromAgent: bigint;
  toAgent: bigint;
  rating: number;
  feedbackUri: string;
  timestamp: number;
  revoked: boolean;
}

// ============================================================================
// ERC-8004 Validation Types
// ============================================================================

/**
 * Validation request parameters
 */
export interface ValidationRequestParams {
  validatorAgentId: bigint;
  requestUri: string;
  requestHash: string;
}

/**
 * Validation request record
 */
export interface ValidationRequest {
  requestId: bigint;
  requester: bigint;
  validator: bigint;
  requestUri: string;
  requestHash: string;
  status: ValidationStatus;
  responseUri?: string;
  timestamp: number;
}

/**
 * Validation status enum
 */
export enum ValidationStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2,
}

// ============================================================================
// Payment Types
// ============================================================================

/**
 * x402 payment parameters
 */
export interface X402PaymentParams {
  toAgent: string;
  amount: string;
  currency?: string;
  serviceType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * x402 payment result
 */
export interface X402Payment {
  from: string;
  to: string;
  amount: string;
  currency: string;
  txHash: string;
  timestamp: number;
  feeAmount?: string;
  feeTxHash?: string;
}

// ============================================================================
// Storage Provider Types
// ============================================================================

/**
 * Storage upload options
 */
export interface UploadOptions {
  mime?: string;
  metadata?: Record<string, unknown>;
  pin?: boolean;
}

/**
 * Storage upload result
 */
export interface UploadResult {
  cid: string;
  uri: string;
  size?: number;
  timestamp: number;
}

/**
 * Storage provider interface
 */
export interface StorageProvider {
  upload(data: Buffer | string | object, options?: UploadOptions): Promise<UploadResult>;
  download(cid: string): Promise<Buffer>;
  pin(cid: string): Promise<void>;
  unpin(cid: string): Promise<void>;
}

// ============================================================================
// Compute Provider Types
// ============================================================================

/**
 * Compute provider interface
 */
export interface ComputeProvider {
  inference(model: string, input: unknown): Promise<unknown>;
  getModels(): Promise<string[]>;
}

// ============================================================================
// Process Integrity Types
// ============================================================================

/**
 * Verification method
 */
export enum VerificationMethod {
  TEE_ML = 'tee-ml', // Trusted Execution Environment
  ZK_ML = 'zk-ml', // Zero-Knowledge Machine Learning
  OP_ML = 'op-ml', // Optimistic Machine Learning
  NONE = 'none', // No verification
}

/**
 * TEE attestation data
 */
export interface TEEAttestation {
  jobId: string;
  provider: string;
  executionHash: string;
  verificationMethod: VerificationMethod;
  model?: string;
  attestationData: unknown;
  proof?: string;
  metadata?: unknown;
  timestamp: string;
}

/**
 * Integrity proof structure
 */
export interface IntegrityProof {
  proofId: string;
  functionName: string;
  codeHash: string;
  executionHash: string;
  timestamp: Date;
  agentName: string;
  verificationStatus: string;
  ipfsCid?: string;
  // TEE (Trusted Execution Environment) attestation fields
  teeAttestation?: TEEAttestation; // Full TEE attestation data
  teeProvider?: string; // e.g., "0g-compute", "phala"
  teeJobId?: string; //  TEE provider's job/task ID
  teeExecutionHash?: string; // TEE-specific execution hash
}

// ============================================================================
// SDK Configuration Types
// ============================================================================

/**
 * Main SDK configuration
 */
export interface ChaosChainSDKConfig {
  agentName: string;
  agentDomain: string;
  agentRole: AgentRole | string;
  network: NetworkConfig | string;
  privateKey?: string;
  mnemonic?: string;
  rpcUrl?: string;
  enableAP2?: boolean;
  enableProcessIntegrity?: boolean;
  enablePayments?: boolean;
  enableStorage?: boolean;
  storageProvider?: StorageProvider;
  computeProvider?: ComputeProvider;
  walletFile?: string;
  // x402 Facilitator Configuration (EIP-3009)
  facilitatorUrl?: string; // e.g., 'https://facilitator.chaoscha.in'
  facilitatorApiKey?: string; // Optional API key for managed facilitator
  facilitatorMode?: 'managed' | 'decentralized';
  agentId?: string; // ERC-8004 tokenId (e.g., '8004#123')
  // Gateway Client Configuration
  gatewayConfig?: GatewayClientConfig;
}

/**
 * Wallet configuration
 */
export interface WalletConfig {
  privateKey?: string;
  mnemonic?: string;
  walletFile?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Contract event data
 */
export interface ContractEvent {
  event: string;
  args: unknown[];
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
}

/**
 * Agent registered event
 */
export interface AgentRegisteredEvent extends ContractEvent {
  agentId: bigint;
  owner: string;
  uri: string;
}

/**
 * Feedback given event
 */
export interface FeedbackGivenEvent extends ContractEvent {
  feedbackId: bigint;
  fromAgent: bigint;
  toAgent: bigint;
  rating: number;
}

/**
 * Validation requested event
 */
export interface ValidationRequestedEvent extends ContractEvent {
  requestId: bigint;
  requester: bigint;
  validator: bigint;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Transaction result
 */
export interface TransactionResult {
  hash: string;
  receipt?: ethers.TransactionReceipt;
  confirmations?: number;
}

/**
 * Query result with pagination
 */
export interface QueryResult<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Agent identity
 */
export interface AgentIdentity {
  agentId: bigint;
  agentName: string;
  agentDomain: string;
  walletAddress: string;
  registrationTx: string;
  network: NetworkConfig;
}

/**
 * Proof of Payment Execution
 */
export interface PaymentProof {
  paymentId: string;
  fromAgent: string;
  toAgent: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  transactionHash: string;
  timestamp: Date;
  receiptData: Record<string, unknown>;
  network?: string;
}

/**
 * Proof of Validation Execution
 */
export interface ValidationResult {
  validationId: string;
  validatorAgentId: number;
  score: number;
  qualityRating: string;
  validationSummary: string;
  detailedAssessment: Record<string, unknown>;
  timestamp: Date;
  ipfsCid?: string;
}

// ============================================================================
// Gateway & Workflow Types
// Ref: /chaoschain/packages/sdk/chaoschain_sdk/gateway_client.py
// ============================================================================

/**
 * Workflow types supported by Gateway.
 */
export enum WorkflowType {
  WORK_SUBMISSION = 'WorkSubmission',
  SCORE_SUBMISSION = 'ScoreSubmission',
  CLOSE_EPOCH = 'CloseEpoch',
}

/**
 * Workflow states.
 */
export enum WorkflowState {
  CREATED = 'CREATED',
  RUNNING = 'RUNNING',
  STALLED = 'STALLED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Score submission modes supported by Gateway.
 * - DIRECT: Simple direct scoring via submitScoreVectorForWorker (default, MVP)
 * - COMMIT_REVEAL: Commit-reveal pattern (prevents last-mover bias)
 */
export enum ScoreSubmissionMode {
  DIRECT = 'direct',
  COMMIT_REVEAL = 'commit_reveal',
}

/**
 * Progress data for a workflow.
 * Populated as the workflow progresses through steps.
 */
export interface WorkflowProgress {
  /** Arweave transaction ID for evidence archival */
  arweaveTxId?: string;
  /** Whether Arweave transaction is confirmed */
  arweaveConfirmed?: boolean;
  /** On-chain transaction hash */
  onchainTxHash?: string;
  /** Whether on-chain transaction is confirmed */
  onchainConfirmed?: boolean;
  /** Block number of on-chain confirmation */
  onchainBlock?: number;
  /** Score submission transaction hash (direct mode) */
  scoreTxHash?: string;
  /** Commit transaction hash (commit-reveal mode) */
  commitTxHash?: string;
  /** Reveal transaction hash (commit-reveal mode) */
  revealTxHash?: string;
}

/**
 * Error information for a failed workflow.
 */
export interface WorkflowError {
  /** Step where the error occurred */
  step: string;
  /** Human-readable error message */
  message: string;
  /** Optional error code */
  code?: string;
}

/**
 * Status of a workflow.
 */
export interface WorkflowStatus {
  /** Unique workflow identifier (UUID) */
  workflowId: string;
  /** Type of workflow */
  workflowType: WorkflowType;
  /** Current state */
  state: WorkflowState;
  /** Current step name */
  step: string;
  /** Unix timestamp of creation */
  createdAt: number;
  /** Unix timestamp of last update */
  updatedAt: number;
  /** Progress information */
  progress: WorkflowProgress;
  /** Error information (if state is FAILED) */
  error?: WorkflowError;
}

/**
 * Gateway client configuration.
 */
export interface GatewayClientConfig {
  /** Gateway API URL (e.g., "http://localhost:3000") */
  gatewayUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum time to wait for workflow completion in milliseconds (default: 300000) */
  maxPollTime?: number;
  /** Interval between status polls in milliseconds (default: 2000) */
  pollInterval?: number;
}

// ============================================================================
// Deprecated Types (backward compatibility only)
// These types existed in early designs but functionality moved to Gateway
// ============================================================================

/**
 * @deprecated XMTP functionality has moved to the Gateway service.
 * This type is kept for backward compatibility only.
 * Do NOT implement XMTP client in SDK - use Gateway instead.
 */
export interface XMTPMessageData {
  messageId: string;
  fromAgent: string;
  toAgent: string;
  content: any;
  timestamp: number;
  parentIds: string[];
  artifactIds: string[];
  signature: string;
}

/**
 * @deprecated DKG functionality has moved to the Gateway service.
 * This type is kept for backward compatibility only.
 * Do NOT implement DKG in SDK - Gateway constructs the graph.
 */
export interface DKGNodeData {
  author: string;
  sig: string;
  ts: number;
  xmtpMsgId: string;
  artifactIds: string[];
  payloadHash: string;
  parents: string[];
  content?: string;
  nodeType?: string;
  metadata?: Record<string, any>;
  vlc?: string;
  canonicalHash?: string;
}
