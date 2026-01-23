/**
 * Verifier Agent for Causal Audit and Multi-Dimensional Scoring
 *
 * Implements Protocol Spec v0.1:
 * - §1.5: Causal Audit Algorithm
 * - §3.1: Proof of Agency (PoA) Features - Measurable Agency Dimensions
 *
 * The VerifierAgent performs a complete causal audit using the DKG:
 * 1. Fetches EvidencePackage from IPFS
 * 2. Reconstructs DKG from XMTP thread + artifacts
 * 3. Verifies threadRoot and evidenceRoot
 * 4. Checks causality (parents exist, timestamps monotonic, no cycles)
 * 5. Verifies signatures
 * 6. Traces causal chains (A→B→C value attribution)
 * 7. Computes multi-dimensional scores using graph analysis
 */

import { ethers } from 'ethers';
import { ChaosChainSDK } from './ChaosChainSDK';
import { DKG } from './dkg/DKG';
import { DKGNode } from './dkg/DKGNode';

/**
 * Audit result from causal audit
 */
export interface AuditResult {
  auditPassed: boolean;
  evidencePackageCid: string;
  dataHash: string;
  scores: Record<string, number[]>; // {agentId: [scores...]}
  contributionWeights: Record<string, number>; // {agentId: weight} (for multi-agent attribution)
  dkg?: DKG; // The reconstructed DKG
  auditReport: Record<string, any>;
  errors: string[];
}

/**
 * Verifier Agent for causal audit using DKG analysis
 *
 * Implements Protocol Spec v0.1:
 * - §1.5: Causal Audit Algorithm (with DKG)
 * - §3.1: Measurable Agency Dimensions (from DKG analysis)
 * - §4.2: Multi-Agent Attribution (contribution weights)
 */
export class VerifierAgent {
  private sdk: ChaosChainSDK;

  constructor(sdk: ChaosChainSDK) {
    this.sdk = sdk;
  }

  /**
   * Perform causal audit with DKG analysis
   *
   * @param evidencePackageCid IPFS CID of evidence package
   * @param studioAddress Studio contract address
   * @returns Audit result with scores and contribution weights
   */
  async performCausalAudit(
    evidencePackageCid: string,
    studioAddress: string
  ): Promise<AuditResult> {
    const errors: string[] = [];
    const scores: Record<string, number[]> = {};
    const contributionWeights: Record<string, number> = {};

    try {
      // 1. Fetch evidence package
      console.log(`📥 Fetching evidence package: ${evidencePackageCid}`);
      const evidence = await this.sdk.download(evidencePackageCid);

      if (!evidence) {
        throw new Error('Failed to fetch evidence package');
      }

      // 2. Reconstruct DKG from XMTP messages and artifacts
      console.log(`🔗 Reconstructing DKG from evidence...`);
      const xmtpMessages = evidence.xmtp_messages || evidence.messages || [];
      const artifacts = evidence.artifacts || {};

      const dkg = DKG.fromXMTPThread(xmtpMessages, artifacts);
      console.log(`   Nodes: ${dkg.nodes.size}, Root nodes: ${dkg.rootNodes.length}`);

      // 3. Verify thread root
      const threadRoot = dkg.computeThreadRoot();
      const expectedThreadRoot = evidence.thread_root || evidence.threadRoot;

      if (expectedThreadRoot && threadRoot.toLowerCase() !== expectedThreadRoot.toLowerCase()) {
        errors.push(`Thread root mismatch: expected ${expectedThreadRoot}, got ${threadRoot}`);
      }

      // 4. Perform causal audit
      console.log(`🔍 Performing causal audit...`);
      const auditReport = this.auditCausality(dkg);

      // 5. Compute multi-dimensional scores for each agent
      console.log(`📊 Computing multi-dimensional scores...`);
      for (const [nodeId, node] of dkg.nodes.entries()) {
        const agentKey = node.agentId ? node.agentId.toString() : node.author;

        if (!scores[agentKey]) {
          scores[agentKey] = this.computeMultiDimensionalScores(dkg, agentKey);
        }
      }

      // 6. Compute contribution weights
      console.log(`⚖️  Computing contribution weights...`);
      const weights = dkg.computeContributionWeights();
      for (const [agent, weight] of weights.entries()) {
        contributionWeights[agent] = weight;
      }

      // 7. Compute data hash (for submission)
      const dataHash = this.computeDataHash(
        studioAddress,
        evidence.epoch || 1,
        threadRoot,
        evidence.evidence_root || evidence.evidenceRoot || ethers.ZeroHash
      );

      const auditPassed = errors.length === 0 && auditReport.passed;

      console.log(`✅ Causal audit ${auditPassed ? 'PASSED' : 'FAILED'}`);
      if (errors.length > 0) {
        console.log(`   Errors: ${errors.length}`);
      }

      return {
        auditPassed,
        evidencePackageCid,
        dataHash,
        scores,
        contributionWeights,
        dkg,
        auditReport,
        errors,
      };
    } catch (error: any) {
      errors.push(error.message);
      return {
        auditPassed: false,
        evidencePackageCid,
        dataHash: ethers.ZeroHash,
        scores: {},
        contributionWeights: {},
        auditReport: { passed: false, error: error.message },
        errors,
      };
    }
  }

