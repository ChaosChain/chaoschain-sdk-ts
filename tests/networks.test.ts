/**
 * Network Configuration Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getNetworkInfo,
  getContractAddresses,
  isNetworkSupported,
  getSupportedNetworks,
} from '../src/utils/networks';
import { NetworkConfig } from '../src/types';

describe('Network Configuration', () => {
  it('should get network info for Base Sepolia', () => {
    const info = getNetworkInfo(NetworkConfig.BASE_SEPOLIA);

    expect(info).toBeDefined();
    expect(info.chainId).toBe(84532);
    expect(info.name).toBe('Base Sepolia Testnet');
    expect(info.contracts).toBeDefined();
    expect(info.contracts.identity).toMatch(/^0x/);
  });

  it('should get network info for Ethereum Sepolia', () => {
    const info = getNetworkInfo(NetworkConfig.ETHEREUM_SEPOLIA);

    expect(info).toBeDefined();
    expect(info.chainId).toBe(11155111);
    expect(info.contracts.identity).toBe('0x8004a6090Cd10A7288092483047B097295Fb8847');
  });

  it('should get contract addresses', () => {
    const addresses = getContractAddresses(NetworkConfig.BASE_SEPOLIA);

    expect(addresses).toBeDefined();
    expect(addresses.identity).toBe('0x8004AA63c570c570eBF15376c0dB199918BFe9Fb');
    expect(addresses.reputation).toBeDefined();
    expect(addresses.validation).toBeDefined();
  });

  it('should check if network is supported', () => {
    expect(isNetworkSupported('base-sepolia')).toBe(true);
    expect(isNetworkSupported('ethereum-sepolia')).toBe(true);
    expect(isNetworkSupported('bsc-testnet')).toBe(true);
    expect(isNetworkSupported('invalid-network')).toBe(false);
  });

  it('should get all supported networks', () => {
    const networks = getSupportedNetworks();

    expect(networks).toContain('base-sepolia');
    expect(networks).toContain('ethereum-sepolia');
    expect(networks).toContain('linea-sepolia');
    expect(networks).toContain('bsc-testnet');
    expect(networks.length).toBeGreaterThan(0);
  });

  it('should get network info for BSC Testnet', () => {
    const info = getNetworkInfo(NetworkConfig.BSC_TESTNET);

    expect(info).toBeDefined();
    expect(info.chainId).toBe(97);
    expect(info.name).toBe('BSC Testnet (Chapel)');
    expect(info.contracts).toBeDefined();
    expect(info.contracts.identity).toBe('0xabbd26d86435b35d9c45177725084ee6a2812e40');
    expect(info.contracts.reputation).toBe('0xeced1af52a0446275e9e6e4f6f26c99977400a6a');
    expect(info.contracts.validation).toBe('0x7866bd057f09a4940fe2ce43320518c8749a921e');
    expect(info.nativeCurrency.symbol).toBe('BNB');
  });

  it('should throw error for unsupported network', () => {
    expect(() => getNetworkInfo('invalid-network' as NetworkConfig)).toThrow(
      'Unsupported network: invalid-network'
    );
  });
});
