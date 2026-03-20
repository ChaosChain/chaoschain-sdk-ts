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

/** Options for {@link Session.log}. */
export interface SessionLogOptions {
  /** Human-readable description of what happened. */
  summary: string;
  /** Canonical event type. Defaults to `"artifact_created"`. */
  event_type?: string;
  /** Arbitrary metadata attached to the event. */
  metadata?: Record<string, unknown>;
}

/** Result returned by {@link Session.complete}. */
export interface SessionCompleteResult {
  workflow_id: string | null;
  data_hash: string | null;
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

  private readonly gatewayUrl: string;
  private readonly apiKey: string | undefined;
  private readonly studioAddress: string;
  private readonly agentAddress: string;
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
  }) {
    this.sessionId = opts.sessionId;
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
   * @param opts - Event details. Only `summary` is required.
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
      agent: { agent_address: this.agentAddress, role: 'worker' },
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
   * @param stepType - Friendly step name.
   * @param summary - What happened in this step.
   */
  async step(stepType: string, summary: string): Promise<void> {
    const eventType = STEP_TYPE_MAP[stepType] ?? 'artifact_created';
    await this.log({ event_type: eventType, summary });
  }

  /**
   * Complete the session.
   *
   * Triggers the on-chain WorkSubmission workflow (if the gateway is configured for it)
   * and returns `workflow_id` + `data_hash` for downstream verification/scoring.
   *
   * @param opts - Optional status (`"completed"` | `"failed"`) and summary.
   * @returns `{ workflow_id, data_hash }` — both may be `null` if the gateway
   *          workflow engine is not configured.
   * @throws Error if the gateway returns a non-2xx status.
   */
  async complete(
    opts?: { status?: 'completed' | 'failed'; summary?: string },
  ): Promise<SessionCompleteResult> {
    const body: Record<string, unknown> = {};
    if (opts?.status) body.status = opts.status;
    if (opts?.summary) body.summary = opts.summary;

    const data = await this.post<{
      data: { workflow_id: string | null; data_hash: string | null };
    }>(`/v1/sessions/${this.sessionId}/complete`, body);

    return {
      workflow_id: data.data?.workflow_id ?? null,
      data_hash: data.data?.data_hash ?? null,
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
