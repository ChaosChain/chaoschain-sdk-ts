import axios, { AxiosError } from 'axios';
import {
  WorkflowType,
  WorkflowState,
  WorkflowStatus,
  WorkflowProgress,
  WorkflowError as WorkflowErrorType,
  GatewayClientConfig,
  ScoreSubmissionMode,
} from './types';
import {
  GatewayError,
  GatewayConnectionError,
  GatewayTimeoutError,
  WorkflowFailedError,
} from './exceptions';

export class GatewayClient {
  private gatewayUrl: string;
  private timeout: number;
  private maxPollTime: number;
  private pollInterval: number;

  constructor(config: GatewayClientConfig) {
    this.gatewayUrl = config.gatewayUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 30000; // Default timeout 30s
    this.maxPollTime = config.maxPollTime || 600000; // Default max poll time 10min
    this.pollInterval = config.pollInterval || 2000; // Default poll interval 2s
  }

  // ===========================================================================
  // Private: HTTP Request
  // ===========================================================================

  /**
   * Make HTTP request to Gateway.
   * Handles errors and transforms them to Gateway exceptions.
   */
  private async _request<T>(
    method: 'GET' | 'POST',
    path: string,
    data?: Record<string, any>
  ): Promise<T> {
    const url = `${this.gatewayUrl}${path}`;

    try {
      const response = await axios({
        method,
        url,
        data,
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/json' },
      });

      return response.data;
    } catch (error) {
      this._handleError(error as AxiosError);
    }
  }

  /**
   * Transform axios errors to Gateway exceptions.
   */
  private _handleError(error: AxiosError): never {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new GatewayConnectionError(`Failed to connect to Gateway at ${this.gatewayUrl}`);
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new GatewayTimeoutError('timeout', `request to Gateway timed out: ${error.message}`);
    }

    if (error.response) {
      const data = error.response.data as any;
      const message = data?.error || data?.message || 'Unknown error from Gateway';
      throw new GatewayError(`Gateway returned error: ${message}`, {
        statusCode: error.response.status,
        response: data,
      });
    }

