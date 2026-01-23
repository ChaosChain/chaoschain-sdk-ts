import { describe, it, expect, beforeEach } from 'vitest';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { StudioManager } from '../src/StudioManager';
import { NetworkConfig } from '../src/types';

describe('StudioManager', () => {
  let sdk: ChaosChainSDK;
  let studio: StudioManager;

  beforeEach(() => {
    sdk = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: 'server',
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: '0x' + '1'.repeat(64),
    });

    studio = sdk.studio();
  });

  it('should initialize StudioManager', () => {
    expect(studio).toBeInstanceOf(StudioManager);
  });

  it('should broadcast task', () => {
    const taskId = studio.broadcastTask(
      '0x' + '1'.repeat(40),
      {
        description: 'Test task',
        budget: 100.0,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        capabilities: ['analysis'],
        minReputation: 50,
      },
      ['0xWorker1', '0xWorker2']
    );

    expect(taskId).toBeDefined();
    expect(taskId).toMatch(/^task_/);

    const task = studio.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.status).toBe('broadcasting');
    expect(task?.requirements.description).toBe('Test task');
  });

  it('should get task by ID', () => {
    const taskId = studio.broadcastTask('0x' + '1'.repeat(40), {
      description: 'Test',
      budget: 50.0,
      deadline: new Date(),
    });

    const task = studio.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.taskId).toBe(taskId);
  });

  it('should assign task to worker', () => {
    const taskId = studio.broadcastTask('0x' + '1'.repeat(40), {
      description: 'Test',
      budget: 100.0,
      deadline: new Date(),
    });

    const assignmentId = studio.assignTask(taskId, '0xWorker', 100.0);

    expect(assignmentId).toBeDefined();

    const task = studio.getTask(taskId);
    expect(task?.status).toBe('assigned');
    expect(task?.assignedTo).toBe('0xWorker');
  });

  it('should select worker based on bids', () => {
    const bids = [
      {
        bidId: 'bid1',
        taskId: 'task1',
        workerAddress: '0xWorker1',
        workerAgentId: 1n,
        proposedPrice: 100.0,
        estimatedTimeHours: 2,
        capabilities: ['analysis'],
        reputationScore: 80,
        message: 'I can do it',
        submittedAt: new Date(),
      },
      {
        bidId: 'bid2',
        taskId: 'task1',
        workerAddress: '0xWorker2',
        workerAgentId: 2n,
        proposedPrice: 80.0,
        estimatedTimeHours: 1.5,
        capabilities: ['analysis'],
        reputationScore: 90,
        message: 'Better price',
        submittedAt: new Date(),
      },
    ];

    const reputationScores = {
      '0xWorker1': 80,
      '0xWorker2': 90,
    };

    const selected = studio.selectWorker(bids, reputationScores);

    // Worker2 should be selected (higher reputation, lower price)
    expect(selected).toBe('0xWorker2');
  });

  it('should throw error when selecting from empty bids', () => {
    expect(() => {
      studio.selectWorker([], {});
    }).toThrow('No bids to select from');
  });
});
