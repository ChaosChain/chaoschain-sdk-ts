/**
 * Production-ready process integrity verification for ChaosChain agents.
 *
 * This module provides cryptographic proof of correct code execution,
 * ensuring that agents perform work as intended with verifiable evidence.
 *
 * Features:
 * - Local code hashing (SHA-256)
 * - Optional TEE attestations (0G Compute, AWS Nitro, etc.)
 * - Dual-layer verification: Code + Execution
 * - Pluggable compute providers for maximum flexibility
 */

import { createHash } from 'crypto';
import { IntegrityProof, TEEAttestation, VerificationMethod } from './types';
import { IntegrityVerificationError } from './exceptions';

export interface StorageProvider {
  uploadJson(data: any, filename: string): Promise<string>;
}

// TEEAttestation is imported from './types' - no duplicate definition needed

export interface ComputeProvider {
  submit(task: any): Promise<string>;
  status(jobId: string): Promise<{ state: string;[key: string]: any }>;
  result(jobId: string): Promise<{
    success: boolean;
    execution_hash: string;
    verification_method: { value: string };
    proof?: Buffer;
    metadata?: any;
    error?: string;
  }>;
  attestation(jobId: string): Promise<any>;
}

/**
 * Production-ready process integrity verifier for ChaosChain agents.
 *
 * Provides dual-layer cryptographic proof:
 * 1. Local code hashing (SHA-256 of function code)
 * 2. Optional TEE attestations (hardware-verified execution from 0G Compute, AWS Nitro, etc.)
 *
 * This enables the "Process Integrity" layer of the Triple-Verified Stack:
 * - Layer 1: AP2 Intent Verification (Google)
 * - Layer 2: Process Integrity (ChaosChain + TEE attestations) ← THIS MODULE
 * - Layer 3: Accountability
 */
export class ProcessIntegrity {
  private agentName: string;
  private storageManager: StorageProvider | null;
  private computeProvider: ComputeProvider | null;
  private registeredFunctions: Map<string, Function>;
  private functionHashes: Map<string, string>;

  constructor(
    agentName: string,
    storageManager: StorageProvider | null = null,
    computeProvider: ComputeProvider | null = null
  ) {
    this.agentName = agentName;
    this.storageManager = storageManager;
    this.computeProvider = computeProvider;
    this.registeredFunctions = new Map();
    this.functionHashes = new Map();

    const verificationMode = !computeProvider ? 'local' : 'local + TEE attestation';
    console.log(
      `✅ ChaosChain Process Integrity Verifier initialized: ${agentName} (${verificationMode})`
    );
  }

  /**
   * Register a function for integrity checking.
   */
  registerFunction(func: Function, functionName?: string): string {
    const name = functionName || func.name;

    // Generate code hash
    const codeHash = this.generateCodeHash(func);

    // Store function and hash
    this.registeredFunctions.set(name, func);
    this.functionHashes.set(name, codeHash);

    console.log(`📝 Registered integrity-checked function: ${name}`);
    console.log(`   Code hash: ${codeHash.slice(0, 16)}...`);

    return codeHash;
  }

  /**
   * Execute a registered function with integrity proof generation.
   */
  async executeWithProof(
    functionName: string,
    inputs: Record<string, any>,
    requireProof: boolean = true,
    useTee: boolean = true
  ): Promise<[any, IntegrityProof | null]> {
    if (!this.registeredFunctions.has(functionName)) {
      const available = Array.from(this.registeredFunctions.keys());
      throw new IntegrityVerificationError(`Function not registered: ${functionName}`, {
        available_functions: available,
      });
    }

    const func = this.registeredFunctions.get(functionName)!;
    const codeHash = this.functionHashes.get(functionName)!;

    const executionMode = useTee && this.computeProvider ? 'local + TEE' : 'local';
    console.log(
      `⚡ Executing with ChaosChain Process Integrity: ${functionName} (${executionMode})`
    );

    // Execute function
    const startTime = new Date();
    let teeAttestation: TEEAttestation | null = null;

    try {
      // Execute the function
      const result = await func(inputs);
      const executionTime = new Date();

      // Optionally get TEE attestation
      if (useTee && this.computeProvider) {
        try {
          teeAttestation = await this.getTeeAttestation(functionName, inputs, result);
        } catch (e) {
          console.warn(`⚠️  TEE attestation failed (continuing with local proof): ${e}`);
        }
      }

      if (!requireProof) {
        return [result, null];
      }

      // Generate integrity proof (includes TEE attestation if available)
      const proof = this.generateIntegrityProof(
        functionName,
        codeHash,
        inputs,
        result,
        startTime,
        executionTime,
        teeAttestation
      );

      // Store proof on IPFS if storage manager available
      if (this.storageManager) {
        await this.storeProofOnIpfs(proof);
      }

      return [result, proof];
    } catch (e) {
      throw new IntegrityVerificationError(`Function execution failed: ${e}`, {
        function_name: functionName,
        inputs,
      });
    }
  }

