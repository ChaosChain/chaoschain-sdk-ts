/**
 * Network configurations for supported chains
 */

import { NetworkConfig, NetworkInfo, ContractAddresses } from '../types';

/**
 * ERC-8004 v1.0 contract addresses (pre-deployed)
 */
export const ERC8004_ADDRESSES: Record<string, ContractAddresses> = {
  // Official ERC-8004 Registries (Feb 2026 spec)
  'ethereum-sepolia': {
    identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
    reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
    validation: '0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5',
  },
  'base-sepolia': {
    identity: '0x8004AA63c570c570eBF15376c0dB199918BFe9Fb',
    reputation: '0x8004bd8daB57f14Ed299135749a5CB5c42d341BF',
    validation: '0x8004C269D0A5647E51E121FeB226200ECE932d55',
  },
  'linea-sepolia': {
    identity: '0x8004aa7C931bCE1233973a0C6A667f73F66282e7',
    reputation: '0x8004bd8483b99310df121c46ED8858616b2Bba02',
    validation: '0x8004c44d1EFdd699B2A26e781eF7F77c56A9a4EB',
  },
  'hedera-testnet': {
    identity: '0x4c74ebd72921d537159ed2053f46c12a7d8e5923',
    reputation: '0xc565edcba77e3abeade40bfd6cf6bf583b3293e0',
    validation: '0x18df085d85c586e9241e0cd121ca422f571c2da6',
  },
  '0g-testnet': {
    identity: '0x80043ed9cf33a3472768dcd53175bb44e03a1e4a',
    reputation: '0x80045d7b72c47bf5ff73737b780cb1a5ba8ee202',
    validation: '0x80041728e0aadf1d1427f9be18d52b7f3afefafb',
  },
  'bsc-testnet': {
    identity: '0xabbd26d86435b35d9c45177725084ee6a2812e40',
    reputation: '0xeced1af52a0446275e9e6e4f6f26c99977400a6a',
    validation: '0x7866bd057f09a4940fe2ce43320518c8749a921e',
  },
};

/**
 * Network information and RPC endpoints
 */
export const NETWORK_INFO: Record<string, NetworkInfo> = {
  'ethereum-sepolia': {
    chainId: 11155111,
    name: 'Ethereum Sepolia Testnet',
    rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    contracts: ERC8004_ADDRESSES['ethereum-sepolia'],
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  'base-sepolia': {
    chainId: 84532,
    name: 'Base Sepolia Testnet',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    contracts: ERC8004_ADDRESSES['base-sepolia'],
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  'linea-sepolia': {
    chainId: 59141,
    name: 'Linea Sepolia Testnet',
    rpcUrl: process.env.LINEA_SEPOLIA_RPC_URL || 'https://rpc.sepolia.linea.build',
    contracts: ERC8004_ADDRESSES['linea-sepolia'],
    nativeCurrency: {
      name: 'Linea ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  'hedera-testnet': {
    chainId: 296,
    name: 'Hedera Testnet',
    rpcUrl: process.env.HEDERA_TESTNET_RPC_URL || 'https://testnet.hashio.io/api',
    contracts: ERC8004_ADDRESSES['hedera-testnet'],
    nativeCurrency: {
      name: 'HBAR',
      symbol: 'HBAR',
      decimals: 18,
    },
  },
  '0g-testnet': {
    chainId: 16602, // Updated to match Python SDK (was 16600)
    name: '0G Network Testnet',
    rpcUrl: process.env.ZEROG_TESTNET_RPC_URL || 'https://evmrpc-testnet.0g.ai',
    contracts: ERC8004_ADDRESSES['0g-testnet'],
    nativeCurrency: {
      name: 'A0GI',
      symbol: 'A0GI',
      decimals: 18,
    },
  },
  'bsc-testnet': {
    chainId: 97,
    name: 'BSC Testnet (Chapel)',
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    contracts: ERC8004_ADDRESSES['bsc-testnet'],
    nativeCurrency: {
      name: 'Binance Coin',
      symbol: 'BNB',
      decimals: 18,
    },
  },
  local: {
    chainId: 31337,
    name: 'Local Network',
    rpcUrl: process.env.LOCAL_RPC_URL || 'http://localhost:8545',
    contracts: {
      identity: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      reputation: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      validation: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    },
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};

/**
 * Get network info by name
 */
export function getNetworkInfo(network: NetworkConfig | string): NetworkInfo {
  const networkKey = network as string;
  const info = NETWORK_INFO[networkKey];

  if (!info) {
    throw new Error(`Unsupported network: ${networkKey}`);
  }

  return info;
}

/**
 * Get contract addresses for a network
 */
export function getContractAddresses(network: NetworkConfig | string): ContractAddresses {
  return getNetworkInfo(network).contracts;
}

/**
 * Check if network is supported
 */
export function isNetworkSupported(network: string): boolean {
  return network in NETWORK_INFO;
}

/**
 * Get all supported networks
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(NETWORK_INFO);
}
