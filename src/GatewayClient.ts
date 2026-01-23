/**
 * Gateway Client for ChaosChain SDK
 *
 * This module provides the HTTP client for communicating with the ChaosChain Gateway.
 *
 * BOUNDARY INVARIANTS (NON-NEGOTIABLE):
 * 1. SDK does NOT contain workflow logic
 * 2. SDK does NOT submit transactions directly
 * 3. SDK only prepares inputs, calls Gateway, and polls status
 * 4. All execution happens in Gateway
 *
 * The Gateway is the ONLY transaction submitter.
 * The SDK is a thin client that prepares data and polls for results.
 */

/**
 * Workflow types supported by Gateway
 */
export enum WorkflowType {
  WORK_SUBMISSION = 'WorkSubmission',
  SCORE_SUBMISSION = 'ScoreSubmission',
  CLOSE_EPOCH = 'CloseEpoch',
}

/**
 * Workflow states
 */
export enum WorkflowState {
  CREATED = 'CREATED',
  RUNNING = 'RUNNING',
  STALLED = 'STALLED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Progress data for a workflow
 */
export interface WorkflowProgress {
  arweaveTxId?: string;
  arweaveConfirmed?: boolean;
  onchainTxHash?: string;
  onchainConfirmed?: boolean;
  onchainBlock?: number;
  commitTxHash?: string;
  revealTxHash?: string;
}

/**
 * Error information for a failed workflow
 */
export interface WorkflowError {
  step: string;
  message: string;
  code?: string;
}

/**
 * Status of a workflow
 */
export interface WorkflowStatus {
  id: string;
  type: WorkflowType;
  state: WorkflowState;
  step: string;
  createdAt: number;
  updatedAt: number;
  progress: WorkflowProgress;
  error?: WorkflowError;
}

/**
 * Gateway error
 */
export class GatewayError extends Error {
  statusCode?: number;
  response?: any;

  constructor(message: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'GatewayError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

/**
 * Gateway connection error
 */
export class GatewayConnectionError extends GatewayError {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayConnectionError';
  }
}

/**
 * Gateway timeout error
 */
export class GatewayTimeoutError extends GatewayError {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayTimeoutError';
  }
}

/**
 * Workflow failed error
 */
export class WorkflowFailedError extends GatewayError {
  workflowId: string;
  error: WorkflowError;

  constructor(workflowId: string, error: WorkflowError) {
    super(`Workflow ${workflowId} failed at step ${error.step}: ${error.message}`);
    this.name = 'WorkflowFailedError';
    this.workflowId = workflowId;
    this.error = error;
  }
}

/**
 * Gateway Client for ChaosChain SDK
 *
 * Thin client that prepares data and polls Gateway for workflow status.
 * All transaction execution happens in Gateway.
 */
export class GatewayClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  /**
   * Submit work via Gateway
   *
   * @param params Work submission parameters
   * @returns Workflow status
   */
  async submitWork(params: {
    studioAddress: string;
    epoch: number;
    dataHash: string;
    threadRoot: string;
    evidenceRoot: string;
    evidenceContent: string; // Base64 or JSON string
  }): Promise<WorkflowStatus> {
    const payload = {
      studio_address: params.studioAddress,
      epoch: params.epoch,
      data_hash: params.dataHash,
      thread_root: params.threadRoot,
      evidence_root: params.evidenceRoot,
      evidence_content: params.evidenceContent,
    };

    return this._request<WorkflowStatus>('POST', '/workflows/work-submission', payload);
  }

  /**
   * Submit score via Gateway (commit-reveal pattern)
   *
   * @param params Score submission parameters
   * @returns Workflow status
   */
  async submitScore(params: {
    studioAddress: string;
    epoch: number;
    validatorAddress: string;
    dataHash: string;
    scores: number[]; // Array of dimension scores (0-10000 basis points)
    salt: string; // Bytes32 random salt for commit-reveal (as hex string)
    signerAddress: string;
  }): Promise<WorkflowStatus> {
    const payload = {
      studio_address: params.studioAddress,
      epoch: params.epoch,
      validator_address: params.validatorAddress,
      data_hash: params.dataHash,
      scores: params.scores,
      salt: params.salt,
      signer_address: params.signerAddress,
    };

    return this._request<WorkflowStatus>('POST', '/workflows/score-submission', payload);
  }

  /**
   * Close epoch via Gateway
   *
   * @param params Epoch closure parameters
   * @returns Workflow status
   */
  async closeEpoch(params: {
    studioAddress: string;
    epoch: number;
    signerAddress: string;
  }): Promise<WorkflowStatus> {
    const payload = {
      studio_address: params.studioAddress,
      epoch: params.epoch,
      signer_address: params.signerAddress,
    };

    return this._request<WorkflowStatus>('POST', '/workflows/close-epoch', payload);
  }

  /**
   * Get workflow status
   *
   * @param workflowId Workflow ID
   * @returns Workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus> {
    return this._request<WorkflowStatus>('GET', `/workflows/${workflowId}`);
  }

  /**
   * Wait for workflow completion
   *
   * @param workflowId Workflow ID
   * @param pollInterval Polling interval in milliseconds (default: 2000)
   * @param maxWaitTime Maximum wait time in milliseconds (default: 300000 = 5 minutes)
   * @returns Final workflow status
   */
  async waitForCompletion(
    workflowId: string,
    pollInterval: number = 2000,
    maxWaitTime: number = 300000
  ): Promise<WorkflowStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getWorkflowStatus(workflowId);

      if (status.state === WorkflowState.COMPLETED) {
        return status;
      }

      if (status.state === WorkflowState.FAILED) {
        throw new WorkflowFailedError(workflowId, status.error!);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new GatewayTimeoutError(
      `Workflow ${workflowId} did not complete within ${maxWaitTime}ms`
    );
  }

  /**
   * Submit work and wait for completion
   */
  async submitWorkAndWait(params: {
    studioAddress: string;
    epoch: number;
    dataHash: string;
    threadRoot: string;
    evidenceRoot: string;
    evidenceContent: string;
  }): Promise<WorkflowStatus> {
    const workflow = await this.submitWork(params);
    return this.waitForCompletion(workflow.id);
  }

  /**
   * Submit score and wait for completion
   */
  async submitScoreAndWait(params: {
    studioAddress: string;
    epoch: number;
    validatorAddress: string;
    dataHash: string;
    scores: number[];
    salt: string;
    signerAddress: string;
  }): Promise<WorkflowStatus> {
    const workflow = await this.submitScore(params);
    return this.waitForCompletion(workflow.id);
  }

  /**
   * Close epoch and wait for completion
   */
  async closeEpochAndWait(params: {
    studioAddress: string;
    epoch: number;
    signerAddress: string;
  }): Promise<WorkflowStatus> {
    const workflow = await this.closeEpoch(params);
    return this.waitForCompletion(workflow.id);
  }

  /**
   * Make HTTP request to Gateway
   */
  private async _request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.timeout),
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new GatewayError(
          `Gateway request failed: ${response.statusText}`,
          response.status,
          errorData
        );
      }

      return (await response.json()) as T;
    } catch (error: any) {
      if (error instanceof GatewayError) {
        throw error;
      }

      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        throw new GatewayTimeoutError(`Gateway request timed out: ${error.message}`);
      }

      if (error.message?.includes('fetch')) {
        throw new GatewayConnectionError(`Failed to connect to Gateway: ${error.message}`);
      }

      throw new GatewayError(`Gateway request failed: ${error.message}`);
    }
  }
}