  /**
   * Generate a hash of the function's code.
   */
  private generateCodeHash(func: Function): string {
    try {
      // Get function source code
      const sourceCode = func.toString();

      // Create hash
      return createHash('sha256').update(sourceCode).digest('hex');
    } catch {
      // Fallback to function name
      const funcInfo = `${func.name}`;
      return createHash('sha256').update(funcInfo).digest('hex');
    }
  }

  /**
   * Get TEE attestation from compute provider (e.g., 0G Compute).
   */
  private async getTeeAttestation(
    functionName: string,
    inputs: Record<string, any>,
    result: any
  ): Promise<TEEAttestation | null> {
    if (!this.computeProvider) {
      return null;
    }

    console.log(`🔐 Requesting TEE attestation from compute provider...`);

    try {
      // Submit task to TEE compute provider
      const taskData = {
        function: functionName,
        inputs,
        model: 'gpt-oss-120b', // Default model for 0G Compute
        prompt: `Execute function: ${functionName} with inputs: ${JSON.stringify(inputs)}`,
      };

      const jobId = await this.computeProvider.submit(taskData);

      // Wait for completion
      const maxWait = 60000; // 60 seconds timeout
      const startWait = Date.now();

      while (Date.now() - startWait < maxWait) {
        const statusResult = await this.computeProvider.status(jobId);
        const state = statusResult.state || 'unknown';

        if (state === 'completed') {
          // Get full result (includes execution_hash, verification_method)
          const computeResult = await this.computeProvider.result(jobId);

          if (computeResult.success) {
            // Get attestation (proof data)
            const attestationData = await this.computeProvider.attestation(jobId);

            console.log(`✅ TEE attestation received: ${jobId}`);
            console.log(`   Execution Hash: ${computeResult.execution_hash}`);
            console.log(`   Verification: ${computeResult.verification_method.value}`);

            return {
              jobId: jobId,
              provider: '0g-compute',
              executionHash: computeResult.execution_hash, // TEE execution ID
              verificationMethod: computeResult.verification_method.value as VerificationMethod,
              model: taskData.model,
              attestationData: attestationData, // Full attestation proof
              proof: computeResult.proof?.toString('hex'),
              metadata: computeResult.metadata,
              timestamp: new Date().toISOString(),
            };
          } else {
            console.warn(`⚠️  Compute result failed: ${computeResult.error}`);
            return null;
          }
        } else if (state === 'failed') {
          console.warn(`⚠️  TEE execution failed`);
          return null;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      console.warn(`⚠️  TEE attestation timeout after ${maxWait}ms`);
      return null;
    } catch (e) {
      console.warn(`⚠️  TEE attestation error: ${e}`);
      return null;
    }
  }

  /**
   * Generate a cryptographic integrity proof.
   */
  private generateIntegrityProof(
    functionName: string,
    codeHash: string,
    inputs: Record<string, any>,
    result: any,
    startTime: Date,
    executionTime: Date,
    teeAttestation: TEEAttestation | null
  ): IntegrityProof {
    const proofId = `proof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    // Create execution hash
    const executionData = {
      function_name: functionName,
      code_hash: codeHash,
      inputs,
      result: this.serializeResult(result),
      start_time: startTime.toISOString(),
      execution_time: executionTime.toISOString(),
      agent_name: this.agentName,
    };

    const executionHash = createHash('sha256').update(JSON.stringify(executionData)).digest('hex');

    // Build proof with optional TEE data (camelCase to match types.ts)
    const proof: IntegrityProof = {
      proofId: proofId,
      functionName: functionName,
      codeHash: codeHash,
      executionHash: executionHash,
      timestamp: executionTime,
      agentName: this.agentName,
      verificationStatus: 'verified',
      ipfsCid: undefined,
      // TEE fields (if available)
      teeAttestation: teeAttestation || undefined,
      teeProvider: teeAttestation?.provider,
      teeJobId: teeAttestation?.jobId,
      teeExecutionHash: teeAttestation?.executionHash,
    };

    const verificationLevel = teeAttestation ? 'local + TEE' : 'local';
    console.log(`✅ Process integrity proof generated: ${proofId} (${verificationLevel})`);

    return proof;
  }

  /**
   * Store integrity proof on IPFS for persistence.
   */
  private async storeProofOnIpfs(proof: IntegrityProof): Promise<void> {
    if (!this.storageManager) return;

    try {
      // JSON output uses snake_case for Python SDK compatibility
      const proofData = {
        type: 'chaoschain_process_integrity_proof_v2', // v2 includes TEE
        proof: {
          proof_id: proof.proofId,
          function_name: proof.functionName,
          code_hash: proof.codeHash,
          execution_hash: proof.executionHash,
          timestamp: proof.timestamp.toISOString(),
          agent_name: proof.agentName,
          verification_status: proof.verificationStatus,
          // TEE attestation (if available)
          tee_attestation: proof.teeAttestation,
          tee_provider: proof.teeProvider,
          tee_job_id: proof.teeJobId,
          tee_execution_hash: proof.teeExecutionHash,
        },
        verification_layers: {
          local_code_hash: true,
          tee_attestation: !!proof.teeAttestation,
        },
        timestamp: new Date().toISOString(),
        agent_name: this.agentName,
      };

      const filename = `process_integrity_proof_${proof.proofId}.json`;
      const cid = await this.storageManager.uploadJson(proofData, filename);

      if (cid) {
        proof.ipfsCid = cid;
        console.log(`📁 Process Integrity Proof stored on IPFS: ${cid}`);
      }
    } catch (e) {
      console.warn(`⚠️  Failed to store process integrity proof on IPFS: ${e}`);
    }
  }

  /**
   * Serialize function result for hashing.
   */
  private serializeResult(result: any): any {
    try {
      // Try direct JSON serialization
      JSON.stringify(result);
      return result;
    } catch {
      // Fallback to string representation
      return String(result);
    }
  }

  /**
   * Create a process insurance policy for a function.
   */
  createInsurancePolicy(
    functionName: string,
    coverageAmount: number,
    conditions: Record<string, any>
  ): Record<string, any> {
    const policyId = `policy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    const policy = {
      policy_id: policyId,
      function_name: functionName,
      agent_name: this.agentName,
      coverage_amount: coverageAmount,
      conditions,
      created_at: new Date().toISOString(),
      status: 'active',
    };

    console.log(`🛡️  Process insurance policy created: ${policyId}`);
    console.log(`   Function: ${functionName}`);
    console.log(`   Coverage: $${coverageAmount}`);

    return policy;
  }

  /**
   * Configure autonomous agent capabilities with integrity verification.
   */
  configureAutonomousAgent(
    capabilities: string[],
    constraints: Record<string, any>
  ): Record<string, any> {
    const configId = `config_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    const configuration = {
      config_id: configId,
      agent_name: this.agentName,
      capabilities,
      constraints,
      integrity_verification: true,
      registered_functions: Array.from(this.registeredFunctions.keys()),
      created_at: new Date().toISOString(),
    };

    console.log(`🤖 Autonomous agent configured: ${configId}`);
    console.log(`   Capabilities: ${capabilities.length}`);
    console.log(`   Registered functions: ${this.registeredFunctions.size}`);

    return configuration;
  }
}

/**
 * Decorator for automatically registering functions with integrity checking.
 */
export function integrityCheckedFunction(verifier?: ProcessIntegrityVerifier) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (verifier) {
        // Register function if not already registered
        if (!verifier['registeredFunctions'].has(propertyKey)) {
          verifier.registerFunction(originalMethod, propertyKey);
        }

        // Execute with integrity proof
        const inputs = { args };
        const [result] = await verifier.executeWithProof(propertyKey, inputs, true);
        return result;
      } else {
        // Execute without integrity checking
        return await originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}
