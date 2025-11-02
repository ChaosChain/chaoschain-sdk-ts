# 💰 Merchant Guide: x402 Paywall Server

This guide shows you how to set up a payment-protected API using the ChaosChain TypeScript SDK with x402 and your facilitator.

---

## 📋 Table of Contents

1. [Quick Start (Express)](#quick-start-express)
2. [Using Built-in X402Server](#using-built-in-x402server)
3. [Manual Implementation](#manual-implementation)
4. [Testing Your Paywall](#testing-your-paywall)
5. [Production Deployment](#production-deployment)

---

## 🚀 Quick Start (Express)

### Installation

```bash
npm install @chaoschain/sdk express
```

### Basic Setup

```typescript
import express from 'express';
import { ethers } from 'ethers';
import { X402PaymentManager, WalletManager } from '@chaoschain/sdk';

const app = express();
app.use(express.json());

// 1. Initialize wallet
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://sepolia.base.org');
const walletManager = new WalletManager(
  { privateKey: process.env.MERCHANT_PRIVATE_KEY },
  provider
);

// 2. Initialize X402 Payment Manager with YOUR facilitator
const paymentManager = new X402PaymentManager(
  walletManager.getWallet(),
  'base-sepolia',
  {
    facilitatorUrl: process.env.FACILITATOR_URL || 'https://facilitator.chaoscha.in',
    apiKey: process.env.CC_API_KEY, // Optional: for premium features
    mode: 'managed',
    agentId: process.env.AGENT_ID // Optional: for Proof-of-Agency tracking
  }
);

// 3. Protected endpoint
app.get('/api/service', async (req, res) => {
  const xPaymentHeader = req.headers['x-payment'] as string;

  if (!xPaymentHeader) {
    // No payment - return 402 with payment requirements
    const requirements = paymentManager.createPaymentRequirements(
      1.00, // 1 USDC
      'USDC',
      'AI Analysis Service',
      '/api/service'
    );

    return res.status(402).json({
      x402Version: 1,
      accepts: [{
        scheme: requirements.scheme,
        network: requirements.network,
        asset: requirements.asset
      }],
      paymentRequirements: requirements
    });
  }

  // Verify payment with facilitator
  try {
    const paymentHeader = JSON.parse(
      Buffer.from(xPaymentHeader, 'base64').toString('utf-8')
    );

    // Call facilitator to verify
    const verifyResponse = await fetch(`${process.env.FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 1,
        paymentHeader,
        paymentRequirements: paymentManager.createPaymentRequirements(
          1.00,
          'USDC',
          'AI Analysis Service',
          '/api/service'
        )
      })
    });

    const verifyData = await verifyResponse.json();

    if (!verifyData.isValid) {
      return res.status(402).json({ error: 'Invalid payment' });
    }

    // Payment verified! Return the service
    res.json({
      result: 'AI analysis complete',
      data: { /* your service response */ }
    });

  } catch (error) {
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

app.listen(3000, () => {
  console.log('💰 Paywall server running on port 3000');
});
```

---

## 🔒 Using Built-in X402Server

The SDK includes a ready-to-use `X402Server` class that handles everything for you:

```typescript
import { ethers } from 'ethers';
import { X402PaymentManager, X402Server, WalletManager } from '@chaoschain/sdk';

async function main() {
  // 1. Initialize wallet
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  const walletManager = new WalletManager(
    { privateKey: process.env.MERCHANT_PRIVATE_KEY },
    provider
  );

  // 2. Initialize X402 Payment Manager
  const paymentManager = new X402PaymentManager(
    walletManager.getWallet(),
    'base-sepolia',
    {
      facilitatorUrl: 'http://localhost:8402', // Your facilitator!
      mode: 'managed'
    }
  );

  // 3. Create X402 Server
  const server = new X402Server(paymentManager, {
    port: 3000,
    host: '0.0.0.0',
    defaultCurrency: 'USDC'
  });

  // 4. Register protected endpoints
  server.requirePayment(1.00, 'AI Analysis Service', 'USDC')(
    async function aiAnalysis(data: any) {
      // Your service logic here
      return {
        result: 'Analysis complete',
        data: { /* your analysis results */ }
      };
    }
  );

  server.requirePayment(0.50, 'Image Generation', 'USDC')(
    async function imageGeneration(data: any) {
      return {
        result: 'Image generated',
        imageUrl: 'https://example.com/image.png'
      };
    }
  );

  // 5. Start server
  server.start();

  console.log('✅ X402 Paywall Server is running!');
  console.log('   Facilitator: http://localhost:8402');
  console.log('   Merchant wallet:', walletManager.getAddress());
}

main().catch(console.error);
```

**Benefits:**
- ✅ Automatic HTTP 402 responses
- ✅ Built-in payment verification
- ✅ Facilitator integration
- ✅ Payment caching
- ✅ Per-endpoint pricing

---

## 🔧 Manual Implementation

For more control, implement x402 manually:

```typescript
import express from 'express';
import { ethers } from 'ethers';
import { X402PaymentManager, WalletManager } from '@chaoschain/sdk';

const app = express();
app.use(express.json());

// Initialize
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const walletManager = new WalletManager(
  { privateKey: process.env.MERCHANT_PRIVATE_KEY },
  provider
);

const paymentManager = new X402PaymentManager(
  walletManager.getWallet(),
  'base-sepolia',
  {
    facilitatorUrl: 'http://localhost:8402',
    mode: 'managed'
  }
);

// Middleware: Check for payment
async function requirePayment(amount: number, description: string) {
  return async (req: any, res: any, next: any) => {
    const xPaymentHeader = req.headers['x-payment'];

    if (!xPaymentHeader) {
      // Return 402 with payment requirements
      const requirements = paymentManager.createPaymentRequirements(
        amount,
        'USDC',
        description,
        req.path
      );

      return res.status(402)
        .header('X-PAYMENT', '') // Indicate x402 support
        .json({
          x402Version: 1,
          accepts: [{
            scheme: requirements.scheme,
            network: requirements.network,
            asset: requirements.asset
          }],
          paymentRequirements: requirements
        });
    }

    // Verify payment
    try {
      const paymentHeader = JSON.parse(
        Buffer.from(xPaymentHeader, 'base64').toString('utf-8')
      );

      const requirements = paymentManager.createPaymentRequirements(
        amount,
        'USDC',
        description,
        req.path
      );

      // Verify with facilitator
      const verifyResponse = await fetch(`${process.env.FACILITATOR_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x402Version: 1,
          paymentHeader,
          paymentRequirements: requirements
        })
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.isValid) {
        return res.status(402).json({ error: 'Invalid payment', reason: verifyData.invalidReason });
      }

      // Store payment info for this request
      req.payment = verifyData;
      next();

    } catch (error: any) {
      res.status(500).json({ error: 'Payment verification failed', message: error.message });
    }
  };
}

// Use the middleware
app.get('/api/analyze', requirePayment(1.00, 'AI Analysis'), async (req, res) => {
  // Payment verified - provide service
  res.json({
    result: 'Analysis complete',
    payment: req.payment // Payment details from facilitator
  });
});

app.get('/api/generate-image', requirePayment(0.50, 'Image Generation'), async (req, res) => {
  res.json({
    result: 'Image generated',
    imageUrl: 'https://example.com/image.png'
  });
});

app.listen(3000);
```

---

## 🧪 Testing Your Paywall

### 1. Start Your Facilitator

```bash
cd /path/to/chaoschain-x402/http-bridge
npm start
```

### 2. Start Your Merchant Server

```bash
MERCHANT_PRIVATE_KEY=0x... \
FACILITATOR_URL=http://localhost:8402 \
npm start
```

### 3. Test Without Payment (Should Return 402)

```bash
curl http://localhost:3000/api/service
```

**Expected Response:**
```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  }],
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1000000",
    "resource": "/api/service",
    "description": "AI Analysis Service",
    "payTo": "0xYourWalletAddress...",
    "maxTimeoutSeconds": 60,
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "extra": {
      "name": "USD Coin",
      "version": "2"
    }
  }
}
```

### 4. Test With Payment (Using SDK as Client)

```typescript
import { X402PaymentManager, WalletManager } from '@chaoschain/sdk';
import { ethers } from 'ethers';

// Client setup
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const clientWallet = new WalletManager({ privateKey: process.env.CLIENT_PRIVATE_KEY }, provider);

const clientPaymentManager = new X402PaymentManager(
  clientWallet.getWallet(),
  'base-sepolia',
  {
    facilitatorUrl: 'http://localhost:8402',
    mode: 'managed'
  }
);

// 1. Get payment requirements from merchant
const response402 = await fetch('http://localhost:3000/api/service');
const { paymentRequirements } = await response402.json();

// 2. Generate payment authorization
const nonce = ethers.hexlify(ethers.randomBytes(32));
const now = BigInt(Math.floor(Date.now() / 1000));

const authParams = {
  from: clientWallet.getAddress(),
  to: paymentRequirements.payTo,
  value: BigInt(paymentRequirements.maxAmountRequired),
  validAfter: now,
  validBefore: now + BigInt(3600),
  nonce
};

const signature = await clientPaymentManager.signTransferAuthorization(authParams);

// 3. Create payment header
const paymentHeader = {
  sender: clientWallet.getAddress(),
  nonce,
  validAfter: now.toString(),
  validBefore: (now + BigInt(3600)).toString(),
  signature
};

// 4. Make request with payment
const paidResponse = await fetch('http://localhost:3000/api/service', {
  headers: {
    'X-PAYMENT': Buffer.from(JSON.stringify(paymentHeader)).toString('base64')
  }
});

const result = await paidResponse.json();
console.log('✅ Service response:', result);
```

---

## 🚀 Production Deployment

### Environment Variables

```bash
# Merchant Configuration
MERCHANT_PRIVATE_KEY=0x...              # Your wallet private key
FACILITATOR_URL=https://facilitator.chaoscha.in  # Production facilitator
CC_API_KEY=your_api_key                 # Optional: for premium features
AGENT_ID=8004#123                       # Optional: your ERC-8004 agent ID

# Network Configuration
RPC_URL=https://sepolia.base.org        # For testnet
# RPC_URL=https://base.org              # For mainnet
NETWORK=base-sepolia                    # or 'base' for mainnet

# Server Configuration
PORT=3000
HOST=0.0.0.0
```

### Production Checklist

- [ ] Use environment variables for sensitive data
- [ ] Enable HTTPS/TLS
- [ ] Set up proper logging
- [ ] Implement rate limiting
- [ ] Add payment caching to prevent replay attacks
- [ ] Monitor facilitator health
- [ ] Set up alerts for failed payments
- [ ] Test on testnet first
- [ ] Ensure wallet has sufficient gas (for non-gasless operations)

### Security Best Practices

1. **Never expose private keys**
   ```typescript
   // ❌ Bad
   const privateKey = '0x123...';
   
   // ✅ Good
   const privateKey = process.env.MERCHANT_PRIVATE_KEY;
   ```

2. **Validate payment amounts**
   ```typescript
   if (verifyData.amount.base !== expectedAmount) {
     return res.status(402).json({ error: 'Incorrect payment amount' });
   }
   ```

3. **Implement idempotency**
   ```typescript
   const paymentCache = new Map();
   
   if (paymentCache.has(paymentHeader.nonce)) {
     return res.json({ error: 'Payment already processed' });
   }
   
   paymentCache.set(paymentHeader.nonce, verifyData);
   ```

4. **Use facilitator for verification**
   - ✅ Always verify payments through the facilitator
   - ❌ Never trust client-provided payment proofs without verification

---

## 📚 API Reference

### `createPaymentRequirements(amount, currency, description, resource?)`

Creates x402 payment requirements for your endpoint.

**Parameters:**
- `amount` (number): Payment amount (e.g., 1.00 for 1 USDC)
- `currency` (string): 'USDC' or 'ETH'
- `description` (string): Human-readable service description
- `resource` (string, optional): API endpoint path

**Returns:** `X402PaymentRequirements` object

**Example:**
```typescript
const requirements = paymentManager.createPaymentRequirements(
  1.00,
  'USDC',
  'AI Analysis Service',
  '/api/analyze'
);
```

---

## 🤝 Support

- **Documentation:** [ChaosChain Docs](https://docs.chaoscha.in)
- **GitHub:** [chaoschain-sdk-ts](https://github.com/ChaosChain/chaoschain-sdk-ts)
- **Discord:** [ChaosChain Community](https://discord.gg/chaoschain)
- **Facilitator:** [chaoschain-x402](https://github.com/ChaosChain/chaoschain-x402)

---

## 📄 License

MIT © ChaosChain Labs

