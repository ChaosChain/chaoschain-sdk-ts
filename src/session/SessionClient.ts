/**
 * SessionClient — factory for creating ChaosChain Engineering Studio sessions.
 *
 * @example
 * ```ts
 * import { SessionClient } from '@chaoschain/sdk';
 *
 * const client = new SessionClient({ gatewayUrl: 'https://gateway.chaoscha.in', apiKey: 'cc_...' });
 * const session = await client.start({
 *   studio_address: '0xFA0795fD5D7F58eCAa7Eae35Ad9cB8AED9424Dd0',
 *   agent_address: '0x9B4Cef62a0ce1671ccFEFA6a6D8cBFa165c49831',
 *   task_type: 'feature',
 * });
 *
 * await session.log({ summary: 'Started implementing cache layer' });
 * await session.step('testing', 'All tests pass');
 * const result = await session.complete();
 * ```
 */

import axios, { AxiosError } from 'axios';
import { Session } from './Session';

// =============================================================================
// Types
// =============================================================================

/** Configuration for {@link SessionClient}. */
export interface SessionClientConfig {
  /** Gateway base URL (default: `"https://gateway.chaoscha.in"`). */
  gatewayUrl?: string;
  /** API key sent as `X-API-Key` header. */
  apiKey?: string;
}

/** Options for {@link SessionClient.start}. */
export interface SessionStartOptions {
  /** Studio contract address (required). */
  studio_address: string;
  /** Worker agent wallet address (required). */
  agent_address: string;
  /** Work mandate ID (default: `"generic-task"`). */
  work_mandate_id?: string;
  /** Task classification (default: `"general"`). */
  task_type?: string;
  /** Studio policy version (default: `"engineering-studio-default-v1"`). */
  studio_policy_version?: string;
  /** Client-provided session ID. Server generates one if omitted. */
  session_id?: string;
}

// =============================================================================
// SessionClient
// =============================================================================

export class SessionClient {
  private readonly gatewayUrl: string;
  private readonly apiKey: string | undefined;

  constructor(config: SessionClientConfig = {}) {
    this.gatewayUrl = (config.gatewayUrl ?? 'https://gateway.chaoscha.in').replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  /**
   * Create a new coding session on the gateway.
   *
   * Returns a {@link Session} instance that can be used to log events, run steps,
   * and complete the session. The gateway persists all events and constructs the
   * Evidence DAG automatically.
   *
   * The returned session exposes `session.sessionId`, `session.epoch`,
   * `session.studioAddress`, and `session.agentAddress`.
   *
   * @param opts.studio_address - Studio contract address (required).
   * @param opts.agent_address - Worker agent wallet address (required).
   * @param opts.task_type - Task classification: `"feature"`, `"bugfix"`, `"refactor"`, etc. (default: `"general"`).
   * @param opts.work_mandate_id - Work mandate identifier (default: `"generic-task"`).
   * @param opts.studio_policy_version - Studio policy version (default: `"engineering-studio-default-v1"`).
   * @param opts.session_id - Client-provided session ID. Server generates one if omitted.
   * @returns A live {@link Session} bound to the newly created session ID and epoch.
   * @throws Error if the gateway returns a non-2xx status.
   */
  async start(opts: SessionStartOptions): Promise<Session> {
    const body: Record<string, string> = {
      studio_address: opts.studio_address,
      agent_address: opts.agent_address,
    };
    if (opts.work_mandate_id) body.work_mandate_id = opts.work_mandate_id;
    if (opts.task_type) body.task_type = opts.task_type;
    if (opts.studio_policy_version) body.studio_policy_version = opts.studio_policy_version;
    if (opts.session_id) body.session_id = opts.session_id;

    const url = `${this.gatewayUrl}/v1/sessions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;

    let data: { data: { session_id: string; epoch: number } };
    try {
      const res = await axios({ method: 'POST', url, data: body, headers, timeout: 30_000 });
      data = res.data as typeof data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status ?? 0;
      const detail = JSON.stringify(axiosErr.response?.data ?? axiosErr.message);
      throw new Error(`Failed to create session: POST /v1/sessions → ${status} ${detail}`);
    }

    const sessionId = data.data?.session_id;
    if (!sessionId) {
      throw new Error('Gateway response missing session_id');
    }

    return new Session({
      sessionId,
      gatewayUrl: this.gatewayUrl,
      apiKey: this.apiKey,
      studioAddress: opts.studio_address,
      agentAddress: opts.agent_address,
      studioPolicyVersion: opts.studio_policy_version ?? 'engineering-studio-default-v1',
      workMandateId: opts.work_mandate_id ?? 'generic-task',
      taskType: opts.task_type ?? 'general',
      epoch: data.data.epoch,
    });
  }
}
