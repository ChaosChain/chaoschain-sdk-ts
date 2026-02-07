import { describe, it, expect } from 'vitest';
import { ChaosChainSDK, NetworkConfig } from '../src';
import { StudioManager } from '../src/StudioManager';

describe('StudioManager', () => {
  it('should broadcast tasks and accept bids', async () => {
    const sdk = new ChaosChainSDK({
      agentName: 'StudioClient',
      agentDomain: 'client.example.com',
      agentRole: 'client',
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      enablePayments: false,
      enableStorage: false,
      enableAP2: false,
      enableProcessIntegrity: false,
    });

    const studioManager = new StudioManager({
      sdk,
      messenger: {
        sendMessage: async () => 'msg_1',
      },
    });

    const taskId = await studioManager.broadcastTask(
      '0xStudio',
      { description: 'Analyze market data', budget: 100 },
      ['0xWorker1', '0xWorker2']
    );

    const bidId = studioManager.submitBid(
      taskId,
      '0xWorker1',
      123,
      100,
      2,
      ['analysis'],
      'ready'
    );

    const bids = await studioManager.collectBids(taskId, 0);
    expect(taskId).toMatch(/^task_/);
    expect(bidId).toMatch(/^bid_/);
    expect(bids.length).toBe(1);
  });

  it('should select worker based on bids', () => {
    const sdk = new ChaosChainSDK({
      agentName: 'StudioClient',
      agentDomain: 'client.example.com',
      agentRole: 'client',
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      enablePayments: false,
      enableStorage: false,
      enableAP2: false,
      enableProcessIntegrity: false,
    });

    const studioManager = new StudioManager({ sdk });
    const bids = [
      {
        bidId: 'bid_1',
        taskId: 'task_1',
        workerAddress: '0xWorker1',
        workerAgentId: 1,
        proposedPrice: 100,
        estimatedTimeHours: 4,
        capabilities: ['analysis', 'research'],
        reputationScore: 0,
        message: '',
        submittedAt: new Date(),
      },
      {
        bidId: 'bid_2',
        taskId: 'task_1',
        workerAddress: '0xWorker2',
        workerAgentId: 2,
        proposedPrice: 80,
        estimatedTimeHours: 6,
        capabilities: ['analysis'],
        reputationScore: 0,
        message: '',
        submittedAt: new Date(),
      },
    ];

    const reputations = {
      '0xWorker1': 90,
      '0xWorker2': 70,
    };

    const selected = studioManager.selectWorker(bids, reputations);
    expect(selected).toBeDefined();
  });
});