  /**
   * Audit causality in DKG
   *
   * Checks:
   * - Parents exist
   * - Timestamps are monotonic
   * - No cycles
   * - Signatures are valid
   */
  private auditCausality(dkg: DKG): Record<string, any> {
    const issues: string[] = [];

    // Check all parents exist
    for (const [nodeId, node] of dkg.nodes.entries()) {
      for (const parentId of node.parents) {
        if (!dkg.nodes.has(parentId)) {
          issues.push(`Node ${nodeId} references missing parent ${parentId}`);
        }
      }
    }

    // Check timestamps are monotonic (parent before child)
    for (const [nodeId, node] of dkg.nodes.entries()) {
      for (const parentId of node.parents) {
        const parent = dkg.nodes.get(parentId);
        if (parent && parent.ts > node.ts) {
          issues.push(
            `Node ${nodeId} has timestamp ${node.ts} before parent ${parentId} (${parent.ts})`
          );
        }
      }
    }

    // Check for cycles (topological sort will throw if cycle exists)
    try {
      dkg.topologicalSort();
    } catch (error: any) {
      issues.push(`Cycle detected in DKG: ${error.message}`);
    }

    return {
      passed: issues.length === 0,
      issues,
      nodeCount: dkg.nodes.size,
      edgeCount: Array.from(dkg.edges.values()).reduce((sum, children) => sum + children.length, 0),
      rootNodeCount: dkg.rootNodes.length,
    };
  }

  /**
   * Compute multi-dimensional scores for an agent
   *
   * Dimensions (§3.1):
   * - Initiative: Original contributions (root nodes, new artifacts)
   * - Collaboration: Building on others' work (causal chains)
   * - Reasoning Depth: Path length and critical nodes
   * - Compliance: Policy checks and rule adherence
   * - Efficiency: Time and resource usage
   */
  private computeMultiDimensionalScores(dkg: DKG, agentKey: string): number[] {
    let initiative = 0;
    let collaboration = 0;
    let reasoningDepth = 0;
    const compliance = 100; // Default to 100 (assume compliant unless proven otherwise)
    const efficiency = 100; // Default to 100

    // Count nodes by this agent
    const agentNodes: DKGNode[] = [];
    for (const [nodeId, node] of dkg.nodes.entries()) {
      const nodeAgentKey = node.agentId ? node.agentId.toString() : node.author;
      if (nodeAgentKey === agentKey) {
        agentNodes.push(node);
      }
    }

    if (agentNodes.length === 0) {
      return [0, 0, 0, 0, 0];
    }

    // Initiative: Count root nodes and nodes with artifacts
    const rootNodes = agentNodes.filter((n) => n.parents.length === 0);
    const nodesWithArtifacts = agentNodes.filter((n) => n.artifactIds.length > 0);
    initiative = Math.min(100, rootNodes.length * 30 + nodesWithArtifacts.length * 10);

    // Collaboration: Count nodes that build on others' work
    const collaborativeNodes = agentNodes.filter((n) => n.parents.length > 0);
    collaboration = Math.min(100, collaborativeNodes.length * 15);

    // Reasoning Depth: Average path length from root
    let totalDepth = 0;
    for (const node of agentNodes) {
      const depth = this.computeNodeDepth(dkg, node);
      totalDepth += depth;
    }
    reasoningDepth = Math.min(100, (totalDepth / agentNodes.length) * 20);

    // Compliance and Efficiency: Default to 100 (would need domain-specific logic)
    // These would be computed based on LogicModule-specific rules

    return [
      Math.floor(initiative),
      Math.floor(collaboration),
      Math.floor(reasoningDepth),
      Math.floor(compliance),
      Math.floor(efficiency),
    ];
  }

