/**
 * ERC-8004 v1.0 Contract ABIs and Addresses
 *
 * Complete ABIs extracted from Python SDK (chaos_agent.py lines 155-637)
 *
 * This module contains the complete ABIs for all ERC-8004 v1.0 contracts.
 * These are the official ABIs deployed on testnets.
 */

import { NetworkConfig } from '../types';

/**
 * Get embedded Identity Registry ABI for ERC-8004 v1.0.
 *
 * v1.0 uses ERC-721 with URIStorage extension. Key changes:
 * - register() functions replace newAgent()
 * - Agents are ERC-721 NFTs with tokenURI
 * - ownerOf() to get agent owner
 * - tokenURI() to get registration file
 */
export const IDENTITY_REGISTRY_ABI = [
  // ERC - 8004 v1.0 Registration Functions
  {
    inputs: [
      { name: 'tokenURI_', type: 'string' },
      {
        name: 'metadata',
        type: 'tuple[]',
        components: [
          { name: 'key', type: 'string' },
          { name: 'value', type: 'bytes' },
        ],
      },
    ],
    name: 'register',
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenURI_', type: 'string' }],
    name: 'register',
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'register',
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // ERC - 721 Standard Functions
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: 'owner', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getApproved',
    outputs: [{ name: 'operator', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: 'approved', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Metadata Functions
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'bytes' },
    ],
    name: 'setMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'key', type: 'string' },
    ],
    name: 'getMetadata',
    outputs: [{ name: 'value', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Additional Functions
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newUri', type: 'string' },
    ],
    name: 'setAgentUri',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: false, name: 'tokenURI', type: 'string' },
      { indexed: true, name: 'owner', type: 'address' },
    ],
    name: 'Registered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: true, name: 'indexedKey', type: 'string' },
      { indexed: false, name: 'key', type: 'string' },
      { indexed: false, name: 'value', type: 'bytes' },
    ],
    name: 'MetadataSet',
    type: 'event',
  },
  // ERC - 721 Standard Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'approved', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: false, name: 'approved', type: 'bool' },
    ],
    name: 'ApprovalForAll',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: false, name: 'newUri', type: 'string' },
      { indexed: true, name: 'updatedBy', type: 'address' },
    ],
    name: 'UriUpdated',
    type: 'event',
  },
];

/**
 * Get Reputation Registry ABI (ERC-8004 Feb 2026)
 *
 * Feb 2026 KEY CHANGES from Oct 2025:
 * - REMOVED feedbackAuth parameter - feedback is now permissionless
 * - ADDED endpoint parameter for endpoint being reviewed
 * - CHANGED tag1, tag2 from bytes32 to string
 * - ADDED feedbackIndex to NewFeedback event
 * - readFeedback returns string tags and feedbackIndex parameter renamed
 *
 * Feb 2026 ABI UPDATE:
 * - CHANGED score (uint8) to value (int128) + valueDecimals (uint8)
 * - getSummary returns summaryValue (int128) + summaryValueDecimals (uint8)
 * - readFeedback returns value (int128) + valueDecimals (uint8)
 */
