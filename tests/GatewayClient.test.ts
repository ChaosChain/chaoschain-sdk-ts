import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayClient, WorkflowType, WorkflowState, GatewayError } from '../src/GatewayClient';

describe('GatewayClient', () => {
  let client: GatewayClient;
  let mockFetch: any;

  beforeEach(() => {
    client = new GatewayClient('https://gateway.test.com');

    // Mock fetch globally
    global.fetch = vi.fn() as any;
    mockFetch = global.fetch;
  });

  it('should initialize GatewayClient', () => {
    expect(client).toBeInstanceOf(GatewayClient);
  });

  it('should submit work', async () => {
    const mockResponse = {
      id: 'workflow_123',
      type: WorkflowType.WORK_SUBMISSION,
      state: WorkflowState.CREATED,
      step: 'created',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progress: {},
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await client.submitWork({
      studioAddress: '0x' + '1'.repeat(40),
      epoch: 1,
      dataHash: '0x' + '2'.repeat(64),
      threadRoot: '0x' + '3'.repeat(64),
      evidenceRoot: '0x' + '4'.repeat(64),
      evidenceContent: 'test content',
    });

    expect(result.id).toBe('workflow_123');
    expect(result.type).toBe(WorkflowType.WORK_SUBMISSION);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should get workflow status', async () => {
    const mockResponse = {
      id: 'workflow_123',
      type: WorkflowType.WORK_SUBMISSION,
      state: WorkflowState.RUNNING,
      step: 'uploading',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progress: {
        arweaveTxId: 'arweave_123',
        arweaveConfirmed: true,
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await client.getWorkflowStatus('workflow_123');

    expect(result.id).toBe('workflow_123');
    expect(result.state).toBe(WorkflowState.RUNNING);
  });

  it('should handle errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Server error' }),
    });

    await expect(
      client.submitWork({
        studioAddress: '0x' + '1'.repeat(40),
        epoch: 1,
        dataHash: '0x' + '2'.repeat(64),
        threadRoot: '0x' + '3'.repeat(64),
        evidenceRoot: '0x' + '4'.repeat(64),
        evidenceContent: 'test',
      })
    ).rejects.toThrow(GatewayError);
  });

  it('should wait for completion', async () => {
    let callCount = 0;

    mockFetch.mockImplementation(() => {
      callCount++;
      const state = callCount === 1 ? WorkflowState.RUNNING : WorkflowState.COMPLETED;

      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 'workflow_123',
          type: WorkflowType.WORK_SUBMISSION,
          state,
          step: state === WorkflowState.COMPLETED ? 'completed' : 'running',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          progress: {},
        }),
      });
    });

    const result = await client.waitForCompletion('workflow_123', 100, 5000);

    expect(result.state).toBe(WorkflowState.COMPLETED);
    expect(callCount).toBeGreaterThan(1);
  });

  it('should throw timeout error', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'workflow_123',
        type: WorkflowType.WORK_SUBMISSION,
        state: WorkflowState.RUNNING,
        step: 'running',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        progress: {},
      }),
    });

    await expect(client.waitForCompletion('workflow_123', 100, 200)).rejects.toThrow(
      /timeout|did not complete/
    );
  });
});
