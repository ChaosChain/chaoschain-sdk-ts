import axios, { AxiosError } from 'axios';
import {
  WorkflowType,
  WorkflowState,
  WorkflowStatus,
  WorkflowProgress,
  WorkflowError as WorkflowErrorType,
  GatewayClientConfig,
  GatewayHealthResponse,
  GatewayWorkflowResponse,
  GatewayListWorkflowsResponse,
  GatewayWorkSubmissionRequest,
  GatewayScoreSubmissionRequest,
  GatewayCloseEpochRequest,
  GatewayAuthConfig,
  GatewayErrorCategory,
  GatewayErrorInfo,
  GatewayRetryConfig,
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
  private defaultHeaders?: Record<string, string>;
  private auth?: GatewayAuthConfig;
  private retryConfig?: GatewayRetryConfig;

  constructor(config: GatewayClientConfig) {
    this.gatewayUrl = config.gatewayUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = this._resolveTimeout(
      config.timeoutMs,
      config.timeoutSeconds,
      config.timeout,
      30000
    ); // Default timeout 30s
    this.maxPollTime = this._resolveTimeout(
      config.maxPollTimeMs,
      config.maxPollTimeSeconds,
      config.maxPollTime,
      600000
    ); // Default max poll time 10min
    this.pollInterval = this._resolveTimeout(
      config.pollIntervalMs,
      config.pollIntervalSeconds,
      config.pollInterval,
      2000
    ); // Default poll interval 2s
    this.defaultHeaders = config.headers;
    this.auth = config.auth;
    this.retryConfig = config.retry;
  }

  // ===========================================================================
  // Private: HTTP Request
  // ===========================================================================

  // Resolve timeout with explicit ms taking precedence, then seconds, then legacy ms.
  private _resolveTimeout(
    timeoutMs?: number,
    timeoutSeconds?: number,
    legacyTimeoutMs?: number,
    defaultMs?: number
  ): number {
    if (typeof timeoutMs === 'number') return timeoutMs;
    if (typeof timeoutSeconds === 'number') return timeoutSeconds * 1000;
    if (typeof legacyTimeoutMs === 'number') return legacyTimeoutMs;
    return defaultMs ?? 0;
  }

  private _resolveAuthMode(): GatewayAuthConfig['authMode'] | undefined {
    if (!this.auth) return undefined;
    if (this.auth.authMode) return this.auth.authMode;
    if (this.auth.apiKey) return 'apiKey';
    if (this.auth.signature) return 'signature';
    return undefined;
  }

  private _buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.defaultHeaders) {
      Object.assign(headers, this.defaultHeaders);
    }

    const authMode = this._resolveAuthMode();
    if (authMode === 'apiKey' && this.auth?.apiKey) {
      headers['X-API-Key'] = this.auth.apiKey;
    }

    // Signature auth expects caller-provided signature and optional timestamp.
    if (authMode === 'signature' && this.auth?.signature) {
      const timestamp = this.auth.signature.timestamp ?? Date.now();
      headers['X-Signature'] = this.auth.signature.signature;
      headers['X-Timestamp'] = `${timestamp}`;
      headers['X-Address'] = this.auth.signature.address;
    }

    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  private _classifyStatusCode(statusCode?: number): GatewayErrorInfo {
    if (statusCode === 401 || statusCode === 403) {
      return { statusCode, category: 'auth', retryable: false };
    }

    if (statusCode === 408 || statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
      return { statusCode, category: 'transient', retryable: true };
    }

    if (statusCode !== undefined && statusCode >= 400) {
      return { statusCode, category: 'permanent', retryable: false };
    }

    return { statusCode, category: 'unknown', retryable: false };
  }

  private _normalizeError(error: AxiosError): GatewayError {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      const connectionError = new GatewayConnectionError(
        `Failed to connect to Gateway at ${this.gatewayUrl}`
      );
      connectionError.details.category = 'transient';
      connectionError.details.retryable = true;
      (connectionError as any).category = 'transient' as GatewayErrorCategory;
      (connectionError as any).retryable = true;
      return connectionError;
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      const timeoutError = new GatewayTimeoutError(
        'timeout',
        `request to Gateway timed out: ${error.message}`
      );
      timeoutError.details.category = 'transient';
      timeoutError.details.retryable = true;
      (timeoutError as any).category = 'transient' as GatewayErrorCategory;
      (timeoutError as any).retryable = true;
      return timeoutError;
    }

    if (error.response) {
      const data = error.response.data as Record<string, any>;
      const message = data?.error || data?.message || 'Unknown error from Gateway';
      const classification = this._classifyStatusCode(error.response.status);
      return new GatewayError(`Gateway returned error: ${message}`, {
        statusCode: error.response.status,
        response: data,
        category: classification.category,
        retryable: classification.retryable,
      });
    }

    const classification = this._classifyStatusCode(undefined);
    return new GatewayError(`Gateway request failed: ${error.message}`, {
      category: classification.category,
      retryable: classification.retryable,
    });
  }

  private _getRetryDelayMs(attempt: number): number {
    const initialDelayMs = this.retryConfig?.initialDelayMs ?? 500;
    const backoffFactor = this.retryConfig?.backoffFactor ?? 2;
    const maxDelayMs = this.retryConfig?.maxDelayMs ?? 8000;
    const jitterEnabled = this.retryConfig?.jitter ?? true;
    const jitterRatio = this.retryConfig?.jitterRatio ?? 0.2;

    let delay = Math.min(maxDelayMs, initialDelayMs * Math.pow(backoffFactor, attempt));
    if (jitterEnabled) {
      const delta = delay * jitterRatio;
      delay = delay + (Math.random() * 2 - 1) * delta;
      delay = Math.max(0, delay);
    }
    return Math.round(delay);
  }

  private async _sleep(durationMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  }

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
    // Retries are disabled by default; only enabled retries for transient errors.
    const maxRetries = this.retryConfig?.maxRetries ?? 3;
    const retriesEnabled = this.retryConfig?.enabled === true;
    let attempt = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const response = await axios({
          method,
          url,
          data,
          timeout: this.timeout,
          headers: this._buildHeaders(),
        });

        return response.data as T;
      } catch (error) {
        const normalizedError = this._normalizeError(error as AxiosError);
        const category = (normalizedError as any).category as GatewayErrorCategory | undefined;
        const retryable = (normalizedError as any).retryable as boolean | undefined;
        const shouldRetry =
          retriesEnabled === true &&
          category === 'transient' &&
          retryable === true &&
          attempt < maxRetries;

        if (!shouldRetry) {
          throw normalizedError;
        }

        const delay = this._getRetryDelayMs(attempt);
        attempt += 1;
        await this._sleep(delay);
      }
    }
  }

  /**
   * Parse workflow status from API response.
   */
  private _parseWorkflowStatus(data: GatewayWorkflowResponse): WorkflowStatus {
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

  async healthCheck(): Promise<GatewayHealthResponse> {
    return this._request<GatewayHealthResponse>('GET', '/health');
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
    const evidenceContentBase64 = Buffer.isBuffer(evidenceContent)
      ? evidenceContent.toString('base64')
      : Buffer.from(evidenceContent, 'utf-8').toString('base64');

    const payload: GatewayWorkSubmissionRequest = {
      studio_address: studioAddress,
      epoch,
      agent_address: agentAddress,
      data_hash: dataHash,
      thread_root: threadRoot,
      evidence_root: evidenceRoot,
      evidence_content: evidenceContentBase64,
      signer_address: signerAddress,
    };

    const result = await this._request<GatewayWorkflowResponse>(
      'POST',
      '/workflows/work-submission',
      payload
    );
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

    const payload: GatewayScoreSubmissionRequest = {
      studio_address: studioAddress,
      epoch: epoch,
      validator_address: validatorAddress,
      data_hash: dataHash,
      scores,
      signer_address: signerAddress,
      mode: mode,
      salt: options?.salt ?? '0x' + '0'.repeat(64),
    };

    if (options?.workerAddress) {
      payload.worker_address = options.workerAddress;
    }

    // Gateway requires salt field (event if unused in direct mode)
    const result = await this._request<GatewayWorkflowResponse>(
      'POST',
      '/workflows/score-submission',
      payload
    );
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
    const payload: GatewayCloseEpochRequest = {
      studio_address: studioAddress,
      epoch,
      signer_address: signerAddress,
    };

    const result = await this._request<GatewayWorkflowResponse>(
      'POST',
      '/workflows/close-epoch',
      payload
    );
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
    const result = await this._request<GatewayWorkflowResponse>('GET', `/workflows/${workflowId}`);
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
    const result = await this._request<GatewayListWorkflowsResponse>(
      'GET',
      `/workflows${queryString}`
    );
    return (result.workflows || []).map((w) => this._parseWorkflowStatus(w));
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
      workerAddress?: string;
      workAddress?: string;
      salt?: string;
      mode?: ScoreSubmissionMode;
      onProgress?: (status: WorkflowStatus) => void;
    }
  ): Promise<WorkflowStatus> {
    const workerAddress = options?.workerAddress ?? options?.workAddress;
    const workflow = await this.submitScore(
      studioAddress,
      epoch,
      validatorAddress,
      dataHash,
      scores,
      signerAddress,
      {
        workerAddress,
        salt: options?.salt,
        mode: options?.mode,
      }
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
