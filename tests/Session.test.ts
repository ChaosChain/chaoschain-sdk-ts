/**
 * Session Tests
 *
 * Tests for the Session class that handles event logging
 * within ChaosChain Engineering Studio sessions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { Session } from '../src/session/Session';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

function createSession(overrides?: Partial<ConstructorParameters<typeof Session>[0]>) {
  return new Session({
    sessionId: 'test-session-id',
    gatewayUrl: 'http://localhost:3000',
    apiKey: 'test-api-key',
    studioAddress: '0xStudio',
    agentAddress: '0xDefaultAgent',
    studioPolicyVersion: 'engineering-studio-default-v1',
    workMandateId: 'generic-task',
    taskType: 'general',
    ...overrides,
  });
}

describe('Session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log()', () => {
    it('should use session agentAddress by default', async () => {
      const session = createSession();
      await session.log({ summary: 'Default agent event' });

      expect(mockedAxios).toHaveBeenCalledOnce();
      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.agent).toEqual({ agent_address: '0xDefaultAgent', role: 'worker' });
    });

    it('should override agent_address when agent is provided', async () => {
      const session = createSession();
      await session.log({
        summary: 'Review by CodeRabbit',
        agent: { agent_address: '0xCodeRabbit' },
      });

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.agent.agent_address).toBe('0xCodeRabbit');
    });

    it('should override role when agent.role is provided', async () => {
      const session = createSession();
      await session.log({
        summary: 'Review event',
        agent: { agent_address: '0xReviewer', role: 'collaborator' },
      });

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.agent).toEqual({ agent_address: '0xReviewer', role: 'collaborator' });
    });

    it('should default role to worker when agent override omits role', async () => {
      const session = createSession();
      await session.log({
        summary: 'No role specified',
        agent: { agent_address: '0xOtherAgent' },
      });

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.agent).toEqual({ agent_address: '0xOtherAgent', role: 'worker' });
    });

    it('should apply agent override per event, not globally', async () => {
      const session = createSession();

      await session.log({
        summary: 'CodeRabbit review',
        agent: { agent_address: '0xCodeRabbit' },
      });

      await session.log({ summary: 'Copilot writes code' });

      expect(mockedAxios).toHaveBeenCalledTimes(2);

      const event1 = (mockedAxios.mock.calls[0][0] as any).data[0];
      const event2 = (mockedAxios.mock.calls[1][0] as any).data[0];

      expect(event1.agent.agent_address).toBe('0xCodeRabbit');
      expect(event2.agent.agent_address).toBe('0xDefaultAgent');
    });

    it('should use session default when agent is explicitly undefined', async () => {
      const session = createSession();
      await session.log({ summary: 'Explicit undefined', agent: undefined });

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.agent).toEqual({ agent_address: '0xDefaultAgent', role: 'worker' });
    });

    it('should preserve other event fields when using agent override', async () => {
      const session = createSession();
      await session.log({
        summary: 'Test event',
        event_type: 'test_run',
        metadata: { passed: true },
        agent: { agent_address: '0xTester' },
      });

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.summary).toBe('Test event');
      expect(event.event_type).toBe('test_run');
      expect(event.metadata).toEqual({ passed: true });
      expect(event.studio.studio_address).toBe('0xStudio');
      expect(event.agent.agent_address).toBe('0xTester');
    });
  });

  describe('step()', () => {
    it('should use session agentAddress by default', async () => {
      const session = createSession();
      await session.step('testing', 'All tests pass');

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.agent).toEqual({ agent_address: '0xDefaultAgent', role: 'worker' });
    });

    it('should override agent when agent parameter is provided', async () => {
      const session = createSession();
      await session.step('testing', 'Tests pass', { agent_address: '0xTester' });

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.agent.agent_address).toBe('0xTester');
    });

    it('should override role via step agent parameter', async () => {
      const session = createSession();
      await session.step('planning', 'Plan created', {
        agent_address: '0xPlanner',
        role: 'collaborator',
      });

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.agent).toEqual({ agent_address: '0xPlanner', role: 'collaborator' });
    });

    it('should map step type to correct event_type with agent override', async () => {
      const session = createSession();
      await session.step('implementing', 'Added CacheService', {
        agent_address: '0xCopilot',
      });

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.event_type).toBe('file_written');
      expect(event.agent.agent_address).toBe('0xCopilot');
    });

    it('should fall back to artifact_created for unknown step type with agent override', async () => {
      const session = createSession();
      await session.step('reviewing', 'Looks good', { agent_address: '0xReviewer' });

      const payload = mockedAxios.mock.calls[0][0] as any;
      const event = payload.data[0];
      expect(event.event_type).toBe('artifact_created');
      expect(event.agent.agent_address).toBe('0xReviewer');
    });
  });

  describe('multi-agent workflow', () => {
    it('should support different agents across sequential events', async () => {
      const session = createSession();

      await session.step('implementing', 'Wrote feature code', {
        agent_address: '0xCopilot',
      });
      await session.log({
        summary: 'Code review completed',
        agent: { agent_address: '0xCodeRabbit', role: 'collaborator' },
      });
      await session.step('testing', 'All 47 tests pass');

      expect(mockedAxios).toHaveBeenCalledTimes(3);

      const events = mockedAxios.mock.calls.map((c: any) => c[0].data[0]);

      expect(events[0].agent).toEqual({ agent_address: '0xCopilot', role: 'worker' });
      expect(events[1].agent).toEqual({ agent_address: '0xCodeRabbit', role: 'collaborator' });
      expect(events[2].agent).toEqual({ agent_address: '0xDefaultAgent', role: 'worker' });
    });

    it('should support all three roles (worker, verifier, collaborator) in one session', async () => {
      const session = createSession();

      await session.step('implementing', 'Built auth module');

      await session.log({
        summary: 'Code review: LGTM',
        agent: { agent_address: '0xCodeRabbit', role: 'collaborator' },
      });

      await session.log({
        summary: 'Verification passed: signatures valid',
        agent: { agent_address: '0xVerifier', role: 'verifier' },
      });

      await session.step('testing', 'All tests pass');

      expect(mockedAxios).toHaveBeenCalledTimes(4);

      const events = mockedAxios.mock.calls.map((c: any) => c[0].data[0]);

      expect(events[0].agent).toEqual({ agent_address: '0xDefaultAgent', role: 'worker' });
      expect(events[1].agent).toEqual({ agent_address: '0xCodeRabbit', role: 'collaborator' });
      expect(events[2].agent).toEqual({ agent_address: '0xVerifier', role: 'verifier' });
      expect(events[3].agent).toEqual({ agent_address: '0xDefaultAgent', role: 'worker' });
    });
  });

  describe('complete()', () => {
    it('should complete session without affecting agent override behavior', async () => {
      const session = createSession();
      mockedAxios.mockResolvedValue({
        data: { data: { workflow_id: 'wf-123', data_hash: '0xabc' } },
      });

      const result = await session.complete({ summary: 'Done' });

      expect(result.workflow_id).toBe('wf-123');
      expect(result.data_hash).toBe('0xabc');
    });

    it('should return null values when gateway has no workflow engine', async () => {
      const session = createSession();
      mockedAxios.mockResolvedValue({ data: { data: {} } });

      const result = await session.complete();

      expect(result.workflow_id).toBeNull();
      expect(result.data_hash).toBeNull();
    });
  });
});
