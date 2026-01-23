/**
 * Decentralized Knowledge Graph (DKG) for ChaosChain Protocol
 *
 * Implements Protocol Spec v0.1 §1 - Formal DKG & Causal Audit Model:
 * - §1.1: Graph Structure (DAG with nodes and edges)
 * - §1.2: Canonicalization (deterministic node hashing)
 * - §1.3: Verifiable Logical Clock (VLC)
 * - §1.4: DataHash commitment
 *
 * The DKG is the core data structure for:
 * 1. Causal audit - tracing cause-effect chains
 * 2. Multi-agent attribution - who contributed what
 * 3. Proof of Agency - measuring initiative, collaboration, reasoning depth
 */

import { ethers } from 'ethers';
import { DKGNode } from './DKGNode';

/**
 * DKG - Decentralized Knowledge Graph
 *
 * Represents a causal DAG of agent interactions.
 */
export class DKG {
  nodes: Map<string, DKGNode>; // nodeId => DKGNode
  edges: Map<string, string[]>; // nodeId => [childNodeIds]
  rootNodes: string[]; // Nodes with no parents

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.rootNodes = [];
  }

  /**
   * Add a node to the DKG
   */
  addNode(node: DKGNode, nodeId?: string): string {
    const id = nodeId || node.xmtpMsgId;
    this.nodes.set(id, node);

    // Build edges (parent -> child)
    for (const parentId of node.parents) {
      if (!this.edges.has(parentId)) {
        this.edges.set(parentId, []);
      }
      this.edges.get(parentId)!.push(id);
    }

    // Track root nodes (no parents)
    if (node.parents.length === 0) {
      if (!this.rootNodes.includes(id)) {
        this.rootNodes.push(id);
      }
    }

    return id;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): DKGNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get children of a node
   */
  getChildren(nodeId: string): string[] {
    return this.edges.get(nodeId) || [];
  }

  /**
   * Topologically sort nodes (for thread root calculation)
   *
   * Returns nodes in dependency order (parents before children)
   */
  topologicalSort(): DKGNode[] {
    const visited = new Set<string>();
    const result: DKGNode[] = [];
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        throw new Error(`Cycle detected in DKG at node ${nodeId}`);
      }
      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found`);
      }

      // Visit all parents first
      for (const parentId of node.parents) {
        visit(parentId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      result.push(node);
    };

    // Visit all nodes
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    return result;
  }

  /**
   * Trace causal chain from one node to another
   *
   * Returns path of nodes from fromNodeId to toNodeId (if path exists)
   */
  traceCausalChain(fromNodeId: string, toNodeId: string): DKGNode[] {
    if (!this.nodes.has(fromNodeId) || !this.nodes.has(toNodeId)) {
      return [];
    }

    // BFS to find path
    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: fromNodeId, path: [fromNodeId] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === toNodeId) {
        return path.map((id) => this.nodes.get(id)!).filter(Boolean);
      }

      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);

      const children = this.getChildren(nodeId);
      for (const childId of children) {
        if (!visited.has(childId)) {
          queue.push({ nodeId: childId, path: [...path, childId] });
        }
      }
    }

    return []; // No path found
  }

  /**
   * Find critical nodes (nodes that enabled downstream value)
   *
   * A critical node is one that has many descendants or is on many paths
   */
  findCriticalNodes(threshold: number = 3): string[] {
    const critical: string[] = [];

    for (const nodeId of this.nodes.keys()) {
      const descendants = this.countDescendants(nodeId);
      if (descendants >= threshold) {
        critical.push(nodeId);
      }
    }

    return critical.sort((a, b) => this.countDescendants(b) - this.countDescendants(a));
  }

  /**
   * Count descendants of a node
   */
  private countDescendants(nodeId: string): number {
    const visited = new Set<string>();

    const count = (id: string): number => {
      if (visited.has(id)) {
        return 0;
      }
      visited.add(id);

      const children = this.getChildren(id);
      let total = children.length;

      for (const childId of children) {
        total += count(childId);
      }

      return total;
    };

    return count(nodeId);
  }

  /**
   * Compute contribution weights using Shapley value approximation
   *
   * Returns Map<agentId, weight> where weights sum to 1.0
   */
  computeContributionWeights(): Map<string, number> {
    const agentContributions = new Map<string, number>();

    // Simple approximation: count nodes per agent, weight by criticality
    for (const [nodeId, node] of this.nodes.entries()) {
      const agentKey = node.agentId ? node.agentId.toString() : node.author;
      const current = agentContributions.get(agentKey) || 0;

      // Weight by number of descendants (critical nodes get more weight)
      const descendants = this.countDescendants(nodeId);
      const weight = 1 + descendants * 0.1; // Base weight + 0.1 per descendant

      agentContributions.set(agentKey, current + weight);
    }

    // Normalize to sum to 1.0
    const total = Array.from(agentContributions.values()).reduce((a, b) => a + b, 0);
    const weights = new Map<string, number>();

    for (const [agent, contribution] of agentContributions.entries()) {
      weights.set(agent, contribution / total);
    }

    return weights;
  }

  /**
   * Compute thread root (Merkle root of topologically sorted messages)
   *
   * Protocol Spec §1.2: Thread root is Merkle root over sorted DKG nodes
   */
  computeThreadRoot(): string {
    const sortedNodes = this.topologicalSort();

    if (sortedNodes.length === 0) {
      return ethers.ZeroHash;
    }

    // Build Merkle tree from sorted nodes
    const hashes = sortedNodes.map((node) => node.computeCanonicalHash());

    // Simple Merkle root (for 2^n leaves, use binary tree)
    // For simplicity, hash all hashes together (works for small graphs)
    if (hashes.length === 1) {
      return hashes[0];
    }

    // Pairwise hashing until one root remains
    let current = hashes;
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        if (i + 1 < current.length) {
          next.push(ethers.keccak256(ethers.concat([current[i], current[i + 1]])));
        } else {
          next.push(current[i]);
        }
      }
      current = next;
    }

    return current[0];
  }

  /**
   * Create DKG from XMTP thread and artifacts
   */
  static fromXMTPThread(
    messages: Array<Record<string, any>>,
    artifacts: Record<string, any> = {}
  ): DKG {
    const dkg = new DKG();

    for (const msg of messages) {
      // Handle both direct message format and dkg_node format
      const nodeData = msg.dkg_node || msg;
      const node = DKGNode.fromDict(nodeData);
      dkg.addNode(node);
    }

    return dkg;
  }

  /**
   * Convert to dictionary for serialization
   */
  toDict(): Record<string, any> {
    return {
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        ...node.toDict(),
      })),
      edges: Object.fromEntries(this.edges),
      rootNodes: this.rootNodes,
    };
  }

  /**
   * Create from dictionary
   */
  static fromDict(data: Record<string, any>): DKG {
    const dkg = new DKG();

    if (data.nodes) {
      for (const nodeData of data.nodes) {
        const node = DKGNode.fromDict(nodeData);
        dkg.addNode(node, nodeData.id);
      }
    }

    return dkg;
  }
}
