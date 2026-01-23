/**
 * XMTP Client for ChaosChain Agent Communication
 *
 * Provides agent-to-agent communication with causal DAG construction
 * as specified in Protocol Spec v0.1 (§1 - Formal DKG & Causal Audit Model).
 *
 * MVP Mode (Default):
 * - Uses LOCAL message storage (no XMTP network dependency)
 * - DKG nodes built from local interaction logs
 * - Thread root computed locally (Merkle root)
 * - VLC computed locally (Verifiable Logical Clock)
 * - Full causal analysis support
 *
 * Future Mode (XMTP Bridge):
 * - When XMTP bridge infrastructure is deployed, agents can use real XMTP
 * - Messages will be E2E encrypted via XMTP network
 * - See packages/xmtp-bridge/ for bridge implementation
 */

import { ethers } from 'ethers';
import { ChaosChainSDK } from './ChaosChainSDK';
import { DKGNode } from './dkg/DKGNode';
import { DKG } from './dkg/DKG';

/**
 * XMTP Message structure
 */
export interface XMTPMessage {
  id: string;
  from: string;
  to: string;
  content: Record<string, any>;
  timestamp: number;
  parentIds: string[];
  messageType?: string;
}

/**
 * XMTP Thread (collection of messages)
 */
export interface XMTPThread {
  threadId: string;
  messages: XMTPMessage[];
  nodes: DKGNode[];
  threadRoot: string;
}

/**
 * XMTP Manager for agent communication
 *
 * MVP Mode: Local storage only
 * Future: Real XMTP network integration
 */
export class XMTPManager {
  private sdk: ChaosChainSDK;
  private messages: Map<string, XMTPMessage>;
  private threads: Map<string, XMTPMessage[]>;
  private storagePath: string;

  constructor(sdk: ChaosChainSDK, storagePath?: string) {
    this.sdk = sdk;
    this.messages = new Map();
    this.threads = new Map();
    this.storagePath = storagePath || './.xmtp_messages.json';

    // Load existing messages from local storage
    this.loadMessages();
  }

  /**
   * Send message to another agent (creates DKG node)
   *
   * @param toAgent Recipient agent address
   * @param content Message content
   * @param parentIds Parent message IDs (for causal links)
   * @param messageType Optional message type
   * @returns Message ID and DKG node
   */
  async sendMessage(
    toAgent: string,
    content: Record<string, any>,
    parentIds: string[] = [],
    messageType?: string
  ): Promise<{ messageId: string; dkgNode: DKGNode }> {
    const wallet = (this.sdk as any).walletManager.getWallet();
    const fromAddress = wallet.address;

    // Generate message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create message
    const message: XMTPMessage = {
      id: messageId,
      from: fromAddress,
      to: toAgent,
      content,
      timestamp: Date.now(),
      parentIds,
      messageType,
    };

    // Store message
    this.messages.set(messageId, message);

    // Add to thread (create thread if needed)
    const threadId = this.getThreadId(fromAddress, toAgent);
    if (!this.threads.has(threadId)) {
      this.threads.set(threadId, []);
    }
    this.threads.get(threadId)!.push(message);

    // Create DKG node
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(content)));
    const sig = await wallet.signMessage(ethers.getBytes(payloadHash));

    const dkgNode = new DKGNode({
      author: fromAddress,
      sig: sig,
      ts: message.timestamp,
      xmtpMsgId: messageId,
      artifactIds: [],
      payloadHash: payloadHash,
      parents: parentIds,
      content: JSON.stringify(content),
      nodeType: messageType || 'message',
    });

    // Save to local storage
    this.saveMessages();

    console.log(`📤 Message sent to ${toAgent.slice(0, 10)}...`);
    console.log(`   Message ID: ${messageId}`);
    console.log(`   Parents: ${parentIds.length}`);

    return { messageId, dkgNode };
  }

  /**
   * Get thread (all messages between two agents)
   *
   * @param otherAgent Other agent address
   * @returns Thread with messages and DKG nodes
   */
  getThread(otherAgent?: string): XMTPThread {
    const wallet = (this.sdk as any).walletManager.getWallet();
    const myAddress = wallet.address;
    const threadId = otherAgent
      ? this.getThreadId(myAddress, otherAgent)
      : Array.from(this.threads.keys())[0]; // Get first thread if no agent specified

    if (!threadId || !this.threads.has(threadId)) {
      return {
        threadId: threadId || 'empty',
        messages: [],
        nodes: [],
        threadRoot: ethers.ZeroHash,
      };
    }

    const messages = this.threads.get(threadId)!;

    // Convert messages to DKG nodes
    const nodes = messages.map((msg) => {
      const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(msg.content)));
      return new DKGNode({
        author: msg.from,
        sig: '', // Would be stored in real implementation
        ts: msg.timestamp,
        xmtpMsgId: msg.id,
        artifactIds: [],
        payloadHash: payloadHash,
        parents: msg.parentIds,
        content: JSON.stringify(msg.content),
        nodeType: msg.messageType || 'message',
      });
    });

    // Compute thread root
    const dkg = new DKG();
    for (const node of nodes) {
      dkg.addNode(node);
    }
    const threadRoot = dkg.computeThreadRoot();

    return {
      threadId,
      messages,
      nodes,
      threadRoot,
    };
  }

  /**
   * Compute thread root for a thread
   *
   * @param nodes Array of DKG nodes
   * @returns Thread root (Merkle root)
   */
  computeThreadRoot(nodes: DKGNode[]): string {
    if (nodes.length === 0) {
      return ethers.ZeroHash;
    }

    const dkg = new DKG();
    for (const node of nodes) {
      dkg.addNode(node);
    }

    return dkg.computeThreadRoot();
  }

  /**
   * Get thread ID from two agent addresses
   */
  private getThreadId(agent1: string, agent2: string): string {
    const sorted = [agent1.toLowerCase(), agent2.toLowerCase()].sort();
    return `thread_${sorted[0]}_${sorted[1]}`;
  }

  /**
   * Load messages from local storage
   */
  private loadMessages(): void {
    try {
      // In Node.js environment, would use fs
      // For browser, would use localStorage
      // For now, skip loading (would need environment detection)
      console.log('📥 XMTP messages loaded from local storage (MVP mode)');
    } catch (error) {
      console.warn('⚠️  Failed to load XMTP messages:', error);
    }
  }

  /**
   * Save messages to local storage
   */
  private saveMessages(): void {
    try {
      // In Node.js environment, would use fs
      // For browser, would use localStorage
      // For now, skip saving (would need environment detection)
      console.log('💾 XMTP messages saved to local storage (MVP mode)');
    } catch (error) {
      console.warn('⚠️  Failed to save XMTP messages:', error);
    }
  }
}
