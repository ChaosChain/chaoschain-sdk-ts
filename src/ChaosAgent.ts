/**
 * ChaosAgent - ERC-8004 v1.0 Contract Interactions
 * Handles Identity, Reputation, and Validation Registry interactions
 */

import { ethers } from 'ethers';
import {
  AgentMetadata,
  AgentRegistration,
  FeedbackParams,
  FeedbackRecord,
  ValidationRequestParams,
  ValidationRequest,
  ValidationStatus,
  ContractAddresses,
} from './types';
import {
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  VALIDATION_REGISTRY_ABI,
} from './utils/contracts';

export class ChaosAgent {
  private identityContract: ethers.Contract;
  private reputationContract: ethers.Contract;
  private validationContract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(addresses: ContractAddresses, signer: ethers.Signer, _provider: ethers.Provider) {
    this.signer = signer;

    // Initialize contract instances
    this.identityContract = new ethers.Contract(addresses.identity, IDENTITY_REGISTRY_ABI, signer);
    this.reputationContract = new ethers.Contract(
      addresses.reputation,
      REPUTATION_REGISTRY_ABI,
      signer
    );
    this.validationContract = new ethers.Contract(
      addresses.validation,
      VALIDATION_REGISTRY_ABI,
      signer
    );
  }

  // ============================================================================
  // Identity Registry Methods
  // ============================================================================

  /**
   * Register a new agent identity (ERC-8004)
   */
  async registerIdentity(metadata?: AgentMetadata): Promise<AgentRegistration> {
    // Create metadata URI (JSON)
    const uri = metadata ? `data:application/json,${JSON.stringify(metadata)}` : '';

    // Call register with the appropriate overload
    let tx;
    if (uri) {
      // Use register(string) overload
      tx = await this.identityContract['register(string)'](uri);
    } else {
      // Use register() overload
      tx = await this.identityContract['register()']();
    }
    const receipt = await tx.wait();

    // Parse Registered event
    const event = receipt.logs
      .map((log: ethers.Log) => {
        try {
          return this.identityContract.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
        } catch {
          return null;
        }
      })
      .find((e: ethers.LogDescription | null) => e?.name === 'Registered');

    if (!event) {
      throw new Error('Registered event not found');
    }

    return {
      agentId: event.args.agentId,
      txHash: receipt.hash,
      owner: event.args.owner,
    };
  }

  /**
   * Get agent metadata
   */
  async getAgentMetadata(agentId: bigint): Promise<AgentMetadata | null> {
    try {
      const uri = await this.identityContract.tokenURI(agentId);

      if (!uri) {
        return null;
      }

      // Parse data URI
      if (uri.startsWith('data:application/json,')) {
        const json = uri.substring('data:application/json,'.length);
        return JSON.parse(decodeURIComponent(json));
      }

      // Parse ipfs:// URI (fetch from gateway)
      if (uri.startsWith('ipfs://')) {
        const cid = uri.substring(7);
        const response = await fetch(`https://ipfs.io/ipfs/${cid}`);
        return (await response.json()) as AgentMetadata | null;
      }

      // Parse https:// URI
      if (uri.startsWith('https://') || uri.startsWith('http://')) {
        const response = await fetch(uri);
        return (await response.json()) as AgentMetadata | null;
      }

      return null;
    } catch (error) {
      console.error('Failed to get agent metadata:', error);
      return null;
    }
  }