    throw new GatewayError(`Gateway request failed: ${error.message}`);
  }

  /**
   * Parse workflow status from API response.
   */
  private _parseWorkflowStatus(data: any): WorkflowStatus {
    const progress: WorkflowProgress = {
      arweaveTxId: data.progress?.arweave_tx_id,
      arweaveConfirmed: data.progress?.arweave_confirmed,
      onchainTxHash: data.progress?.onchain_tx_hash,
      onchainConfirmed: data.progress?.onchain_confirmed,
      onchainBlock: data.progress?.onchain_block,
      scoreTxHash: data.progress?.score_tx_hash,
      commitTxHash: data.progress?.commit_tx_hash,
      revealTxHash: data.progress?.reveal_tx_hash,
    };

    const error: WorkflowErrorType | undefined = data.error
      ? {
          step: data.error.step || '',
          message: data.error.message || '',
          code: data.error.code,
        }
      : undefined;

    return {
      workflowId: data.id,
      workflowType: data.type as WorkflowType,
      state: data.state as WorkflowState,
      step: data.step,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      progress,
      error,
    };
  }

  // ===========================================================================
  // Health Check
  // ===========================================================================

  async healthCheck(): Promise<{ status: string; timestamp?: number }> {
    return this._request('GET', '/health');
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.healthCheck();
      return result.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  // ===========================================================================
  // Workflow Submission
  // ===========================================================================

  /**
   * Create a work submission workflow.
   * POST /workflows/work-submission
   *
   * SDK prepares inputs; Gateway handles:
   * - Evidence upload to Arweave
   * - Transaction submission
   * - Confirmation waiting
   *
   * @param studioAddress - Ethereum address of the studio
   * @param epoch - Epoch number
   * @param agentAddress - Ethereum address of the submitting agent
   * @param dataHash - Bytes32 hash of the work (as hex string)
   * @param threadRoot - Bytes32 DKG thread root (as hex string)
   * @param evidenceRoot - Bytes32 evidence Merkle root (as hex string)
   * @param evidenceContent - Raw evidence bytes (will be base64 encoded)
   * @param signerAddress - Ethereum address of the signer (must be registered in Gateway)
   * @returns WorkflowStatus - Initial status of the created workflow
   */
  async submitWork(
    studioAddress: string,
    epoch: number,
    agentAddress: string,
    dataHash: string,
    threadRoot: string,
    evidenceRoot: string,
    evidenceContent: Buffer | string,
    signerAddress: string
  ): Promise<WorkflowStatus> {
    const evidenceBase64 = Buffer.isBuffer(evidenceContent)
      ? evidenceContent.toString('base64')
      : Buffer.from(evidenceContent, 'utf-8').toString('base64');

    const payload = {
      studio_address: studioAddress,
      epoch,
      agent_address: agentAddress,
      data_hash: dataHash,
      thread_root: threadRoot,
      evidence_root: evidenceRoot,
      evidence_base64: evidenceBase64,
      signer_address: signerAddress,
    };

    const result = await this._request<any>('POST', '/workflows/work-submission', payload);
    return this._parseWorkflowStatus(result);
  }

  /**
   * Create a score submission workflow.
   * POST /workflows/score-submission
   *
   * Supports two modes:
   * - DIRECT (default): Simple direct scoring, requires workerAddress
   * - COMMIT_REVEAL: Commit-reveal pattern, requires salt
   *
   * @param studioAddress - Ethereum address of the studio
   * @param epoch - Epoch number
   * @param validatorAddress - Ethereum address of the validator
   * @param dataHash - Bytes32 hash of the work being scored (as hex string)
   * @param scores - Array of dimension scores (0-10000 basis points)
   * @param signerAddress - Ethereum address of the signer
   * @param options - Additional options (workerAddress, salt, mode)
   */
  async submitScore(
    studioAddress: string,
    epoch: number,
    validatorAddress: string,
    dataHash: string,
    scores: number[],
    signerAddress: string,
    options?: {
      workerAddress?: string;
      salt?: string;
      mode?: ScoreSubmissionMode;
    }
  ): Promise<WorkflowStatus> {
    const mode = options?.mode ?? ScoreSubmissionMode.DIRECT;

    if (mode === ScoreSubmissionMode.DIRECT && !options?.workerAddress) {
      throw new Error('workerAddress is required for DIRECT score scoring mode');
    }

    if (mode === ScoreSubmissionMode.COMMIT_REVEAL && !options?.salt) {
      throw new Error('salt is required for COMMIT_REVEAL score scoring mode');
    }

    const payload: Record<string, any> = {
      studio_address: studioAddress,
      epoch: epoch,
      validator_address: validatorAddress,
      data_hash: dataHash,
      scores,
      signer_address: signerAddress,
      mode: mode,
    };

    if (options?.workerAddress) {
      payload.worker_address = options.workerAddress;
    }

    // Gateway requires salt field (event if unused in direct mode)
    payload.salt = options?.salt ?? '0x' + '0'.repeat(64);
    const result = await this._request<any>('POST', '/workflows/score-submission', payload);
    return this._parseWorkflowStatus(result);
  }

  /**
   * Create a close epoch workflow.
   * POST /workflows/close-epoch
   *
   * This is economically final — cannot be undone.
   *
   * @param studioAddress - Ethereum address of the studio
   * @param epoch - Epoch number to close
   * @param signerAddress - Ethereum address of the signer
   */
  async closeEpoch(
    studioAddress: string,
    epoch: number,
    signerAddress: string
  ): Promise<WorkflowStatus> {
    const payload = {
      studio_address: studioAddress,
      epoch,
      signer_address: signerAddress,
    };

    const result = await this._request<any>('POST', '/workflows/close-epoch', payload);
    return this._parseWorkflowStatus(result);
  }

  // ===========================================================================
  // Workflow Status
  // ===========================================================================

  /**
   * Get workflow status by ID.
   * GET /workflows/{id}
   */
  async getWorkflow(workflowId: string): Promise<WorkflowStatus> {
    const result = await this._request<any>('GET', `/workflows/${workflowId}`);
    return this._parseWorkflowStatus(result);
  }

  /**
   * List workflows with optional filters.
   * GET /workflows?studio=&state=&type=
   */
  async listWorkflows(options?: {
    studio?: string;
    state?: string;
    workflowType?: string;
  }): Promise<WorkflowStatus[]> {
    const params: string[] = [];
    if (options?.studio) params.push(`studio=${options.studio}`);
    if (options?.state) params.push(`state=${options.state}`);
    if (options?.workflowType) params.push(`type=${options.workflowType}`);

    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    const result = await this._request<any>('GET', `/workflows${queryString}`);
    return (result.workflows || []).map((w: any) => this._parseWorkflowStatus(w));
  }

  // ===========================================================================
  // Polling and Waiting
  // ===========================================================================

  /**
   * Poll workflow until it reaches a terminal state.
   *
   * @param workflowId - UUID of the workflow
   * @param options - Polling options
   * @throws WorkflowFailedError - If workflow reaches FAILED state
   * @throws GatewayTimeoutError - If maxWait exceeded
   */
  async waitForCompletion(
    workflowId: string,
    options?: {
      maxWait?: number;
      pollInterval?: number;
      onProgress?: (status: WorkflowStatus) => void;
    }
  ): Promise<WorkflowStatus> {
    const maxWait = options?.maxWait || this.maxPollTime;
    const pollInterval = options?.pollInterval || this.pollInterval;
    const startTime = Date.now();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const status = await this.getWorkflow(workflowId);

      // Invoke progress callback if provided
      if (options?.onProgress) {
        options.onProgress(status);
      }

      if (status.state === WorkflowState.COMPLETED) {
        return status;
      }

      if (status.state === WorkflowState.FAILED) {
        throw new WorkflowFailedError(workflowId, status.error!);
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWait) {
        throw new GatewayTimeoutError(
          workflowId,
          `Workflow ${workflowId} did not complete within ${maxWait} ms.` +
            `Current state: ${status.state}, step: ${status.step}`,
          status
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  // ===========================================================================
  // Convenience Methods (submit + wait)
  // ===========================================================================

  /**
   * Submit work and wait for completion.
   */
  async submitWorkAndWait(
    studioAddress: string,
    epoch: number,
    agentAddress: string,
    dataHash: string,
    threadRoot: string,
    evidenceRoot: string,
    evidenceContent: Buffer | string,
    signerAddress: string,
    options?: {
      onProgress?: (status: WorkflowStatus) => void;
    }
  ): Promise<WorkflowStatus> {
    const workflow = await this.submitWork(
      studioAddress,
      epoch,
      agentAddress,
      dataHash,
      threadRoot,
      evidenceRoot,
      evidenceContent,
      signerAddress
    );

    return this.waitForCompletion(workflow.workflowId, options);
  }

  /**
   * Submit score and wait for completion.
   */
  async submitScoreAndWait(
    studioAddress: string,
    epoch: number,
    validatorAddress: string,
    dataHash: string,
    scores: number[],
    signerAddress: string,
    options?: {
      workAddress?: string;
      salt?: string;
      mode?: ScoreSubmissionMode;
      onProgress?: (status: WorkflowStatus) => void;
    }
  ): Promise<WorkflowStatus> {
    const workflow = await this.submitScore(
      studioAddress,
      epoch,
      validatorAddress,
      dataHash,
      scores,
      signerAddress,
      options
    );

    return this.waitForCompletion(workflow.workflowId, { onProgress: options?.onProgress });
  }

  /**
   * Close epoch and wait for completion.
   */
  async closeEpochAndWait(
    studioAddress: string,
    epoch: number,
    signerAddress: string,
    options?: {
      onProgress?: (status: WorkflowStatus) => void;
    }
  ): Promise<WorkflowStatus> {
    const workflow = await this.closeEpoch(studioAddress, epoch, signerAddress);
    return this.waitForCompletion(workflow.workflowId, options);
  }
}
