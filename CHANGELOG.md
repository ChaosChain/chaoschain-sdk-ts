# Changelog

All notable changes to the ChaosChain TypeScript SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.3] - 2026-03-24

### Added

- **`Session` read-only fields** (additive): `epoch`, `studioAddress`, `agentAddress`, `viewerUrl` — populated when the session is created from the gateway response
- **`SessionCompleteResult.epoch`** — epoch included on `complete()` result for convenience

## [0.3.2] - 2026-03-23

### Added

- **Subpath package exports** for edge/serverless: `@chaoschain/sdk/session` and `@chaoschain/sdk/gateway` (lightweight bundles; no ethers / IPFS / heavy Node deps in those entry points)
- **`src/gateway/index.ts`** — re-exports `GatewayClient`, selected gateway types, and gateway-related exceptions

### Changed

- **`src/types.ts`** — `import type` for `ethers` where only types are needed (no runtime change)

### Documentation

- README **Edge Runtime / Serverless Usage**: caveat that `GatewayClient.submitWork()` uses `Buffer`; read/poll APIs are safe on strict V8 isolates; binary `submitWork` needs Node compat or a Buffer polyfill

## [0.3.1] - 2026-03-22

### Added

- **Multi-agent sessions (per-event agent override)** on `Session.log()` and `Session.step()`:
  - Optional `agent: { agent_address, role? }` on `log()` — override applies to that event only
  - Optional third argument on `step()` for the same override
  - Types: `SessionAgentOverride`, `SessionAgentRole` (`worker` | `verifier` | `collaborator`), aligned with gateway validation
- Unit tests in `tests/Session.test.ts` for override paths and multi-agent sequences

### Changed

- **`scripts/test-session-e2e.ts`**: `OVERRIDE_AGENT_ADDRESS` is **optional**. Without it, the smoke test runs the original 4-event single-agent path (`node_count >= 4`). With it set, the script logs extra collaborator events and expects `node_count >= 7`.

### Fixed

- README **E2E Testing** section now documents required vs optional env vars and both smoke-test modes

## [0.3.0] - 2026-03-20

### Added

- **Session SDK** (`src/session/`): `SessionClient` and `Session` classes for Engineering Studio session ingestion
  - `session.start()` — Create a new coding session
  - `session.log()` — Log events with automatic parent chaining
  - `session.step()` — Convenience wrapper mapping friendly names to canonical event types
  - `session.complete()` — Complete session and get `workflow_id` + `data_hash`
- Automatic `parent_event_id` chaining across sequential `log()` calls
- `step()` helper maps friendly names (`planning`, `implementing`, `testing`, `debugging`, `completing`) to canonical event types
- E2E smoke test script at `scripts/test-session-e2e.ts` for validating against live gateway
- Session SDK accessible via `sdk.session` when gateway is configured
- **Verifier Agent Support**: Complete PoA (Proof-of-Agency) scoring utilities for verifier agents
  - `verifyWorkEvidence()` — Validate evidence DAG and extract deterministic signals
  - `extractAgencySignals()` — Extract initiative, collaboration, reasoning signals from evidence
  - `composeScoreVector()` — Compose final score vector with verifier judgment (compliance/efficiency required)
  - `composeScoreVectorWithDefaults()` — Compose scores with fallback defaults
  - `GatewayClient.getPendingWork()` — Discover pending work for a studio
  - `GatewayClient.getWorkEvidence()` — Fetch full evidence graph for work submission
  - Types: `AgencySignals`, `VerifierAssessment`, `WorkVerificationResult`, `EngineeringStudioPolicy`, `WorkMandate`
- **Verifier Integration Guide** documentation with complete step-by-step workflow

### Changed

- **Gateway is now always configured by default**: SDK automatically creates a `GatewayClient` pointing to `https://gateway.chaoscha.in` when no `gatewayConfig` or `gatewayUrl` is provided. This is a **breaking change** for code that expected `sdk.gateway` to be `null` when not explicitly configured.
- Gateway client initialization log now shows the resolved base URL
- Updated README with comprehensive verifier agent integration examples and 3-layer PoA scoring architecture

### Fixed

- `randomUUID()` now uses `node:crypto` import for Node.js compatibility
- **Treasury address correction**: Fixed incorrect treasury address for `base-sepolia` network in `X402PaymentManager` (changed from `0x8004AA63c570c570eBF15376c0dB199918BFe9Fb` to `0x20E7B2A2c8969725b88Dd3EF3a11Bc3353C83F70`)
- TypeScript unused parameter warning in `computeComplianceSignal()` (renamed `observed` to `_observed`)

## [0.2.0] - Unreleased

### Added

