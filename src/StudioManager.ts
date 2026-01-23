/**
 * Studio Manager for ChaosChain Task Assignment and Orchestration
 *
 * Implements Studio task workflow:
 * - Task broadcasting to registered workers
 * - Bid collection from workers
 * - Worker selection (reputation-based)
 * - Task assignment
 * - Work submission tracking
 */

import { ChaosChainSDK } from './ChaosChainSDK';
import { ChaosAgent } from './ChaosAgent';

/**
 * Task definition
 */
export interface Task {
  taskId: string;
  studioAddress: string;
  requirements: TaskRequirements;
  status: 'broadcasting' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  assignedTo?: string;
  assignedAt?: Date;
}

/**
 * Task requirements
 */
export interface TaskRequirements {
  description: string;
  budget: number; // USDC amount
  deadline: Date;
  capabilities?: string[];
  minReputation?: number;
}

/**
 * Worker bid on a task
 */
export interface WorkerBid {
  bidId: string;
  taskId: string;
  workerAddress: string;
  workerAgentId: bigint;
  proposedPrice: number;
  estimatedTimeHours: number;
  capabilities: string[];
  reputationScore: number;
  message: string;
  submittedAt: Date;
}

/**
 * Studio Manager for task orchestration
 */
export class StudioManager {
  private sdk: ChaosChainSDK;
  private chaosAgent: ChaosAgent;
  private tasks: Map<string, Task>;
  private bids: Map<string, WorkerBid[]>;

  constructor(sdk: ChaosChainSDK) {
    this.sdk = sdk;
    this.chaosAgent = (sdk as any).chaosAgent; // Access internal chaosAgent
    this.tasks = new Map();
    this.bids = new Map();
  }

  /**
   * Get registered workers from StudioProxy
   *
   * Note: This would require StudioProxy ABI extension for getRegisteredWorkers()
   * For now, returns empty array - would need contract method
   */
  async getRegisteredWorkers(studioAddress: string): Promise<string[]> {
    // TODO: Implement when StudioProxy.getRegisteredWorkers() is available
    console.warn('getRegisteredWorkers() not yet implemented - requires StudioProxy ABI extension');
    return [];
  }

  /**
   * Broadcast task to registered workers
   *
   * @param studioAddress Studio contract address
   * @param requirements Task requirements
   * @param registeredWorkers List of worker addresses
   * @returns Task ID
   */
  broadcastTask(
    studioAddress: string,
    requirements: TaskRequirements,
    registeredWorkers: string[] = []
  ): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task: Task = {
      taskId,
      studioAddress,
      requirements,
      status: 'broadcasting',
      createdAt: new Date(),
    };

    this.tasks.set(taskId, task);
    this.bids.set(taskId, []);

    console.log(`📢 Task ${taskId} broadcasted to ${registeredWorkers.length} workers`);
    console.log(`   Budget: ${requirements.budget} USDC`);
    console.log(`   Deadline: ${requirements.deadline.toISOString()}`);

    return taskId;
  }

  /**
   * Collect bids from workers (with timeout)
   *
   * @param taskId Task ID
   * @param timeoutSeconds Timeout in seconds (default: 300 = 5 minutes)
   * @returns Array of bids
   */
  async collectBids(taskId: string, timeoutSeconds: number = 300): Promise<WorkerBid[]> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    console.log(`⏳ Collecting bids for task ${taskId} (timeout: ${timeoutSeconds}s)...`);

    // In a real implementation, this would listen for bid events or poll
    // For now, return existing bids
    const existingBids = this.bids.get(taskId) || [];

    // Simulate waiting (in real implementation, would wait for events)
    await new Promise((resolve) => setTimeout(resolve, Math.min(timeoutSeconds * 1000, 5000)));

    const bids = this.bids.get(taskId) || [];
    console.log(`📥 Collected ${bids.length} bids`);

    return bids;
  }

  /**
   * Get worker reputations
   *
   * @param workerAddresses Array of worker addresses
   * @returns Map of worker address to reputation score
   */
  async getWorkerReputations(workerAddresses: string[]): Promise<Record<string, number>> {
    const reputations: Record<string, number> = {};

    // Get agent IDs for workers
    // Note: This would require resolving addresses to agent IDs
    // For now, return default scores
    for (const address of workerAddresses) {
      reputations[address] = 75; // Default reputation
    }

    return reputations;
  }

  /**
   * Select best worker based on bids and reputation
   *
   * @param bids Array of bids
   * @param reputationScores Map of worker address to reputation score
   * @returns Selected worker address
   */
  selectWorker(bids: WorkerBid[], reputationScores: Record<string, number>): string {
    if (bids.length === 0) {
      throw new Error('No bids to select from');
    }

    // Score each bid: reputation * 0.6 + (1/price) * 0.4
    const scoredBids = bids.map((bid) => {
      const reputation = reputationScores[bid.workerAddress] || 0;
      const priceScore = bid.proposedPrice > 0 ? 100 / bid.proposedPrice : 0;
      const score = reputation * 0.6 + priceScore * 0.4;

      return { bid, score };
    });

    // Sort by score (highest first)
    scoredBids.sort((a, b) => b.score - a.score);

    const selected = scoredBids[0].bid;
    console.log(`✅ Selected worker: ${selected.workerAddress.slice(0, 10)}...`);
    console.log(
      `   Score: ${scoredBids[0].score.toFixed(2)}, Price: ${selected.proposedPrice} USDC`
    );

    return selected.workerAddress;
  }

  /**
   * Assign task to worker
   *
   * @param taskId Task ID
   * @param workerAddress Worker address
   * @param budget Budget amount
   * @returns Assignment ID
   */
  assignTask(taskId: string, workerAddress: string, budget: number): string {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = 'assigned';
    task.assignedTo = workerAddress;
    task.assignedAt = new Date();

    const assignmentId = `assignment_${taskId}_${Date.now()}`;

    console.log(`📋 Task ${taskId} assigned to ${workerAddress.slice(0, 10)}...`);
    console.log(`   Budget: ${budget} USDC`);

    return assignmentId;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get bids for a task
   */
  getBids(taskId: string): WorkerBid[] {
    return this.bids.get(taskId) || [];
  }
}
