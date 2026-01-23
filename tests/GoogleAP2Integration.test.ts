import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleAP2Integration } from '../src/GoogleAP2Integration';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    default: {
      existsSync: vi.fn(),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      readFileSync: vi.fn(),
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    default: {
      join: vi.fn((...args) => args.join('/')),
    },
    join: vi.fn((...args) => args.join('/')),
  };
});

describe('GoogleAP2Integration', () => {
  let ap2: GoogleAP2Integration;

  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => {});
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.readFileSync).mockReturnValue('mock-key-content');

    ap2 = new GoogleAP2Integration('TestAgent', 'mock-private-key');
  });

  it('should initialize GoogleAP2Integration', () => {
    expect(ap2).toBeInstanceOf(GoogleAP2Integration);
  });

  it('should create intent mandate', () => {
    const result = ap2.createIntentMandate(
      'Buy 100 USDC worth of tokens',
      ['0xMerchant1'],
      ['SKU1'],
      true,
      60
    );

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.intent_mandate).toBeDefined();
  });

  it('should create cart mandate', async () => {
    const result = await ap2.createCartMandate(
      'cart-123',
      [{ name: 'Item 1', price: 10 }],
      10,
      'USD',
      'Test Merchant',
      15
    );

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.cart_mandate).toBeDefined();
  });

  it('should verify JWT token', async () => {
    // Mock JWT verification
    const result = await ap2.verifyJwtToken('mock.jwt.token');

    expect(result).toBeDefined();
  });
});