  /**
   * Set agent URI
   */
  async setAgentUri(agentId: bigint, uri: string): Promise<string> {
    const tx = await this.identityContract.setAgentUri(agentId, uri);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Update agent metadata
   */
  async updateAgentMetadata(agentId: bigint, metadata: AgentMetadata): Promise<string> {
    const uri = `data:application/json,${JSON.stringify(metadata)}`;
    return this.setAgentUri(agentId, uri);
  }

  /**
   * Check if agent exists
   */
  async agentExists(agentId: bigint): Promise<boolean> {
    return this.identityContract.agentExists(agentId);
  }

  /**
   * Get agent owner
   */
  async getAgentOwner(agentId: bigint): Promise<string> {
    return this.identityContract.ownerOf(agentId);
  }

  /**
   * Get total number of agents
   */
  async getTotalAgents(): Promise<bigint> {
    return this.identityContract.totalAgents();
  }

  /**
   * Transfer agent ownership
   */
  async transferAgent(agentId: bigint, to: string): Promise<string> {
    const from = await this.signer.getAddress();
    const tx = await this.identityContract.transferFrom(from, to, agentId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ============================================================================
  // Reputation Registry Methods
  // ============================================================================

  /**
   * Generate EIP-191 signed feedback authorization (ERC-8004 v1.0)
   *
   * This signature allows a client to submit feedback to an agent's reputation.
   * The agent owner signs to authorize the client to give feedback up to a certain index.
   *
   * @param agentId Target agent ID receiving feedback
   * @param clientAddress Address of the client giving feedback
   * @param indexLimit Maximum feedback index this authorization permits
   * @param expiry Unix timestamp when authorization expires
   * @returns Signed feedbackAuth bytes for use in giveFeedback()
   */
  async generateFeedbackAuthorization(
    agentId: bigint,
    clientAddress: string,
    indexLimit: bigint,
    expiry: bigint
  ): Promise<string> {
    try {
      // Get chain ID
      const network = await this.signer.provider!.getNetwork();
      const chainId = network.chainId;

      // Get identity registry address
      const identityAddress = await this.identityContract.getAddress();

      // Get signer address
      const signerAddress = await this.signer.getAddress();

      // Pack the FeedbackAuth struct (7 fields)
      // As per ERC-8004 v1.0 spec: (agentId, clientAddress, indexLimit, expiry, chainId, identityRegistry, signerAddress)
      const feedbackAuthData = ethers.solidityPackedKeccak256(
        ['uint256', 'address', 'uint64', 'uint256', 'uint256', 'address', 'address'],
        [agentId, clientAddress, indexLimit, expiry, chainId, identityAddress, signerAddress]
      );

      // Sign with agent's private key (EIP-191)
      const signature = await this.signer.signMessage(ethers.getBytes(feedbackAuthData));
      const signatureBytes = ethers.getBytes(signature); // 65 bytes (r + s + v)

      // Pack struct data + signature (224 bytes + 65 bytes = 289 bytes)
      const structBytes = ethers.concat([
        ethers.toBeHex(agentId, 32),
        ethers.zeroPadValue(clientAddress, 32),
        ethers.concat([ethers.toBeHex(indexLimit, 8), ethers.zeroPadValue('0x', 24)]), // uint64 padded
        ethers.toBeHex(expiry, 32),
        ethers.toBeHex(chainId, 32),
        ethers.zeroPadValue(identityAddress, 32),
        ethers.zeroPadValue(signerAddress, 32),
      ]);

      // Return struct + signature
      const feedbackAuth = ethers.hexlify(ethers.concat([structBytes, signatureBytes]));

      console.log(`✅ Generated feedback authorization for agent #${agentId}`);
      return feedbackAuth;
    } catch (e: any) {
      throw new Error(`Failed to generate feedback authorization: ${e.message}`);
    }
  }

  /**
   * Give feedback to an agent (ERC-8004 v1.0)
   *
   * @param params Feedback parameters including agentId, rating, feedbackUri, and optional auth
   * @returns Transaction hash
   */
  async giveFeedback(params: FeedbackParams): Promise<string> {
    const { agentId, rating, feedbackUri, feedbackData } = params;

    // Validate rating (0-100)
    if (rating < 0 || rating > 100) {
      throw new Error('Rating must be between 0 and 100');
    }

    // ERC-8004 v1.0 requires: (agentId, score, tag1, tag2, feedbackUri, feedbackHash, feedbackAuth)
    const score = rating; // 0-100
    const tag1 = feedbackData?.tag1 || ethers.ZeroHash; // bytes32
    const tag2 = feedbackData?.tag2 || ethers.ZeroHash; // bytes32

    // Calculate feedback hash
    const feedbackContent = feedbackData?.content || feedbackUri || '';
    const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes(String(feedbackContent)));

    // Feedback auth (289 bytes: struct + signature)
    // If not provided, use empty bytes (will work if no auth required or for self-feedback)
    const feedbackAuth = feedbackData?.feedbackAuth || '0x';

    const tx = await this.reputationContract.giveFeedback(
      agentId,
      score,
      tag1,
      tag2,
      feedbackUri,
      feedbackHash,
      feedbackAuth
    );
    const receipt = await tx.wait();

    return receipt.hash;
  }

  /**
   * Revoke feedback (ERC-8004 v1.0)
   * @param agentId Agent ID that received the feedback
   * @param feedbackIndex Index of the feedback to revoke (uint64)
   */
  async revokeFeedback(agentId: bigint, feedbackIndex: bigint): Promise<string> {
    const tx = await this.reputationContract.revokeFeedback(agentId, feedbackIndex);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Append response to feedback (ERC-8004 v1.0)
   * @param agentId Agent ID that received the feedback
   * @param clientAddress Address of the client who gave feedback
   * @param feedbackIndex Index of the feedback
   * @param responseUri URI containing the response data
   * @param responseHash Hash of the response content
   */
  async appendResponse(
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
    responseUri: string,
    responseHash: string
  ): Promise<string> {
    const tx = await this.reputationContract.appendResponse(
      agentId,
      clientAddress,
      feedbackIndex,
      responseUri,
      responseHash
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Read specific feedback (ERC-8004 v1.0)
   * @param agentId Agent ID that received the feedback
   * @param clientAddress Address of the client who gave feedback
   * @param index Index of the feedback
   */
  async readFeedback(
    agentId: bigint,
    clientAddress: string,
    index: bigint
  ): Promise<{
    score: number;
    tag1: string;
    tag2: string;
    isRevoked: boolean;
  }> {
    const feedback = await this.reputationContract.readFeedback(agentId, clientAddress, index);
    return {
      score: Number(feedback.score),
      tag1: feedback.tag1,
      tag2: feedback.tag2,
      isRevoked: feedback.isRevoked,
    };
  }

  /**
   * Read all feedback for an agent (ERC-8004 v1.0)
   * @param agentId Agent ID
   * @param clientAddresses Array of client addresses (empty array for all clients)
   * @param tag1 First tag filter (ZeroHash for no filter)
   * @param tag2 Second tag filter (ZeroHash for no filter)
   * @param includeRevoked Whether to include revoked feedback
   */
  async readAllFeedback(
    agentId: bigint,
    clientAddresses: string[] = [],
    tag1: string = ethers.ZeroHash,
    tag2: string = ethers.ZeroHash,
    includeRevoked: boolean = false
  ): Promise<{
    clients: string[];
    scores: number[];
    tag1s: string[];
    tag2s: string[];
    revokedStatuses: boolean[];
  }> {
    const result = await this.reputationContract.readAllFeedback(
      agentId,
      clientAddresses,
      tag1,
      tag2,
      includeRevoked
    );
    return {
      clients: result.clients,
      scores: result.scores.map((s: bigint) => Number(s)),
      tag1s: result.tag1s,
      tag2s: result.tag2s,
      revokedStatuses: result.revokedStatuses,
    };
  }

  /**
   * Get summary statistics (ERC-8004 v1.0)
   * @param agentId Agent ID
   * @param clientAddresses Array of client addresses (empty array for all clients)
   * @param tag1 First tag filter (ZeroHash for no filter)
   * @param tag2 Second tag filter (ZeroHash for no filter)
   */
  async getSummary(
    agentId: bigint,
    clientAddresses: string[] = [],
    tag1: string = ethers.ZeroHash,
    tag2: string = ethers.ZeroHash
  ): Promise<{
    count: bigint;
    averageScore: number;
  }> {
    const result = await this.reputationContract.getSummary(agentId, clientAddresses, tag1, tag2);
    return {
      count: result.count,
      averageScore: Number(result.averageScore),
    };
  }

  /**
   * Get list of clients who gave feedback
   * @param agentId Agent ID
   */
  async getClients(agentId: bigint): Promise<string[]> {
    return this.reputationContract.getClients(agentId);
  }

  /**
   * Get last feedback index for a client
   * @param agentId Agent ID
   * @param clientAddress Client address
   */
  async getLastIndex(agentId: bigint, clientAddress: string): Promise<bigint> {
    return this.reputationContract.getLastIndex(agentId, clientAddress);
  }

  /**
   * Get identity registry address from reputation contract
   */
  async getIdentityRegistry(): Promise<string> {
    return this.reputationContract.getIdentityRegistry();
  }

  // ============================================================================
  // Validation Registry Methods
  // ============================================================================

  /**
   * Request validation from a validator (ERC-8004 v1.0)
   * @param validatorAddress Address of the validator
   * @param agentId Agent ID requesting validation
   * @param requestUri URI containing validation request data
   * @param requestHash Hash of the request content (bytes32)
   */
  async requestValidation(
    validatorAddress: string,
    agentId: bigint,
    requestUri: string,
    requestHash: string
  ): Promise<string> {
    // Ensure requestHash is bytes32 format
    const hashBytes = requestHash.startsWith('0x') ? requestHash : ethers.id(requestHash);

    const tx = await this.validationContract.validationRequest(
      validatorAddress,
      agentId,
      requestUri,
      hashBytes
    );
    const receipt = await tx.wait();

    return receipt.hash;
  }

  /**
   * Respond to validation request (ERC-8004 v1.0)
   * @param requestHash Hash of the original validation request (bytes32)
   * @param response Response score (0-100, where 100 = approved)
   * @param responseUri URI containing response data
   * @param responseHash Hash of the response content (bytes32)
   * @param tag Optional tag for categorization (bytes32)
   */
  async respondToValidation(
    requestHash: string,
    response: number,
    responseUri: string,
    responseHash: string,
    tag: string = ethers.ZeroHash
  ): Promise<string> {
    // Validate response (0-100)
    if (response < 0 || response > 100) {
      throw new Error('Response must be between 0 and 100');
    }

    // Ensure hashes are bytes32 format
    const reqHashBytes = requestHash.startsWith('0x') ? requestHash : ethers.id(requestHash);
    const resHashBytes = responseHash.startsWith('0x') ? responseHash : ethers.id(responseHash);
    const tagBytes = tag.startsWith('0x') ? tag : ethers.ZeroHash;

    const tx = await this.validationContract.validationResponse(
      reqHashBytes,
      response,
      responseUri,
      resHashBytes,
      tagBytes
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Get validation status (ERC-8004 v1.0)
   * @param requestHash Hash of the validation request (bytes32)
   */
  async getValidationStatus(requestHash: string): Promise<{
    validatorAddress: string;
    agentId: bigint;
    response: number;
    responseHash: string;
    tag: string;
    lastUpdate: bigint;
  }> {
    const hashBytes = requestHash.startsWith('0x') ? requestHash : ethers.id(requestHash);
    const result = await this.validationContract.getValidationStatus(hashBytes);
    return {
      validatorAddress: result.validatorAddress,
      agentId: result.agentId,
      response: Number(result.response),
      responseHash: result.responseHash,
      tag: result.tag,
      lastUpdate: result.lastUpdate,
    };
  }

  /**
   * Get validation summary statistics (ERC-8004 v1.0)
   * @param agentId Agent ID
   * @param validatorAddresses Array of validator addresses (empty for all)
   * @param tag Tag filter (ZeroHash for no filter)
   */
  async getValidationSummary(
    agentId: bigint,
    validatorAddresses: string[] = [],
    tag: string = ethers.ZeroHash
  ): Promise<{
    count: bigint;
    avgResponse: number;
  }> {
    const tagBytes = tag.startsWith('0x') ? tag : ethers.ZeroHash;
    const result = await this.validationContract.getSummary(agentId, validatorAddresses, tagBytes);
    return {
      count: result.count,
      avgResponse: Number(result.avgResponse),
    };
  }

  /**
   * Get all validation request hashes for an agent
   * @param agentId Agent ID
   */
  async getAgentValidations(agentId: bigint): Promise<string[]> {
    return this.validationContract.getAgentValidations(agentId);
  }

  /**
   * Get all validation requests for a validator
   * @param validatorAddress Validator address
   */
  async getValidatorRequests(validatorAddress: string): Promise<string[]> {
    return this.validationContract.getValidatorRequests(validatorAddress);
  }

  /**
   * Get identity registry address from validation contract
   */
  async getValidationIdentityRegistry(): Promise<string> {
    return this.validationContract.getIdentityRegistry();
  }

  // ============================================================================
  // Event Listening
  // ============================================================================

  /**
   * Listen for Registered events
   */
  onAgentRegistered(callback: (agentId: bigint, owner: string, uri: string) => void): void {
    this.identityContract.on('Registered', callback);
  }

  /**
   * Listen for NewFeedback events (ERC-8004 v1.0)
   */
  onNewFeedback(
    callback: (
      agentId: bigint,
      clientAddress: string,
      score: number,
      tag1: string,
      tag2: string,
      feedbackUri: string,
      feedbackHash: string
    ) => void
  ): void {
    this.reputationContract.on('NewFeedback', callback);
  }

  /**
   * Listen for ResponseAppended events (ERC-8004 v1.0)
   */
  onResponseAppended(
    callback: (
      agentId: bigint,
      clientAddress: string,
      feedbackIndex: bigint,
      responder: string,
      responseUri: string,
      responseHash: string
    ) => void
  ): void {
    this.reputationContract.on('ResponseAppended', callback);
  }

  /**
   * Listen for ValidationRequest events (ERC-8004 v1.0)
   */
  onValidationRequest(
    callback: (
      validatorAddress: string,
      agentId: bigint,
      requestUri: string,
      requestHash: string
    ) => void
  ): void {
    this.validationContract.on('ValidationRequest', callback);
  }

  /**
   * Listen for ValidationResponse events (ERC-8004 v1.0)
   */
  onValidationResponse(
    callback: (
      validatorAddress: string,
      agentId: bigint,
      requestHash: string,
      response: number,
      responseUri: string,
      responseHash: string,
      tag: string
    ) => void
  ): void {
    this.validationContract.on('ValidationResponse', callback);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.identityContract.removeAllListeners();
    this.reputationContract.removeAllListeners();
    this.validationContract.removeAllListeners();
  }
}