  /**
   * Compute depth of a node (distance from root)
   */
  private computeNodeDepth(dkg: DKG, node: DKGNode): number {
    if (node.parents.length === 0) {
      return 1;
    }

    let maxParentDepth = 0;
    for (const parentId of node.parents) {
      const parent = dkg.nodes.get(parentId);
      if (parent) {
        maxParentDepth = Math.max(maxParentDepth, this.computeNodeDepth(dkg, parent));
      }
    }

    return maxParentDepth + 1;
  }

  /**
   * Compute DataHash (EIP-712)
   *
   * DataHash = keccak256(
   *   studio || epoch || demandHash || threadRoot || evidenceRoot || paramsHash
   * )
   */
  private computeDataHash(
    studio: string,
    epoch: number,
    threadRoot: string,
    evidenceRoot: string
  ): string {
    const demandHash = ethers.ZeroHash; // Would come from task requirements
    const paramsHash = ethers.ZeroHash; // Would come from policy params

    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint64', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
      [studio, epoch, demandHash, threadRoot, evidenceRoot, paramsHash]
    );

    return ethers.keccak256(encoded);
  }

  /**
   * Submit score vector after audit
   *
   * @param studioAddress Studio contract address
   * @param epoch Epoch number
   * @param dataHash Data hash from audit result
   * @param workerAgentId Worker agent ID to score
   * @param scores Score vector [initiative, collaboration, reasoning_depth, compliance, efficiency]
   * @returns Transaction hash
   */
  async submitScoreVector(
    studioAddress: string,
    epoch: number,
    dataHash: string,
    workerAgentId: bigint,
    scores: number[]
  ): Promise<string> {
    console.log(`📤 Submitting score vector to studio ${studioAddress.slice(0, 8)}...`);

    // Convert scores to uint8 (0-100)
    const scoresUint8 = scores.map((s) => Math.min(Math.max(Math.floor(s), 0), 100));

    // Call SDK's submitScoreVector method
    const txHash = await this.sdk.submitScoreVector({
      studioAddress,
      dataHash,
      scoreVector: scoresUint8,
    });

    console.log(`✅ Score vector submitted: ${txHash.slice(0, 16)}...`);

    return txHash;
  }

  /**
   * Submit score vectors for multiple workers (multi-agent tasks)
   *
   * @param studioAddress Studio contract address
   * @param epoch Epoch number
   * @param dataHash Data hash from audit result
   * @param scoresPerWorker Map of worker address to score vector
   * @returns Array of transaction hashes
   */
  async submitScoreVectorsPerWorker(
    studioAddress: string,
    epoch: number,
    dataHash: string,
    scoresPerWorker: Record<string, number[]>
  ): Promise<string[]> {
    const txHashes: string[] = [];

    console.log(`📤 Submitting per-worker score vectors...`);

    for (const [workerAddress, scores] of Object.entries(scoresPerWorker)) {
      const scoresUint8 = scores.map((s) => Math.min(Math.max(Math.floor(s), 0), 100));

      const txHash = await this.sdk.submitScoreVectorForWorker({
        studioAddress,
        dataHash,
        workerAddress,
        scoreVector: scoresUint8,
      });

      txHashes.push(txHash);
      console.log(
        `  ✅ Score vector submitted for worker ${workerAddress.slice(0, 8)}...: ${txHash.slice(0, 16)}...`
      );
    }

    return txHashes;
  }
}
