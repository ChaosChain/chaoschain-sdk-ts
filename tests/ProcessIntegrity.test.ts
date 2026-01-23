import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcessIntegrity } from '../src/ProcessIntegrity';
import { IntegrityVerificationError } from '../src/exceptions';

describe('ProcessIntegrity', () => {
  let integrity: ProcessIntegrity;

  beforeEach(() => {
    integrity = new ProcessIntegrity('TestAgent');
  });

  it('should initialize ProcessIntegrity', () => {
    expect(integrity).toBeInstanceOf(ProcessIntegrity);
  });

  it('should register function', () => {
    const testFunc = async (x: number) => x * 2;
    const codeHash = integrity.registerFunction(testFunc, 'double');

    expect(codeHash).toBeDefined();
    expect(typeof codeHash).toBe('string');
  });

  it('should execute function with proof', async () => {
    const testFunc = async (inputs: Record<string, any>) => {
      return { result: (inputs.x as number) * 2 };
    };
    integrity.registerFunction(testFunc, 'double');

    const [result, proof] = await integrity.executeWithProof('double', { x: 5 });

    expect(result).toBeDefined();
    expect(result.result).toBe(10);
    expect(proof).toBeDefined();
    if (proof) {
      // Proof uses function_name (snake_case) not functionName
      expect(proof.function_name || proof.functionName).toBe('double');
    }
  });

  it('should execute function without proof', async () => {
    const testFunc = async (inputs: Record<string, any>) => {
      return { result: (inputs.x as number) * 2 };
    };
    integrity.registerFunction(testFunc, 'double');

    const [result, proof] = await integrity.executeWithProof('double', { x: 5 }, false);

    expect(result).toBeDefined();
    expect(result.result).toBe(10);
    expect(proof).toBeNull();
  });

  it('should throw error for unregistered function', async () => {
    await expect(integrity.executeWithProof('unknown', {})).rejects.toThrow(
      IntegrityVerificationError
    );
  });

  it('should handle function execution errors', async () => {
    const errorFunc = async () => {
      throw new Error('Test error');
    };
    integrity.registerFunction(errorFunc, 'errorFunc');

    await expect(integrity.executeWithProof('errorFunc', {})).rejects.toThrow(
      IntegrityVerificationError
    );
  });

  it('should generate code hash', () => {
    const testFunc = async (x: number) => x * 2;
    const hash1 = integrity.registerFunction(testFunc, 'func1');
    const hash2 = integrity.registerFunction(testFunc, 'func2');

    // Same function should produce same hash
    expect(hash1).toBe(hash2);
  });

  it('should generate integrity proof', async () => {
    const testFunc = async (inputs: Record<string, any>) => {
      return { result: (inputs.x as number) * 2 };
    };
    integrity.registerFunction(testFunc, 'double');

    const [result, proof] = await integrity.executeWithProof('double', { x: 5 });

    expect(proof).toBeDefined();
    if (proof) {
      // Check proof structure (may vary by implementation)
      expect(proof).toHaveProperty('codeHash');
      expect(proof).toHaveProperty('executionHash');
      expect(proof).toHaveProperty('timestamp');
    }
  });

  it('should work with TEE provider', async () => {
    const mockTeeProvider = {
      submit: vi.fn().mockResolvedValue('job-id'),
      status: vi.fn().mockResolvedValue({ state: 'completed' }),
      result: vi.fn().mockResolvedValue({
        success: true,
        execution_hash: 'hash123',
        verification_method: { value: 'tee' },
      }),
      attestation: vi.fn().mockResolvedValue({}),
    };

    const integrityWithTee = new ProcessIntegrity('TestAgent', null, mockTeeProvider as any);
    const testFunc = async (inputs: Record<string, any>) => {
      return { result: (inputs.x as number) * 2 };
    };
    integrityWithTee.registerFunction(testFunc, 'double');

    const [result, proof] = await integrityWithTee.executeWithProof('double', { x: 5 }, true, true);

    expect(result).toBeDefined();
    expect(result.result).toBe(10);
    expect(proof).toBeDefined();
  });

  it('should handle TEE provider errors gracefully', async () => {
    const mockTeeProvider = {
      submit: vi.fn().mockRejectedValue(new Error('TEE error')),
      status: vi.fn(),
      result: vi.fn(),
      attestation: vi.fn(),
    };

    const integrityWithTee = new ProcessIntegrity('TestAgent', null, mockTeeProvider as any);
    const testFunc = async (inputs: Record<string, any>) => {
      return { result: (inputs.x as number) * 2 };
    };
    integrityWithTee.registerFunction(testFunc, 'double');

    // Should still work without TEE
    const [result, proof] = await integrityWithTee.executeWithProof('double', { x: 5 }, true, true);

    expect(result).toBeDefined();
    expect(result.result).toBe(10);
    expect(proof).toBeDefined();
  });

  it('should store proof on IPFS if storage available', async () => {
    const mockStorage = {
      uploadJson: vi.fn().mockResolvedValue('QmHash123'),
    };

    const integrityWithStorage = new ProcessIntegrity('TestAgent', mockStorage as any);
    const testFunc = async (inputs: Record<string, any>) => {
      return { result: (inputs.x as number) * 2 };
    };
    integrityWithStorage.registerFunction(testFunc, 'double');

    const [result, proof] = await integrityWithStorage.executeWithProof('double', { x: 5 });

    expect(result).toBeDefined();
    expect(result.result).toBe(10);
    expect(proof).toBeDefined();
    expect(mockStorage.uploadJson).toHaveBeenCalled();
  });
});
