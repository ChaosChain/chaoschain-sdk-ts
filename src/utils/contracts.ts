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
 * Identity Registry ABI (ERC-8004 v1.0 with ERC-721)
 */
export const IDENTITY_REGISTRY_ABI = [
  {
    inputs: [
      { name: 'tokenURI_', type: 'string' },
      {
        name: 'metadata',
        type: 'tuple[]',
        components: [
          { name: 'key', type: 'string' },
          { name: 'value', type: 'bytes' }
        ]
      }
    ],
    name: 'register',
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
    {
      inputs: [{ name: 'tokenURI_', type: 'string' }],
      name: 'register',
      outputs: [{ name: 'agentId', type: 'uint256' }],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [],
      name: 'register',
      outputs: [{ name: 'agentId', type: 'uint256' }],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    // ERC-721 Standard Functions
    {
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      name: 'ownerOf',
      outputs: [{ name: 'owner', type: 'address' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [{ name: 'owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      name: 'tokenURI',
      outputs: [{ name: '', type: 'string' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' }
      ],
      name: 'transferFrom',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'tokenId', type: 'uint256' }
      ],
      name: 'approve',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        { name: 'operator', type: 'address' },
        { name: 'approved', type: 'bool' }
      ],
      name: 'setApprovalForAll',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      name: 'getApproved',
      outputs: [{ name: 'operator', type: 'address' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'operator', type: 'address' }
      ],
      name: 'isApprovedForAll',
      outputs: [{ name: 'approved', type: 'bool' }],
      stateMutability: 'view',
      type: 'function'
    },
    // Metadata Functions
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'key', type: 'string' },
        { name: 'value', type: 'bytes' }
      ],
      name: 'setMetadata',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'key', type: 'string' }
      ],
      name: 'getMetadata',
      outputs: [{ name: 'value', type: 'bytes' }],
      stateMutability: 'view',
      type: 'function'
    },
    // Additional Functions
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'newUri', type: 'string' }
      ],
      name: 'setAgentUri',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [],
      name: 'totalAgents',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    },
    // Events
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'agentId', type: 'uint256' },
        { indexed: false, name: 'tokenURI', type: 'string' },
        { indexed: true, name: 'owner', type: 'address' }
      ],
      name: 'Registered',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'agentId', type: 'uint256' },
        { indexed: true, name: 'indexedKey', type: 'string' },
        { indexed: false, name: 'key', type: 'string' },
        { indexed: false, name: 'value', type: 'bytes' }
      ],
      name: 'MetadataSet',
      type: 'event'
    },
    // ERC-721 Standard Events
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'from', type: 'address' },
        { indexed: true, name: 'to', type: 'address' },
        { indexed: true, name: 'tokenId', type: 'uint256' }
      ],
      name: 'Transfer',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'owner', type: 'address' },
        { indexed: true, name: 'approved', type: 'address' },
        { indexed: true, name: 'tokenId', type: 'uint256' }
      ],
      name: 'Approval',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'owner', type: 'address' },
        { indexed: true, name: 'operator', type: 'address' },
        { indexed: false, name: 'approved', type: 'bool' }
      ],
      name: 'ApprovalForAll',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'agentId', type: 'uint256' },
        { indexed: false, name: 'newUri', type: 'string' },
        { indexed: true, name: 'updatedBy', type: 'address' }
      ],
      name: 'UriUpdated',
      type: 'event'
    }
  ];

/**
 * Get Reputation Registry ABI (ERC-8004 v1.0)
 * 
 * v1.0 uses cryptographic signatures (EIP-191/ERC-1271) for feedback authorization.
 * Key changes:
 * - giveFeedback() with signature-based authorization
 * - On-chain scores (0-100) with tags
 * - revokeFeedback() support
 * - appendResponse() for audit trails
 */
