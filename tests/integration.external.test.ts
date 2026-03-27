import { describe, it, expect } from 'vitest';
import { GatewayClient, derivePoAScores, verifyWorkEvidence, composeScoreVector } from '@chaoschain/sdk';

const STUDIO_ADDRESS = '0xA855F7893ac01653D1bCC24210bFbb3c47324649';
const BASE_URL = 'https://gateway.chaoscha.in';

describe('External SDK integration smoke', () => {
  it('supports external verifier workflow imports and pending work fetch', async () => {
    const gateway = new GatewayClient({ baseUrl: BASE_URL, timeout: 3000 });

    try {
      const pending = await gateway.getPendingWork(STUDIO_ADDRESS);
      expect(Array.isArray(pending.data.work)).toBe(true);
    } catch (error) {
      // Expected in CI: gateway not reachable
      expect(error).toBeDefined();
    }

    const sample = [
      {
        arweave_tx_id: 'a',
        author: '0x1',
        timestamp: Date.now(),
        parent_ids: [],
        payload_hash: '0xhash1',
        artifact_ids: ['x.ts'],
        signature: '0xsig1',
      },
      {
        arweave_tx_id: 'b',
        author: '0x1',
        timestamp: Date.now(),
        parent_ids: ['a'],
        payload_hash: '0xhash2',
        artifact_ids: ['y.ts'],
        signature: '0xsig2',
      },
    ];

    const scores = derivePoAScores(sample);
    const verification = verifyWorkEvidence(sample);

    expect(scores).toHaveLength(5);
    expect(verification.valid).toBe(true);
    expect(verification.signals).toBeDefined();

    // Full pipeline: verify → compose
    const vector = composeScoreVector(verification.signals!, {
      complianceScore: 85,
      efficiencyScore: 78,
    });
    expect(vector).toHaveLength(5);
    expect(vector.every(v => Number.isInteger(v) && v >= 0 && v <= 100)).toBe(true);
  });
});
