/**
 * Session — high-level wrapper for ChaosChain Engineering Studio sessions.
 *
 * Agents use this class to log work events without constructing raw event schemas,
 * managing parent IDs, or thinking about DAGs. The gateway handles all of that.
 *
 * @example
 * ```ts
 * const session = await client.start({ studio_address: '0x...', agent_address: '0x...' });
 * await session.log({ summary: 'Planning cache layer implementation' });
 * await session.step('implementing', 'Added CacheService class');
 * await session.step('testing', 'All 47 tests pass');
 * const { workflow_id, data_hash } = await session.complete();
 * ```
 */

import { randomUUID } from 'node:crypto';
import axios, { AxiosError } from 'axios';

// =============================================================================
// Types
// =============================================================================

/** Valid agent roles accepted by the gateway for session events. */
export type SessionAgentRole = 'worker' | 'verifier' | 'collaborator';

/** Per-event agent override. */
export interface SessionAgentOverride {
  /** Wallet address of the agent emitting this event. */
  agent_address: string;
  /** Agent role (defaults to `"worker"`). Must be `worker`, `verifier`, or `collaborator`. */
  role?: SessionAgentRole;
}

/** Options for {@link Session.log}. */
export interface SessionLogOptions {
  /** Human-readable description of what happened. */
  summary: string;
  /** Canonical event type. Defaults to `"artifact_created"`. */
  event_type?: string;
  /** Arbitrary metadata attached to the event. */
  metadata?: Record<string, unknown>;
  /** Override the session-level agent for this event. */
  agent?: SessionAgentOverride;
}

/** Result returned by {@link Session.complete}. */
export interface SessionCompleteResult {
  workflow_id: string | null;
  data_hash: string | null;
  epoch: number;
}

/** Canonical event-type mappings for {@link Session.step}. */
const STEP_TYPE_MAP: Record<string, string> = {
  planning: 'plan_created',
  testing: 'test_run',
  debugging: 'debug_step',
  implementing: 'file_written',
  completing: 'submission_created',
};

// =============================================================================
// Session
// =============================================================================

export class Session {
  /** Session ID returned by the gateway. */
  public readonly sessionId: string;
  /** Epoch number returned by the gateway. */
  public readonly epoch: number;
  /** Studio contract address for this session. */
  public readonly studioAddress: string;
  /** Default agent wallet address for this session. */
  public readonly agentAddress: string;
  /** URL to view this session's Evidence DAG in the browser. */
  public readonly viewerUrl: string;

  private readonly gatewayUrl: string;
  private readonly apiKey: string | undefined;
  private readonly studioPolicyVersion: string;
  private readonly workMandateId: string;
  private readonly taskType: string;
  private lastEventId: string | null;

  /** @internal — use {@link SessionClient.start} to create instances. */
  constructor(opts: {
    sessionId: string;
    gatewayUrl: string;
    apiKey?: string;
    lastEventId?: string | null;
    studioAddress: string;
    agentAddress: string;
    studioPolicyVersion: string;
    workMandateId: string;
    taskType: string;
    epoch: number;
  }) {
    this.sessionId = opts.sessionId;
    this.epoch = opts.epoch;
    this.viewerUrl = `${opts.gatewayUrl}/v1/sessions/${opts.sessionId}/viewer`;
    this.gatewayUrl = opts.gatewayUrl;
    this.apiKey = opts.apiKey;
    this.lastEventId = opts.lastEventId ?? null;
    this.studioAddress = opts.studioAddress;
    this.agentAddress = opts.agentAddress;
    this.studioPolicyVersion = opts.studioPolicyVersion;
    this.workMandateId = opts.workMandateId;
    this.taskType = opts.taskType;
  }

