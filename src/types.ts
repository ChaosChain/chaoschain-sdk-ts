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

  // Legacy aliases for backward compatibility
  SERVER = 'worker', // Deprecated: use WORKER
  VALIDATOR = 'verifier', // Deprecated: use VERIFIER
}

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
 * TEE attestation data
 */
export interface TEEAttestation {
  job_id: string;
  provider: string;
  execution_hash: string;
  verification_method: string;
  model?: string;
  attestation_data: unknown;
  proof?: string;
  metadata?: unknown;
  timestamp: string;
}

/**
 * Integrity proof structure
 */
export interface IntegrityProof {
  proof_id: string;
  function_name: string;
  code_hash: string;
  execution_hash: string;
  timestamp: Date;
  agent_name: string;
  verification_status: string;
  ipfs_cid?: string;
  tee_attestation?: TEEAttestation;
  tee_provider?: string;
  tee_job_id?: string;
  tee_execution_hash?: string;
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
