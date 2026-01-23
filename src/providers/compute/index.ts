/**
 * Compute Providers Export
 * Placeholder for future compute providers (0G, etc.)
 */

import { ComputeProvider } from '../../types';

/**
 * Basic compute provider implementation
 */
export class LocalComputeProvider implements ComputeProvider {
  async inference(_model: string, _input: unknown): Promise<unknown> {
    throw new Error('Local compute not yet implemented. Use 0G Compute or other provider.');
  }

  async getModels(): Promise<string[]> {
    return [];
  }
}
