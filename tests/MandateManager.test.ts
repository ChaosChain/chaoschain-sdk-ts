import { describe, it, expect, beforeEach } from 'vitest';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { MandateManager } from '../src/MandateManager';
import { NetworkConfig } from '../src/types';
import { ethers } from 'ethers';

describe('MandateManager', () => {
  let sdk: ChaosChainSDK;
  let mandate: MandateManager;

  beforeEach(() => {
    sdk = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: 'server',
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: '0x' + '1'.repeat(64),
    });

    mandate = sdk.mandate();
  });

  it('should initialize MandateManager', () => {
    expect(mandate).toBeInstanceOf(MandateManager);
  });

  it('should create mandate', () => {
    const m = mandate.createMandate(
      'Buy 100 USDC worth of tokens',
      ['0xMerchant1', '0xMerchant2'],
      ['SKU1', 'SKU2'],
      true,
      60
    );

    expect(m.id).toBeDefined();
    expect(m.id).toMatch(/^mandate_/);
    expect(m.userDescription).toBe('Buy 100 USDC worth of tokens');
    expect(m.merchants).toEqual(['0xMerchant1', '0xMerchant2']);
    expect(m.skus).toEqual(['SKU1', 'SKU2']);
    expect(m.requiresRefundability).toBe(true);
    expect(m.expiry).toBeGreaterThan(Date.now());
  });

  it('should sign mandate as server', async () => {
    const m = mandate.createMandate('Test mandate');
    const signed = await mandate.signMandateAsServer(m);

    expect(signed.serverSignature).toBeDefined();
    expect(signed.serverSignature).toMatch(/^0x[a-fA-F0-9]{130}$/);
  });

  it('should verify mandate', async () => {
    const m = mandate.createMandate('Test mandate');
    const signed = await mandate.signMandateAsServer(m);

    const verification = await mandate.verifyMandate(signed);

    expect(verification.serverVerified).toBe(true);
    expect(verification.expired).toBe(false);
  });

  it('should detect expired mandate', async () => {
    const m = mandate.createMandate('Test', undefined, undefined, false, -1); // Expired
    const verification = await mandate.verifyMandate(m);

    expect(verification.expired).toBe(true);
  });
});
