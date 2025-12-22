/**
 * ChaosChain SDK - TypeScript Entry Point
 * 
 * Complete TypeScript implementation with feature parity to Python SDK
 * 
 * @packageDocumentation
 */

// ============================================================================
// Main SDK Export
// ============================================================================
export { ChaosChainSDK } from './ChaosChainSDK';

// ============================================================================
// Core Components
// ============================================================================
export { WalletManager } from './WalletManager';
export { ChaosAgent } from './ChaosAgent';

// ============================================================================
// Payment Components
// ============================================================================
export { X402PaymentManager } from './X402PaymentManager';
export type {
  X402PaymentRequest,
  X402PaymentProof,
  X402PaymentRequirements,
  PaymentHeader,
  TransferAuthorizationParams,
  X402FacilitatorConfig,
  SettleRequest,
  SettleResponse
} from './X402PaymentManager';
export { PaymentManager } from './PaymentManager';
export { X402Server } from './X402Server';

// ============================================================================
// Advanced Integrations
// ============================================================================
export { GoogleAP2Integration } from './GoogleAP2Integration';
export { MandateIntegration } from './Mandate';
export type {
  MandateCreateParams,
  MandateSignParams,
  MandateIntegrationResult
} from './Mandate';
export { A2AX402Extension } from './A2AX402Extension';
// export { ProcessIntegrity } from './ProcessIntegrity'; // TODO: Fix export

// ============================================================================
// Storage Backends
// ============================================================================
export {
  LocalIPFSStorage,
  PinataStorage,
  IrysStorage,
  ZeroGStorage,
  AutoStorageManager,
  type StorageBackend,
  type StorageResult
} from './StorageBackends';

// ============================================================================
// Storage Providers (Legacy exports)
// ============================================================================
export { IPFSLocalStorage } from './providers/storage/IPFSLocal';
export { PinataStorage as IPFSPinataStorage } from './StorageBackends';
export { IrysStorage as IrysStorageProvider } from './StorageBackends';

// ============================================================================
// Exceptions
// ============================================================================
export {
  ChaosChainSDKError,
  AgentRegistrationError,
  // FeedbackSubmissionError, // Not defined yet
  // ValidationError as SDKValidationError, // Not defined yet
  PaymentError,
  StorageError,
  ContractError,
  ConfigurationError,
  IntegrityVerificationError,
  // WalletError, // Not defined yet
  // NetworkError, // Not defined yet
} from './exceptions';

// ============================================================================
// Types & Interfaces
// ============================================================================
export type {
  // Core Config
  ChaosChainSDKConfig,
  WalletConfig,
  
  // Agent Types
  AgentMetadata,
  AgentRegistration,
  
  // Feedback & Reputation
  FeedbackParams,
  FeedbackRecord,
  
  // Validation
  ValidationRequestParams,
  ValidationRequest,
  
  // Payments
  X402PaymentParams,
  X402Payment,
  // X402PaymentReceipt, // Use PaymentReceipt instead
  
  // Storage
  StorageProvider,
  UploadOptions,
  UploadResult,
  
  // Compute
  ComputeProvider,
  
  // Network
  ContractAddresses,
  
  // Process Integrity
  IntegrityProof,
  TEEAttestation,
  
  // Transaction
  TransactionResult,
} from './types';

// ============================================================================
// Enums
// ============================================================================
export { 
  NetworkConfig,
  AgentRole,
  ValidationStatus
  // PaymentMethod // Not defined in types.ts yet
} from './types';

// PaymentMethod enum for traditional + crypto payments
export enum PaymentMethod {
  BASIC_CARD = 'basic-card',
  GOOGLE_PAY = 'https://google.com/pay',
  APPLE_PAY = 'https://apple.com/apple-pay',
  PAYPAL = 'https://paypal.com',
  A2A_X402 = 'https://a2a.org/x402'
}

// ============================================================================
// Utilities
// ============================================================================
export { 
  getNetworkInfo, 
  getContractAddresses
  // SUPPORTED_NETWORKS // Not exported from networks.ts
} from './utils/networks';

export {
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  VALIDATION_REGISTRY_ABI
  // getIdentityRegistryABI, // Now exported as const
  // getReputationRegistryABI, // Now exported as const
  // getValidationRegistryABI // Now exported as const
} from './utils/contracts';

// ============================================================================
// Version Info
// ============================================================================
export const SDK_VERSION = '0.1.3';
export const ERC8004_VERSION = '1.0';
export const X402_VERSION = '1.0';

// ============================================================================
// Default Export
// ============================================================================
import { ChaosChainSDK as SDK } from './ChaosChainSDK';
export default SDK;

// ============================================================================
// Quick Start Helper
// ============================================================================

/**
 * Initialize ChaosChain SDK with minimal configuration
 * 
 * @example
 * ```typescript
 * import { initChaosChainSDK, ChaosChainSDK } from '@chaoschain/sdk';
 * 
 * const sdk = initChaosChainSDK({
 *   agentName: 'MyAgent',
 *   agentDomain: 'myagent.example.com',
 *   agentRole: 'server',
 *   network: 'base-sepolia',
 *   privateKey: process.env.PRIVATE_KEY
 * });
 * 
 * const { agentId } = await sdk.registerIdentity();
 * console.log(`Agent registered with ID: ${agentId}`);
 * ```
 */
export function initChaosChainSDK(config: {
  agentName: string;
  agentDomain: string;
  agentRole: string;
  network: string;
  privateKey?: string;
  mnemonic?: string;
  rpcUrl?: string;
  enablePayments?: boolean;
  enableAP2?: boolean;
  enableProcessIntegrity?: boolean;
  enableStorage?: boolean;
}): SDK {
  return new SDK(config as any);
}
