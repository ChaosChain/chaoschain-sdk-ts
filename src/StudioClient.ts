import { ethers } from 'ethers';
import {
  CHAOS_CORE_ABI,
  STUDIO_PROXY_ABI,
  REWARDS_DISTRIBUTOR_ABI,
  getContractAddresses,
} from './utils/contracts';
import { ContractError } from './exceptions';

export interface StudioClientConfig {
  provider: ethers.Provider;
  signer: ethers.Signer;
  network: string;
}

export class StudioClient {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private network: string;

  constructor(config: StudioClientConfig) {
    this.provider = config.provider;
    this.signer = config.signer;
    this.network = config.network;
  }

  // ===========================================================================
  // Studio Creation (ChaosCore)
  // ===========================================================================

  /**
   * Create a new Studio on the ChaosChain protocol.
   *
   * @param name - Name for the studio
   * @param logicModuleAddress - Address of deployed LogicModule contract
   * @returns Studio proxy address and studioId
   */
  async createStudio(
    name: string,
    logicModuleAddress: string
  ): Promise<{ proxyAddress: string; studioId: bigint }> {
    const addresses = getContractAddresses(this.network) as Record<string, string> | undefined;
    const chaosCoreAddress = addresses?.chaos_core;

    if (!chaosCoreAddress) {
      throw new ContractError(`ChaosCore contract address not found for network: ${this.network}.`);
    }
    const chaosCore = new ethers.Contract(chaosCoreAddress, CHAOS_CORE_ABI, this.signer);

    const tx = await chaosCore.createStudio(name, logicModuleAddress);
    const receipt = await tx.wait();

    const event = receipt.logs.find((log: any) => {
      try {
        return chaosCore.interface.parseLog(log)?.name === 'StudioCreated';
      } catch (error) {
        return false;
      }
    });

    if (!event) {
      throw new ContractError('Could not find StudioCreated event');
    }

    const parsed = chaosCore.interface.parseLog(event);

    if (!parsed || !parsed.args) {
      throw new ContractError('Could not parse StudioCreated event');
    }

    return {
      proxyAddress: parsed.args.proxyAddress,
      studioId: parsed.args.studioId,
    };
  }

  // ===========================================================================
  // Agent Registration
  // ===========================================================================

  /**
   * Register this agent with a Studio.
   *
   * @param studioAddress - Address of the Studio proxy
   * @param agentId - Agent's ERC-8004 ID
   * @param role - Agent role (1=WORKER, 2=VERIFIER, 3=CLIENT, etc.)
   * @param stakeAmount - Amount to stake in wei (default: 0.0001 ETH)
   */
  async registerWithStudio(
    studioAddress: string,
    agentId: string,
    role: number,
    stakeAmount?: bigint
  ): Promise<string> {
    const stake = stakeAmount ?? ethers.parseEther('0.0001');

    if (stake === 0n) {
      throw new ContractError('Stake amount must be > 0 (contract requirement)');
    }

    const studio = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, this.signer);

    const tx = await studio.registerAgent(agentId, role, {
      value: stake,
    });

    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ===========================================================================
  // Work Submission
  // ===========================================================================

  /**
   * Submit work to a Studio (direct, deprecated).
   * @deprecated Use Gateway for production. Direct submission lacks crash recovery.
   *
   * @param studioAddress - Address of the Studio proxy
   * @param dataHash - EIP-712 DataHash of the work (bytes32)
   * @param threadRoot - VLC/Merkle root of XMTP thread (bytes32)
   * @param evidenceRoot - Merkle root of artifacts (bytes32)
   * @param feedbackAuth - Feedback authorization (deprecated, default empty)
   * @returns Transaction hash
   */
  async submitWork(
    studioAddress: string,
    dataHash: string,
    threadRoot: string,
    evidenceRoot: string,
    feedbackAuth: string = '0x'
  ): Promise<string> {
    console.warn('submitWork() is deprecated. Use Gateway for production.');

    const studio = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, this.signer);

    const tx = await studio.submitWork(dataHash, threadRoot, evidenceRoot, feedbackAuth);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Submit work with multi-agent attribution.
   * @deprecated Use Gateway for production.
   *
   * @param studioAddress - Address of the Studio proxy
   * @param dataHash - EIP-712 DataHash of the work (bytes32)
   * @param threadRoot - VLC/Merkle root of XMTP thread (bytes32)
   * @param evidenceRoot - Merkle root of artifacts (bytes32)
   * @param participants - List of participant addresses (in order)
   * @param contributionWeights - Contribution weights in basis points (must sum to 10000)
   * @param evidenceCID - IPFS/Arweave CID of evidence package (optional)
   * @returns Transaction hash
   */
  async submitWorkMultiAgent(
    studioAddress: string,
    dataHash: string,
    threadRoot: string,
    evidenceRoot: string,
    participants: string[],
    contributionWeights: number[],
    evidenceCID: string = ''
  ): Promise<string> {
    console.warn('submitWorkMultiAgent() is deprecated. Use Gateway for production.');

    const sum = contributionWeights.reduce((a, b) => a + b, 0);
    if (sum !== 10000) {
      throw new ContractError(`Contribution weights must sum to 10000, got ${sum}`);
    }

    if (participants.length !== contributionWeights.length) {
      throw new ContractError(
        `Participants (${participants.length}) and weights (${contributionWeights.length}) must have same length`
      );
    }

    const studio = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, this.signer);

