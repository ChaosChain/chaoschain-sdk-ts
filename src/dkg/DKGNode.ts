/**
 * DKG Node - Decentralized Knowledge Graph Node
 *
 * Implements Protocol Spec v0.1 §1.1 - Graph Structure
 * Each node represents an event/message from an agent with causal links.
 */

import { ethers } from 'ethers';

/**
 * DKG Node structure (Protocol Spec §1.1)
 *
 * Represents a node in the Decentralized Knowledge Graph.
 * Each message becomes a DKG node with causal links.
 */
export class DKGNode {
  author: string; // Agent address
  sig: string; // Cryptographic signature over node contents
  ts: number; // Unix timestamp in milliseconds
  xmtpMsgId: string; // Message ID (local UUID in MVP mode)
  artifactIds: string[]; // Array of artifact CIDs (IPFS/Arweave)
  payloadHash: string; // keccak256 hash of the payload (hex string)
  parents: string[]; // Parent message IDs (for causal DAG)
  vlc?: string; // Verifiable Logical Clock value (§1.3)
  agentId?: bigint; // ERC-8004 Agent ID (if registered)

  // Additional metadata
  content?: string; // Message content (for analysis)
  nodeType?: string; // message, artifact, result, etc.
  metadata?: Record<string, any>;

  constructor(data: {
    author: string;
    sig: string;
    ts: number;
    xmtpMsgId: string;
    artifactIds: string[];
    payloadHash: string;
    parents: string[];
    vlc?: string;
    agentId?: bigint;
    content?: string;
    nodeType?: string;
    metadata?: Record<string, any>;
  }) {
    this.author = data.author;
    this.sig = data.sig;
    this.ts = data.ts;
    this.xmtpMsgId = data.xmtpMsgId;
    this.artifactIds = data.artifactIds;
    this.payloadHash = data.payloadHash;
    this.parents = data.parents;
    this.vlc = data.vlc;
    this.agentId = data.agentId;
    this.content = data.content;
    this.nodeType = data.nodeType || 'message';
    this.metadata = data.metadata || {};
  }

  /**
   * Compute canonical hash for this node (§1.2)
   *
   * Canon(v) = keccak256(author || ts || xmtp_msg_id || payload_hash || parents[])
   *
   * @returns 32-byte hash as hex string
   */
  computeCanonicalHash(): string {
    // Sort parents for determinism
    const sortedParents = [...this.parents].sort();

    // Canonical representation
    const canonical = [
      this.author,
      this.ts.toString(),
      this.xmtpMsgId,
      this.payloadHash,
      sortedParents.join('|'),
    ].join('|');

    return ethers.keccak256(ethers.toUtf8Bytes(canonical));
  }

  /**
   * Convert to dictionary for serialization
   */
  toDict(): Record<string, any> {
    return {
      author: this.author,
      sig: this.sig,
      ts: this.ts,
      xmtp_msg_id: this.xmtpMsgId,
      artifact_ids: this.artifactIds,
      payload_hash: this.payloadHash,
      parents: this.parents,
      vlc: this.vlc,
      agent_id: this.agentId ? this.agentId.toString() : undefined,
      content: this.content,
      node_type: this.nodeType,
      metadata: this.metadata,
    };
  }

  /**
   * Create from dictionary
   */
  static fromDict(data: Record<string, any>): DKGNode {
    return new DKGNode({
      author: data.author,
      sig: data.sig,
      ts: data.ts,
      xmtpMsgId: data.xmtp_msg_id || data.xmtpMsgId,
      artifactIds: data.artifact_ids || data.artifactIds || [],
      payloadHash: data.payload_hash || data.payloadHash,
      parents: data.parents || [],
      vlc: data.vlc,
      agentId: data.agent_id ? BigInt(data.agent_id) : undefined,
      content: data.content,
      nodeType: data.node_type || data.nodeType,
      metadata: data.metadata,
    });
  }
}