  /**
   * Log a session event.
   *
   * Automatically generates `event_id`, `timestamp`, and chains `parent_event_ids`
   * from the previous event so the gateway can build a causal DAG.
   *
   * @param opts.summary - Human-readable description of what happened (required).
   * @param opts.event_type - Canonical event type (default: `"artifact_created"`).
   * @param opts.metadata - Arbitrary key-value metadata attached to the event.
   * @param opts.agent - Override the session-level agent for this event.
   *   Pass `{ agent_address, role? }` to emit the event from a different agent.
   *   Valid roles: `"worker"`, `"verifier"`, `"collaborator"`. Defaults to `"worker"`.
   * @throws Error if the gateway returns a non-2xx status.
   */
  async log(opts: SessionLogOptions): Promise<void> {
    const eventId = randomUUID();
    const event = {
      event_id: eventId,
      event_type: opts.event_type ?? 'artifact_created',
      timestamp: new Date().toISOString(),
      summary: opts.summary,
      causality: {
        parent_event_ids: this.lastEventId ? [this.lastEventId] : [],
      },
      agent: {
        agent_address: opts.agent?.agent_address ?? this.agentAddress,
        role: opts.agent?.role ?? 'worker',
      },
      studio: {
        studio_address: this.studioAddress,
        studio_policy_version: this.studioPolicyVersion,
      },
      task: {
        work_mandate_id: this.workMandateId,
        task_type: this.taskType,
      },
      ...(opts.metadata ? { metadata: opts.metadata } : {}),
    };

    await this.post(`/v1/sessions/${this.sessionId}/events`, [event]);
    this.lastEventId = eventId;
  }

  /**
   * Convenience wrapper around {@link log} that maps human-friendly step names
   * to canonical event types.
   *
   * Mappings:
   * - `"planning"` → `plan_created`
   * - `"testing"` → `test_run`
   * - `"debugging"` → `debug_step`
   * - `"implementing"` → `file_written`
   * - `"completing"` → `submission_created`
   *
   * Unknown step types fall back to `artifact_created`.
   *
   * @param stepType - Friendly step name (`"planning"`, `"implementing"`, `"testing"`, `"debugging"`, `"completing"`).
   * @param summary - What happened in this step.
   * @param agent - Optional agent override for this event. Same as `log({ agent })`.
   */
  async step(stepType: string, summary: string, agent?: SessionAgentOverride): Promise<void> {
    const eventType = STEP_TYPE_MAP[stepType] ?? 'artifact_created';
    await this.log({ event_type: eventType, summary, agent });
  }

  /**
   * Complete the session.
   *
   * Triggers the on-chain WorkSubmission workflow (if the gateway is configured for it)
   * and returns the session result.
   *
   * @param opts.status - `"completed"` or `"failed"` (default: `"completed"`).
   * @param opts.summary - Human-readable summary of the session outcome.
   * @returns `{ workflow_id, data_hash, epoch }` — `workflow_id` and `data_hash`
   *          may be `null` if the gateway workflow engine is not configured.
   *          `epoch` is the epoch this session belongs to.
   * @throws Error if the gateway returns a non-2xx status.
   */
  async complete(
    opts?: { status?: 'completed' | 'failed'; summary?: string },
  ): Promise<SessionCompleteResult> {
    const body: Record<string, unknown> = {};
    if (opts?.status) body.status = opts.status;
    if (opts?.summary) body.summary = opts.summary;

    const data = await this.post<{
      data: { workflow_id: string | null; data_hash: string | null; epoch: number };
    }>(`/v1/sessions/${this.sessionId}/complete`, body);

    return {
      workflow_id: data.data?.workflow_id ?? null,
      data_hash: data.data?.data_hash ?? null,
      epoch: data.data.epoch,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal HTTP helper
  // ---------------------------------------------------------------------------

  private async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = `${this.gatewayUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;

    try {
      const res = await axios({ method: 'POST', url, data: body, headers, timeout: 30_000 });
      return res.data as T;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status ?? 0;
      const detail = JSON.stringify(axiosErr.response?.data ?? axiosErr.message);
      throw new Error(`Session request failed: POST ${path} → ${status} ${detail}`);
    }
  }
}
