import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChaosChainSDK } from '../src/ChaosChainSDK';
import { XMTPManager } from '../src/XMTPClient';
import { NetworkConfig } from '../src/types';

describe('XMTPManager', () => {
  let sdk: ChaosChainSDK;
  let xmtp: XMTPManager;

  beforeEach(() => {
    sdk = new ChaosChainSDK({
      agentName: 'TestAgent',
      agentDomain: 'test.example.com',
      agentRole: 'server',
      network: NetworkConfig.ETHEREUM_SEPOLIA,
      privateKey: '0x' + '1'.repeat(64),
    });

    xmtp = sdk.xmtp();
  });

  it('should initialize XMTPManager', () => {
    expect(xmtp).toBeInstanceOf(XMTPManager);
  });

  it('should send message and create DKG node', async () => {
    const { messageId, dkgNode } = await xmtp.sendMessage(
      '0x' + '2'.repeat(40),
      { text: 'Hello' },
      []
    );

    expect(messageId).toBeDefined();
    expect(messageId).toMatch(/^msg_/);
    expect(dkgNode).toBeDefined();
    expect(dkgNode.xmtpMsgId).toBe(messageId);
  });

  it('should create causal links with parent messages', async () => {
    const { messageId: parentId } = await xmtp.sendMessage(
      '0x' + '2'.repeat(40),
      { text: 'Parent' },
      []
    );

    const { messageId: childId, dkgNode } = await xmtp.sendMessage(
      '0x' + '2'.repeat(40),
      { text: 'Child' },
      [parentId]
    );

    expect(dkgNode.parents).toContain(parentId);
  });

  it('should get thread', () => {
    const thread = xmtp.getThread('0x' + '2'.repeat(40));

    expect(thread).toBeDefined();
    expect(thread.threadId).toBeDefined();
    expect(Array.isArray(thread.messages)).toBe(true);
    expect(Array.isArray(thread.nodes)).toBe(true);
  });

  it('should compute thread root', () => {
    const thread = xmtp.getThread();

    expect(thread.threadRoot).toBeDefined();
    expect(thread.threadRoot).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });
});