#### Gateway Integration
- **GatewayClient**: Full Gateway service integration for workflow orchestration
  - `healthCheck()`: Check Gateway service health
  - `submitWork()`: Submit work with evidence and multi-agent attribution
  - `submitScore()`: Submit scores with commit-reveal or direct mode
  - `closeEpoch()`: Close epoch and trigger reward distribution
  - `getWorkflow()`: Get workflow status by ID
  - `listWorkflows()`: List workflows with filters
  - `waitForCompletion()`: Poll until workflow completes
- Gateway client accessible via `sdk.gateway`

#### Studio Client (Direct On-Chain Operations)
- **StudioClient**: Direct contract interaction for testing and low-level control
  - `createStudio()`: Create new Studio via ChaosCore contract
  - `registerWithStudio()`: Register agent with stake
  - `submitWork()`: Direct work submission (deprecated, use Gateway)
  - `submitWorkMultiAgent()`: Multi-agent work with contribution weights (deprecated, use Gateway)
  - `commitScore()`: Commit score hash (commit-reveal phase 1)
  - `revealScore()`: Reveal score (commit-reveal phase 2)
  - `submitScoreVector()`: Direct score submission
  - `submitScoreVectorForWorker()`: Per-worker score submission for multi-agent tasks
  - `closeEpoch()`: Close epoch via RewardsDistributor
  - `getPendingRewards()`: Check withdrawable balance
  - `withdrawRewards()`: Withdraw accumulated rewards
- Helper methods: `computeScoreCommitment()`, `encodeScoreVector()`, `generateSalt()`
- Studio client accessible via `sdk.studio`

#### Contract ABIs
- Added ChaosCore ABI for Studio creation
- Added StudioProxy ABI for agent registration, work submission, and scoring
- Added RewardsDistributor ABI for epoch management
- Added `submitScoreVector` and `submitScoreVectorForWorker` to StudioProxy ABI

#### SDK Integration
- Convenience methods on ChaosChainSDK:
  - `createStudio()`: Create new Studio
  - `registerWithStudio()`: Register with Studio
  - `getStudioPendingRewards()`: Check rewards
  - `withdrawStudioRewards()`: Withdraw rewards

#### Documentation
- Architecture diagram showing ChaosChain Protocol components
- ChaosChain Protocol section explaining Studios, Epochs, Workers, Verifiers
- Gateway Integration documentation with code examples
- Studio Client documentation with method tables
- Multi-agent work and per-worker scoring explanation
- Complete Studio workflow example
- Verifier agent example
- Updated FAQ with Gateway and Studio questions
- Added Gateway and Studio methods to API reference

#### Tests
- 18 new tests for StudioClient covering:
  - Validation (stake, weights, contract addresses)
  - Helper methods (commitment, encoding, salt generation)
  - Commit-reveal pattern integration
  - Deprecation warnings

### Changed

- Updated Reputation Registry ABI to Feb 2026 spec
- Refactored deprecated AgentRole aliases for type clarity
- Enhanced X402 payment requirements with Python SDK alignment
- Improved wallet type handling for HDNodeWallet
- Updated maximum timeout in X402 payment tests to 300 seconds
- Streamlined crypto and form data imports

### Fixed

- Agent ID caching for improved performance
- Type safety improvements for agent metadata retrieval

## [0.1.3] - Previous Release

- Initial ERC-8004 v1.0 implementation
- x402 payment integration with Coinbase protocol
- Pluggable storage providers (IPFS, Pinata, Irys)
- Multi-network support (Sepolia, Base Sepolia, Linea Sepolia, Hedera, 0G)

---

## Migration Guide: 0.1.x to 0.2.0

### Using the Gateway (Recommended for Production)

```typescript
// Before: Direct contract interaction (still available but deprecated)
await sdk.studio.submitWork(studioAddress, dataHash, threadRoot, evidenceRoot);

// After: Use Gateway for production workflows
const workflow = await sdk.gateway.submitWork({
  studioAddress,
  dataHash,
  threadRoot,
  evidenceRoot,
  participants: ['0xWorker1'],
  contributionWeights: [10000],
  evidenceCid: 'bafybei...',
});
```

### Multi-Agent Work Attribution

```typescript
// Submit work with multiple contributors
await sdk.gateway.submitWork({
  studioAddress,
  dataHash,
  threadRoot,
  evidenceRoot,
  participants: ['0xWorker1', '0xWorker2'],
  contributionWeights: [6000, 4000], // Must sum to 10000 (basis points)
  evidenceCid,
});
```

### Scoring with Commit-Reveal

```typescript
// Gateway handles commit-reveal automatically
await sdk.gateway.submitScore({
  studioAddress,
  dataHash,
  scores: [85, 90, 78, 92, 88], // 5-dimensional scores
  mode: 'COMMIT_REVEAL', // or 'DIRECT'
});
```
