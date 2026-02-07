import { ChaosChainSDK } from './ChaosChainSDK';
import { ChaosChainSDKError } from './exceptions';

export interface Task {
  taskId: string;
  studioAddress: string;
  requirements: Record<string, any>;
  status: string;
  createdAt: Date;
  assignedTo?: string;
  assignedAt?: Date;
}

export interface WorkerBid {
  bidId: string;
  taskId: string;
  workerAddress: string;
  workerAgentId: number;
  proposedPrice: number;
  estimatedTimeHours: number;
  capabilities: string[];
  reputationScore: number;
  message: string;
  submittedAt: Date;
}

export interface StudioManagerConfig {
  sdk: ChaosChainSDK;
  messenger?: {
    sendMessage: (params: {
      toAgent: string;
      messageType: string;
      content: Record<string, any>;
    }) => Promise<string>;
  };
}

export class StudioManager {
  private sdk: ChaosChainSDK;
  private messenger?: StudioManagerConfig['messenger'];
  private activeTasks: Record<string, Task> = {};
  private workerBids: Record<string, WorkerBid[]> = {};

  constructor(config: StudioManagerConfig) {
    this.sdk = config.sdk;
    this.messenger = config.messenger;

    if (!this.messenger) {
      console.warn('⚠️ XMTP not available. Task broadcasting will be limited.');
    }
  }

  getRegisteredWorkers(_studioAddress: string): string[] {
    console.warn('⚠️ StudioProxy needs getRegisteredWorkers() method');
    return [];
  }

  async broadcastTask(
    studioAddress: string,
    taskRequirements: Record<string, any>,
    registeredWorkers: string[]
  ): Promise<string> {
    if (!this.messenger) {
      throw new ChaosChainSDKError('XMTP not available. Provide a messenger adapter.');
    }

    const taskId = `task_${Math.random().toString(16).slice(2, 10)}`;
    const task: Task = {
      taskId,
      studioAddress,
      requirements: taskRequirements,
      status: 'broadcasting',
      createdAt: new Date(),
    };

    this.activeTasks[taskId] = task;
    this.workerBids[taskId] = [];

    console.log(`📢 Broadcasting task ${taskId} to ${registeredWorkers.length} workers...`);

    for (const workerAddress of registeredWorkers) {
      try {
        await this.messenger.sendMessage({
          toAgent: workerAddress,
          messageType: 'task_broadcast',
          content: {
            task_id: taskId,
            studio_address: studioAddress,
            ...taskRequirements,
          },
        });
        console.log(`✅ Sent to ${workerAddress.slice(0, 8)}...`);
      } catch (error) {
        console.warn(`⚠️ Failed to send to ${workerAddress.slice(0, 8)}...: ${String(error)}`);
      }
    }

    return taskId;
  }

  async collectBids(taskId: string, timeoutSeconds = 300): Promise<WorkerBid[]> {
    if (!this.activeTasks[taskId]) {
      throw new ChaosChainSDKError(`Task ${taskId} not found`);
    }

    const deadline = Date.now() + timeoutSeconds * 1000;
    console.log(`⏳ Collecting bids for ${timeoutSeconds}s...`);

    while (Date.now() < deadline) {
      const bids = this.workerBids[taskId] || [];
      if (bids.length >= 3) {
        console.log(`✅ Received ${bids.length} bids`);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    const bids = this.workerBids[taskId] || [];
    if (bids.length === 0) {
      console.warn('⚠️ No bids received');
    } else {
      this.displayBids(bids);
    }
    return bids;
  }

  submitBid(
    taskId: string,
    workerAddress: string,
    workerAgentId: number,
    proposedPrice: number,
    estimatedTimeHours: number,
    capabilities: string[],
    message = ''
  ): string {
    if (!this.activeTasks[taskId]) {
      throw new ChaosChainSDKError(`Task ${taskId} not found`);
    }

    const bid: WorkerBid = {
      bidId: `bid_${Math.random().toString(16).slice(2, 10)}`,
      taskId,
      workerAddress,
      workerAgentId,
      proposedPrice,
      estimatedTimeHours,
      capabilities,
      reputationScore: 0,
      message,
      submittedAt: new Date(),
    };

    this.workerBids[taskId] = this.workerBids[taskId] || [];
    this.workerBids[taskId].push(bid);

    console.log(`✅ Bid ${bid.bidId} submitted for task ${taskId}`);
    return bid.bidId;
  }

  getWorkerReputations(workerAddresses: string[]): Record<string, number> {
    const reputationScores: Record<string, number> = {};
    for (const address of workerAddresses) {
      reputationScores[address] = 75.0;
    }
    return reputationScores;
  }

  selectWorker(
    bids: WorkerBid[],
    reputationScores: Record<string, number>,
    weights?: Record<string, number>
  ): string {
    if (!bids.length) {
      throw new ChaosChainSDKError('No bids to select from');
    }

    const weight = weights || {
      reputation: 0.4,
      price: 0.3,
      time: 0.2,
      capabilities: 0.1,
    };

    const maxPrice = Math.max(...bids.map((bid) => bid.proposedPrice));
    const maxTime = Math.max(...bids.map((bid) => bid.estimatedTimeHours));
    const maxReputation = Math.max(...Object.values(reputationScores));

    let bestScore = -1;
    let bestWorker = bids[0].workerAddress;

    for (const bid of bids) {
      const reputation = reputationScores[bid.workerAddress] || 0;
      const normReputation = maxReputation > 0 ? reputation / maxReputation : 0;
      const normPrice = maxPrice > 0 ? 1 - bid.proposedPrice / maxPrice : 1;
      const normTime = maxTime > 0 ? 1 - bid.estimatedTimeHours / maxTime : 1;
      const capabilityMatch = bid.capabilities.length / 10;

      const score =
        weight.reputation * normReputation +
        weight.price * normPrice +
        weight.time * normTime +
        weight.capabilities * capabilityMatch;

      if (score > bestScore) {
        bestScore = score;
        bestWorker = bid.workerAddress;
      }
    }

    console.log(`✅ Selected worker: ${bestWorker.slice(0, 8)}... (score=${bestScore.toFixed(2)})`);
    return bestWorker;
  }

  async assignTask(taskId: string, workerAddress: string, budget: number): Promise<string> {
    if (!this.activeTasks[taskId]) {
      throw new ChaosChainSDKError(`Task ${taskId} not found`);
    }

    if (!this.messenger) {
      throw new ChaosChainSDKError('XMTP not available. Provide a messenger adapter.');
    }

    const task = this.activeTasks[taskId];
    task.status = 'assigned';
    task.assignedTo = workerAddress;
    task.assignedAt = new Date();

    const deadline =
      task.requirements.deadline instanceof Date
        ? task.requirements.deadline.toISOString()
        : task.requirements.deadline || '';

    const messageId = await this.messenger.sendMessage({
      toAgent: workerAddress,
      messageType: 'task_assignment',
      content: {
        task_id: taskId,
        studio_address: task.studioAddress,
        budget,
        deadline,
        requirements: task.requirements,
      },
    });

    console.log(`✅ Task ${taskId} assigned to ${workerAddress.slice(0, 8)}...`);
    return messageId;
  }

  private displayBids(bids: WorkerBid[]) {
    console.log(
      bids.map((bid) => ({
        worker: `${bid.workerAddress.slice(0, 8)}...`,
        price: bid.proposedPrice,
        time: bid.estimatedTimeHours,
        capabilities: bid.capabilities.slice(0, 3),
        reputation: bid.reputationScore,
      }))
    );
  }
}