    const tx = await studio.submitWorkMultiAgent(
      dataHash,
      threadRoot,
      evidenceRoot,
      participants,
      contributionWeights,
      evidenceCID
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ===========================================================================
  // Score Commit-Reveal
  // ===========================================================================

  /**
   * Commit a score (commit phase of commit-reveal).
   *
   * @param studioAddress - Address of the Studio proxy
   * @param dataHash - DataHash of the work being scored (bytes32)
   * @param commitment - keccak256(abi.encodePacked(scoreVector, salt, dataHash))
   * @returns Transaction hash
   */
  async commitScore(studioAddress: string, dataHash: string, commitment: string): Promise<string> {
    const studio = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, this.signer);

    const tx = await studio.commitScore(dataHash, commitment);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Reveal a score (reveal phase of commit-reveal).
   *
   * @param studioAddress - Address of the Studio proxy
   * @param dataHash - DataHash of the work being scored (bytes32)
   * @param scoreVector - ABI-encoded score array (bytes)
   * @param salt - Random salt used in commitment (bytes32)
   * @returns Transaction hash
   */
  async revealScore(
    studioAddress: string,
    dataHash: string,
    scoreVector: string,
    salt: string
  ): Promise<string> {
    const studio = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, this.signer);

    const tx = await studio.revealScore(dataHash, scoreVector, salt);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ===========================================================================
  // Epoch Management
  // ===========================================================================

  /**
   * Close an epoch and trigger reward distribution.
   *
   * @param studioAddress - Address of the Studio proxy
   * @param epoch - Epoch number to close
   * @returns Transaction hash
   */
  async closeEpoch(studioAddress: string, epoch: number): Promise<string> {
    const addresses = getContractAddresses(this.network) as Record<string, string> | undefined;
    const rewardsDistributorAddress = addresses?.rewards_distributor;

    if (!rewardsDistributorAddress) {
      throw new ContractError(
        `RewardsDistributor contract address not found for network: ${this.network}.`
      );
    }

    const distributor = new ethers.Contract(
      rewardsDistributorAddress,
      REWARDS_DISTRIBUTOR_ABI,
      this.signer
    );

    const tx = await distributor.closeEpoch(studioAddress, epoch);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ===========================================================================
  // Rewards
  // ===========================================================================

  /**
   * Get pending rewards for an account in a Studio.
   *
   * @param studioAddress - Address of the Studio proxy
   * @param account - Address to check balance for
   * @returns Pending reward amount in wei
   */
  async getPendingRewards(studioAddress: string, account: string): Promise<bigint> {
    const studio = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, this.provider);
    return studio.getWithdrawableBalance(account);
  }

  /**
   * Withdraw pending rewards from a Studio.
   *
   * @param studioAddress - Address of the Studio proxy
   * @returns Transaction hash
   */
  async withdrawRewards(studioAddress: string): Promise<string> {
    const studio = new ethers.Contract(studioAddress, STUDIO_PROXY_ABI, this.signer);

    const tx = await studio.withdrawRewards();
    const receipt = await tx.wait();
    return receipt.hash;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Compute score commitment for commit-reveal pattern.
   *
   * @param scores - Array of scores (0-100 or 0-10000 depending on contract)
   * @param salt - Random bytes32 salt
   * @param dataHash - DataHash of the work being scored
   * @returns bytes32 commitment hash
   */
  computeScoreCommitment(scores: number[], salt: string, dataHash: string): string {
    const abiCoder = new ethers.AbiCoder();
    const encoded = abiCoder.encode(['uint8[]', 'bytes32', 'bytes32'], [scores, salt, dataHash]);
    return ethers.keccak256(encoded);
  }

  /**
   * Encode score vector for revealScore.
   *
   * @param scores - Array of scores
   * @returns ABI-encoded bytes
   */
  encodeScoreVector(scores: number[]): string {
    const abiCoder = new ethers.AbiCoder();
    return abiCoder.encode(['uint8[]'], [scores]);
  }

  /**
   * Generate random salt for commit-reveal.
   *
   * @returns bytes32 random salt
   */
  generateSalt(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }
}
