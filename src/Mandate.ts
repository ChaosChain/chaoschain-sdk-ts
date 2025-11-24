/**
 * Mandate Integration for ChaosChain SDK
 *
 * This module integrates Mandate's package with the ChaosChain protocol,
 * providing mandate creation and signing capabilities with CAIP-10 identities.
 */

import { HDNodeWallet } from 'ethers';
import { Mandate, type MandateInit, type MandateJSON, type Signature, type CAIP10 } from '@quillai-network/mandates-core';
import { ConfigurationError, ValidationError } from './exceptions';
import { AgentRole } from './types';

export interface MandateCreateParams {
  client: CAIP10;
  server: CAIP10;
  intent: string;
  deadline: string;
  core: {
    kind: string;
    payload: Record<string, any>;
  };
  version?: string;
  mandateId?: string;
}

export interface MandateSignParams {
  mandate: Mandate | MandateJSON;
  agentRole: AgentRole | string;
  wallet: HDNodeWallet;
  alg?: 'eip191' | 'eip712';
  domain?: Record<string, unknown>;
}

export interface MandateIntegrationResult {
  mandate?: MandateJSON;
  signature?: Signature;
  mandateHash?: string;
  success: boolean;
  error?: string;
}

/**
 * Mandate integration for ChaosChain SDK
 * 
 * This integrates mandates-core library for creating and signing
 * immutable mandate documents with CAIP-10 identities and EIP-191/EIP-712 signing.
 */
export class MandateIntegration {
  private agentName: string;
  private agentRole: AgentRole | string;

  constructor(agentName: string, agentRole?: AgentRole | string) {
    this.agentName = agentName;
    this.agentRole = agentRole || AgentRole.SERVER;

    console.log(`✅ Mandate Integration initialized for ${agentName}`);
    console.log(`   Agent Role: ${this.agentRole}`);
  }

  /**
   * Map agent role to mandate signing role
   */
  private mapAgentRoleToMandateRole(agentRole: AgentRole | string): 'client' | 'server' {
    const role = agentRole.toString().toLowerCase();
    
    if (role === AgentRole.CLIENT || role === 'client') {
      return 'client';
    } else if (role === AgentRole.SERVER || role === 'server') {
      return 'server';
    } else if (role === AgentRole.BOTH || role === 'both') {
      // Default to server for BOTH role, but this can be overridden
      return 'server';
    } else {
      // Default fallback
      return 'server';
    }
  }

  /**
   * Create a new mandate using mandates-core
   */
  createMandate(params: MandateCreateParams): MandateIntegrationResult {
    try {
      // Validate required fields
      if (!params.client || !params.server) {
        throw new ConfigurationError('Client and server CAIP-10 identities are required');
      }

      if (!params.intent) {
        throw new ConfigurationError('Intent is required for mandate creation');
      }

      if (!params.deadline) {
        throw new ConfigurationError('Deadline is required for mandate creation');
      }

      if (!params.core || !params.core.kind || !params.core.payload) {
        throw new ConfigurationError('Core primitive with kind and payload is required');
      }

      // Create mandate initialization object
      const mandateInit: MandateInit = {
        client: params.client,
        server: params.server,
        intent: params.intent,
        deadline: params.deadline,
        core: params.core,
        version: params.version || '1.0',
        mandateId: params.mandateId,
        createdAt: new Date().toISOString()
      };

      // Create mandate instance
      const mandate = new Mandate(mandateInit);

      // Get mandate JSON
      const mandateJSON = mandate.toJSON();
      const mandateHash = mandate.mandateHash();

      console.log(`📝 Created Mandate`);
      console.log(`   Mandate ID: ${mandateJSON.mandateId}`);
      console.log(`   Client: ${mandateJSON.client}`);
      console.log(`   Server: ${mandateJSON.server}`);
      console.log(`   Intent: ${mandateJSON.intent}`);
      console.log(`   Hash: ${mandateHash}`);
      console.log(`   Deadline: ${mandateJSON.deadline}`);

      return {
        mandate: mandateJSON as MandateJSON,
        mandateHash,
        success: true
      };
    } catch (e: any) {
      console.error(`❌ Failed to create mandate: ${e}`);
      return {
        success: false,
        error: e.message || String(e)
      };
    }
  }

  /**
   * Sign a mandate using the agent's role to identify the signing function
   * 
   * @param params Signing parameters including mandate, agentRole, and wallet
   * @returns Result with signature and updated mandate
   */
  async signMandate(params: MandateSignParams): Promise<MandateIntegrationResult> {
    try {
      // Validate mandate
      let mandate: Mandate;
      
      if (params.mandate instanceof Mandate) {
        mandate = params.mandate;
      } else {
        // Create Mandate from JSON object
        mandate = Mandate.fromObject(params.mandate);
      }

      if (!params.wallet) {
        throw new ConfigurationError('Wallet is required for signing');
      }

      // Map agent role to mandate signing role (client or server)
      const mandateRole = this.mapAgentRoleToMandateRole(params.agentRole);

      console.log(`🔏 Signing mandate as ${mandateRole} (agent role: ${params.agentRole})`);

      // Sign the mandate with the appropriate role
      const signature = await mandate.sign(
        mandateRole,
        params.wallet,
        params.alg || 'eip191',
        params.domain as any
      );

      // Get updated mandate JSON with signature
      const mandateJSON = mandate.toJSON();

      // Verify the signature
      const verifyResult = mandate.verifyRole(mandateRole, params.domain as any);
      
      if (!verifyResult.ok) {
        throw new ValidationError('Failed to verify mandate signature');
      }

      console.log(`✅ Mandate signed successfully as ${mandateRole}`);
      console.log(`   Signer: ${verifyResult.recovered}`);
      console.log(`   Algorithm: ${signature.alg}`);
      console.log(`   Mandate Hash: ${signature.mandateHash}`);

      return {
        mandate: mandateJSON as MandateJSON,
        signature,
        mandateHash: signature.mandateHash,
        success: true
      };
    } catch (e: any) {
      console.error(`❌ Failed to sign mandate: ${e}`);
      return {
        success: false,
        error: e.message || String(e)
      };
    }
  }