export const REPUTATION_REGISTRY_ABI = [
  // Core Functions
  {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'score', type: 'uint8' },
        { name: 'tag1', type: 'bytes32' },
        { name: 'tag2', type: 'bytes32' },
        { name: 'feedbackUri', type: 'string' },
        { name: 'feedbackHash', type: 'bytes32' },
        { name: 'feedbackAuth', type: 'bytes' }
      ],
      name: 'giveFeedback',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'feedbackIndex', type: 'uint64' }
      ],
      name: 'revokeFeedback',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'clientAddress', type: 'address' },
        { name: 'feedbackIndex', type: 'uint64' },
        { name: 'responseUri', type: 'string' },
        { name: 'responseHash', type: 'bytes32' }
      ],
      name: 'appendResponse',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    // Read Functions
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'clientAddresses', type: 'address[]' },
        { name: 'tag1', type: 'bytes32' },
        { name: 'tag2', type: 'bytes32' }
      ],
      name: 'getSummary',
      outputs: [
        { name: 'count', type: 'uint64' },
        { name: 'averageScore', type: 'uint8' }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'clientAddress', type: 'address' },
        { name: 'index', type: 'uint64' }
      ],
      name: 'readFeedback',
      outputs: [
        { name: 'score', type: 'uint8' },
        { name: 'tag1', type: 'bytes32' },
        { name: 'tag2', type: 'bytes32' },
        { name: 'isRevoked', type: 'bool' }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'clientAddresses', type: 'address[]' },
        { name: 'tag1', type: 'bytes32' },
        { name: 'tag2', type: 'bytes32' },
        { name: 'includeRevoked', type: 'bool' }
      ],
      name: 'readAllFeedback',
      outputs: [
        { name: 'clients', type: 'address[]' },
        { name: 'scores', type: 'uint8[]' },
        { name: 'tag1s', type: 'bytes32[]' },
        { name: 'tag2s', type: 'bytes32[]' },
        { name: 'revokedStatuses', type: 'bool[]' }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [{ name: 'agentId', type: 'uint256' }],
      name: 'getClients',
      outputs: [{ name: 'clientList', type: 'address[]' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'clientAddress', type: 'address' }
      ],
      name: 'getLastIndex',
      outputs: [{ name: 'lastIndex', type: 'uint64' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'getIdentityRegistry',
      outputs: [{ name: 'registry', type: 'address' }],
      stateMutability: 'view',
      type: 'function'
    },
    // Events
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'agentId', type: 'uint256' },
        { indexed: true, name: 'clientAddress', type: 'address' },
        { indexed: false, name: 'score', type: 'uint8' },
        { indexed: true, name: 'tag1', type: 'bytes32' },
        { indexed: false, name: 'tag2', type: 'bytes32' },
        { indexed: false, name: 'feedbackUri', type: 'string' },
        { indexed: false, name: 'feedbackHash', type: 'bytes32' }
      ],
      name: 'NewFeedback',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'agentId', type: 'uint256' },
        { indexed: true, name: 'clientAddress', type: 'address' },
        { indexed: false, name: 'feedbackIndex', type: 'uint64' },
        { indexed: true, name: 'responder', type: 'address' },
        { indexed: false, name: 'responseUri', type: 'string' },
        { indexed: false, name: 'responseHash', type: 'bytes32' }
      ],
      name: 'ResponseAppended',
      type: 'event'
    }
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
      inputs: [
        { name: 'validatorAddress', type: 'address' },
        { name: 'agentId', type: 'uint256' },
        { name: 'requestUri', type: 'string' },
        { name: 'requestHash', type: 'bytes32' }
      ],
      name: 'validationRequest',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        { name: 'requestHash', type: 'bytes32' },
        { name: 'response', type: 'uint8' },
        { name: 'responseUri', type: 'string' },
        { name: 'responseHash', type: 'bytes32' },
        { name: 'tag', type: 'bytes32' }
      ],
      name: 'validationResponse',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    // Read Functions
    {
      inputs: [{ name: 'requestHash', type: 'bytes32' }],
      name: 'getValidationStatus',
      outputs: [
        { name: 'validatorAddress', type: 'address' },
        { name: 'agentId', type: 'uint256' },
        { name: 'response', type: 'uint8' },
        { name: 'responseHash', type: 'bytes32' },
        { name: 'tag', type: 'bytes32' },
        { name: 'lastUpdate', type: 'uint256' }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        { name: 'agentId', type: 'uint256' },
        { name: 'validatorAddresses', type: 'address[]' },
        { name: 'tag', type: 'bytes32' }
      ],
      name: 'getSummary',
      outputs: [
        { name: 'count', type: 'uint64' },
        { name: 'avgResponse', type: 'uint8' }
      ],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [{ name: 'agentId', type: 'uint256' }],
      name: 'getAgentValidations',
      outputs: [{ name: 'requestHashes', type: 'bytes32[]' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [{ name: 'validatorAddress', type: 'address' }],
      name: 'getValidatorRequests',
      outputs: [{ name: 'requestHashes', type: 'bytes32[]' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'getIdentityRegistry',
      outputs: [{ name: 'registry', type: 'address' }],
      stateMutability: 'view',
      type: 'function'
    },
    // Events
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'validatorAddress', type: 'address' },
        { indexed: true, name: 'agentId', type: 'uint256' },
        { indexed: false, name: 'requestUri', type: 'string' },
        { indexed: true, name: 'requestHash', type: 'bytes32' }
      ],
      name: 'ValidationRequest',
      type: 'event'
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: 'validatorAddress', type: 'address' },
        { indexed: true, name: 'agentId', type: 'uint256' },
        { indexed: true, name: 'requestHash', type: 'bytes32' },
        { indexed: false, name: 'response', type: 'uint8' },
        { indexed: false, name: 'responseUri', type: 'string' },
        { indexed: false, name: 'responseHash', type: 'bytes32' },
        { indexed: false, name: 'tag', type: 'bytes32' }
      ],
      name: 'ValidationResponse',
      type: 'event'
    }
  ];

