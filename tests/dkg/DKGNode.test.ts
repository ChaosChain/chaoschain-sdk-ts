import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { DKGNode } from '../../src/dkg/DKGNode';

describe('DKGNode', () => {
  const sampleNode = {
    author: '0x1234567890123456789012345678901234567890',
    sig: '0x' + 'a'.repeat(130),
    ts: Date.now(),
    xmtpMsgId: 'msg_123',
    artifactIds: ['QmHash1', 'QmHash2'],
    payloadHash: ethers.keccak256(ethers.toUtf8Bytes('test payload')),
    parents: ['msg_001', 'msg_002'],
  };

  it('should create a DKG node', () => {
    const node = new DKGNode(sampleNode);

    expect(node.author).toBe(sampleNode.author);
    expect(node.xmtpMsgId).toBe(sampleNode.xmtpMsgId);
    expect(node.artifactIds).toEqual(sampleNode.artifactIds);
    expect(node.parents).toEqual(sampleNode.parents);
  });

  it('should compute canonical hash', () => {
    const node = new DKGNode(sampleNode);
    const hash = node.computeCanonicalHash();

    expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Hash should be deterministic
    const hash2 = node.computeCanonicalHash();
    expect(hash).toBe(hash2);
  });

  it('should sort parents for deterministic hashing', () => {
    const node1 = new DKGNode({
      ...sampleNode,
      parents: ['msg_002', 'msg_001'],
    });

    const node2 = new DKGNode({
      ...sampleNode,
      parents: ['msg_001', 'msg_002'],
    });

    // Same parents in different order should produce same hash
    expect(node1.computeCanonicalHash()).toBe(node2.computeCanonicalHash());
  });

  it('should convert to dictionary', () => {
    const node = new DKGNode({
      ...sampleNode,
      agentId: 123n,
      content: 'test content',
      nodeType: 'message',
    });

    const dict = node.toDict();

    expect(dict.author).toBe(sampleNode.author);
    expect(dict.xmtp_msg_id).toBe(sampleNode.xmtpMsgId);
    expect(dict.artifact_ids).toEqual(sampleNode.artifactIds);
    expect(dict.parents).toEqual(sampleNode.parents);
    expect(dict.agent_id).toBe('123');
    expect(dict.content).toBe('test content');
    expect(dict.node_type).toBe('message');
  });

  it('should create from dictionary', () => {
    const dict = {
      author: sampleNode.author,
      sig: sampleNode.sig,
      ts: sampleNode.ts,
      xmtp_msg_id: sampleNode.xmtpMsgId,
      artifact_ids: sampleNode.artifactIds,
      payload_hash: sampleNode.payloadHash,
      parents: sampleNode.parents,
      agent_id: '123',
      content: 'test',
      node_type: 'message',
    };

    const node = DKGNode.fromDict(dict);

    expect(node.author).toBe(sampleNode.author);
    expect(node.xmtpMsgId).toBe(sampleNode.xmtpMsgId);
    expect(node.agentId).toBe(123n);
    expect(node.content).toBe('test');
  });
});