export const REPUTATION_REGISTRY_ABI = [
  // Core Functions (Feb 2026 ABI)
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' }, // CHANGED: uint8 score -> int128 value
      { name: 'valueDecimals', type: 'uint8' }, // NEW: decimal precision
      { name: 'tag1', type: 'string' }, // CHANGED: bytes32 -> string
      { name: 'tag2', type: 'string' }, // CHANGED: bytes32 -> string
      { name: 'endpoint', type: 'string' }, // NEW: endpoint being reviewed
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    name: 'giveFeedback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'feedbackIndex', type: 'uint64' },
    ],
    name: 'revokeFeedback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
      { name: 'feedbackIndex', type: 'uint64' },
      { name: 'responseURI', type: 'string' }, // RENAMED: responseUri -> responseURI
      { name: 'responseHash', type: 'bytes32' },
    ],
    name: 'appendResponse',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Read Functions (Feb 2026 ABI)
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' }, // CHANGED: bytes32 -> string
      { name: 'tag2', type: 'string' }, // CHANGED: bytes32 -> string
    ],
    name: 'getSummary',
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' }, // CHANGED: uint8 averageScore -> int128 summaryValue
      { name: 'summaryValueDecimals', type: 'uint8' }, // NEW: decimal precision
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
      { name: 'feedbackIndex', type: 'uint64' },
    ],
    name: 'readFeedback',
    outputs: [
      { name: 'value', type: 'int128' }, // CHANGED: uint8 score -> int128 value
      { name: 'valueDecimals', type: 'uint8' }, // NEW: decimal precision
      { name: 'tag1', type: 'string' }, // CHANGED: bytes32 -> string
      { name: 'tag2', type: 'string' }, // CHANGED: bytes32 -> string
      { name: 'isRevoked', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' }, // CHANGED: bytes32 -> string
      { name: 'tag2', type: 'string' }, // CHANGED: bytes32 -> string
      { name: 'includeRevoked', type: 'bool' },
    ],
    name: 'readAllFeedback',
    outputs: [
      { name: 'clients', type: 'address[]' },
      { name: 'feedbackIndexes', type: 'uint64[]' }, // NEW: feedback indexes
      { name: 'values', type: 'int128[]' }, // CHANGED: uint8[] scores -> int128[] values
      { name: 'valueDecimals', type: 'uint8[]' }, // NEW: decimal precisions
      { name: 'tag1s', type: 'string[]' }, // CHANGED: bytes32[] -> string[]
      { name: 'tag2s', type: 'string[]' }, // CHANGED: bytes32[] -> string[]
      { name: 'revokedStatuses', type: 'bool[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'agentId', type: 'uint256' }],
    name: 'getClients',
    outputs: [{ name: 'clientList', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
    ],
    name: 'getLastIndex',
    outputs: [{ name: 'lastIndex', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getIdentityRegistry',
    outputs: [{ name: 'registry', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events (Feb 2026 spec)
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: true, name: 'clientAddress', type: 'address' },
      { indexed: false, name: 'feedbackIndex', type: 'uint64' }, // NEW
      { indexed: false, name: 'score', type: 'uint8' },
      { indexed: true, name: 'tag1', type: 'string' }, // CHANGED: bytes32 -> string
      { indexed: false, name: 'tag2', type: 'string' }, // CHANGED: bytes32 -> string
      { indexed: false, name: 'endpoint', type: 'string' }, // NEW
      { indexed: false, name: 'feedbackURI', type: 'string' }, // RENAMED
      { indexed: false, name: 'feedbackHash', type: 'bytes32' },
    ],
    name: 'NewFeedback',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: true, name: 'clientAddress', type: 'address' },
      { indexed: false, name: 'feedbackIndex', type: 'uint64' },
      { indexed: true, name: 'responder', type: 'address' },
      { indexed: false, name: 'responseURI', type: 'string' }, // RENAMED
      { indexed: false, name: 'responseHash', type: 'bytes32' },
    ],
    name: 'ResponseAppended',
    type: 'event',
  },
];

/**
 * Get Validation Registry ABI (ERC-8004 v1.0)
 *
 * v1.0 uses URI-based validation with off-chain evidence storage.
 * Key changes:
 * - validationRequest() uses validatorAddress instead of validatorAgentId
 * - requestUri and requestHash for off-chain evidence
 * - validationResponse() uses requestHash with response (0-100)
 * - Support for multiple responses per request (progressive validation)
 */
export const VALIDATION_REGISTRY_ABI = [
  // Core Functions
  {
    "inputs": [
      { "name": "validatorAddress", "type": "address" },
      { "name": "agentId", "type": "uint256" },
      { "name": "requestUri", "type": "string" },
      { "name": "requestHash", "type": "bytes32" }
    ],
    "name": "validationRequest",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "requestHash", "type": "bytes32" },
      { "name": "response", "type": "uint8" },
      { "name": "responseUri", "type": "string" },
      { "name": "responseHash", "type": "bytes32" },
      { "name": "tag", "type": "bytes32" }
    ],
    "name": "validationResponse",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Read Functions
  {
    "inputs": [{ "name": "requestHash", "type": "bytes32" }],
    "name": "getValidationStatus",
    "outputs": [
      { "name": "validatorAddress", "type": "address" },
      { "name": "agentId", "type": "uint256" },
      { "name": "response", "type": "uint8" },
      { "name": "responseHash", "type": "bytes32" },
      { "name": "tag", "type": "bytes32" },
      { "name": "lastUpdate", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "agentId", "type": "uint256" },
      { "name": "validatorAddresses", "type": "address[]" },
      { "name": "tag", "type": "bytes32" }
    ],
    "name": "getSummary",
    "outputs": [
      { "name": "count", "type": "uint64" },
      { "name": "avgResponse", "type": "uint8" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "agentId", "type": "uint256" }],
    "name": "getAgentValidations",
    "outputs": [{ "name": "requestHashes", "type": "bytes32[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "validatorAddress", "type": "address" }],
    "name": "getValidatorRequests",
    "outputs": [{ "name": "requestHashes", "type": "bytes32[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getIdentityRegistry",
    "outputs": [{ "name": "registry", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "validatorAddress", "type": "address" },
      { "indexed": true, "name": "agentId", "type": "uint256" },
      { "indexed": false, "name": "requestUri", "type": "string" },
      { "indexed": true, "name": "requestHash", "type": "bytes32" }
    ],
    "name": "ValidationRequest",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "validatorAddress", "type": "address" },
      { "indexed": true, "name": "agentId", "type": "uint256" },
      { "indexed": true, "name": "requestHash", "type": "bytes32" },
      { "indexed": false, "name": "response", "type": "uint8" },
      { "indexed": false, "name": "responseUri", "type": "string" },
      { "indexed": false, "name": "responseHash", "type": "bytes32" },
      { "indexed": false, "name": "tag", "type": "bytes32" }
    ],
    "name": "ValidationResponse",
    "type": "event"
  }
] as const;

/**
 * ERC-20 USDC ABI (for x402 payments)
 */
export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
];

/**
 * USDC token addresses by network
 */
export const USDC_ADDRESSES: Record<string, string> = {
  [NetworkConfig.ETHEREUM_SEPOLIA]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  [NetworkConfig.BASE_SEPOLIA]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [NetworkConfig.OPTIMISM_SEPOLIA]: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  [NetworkConfig.LINEA_SEPOLIA]: '0x0000000000000000000000000000000000000000', // TODO: Add Linea Sepolia USDC address
  [NetworkConfig.HEDERA_TESTNET]: '0x0000000000000000000000000000000000000000', // TODO: Add Hedera Testnet USDC address
  [NetworkConfig.ZEROG_TESTNET]: '0x0000000000000000000000000000000000000000', // TODO: Add Zerog Testnet USDC address
  [NetworkConfig.BSC_TESTNET]: '0x0000000000000000000000000000000000000000', // TODO: Add BSC Testnet USDC address
  [NetworkConfig.LOCAL]: '0x0000000000000000000000000000000000000000',
};

/**
 * Get USDC address for network
 */
export function getUSDCAddress(network: string): string {
  return USDC_ADDRESSES[network] || '0x0000000000000000000000000000000000000000';
}

/**
 * ERC-8004 v1.0 Contract Addresses by Network
 */
export const CONTRACT_ADDRESSES = {
  [NetworkConfig.ETHEREUM_SEPOLIA]: {
    // Official ERC-8004 Registries (Feb 2026 spec - https://github.com/erc-8004/erc-8004-contracts)
    identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
    validation: '0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70',
    // ChaosChain Protocol v0.4.31 (deployed Jan 28, 2026) - ERC-8004 Feb 2026 ABI
    // giveFeedback: score (uint8) -> value (int128) + valueDecimals (uint8)
    // validationResponse: tag (bytes32) -> tag (string)
    chaos_registry: '0x7F38C1aFFB24F30500d9174ed565110411E42d50',
    chaos_core: '0x92cBc471D8a525f3Ffb4BB546DD8E93FC7EE67ca',
    rewards_distributor: '0x4bd7c3b53474Ba5894981031b5a9eF70CEA35e53',
    studio_factory: '0x54Cbf5fa7d10ECBab4f46D71FAD298A230A16aF6',
    // LogicModules
    prediction_logic: '0xE90CaE8B64458ba796F462AB48d84F6c34aa29a3',
  },
  [NetworkConfig.OPTIMISM_SEPOLIA]: {
    identity_registry: '0x0000000000000000000000000000000000000000', // Not yet deployed
    reputation_registry: '0x0000000000000000000000000000000000000000',
    validation_registry: '0x0000000000000000000000000000000000000000',
    usdc_token: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70',
  },
  [NetworkConfig.BASE_SEPOLIA]: {
    identity: '0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
    reputation: '0x8004bd8daB57f14Ed299135749a5CB5c42d341BF',
    validation: '0x8004C269D0A5647E51E121FeB226200ECE932d55',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70',
  },
  [NetworkConfig.LINEA_SEPOLIA]: {
    identity: '0x8004aa7C931bCE1233973a0C6A667f73F66282e7',
    reputation: '0x8004bd8483b99310df121c46ED8858616b2Bba02',
    validation: '0x8004c44d1EFdd699B2A26e781eF7F77c56A9a4EB',
    usdc: '0x0000000000000000000000000000000000000000',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70',
  },
  [NetworkConfig.HEDERA_TESTNET]: {
    identity: '0x4c74ebd72921d537159ed2053f46c12a7d8e5923',
    reputation: '0xc565edcba77e3abeade40bfd6cf6bf583b3293e0',
    validation: '0x18df085d85c586e9241e0cd121ca422f571c2da6',
    usdc: '0x0000000000000000000000000000000000000000',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70',
  },
  [NetworkConfig.ZEROG_TESTNET]: {
    identity: '0x80043ed9cf33a3472768dcd53175bb44e03a1e4a',
    reputation: '0x80045d7b72c47bf5ff73737b780cb1a5ba8ee202',
    validation: '0x80041728e0aadf1d1427f9be18d52b7f3afefafb',
    usdc: '0x0000000000000000000000000000000000000000',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70',
  },
  [NetworkConfig.BSC_TESTNET]: {
    identity: '0xabbd26d86435b35d9c45177725084ee6a2812e40',
    reputation: '0xeced1af52a0446275e9e6e4f6f26c99977400a6a',
    validation: '0x7866bd057f09a4940fe2ce43320518c8749a921e',
    usdc: '0x0000000000000000000000000000000000000000',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70',
  },
} as const;

/**
 * Get contract addresses for a network
 */
export function getContractAddresses(network: string) {
  return CONTRACT_ADDRESSES[network as keyof typeof CONTRACT_ADDRESSES];
}

/**
 * Common contract errors
 */
export const CONTRACT_ERRORS = {
  AGENT_NOT_FOUND: 'Agent does not exist',
  UNAUTHORIZED: 'Caller is not authorized',
  INVALID_RATING: 'Rating must be between 0 and 100',
  FEEDBACK_NOT_FOUND: 'Feedback does not exist',
  FEEDBACK_REVOKED: 'Feedback has been revoked',
  VALIDATION_NOT_FOUND: 'Validation request does not exist',
  VALIDATION_ALREADY_RESPONDED: 'Validation already responded',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
} as const;