/**
 * ERC-20 USDC ABI (for x402 payments)
 */
export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Approval',
    type: 'event'
  }
];

/**
 * USDC token addresses by network
 */
export const USDC_ADDRESSES: Record<string, string> = {
  'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'optimism-sepolia': '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  'linea-sepolia': '0x0000000000000000000000000000000000000000',
  'hedera-testnet': '0x0000000000000000000000000000000000000000',
  '0g-testnet': '0x0000000000000000000000000000000000000000',
  'bsc-testnet': '0x0000000000000000000000000000000000000000',
  local: '0x0000000000000000000000000000000000000000'
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
  'ethereum-sepolia': {
    identity: '0x8004a6090Cd10A7288092483047B097295Fb8847',
    reputation: '0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E',
    validation: '0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5',
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70'
  },
  'base-sepolia': {
    identity: '0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
    reputation: '0x8004bd8daB57f14Ed299135749a5CB5c42d341BF',
    validation: '0x8004C269D0A5647E51E121FeB226200ECE932d55',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70'
  },
  'linea-sepolia': {
    identity: '0x8004aa7C931bCE1233973a0C6A667f73F66282e7',
    reputation: '0x8004bd8483b99310df121c46ED8858616b2Bba02',
    validation: '0x8004c44d1EFdd699B2A26e781eF7F77c56A9a4EB',
    usdc: '0x0000000000000000000000000000000000000000',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70'
  },
  'hedera-testnet': {
    identity: '0x4c74ebd72921d537159ed2053f46c12a7d8e5923',
    reputation: '0xc565edcba77e3abeade40bfd6cf6bf583b3293e0',
    validation: '0x18df085d85c586e9241e0cd121ca422f571c2da6',
    usdc: '0x0000000000000000000000000000000000000000',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70'
  },
  '0g-testnet': {
    identity: '0x80043ed9cf33a3472768dcd53175bb44e03a1e4a',
    reputation: '0x80045d7b72c47bf5ff73737b780cb1a5ba8ee202',
    validation: '0x80041728e0aadf1d1427f9be18d52b7f3afefafb',
    usdc: '0x0000000000000000000000000000000000000000',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70'
  },
  'bsc-testnet': {
    identity: '0xabbd26d86435b35d9c45177725084ee6a2812e40',
    reputation: '0xeced1af52a0446275e9e6e4f6f26c99977400a6a',
    validation: '0x7866bd057f09a4940fe2ce43320518c8749a921e',
    usdc: '0x0000000000000000000000000000000000000000',
    treasury: '0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70'
  }
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
  INSUFFICIENT_BALANCE: 'Insufficient balance'
} as const;
