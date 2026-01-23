import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { DKG } from '../../src/dkg/DKG';
import { DKGNode } from '../../src/dkg/DKGNode';

describe('DKG', () => {
  const createNode = (id: string, parents: string[] = [], author = '0xAuthor'): DKGNode => {
    return new DKGNode({
      author,
      sig: '0x' + 'a'.repeat(130),
      ts: Date.now(),
      xmtpMsgId: id,
      artifactIds: [],
      payloadHash: ethers.keccak256(ethers.toUtf8Bytes(`payload_${id}`)),
      parents,
    });
  };

  it('should add nodes to DKG', () => {
    const dkg = new DKG();
    const node1 = createNode('node1');
    const node2 = createNode('node2', ['node1']);

    dkg.addNode(node1);
    dkg.addNode(node2);

    expect(dkg.nodes.size).toBe(2);
    expect(dkg.getNode('node1')).toBe(node1);
    expect(dkg.getNode('node2')).toBe(node2);
  });

  it('should track root nodes', () => {
    const dkg = new DKG();
    const root = createNode('root');
    const child = createNode('child', ['root']);

    dkg.addNode(root);
    dkg.addNode(child);

    expect(dkg.rootNodes).toContain('root');
    expect(dkg.rootNodes).not.toContain('child');
  });

  it('should build edges correctly', () => {
    const dkg = new DKG();
    const parent = createNode('parent');
    const child1 = createNode('child1', ['parent']);
    const child2 = createNode('child2', ['parent']);

    dkg.addNode(parent);
    dkg.addNode(child1);
    dkg.addNode(child2);

    const children = dkg.getChildren('parent');
    expect(children).toContain('child1');
    expect(children).toContain('child2');
    expect(children.length).toBe(2);
  });

  it('should topologically sort nodes', () => {
    const dkg = new DKG();
    const root = createNode('root');
    const mid = createNode('mid', ['root']);
    const leaf = createNode('leaf', ['mid']);

    dkg.addNode(root);
    dkg.addNode(mid);
    dkg.addNode(leaf);

    const sorted = dkg.topologicalSort();

    // Root should come before mid, mid before leaf
    const rootIdx = sorted.findIndex((n) => n.xmtpMsgId === 'root');
    const midIdx = sorted.findIndex((n) => n.xmtpMsgId === 'mid');
    const leafIdx = sorted.findIndex((n) => n.xmtpMsgId === 'leaf');

    expect(rootIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(leafIdx);
  });

  it('should detect cycles', () => {
    const dkg = new DKG();
    const node1 = createNode('node1', ['node2']);
    const node2 = createNode('node2', ['node1']);

    dkg.addNode(node1);
    dkg.addNode(node2);

    expect(() => dkg.topologicalSort()).toThrow('Cycle detected');
  });

  it('should trace causal chain', () => {
    const dkg = new DKG();
    const root = createNode('root');
    const mid = createNode('mid', ['root']);
    const leaf = createNode('leaf', ['mid']);

    dkg.addNode(root);
    dkg.addNode(mid);
    dkg.addNode(leaf);

    const chain = dkg.traceCausalChain('root', 'leaf');

    expect(chain.length).toBe(3);
    expect(chain[0].xmtpMsgId).toBe('root');
    expect(chain[1].xmtpMsgId).toBe('mid');
    expect(chain[2].xmtpMsgId).toBe('leaf');
  });

  it('should find critical nodes', () => {
    const dkg = new DKG();
    const root = createNode('root');
    const hub = createNode('hub', ['root']);
    const leaf1 = createNode('leaf1', ['hub']);
    const leaf2 = createNode('leaf2', ['hub']);
    const leaf3 = createNode('leaf3', ['hub']);

    dkg.addNode(root);
    dkg.addNode(hub);
    dkg.addNode(leaf1);
    dkg.addNode(leaf2);
    dkg.addNode(leaf3);

    const critical = dkg.findCriticalNodes(2);

    // Hub should be critical (has 3 descendants)
    expect(critical).toContain('hub');
  });

  it('should compute contribution weights', () => {
    const dkg = new DKG();
    const agent1 = '0xAgent1';
    const agent2 = '0xAgent2';

    const node1 = createNode('node1', [], agent1);
    const node2 = createNode('node2', ['node1'], agent2);
    const node3 = createNode('node3', ['node2'], agent1);

    dkg.addNode(node1);
    dkg.addNode(node2);
    dkg.addNode(node3);

    const weights = dkg.computeContributionWeights();

    expect(weights.has(agent1)).toBe(true);
    expect(weights.has(agent2)).toBe(true);

    // Weights should sum to approximately 1.0
    const total = Array.from(weights.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 2);
  });

  it('should compute thread root', () => {
    const dkg = new DKG();
    const root = createNode('root');
    const child = createNode('child', ['root']);

    dkg.addNode(root);
    dkg.addNode(child);

    const threadRoot = dkg.computeThreadRoot();

    expect(threadRoot).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Should be deterministic
    const threadRoot2 = dkg.computeThreadRoot();
    expect(threadRoot).toBe(threadRoot2);
  });

  it('should create from XMTP thread', () => {
    const messages = [
      {
        id: 'msg1',
        sender: '0xAgent1',
        recipient: '0xAgent2',
        content: { text: 'Hello' },
        timestamp: Date.now(),
        dkg_node: {
          author: '0xAgent1',
          sig: '0x' + 'a'.repeat(130),
          ts: Date.now(),
          xmtp_msg_id: 'msg1',
          artifact_ids: [],
          payload_hash: ethers.keccak256(ethers.toUtf8Bytes('Hello')),
          parents: [],
        },
      },
    ];

    const dkg = DKG.fromXMTPThread(messages);

    expect(dkg.nodes.size).toBe(1);
    // Check that node exists (it will be stored with xmtp_msg_id as key)
    const node = Array.from(dkg.nodes.values())[0];
    expect(node).toBeDefined();
    expect(node.xmtpMsgId).toBe('msg1');
  });

  it('should serialize and deserialize', () => {
    const dkg = new DKG();
    const node1 = createNode('node1');
    const node2 = createNode('node2', ['node1']);

    dkg.addNode(node1);
    dkg.addNode(node2);

    const dict = dkg.toDict();
    const restored = DKG.fromDict(dict);

    expect(restored.nodes.size).toBe(2);
    expect(restored.getNode('node1')).toBeDefined();
    expect(restored.getNode('node2')).toBeDefined();
  });
});