  /**
   * Verify a mandate signature for a specific role
   */
  verifyMandateSignature(
    mandate: Mandate | MandateJSON,
    role: 'client' | 'server',
    domain?: Record<string, unknown>
  ): MandateIntegrationResult {
    try {
      let mandateInstance: Mandate;
      
      if (mandate instanceof Mandate) {
        mandateInstance = mandate;
      } else {
        mandateInstance = Mandate.fromObject(mandate);
      }

      const verifyResult = mandateInstance.verifyRole(role, domain as any);

      if (!verifyResult.ok) {
        return {
          success: false,
          error: 'Signature verification failed'
        };
      }

      console.log(`✅ Mandate signature verified for ${role}`);
      console.log(`   Recovered address: ${verifyResult.recovered}`);
      console.log(`   Algorithm: ${verifyResult.alg}`);
      console.log(`   Hash: ${verifyResult.recomputedHash}`);

      return {
        mandate: mandateInstance.toJSON() as MandateJSON,
        mandateHash: verifyResult.recomputedHash,
        success: true
      };
    } catch (e: any) {
      console.error(`❌ Failed to verify mandate signature: ${e}`);
      return {
        success: false,
        error: e.message || String(e)
      };
    }
  }

  /**
   * Verify all signatures in a mandate (both client and server)
   */
  verifyAllSignatures(
    mandate: Mandate | MandateJSON,
    domainForClient?: Record<string, unknown>,
    domainForServer?: Record<string, unknown>
  ): MandateIntegrationResult {
    try {
      let mandateInstance: Mandate;
      
      if (mandate instanceof Mandate) {
        mandateInstance = mandate;
      } else {
        mandateInstance = Mandate.fromObject(mandate);
      }

      const verifyResult = mandateInstance.verifyAll(domainForClient as any, domainForServer as any);

      const clientOk = verifyResult.client.ok;
      const serverOk = verifyResult.server.ok;

      if (!clientOk || !serverOk) {
        return {
          success: false,
          error: `Client signature: ${clientOk ? 'OK' : 'FAILED'}, Server signature: ${serverOk ? 'OK' : 'FAILED'}`
        };
      }

      console.log(`✅ All mandate signatures verified`);
      console.log(`   Client: ${verifyResult.client.recovered} (${verifyResult.client.alg})`);
      console.log(`   Server: ${verifyResult.server.recovered} (${verifyResult.server.alg})`);

      return {
        mandate: mandateInstance.toJSON() as MandateJSON,
        mandateHash: verifyResult.client.recomputedHash,
        success: true
      };
    } catch (e: any) {
      console.error(`❌ Failed to verify mandate signatures: ${e}`);
      return {
        success: false,
        error: e.message || String(e)
      };
    }
  }

  /**
   * Get mandate hash from a mandate object
   */
  getMandateHash(mandate: Mandate | MandateJSON): string {
    try {
      let mandateInstance: Mandate;
      
      if (mandate instanceof Mandate) {
        mandateInstance = mandate;
      } else {
        mandateInstance = Mandate.fromObject(mandate);
      }

      return mandateInstance.mandateHash();
    } catch (e: any) {
      throw new ValidationError(`Failed to get mandate hash: ${e.message}`);
    }
  }

  /**
   * Get canonical string representation of a mandate
   */
  getCanonicalString(mandate: Mandate | MandateJSON): string {
    try {
      let mandateInstance: Mandate;
      
      if (mandate instanceof Mandate) {
        mandateInstance = mandate;
      } else {
        mandateInstance = Mandate.fromObject(mandate);
      }

      return mandateInstance.toCanonicalString();
    } catch (e: any) {
      throw new ValidationError(`Failed to get canonical string: ${e.message}`);
    }
  }

  /**
   * Get a summary of the Mandate integration capabilities
   */
  getIntegrationSummary(): Record<string, any> {
    return {
      integration_type: 'Mandates Core',
      agent_name: this.agentName,
      agent_role: this.agentRole,
      supported_features: [
        'Mandate creation with CAIP-10 identities',
        'Mandate signing with agent role identification',
        'EIP-191 and EIP-712 signature support',
        'Signature verification (single and all)',
        'Canonical JSON serialization (JCS)',
        'Mandate hashing',
        'Immutable mandate documents'
      ],
      cryptographic_features: [
        'EIP-191 message signing',
        'EIP-712 typed data signing',
        'CAIP-10 identity format',
        'Mandate hash computation',
        'Signature verification and recovery'
      ],
      compliance: [
        'CAIP-10 Identity Specification',
        'EIP-191 Signed Data Standard',
        'EIP-712 Typed Data Hashing',
        'JSON Canonicalization Scheme (JCS)',
        'ISO 8601 timestamps'
      ]
    };
  }
}

