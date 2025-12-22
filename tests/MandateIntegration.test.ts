import { describe, it, expect, beforeEach } from 'vitest';
import { ethers } from 'ethers';
import {
  MandateIntegration,
  type MandateCreateParams,
} from '../src/Mandate';
import { AgentRole } from '../src/types';
import type { MandateJSON } from '@quillai-network/mandates-core';

describe('MandateIntegration', () => {
  const mnemonic = 'test test test test test test test test test test test junk';
  let integration: MandateIntegration;
  let wallet: ethers.HDNodeWallet;
  let baseParams: MandateCreateParams;

  beforeEach(() => {
    integration = new MandateIntegration('MandateTestAgent', AgentRole.SERVER);
    wallet = ethers.HDNodeWallet.fromPhrase(mnemonic);
    const walletAddress = wallet.address as `0x${string}`;
    baseParams = {
      client: 'eip155:84532:0x1234567890abcdef1234567890abcdef12345678',
      server: `eip155:84532:${walletAddress}`,
      intent: 'test-service',
      deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      core: {
        kind: 'serviceAgreement',
        payload: {
          service: 'ai-evaluation',
          value: '10 USDC',
        },
      },
      version: '0.1.0',
    };
  });

  it('creates mandates with CAIP-10 identities', () => {
    const result = integration.createMandate(baseParams);

    expect(result.success).toBe(true);
    expect(result.mandate).toBeDefined();
    expect(result.mandate?.client).toBe(baseParams.client);
    expect(result.mandate?.server).toBe(baseParams.server);
    expect(result.mandateHash).toBeDefined();
  });

  it('signs mandates as server role and verifies signature', async () => {
    const creation = integration.createMandate(baseParams);
    expect(creation.success).toBe(true);

    const signResult = await integration.signMandate({
      mandate: creation.mandate as MandateJSON,
      agentRole: AgentRole.SERVER,
      wallet,
      alg: 'eip191',
    });

    expect(signResult.success).toBe(true);
    expect(signResult.signature).toBeDefined();
    expect(signResult.signature?.mandateHash).toBe(signResult.mandateHash);

    const verifyResult = integration.verifyMandateSignature(
      signResult.mandate as MandateJSON,
      'server',
    );

    expect(verifyResult.success).toBe(true);
    expect(verifyResult.mandateHash).toBe(signResult.mandateHash);
  });

  it('exposes mandate hash and canonical string helpers', async () => {
    const creation = integration.createMandate(baseParams);
    const signed = await integration.signMandate({
      mandate: creation.mandate as MandateJSON,
      agentRole: AgentRole.SERVER,
      wallet,
    });

    const hash = integration.getMandateHash(signed.mandate as MandateJSON);
    const canonical = integration.getCanonicalString(
      signed.mandate as MandateJSON,
    );

    expect(hash).toBeDefined();
    expect(hash).toBe(signed.mandateHash);
    expect(typeof canonical).toBe('string');
    expect(canonical.length).toBeGreaterThan(0);
  });

  it('provides integration summary metadata', () => {
    const summary = integration.getIntegrationSummary();

    expect(summary.integration_type).toBe('Mandates Core');
    expect(summary.agent_name).toBe('MandateTestAgent');
    expect(summary.supported_features).toContain(
      'Mandate creation with CAIP-10 identities',
    );
    expect(summary.cryptographic_features).toContain('EIP-191 message signing');
  });
});

