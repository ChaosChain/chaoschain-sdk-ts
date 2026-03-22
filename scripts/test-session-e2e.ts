/**
 * E2E smoke test — Session SDK against the live ChaosChain gateway.
 *
 * Required env: CHAOSCHAIN_API_KEY, STUDIO_ADDRESS, AGENT_ADDRESS
 * Optional: OVERRIDE_AGENT_ADDRESS — if unset, single-agent path (4 events, node_count >= 4).
 *           If set, adds 3 collaborator override events (node_count >= 7).
 *
 * Usage (single-agent):
 *   CHAOSCHAIN_API_KEY=cc_... STUDIO_ADDRESS=0x... AGENT_ADDRESS=0x... npx tsx scripts/test-session-e2e.ts
 *
 * Usage (multi-agent / per-event override):
 *   CHAOSCHAIN_API_KEY=cc_... STUDIO_ADDRESS=0x... AGENT_ADDRESS=0x... OVERRIDE_AGENT_ADDRESS=0x... npx tsx scripts/test-session-e2e.ts
 *
 * Optional: GATEWAY_URL (defaults to https://gateway.chaoscha.in)
 */

import axios from 'axios';
import { SessionClient } from '../src/session/SessionClient';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'https://gateway.chaoscha.in';

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

const required = ['CHAOSCHAIN_API_KEY', 'STUDIO_ADDRESS', 'AGENT_ADDRESS'] as const;
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Usage (single-agent, 4 events):');
  console.error(
    '  CHAOSCHAIN_API_KEY=cc_... STUDIO_ADDRESS=0x... AGENT_ADDRESS=0x... npx tsx scripts/test-session-e2e.ts',
  );
  console.error('Usage (multi-agent, +3 collaborator events):');
  console.error(
    '  CHAOSCHAIN_API_KEY=cc_... STUDIO_ADDRESS=0x... AGENT_ADDRESS=0x... OVERRIDE_AGENT_ADDRESS=0x... npx tsx scripts/test-session-e2e.ts',
  );
  process.exit(1);
}

const API_KEY = process.env.CHAOSCHAIN_API_KEY!;
const STUDIO = process.env.STUDIO_ADDRESS!;
const AGENT = process.env.AGENT_ADDRESS!;
const OVERRIDE_AGENT = process.env.OVERRIDE_AGENT_ADDRESS?.trim();
const multiAgentMode = Boolean(OVERRIDE_AGENT);
const minNodeCount = multiAgentMode ? 7 : 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = true;
let depth = 0;

function ok(step: number, msg: string) {
  console.log(`  [Step ${step}] OK — ${msg}`);
}

function fail(step: number, msg: string): never {
  console.error(`  [Step ${step}] FAIL — ${msg}`);
  passed = false;
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  console.log('=== ChaosChain Session SDK — E2E Smoke Test ===');
  console.log(`  Gateway:  ${GATEWAY_URL}`);
  console.log(`  Studio:   ${STUDIO}`);
  console.log(`  Agent:    ${AGENT}`);
  console.log(
    `  Mode:     ${multiAgentMode ? `multi-agent (OVERRIDE_AGENT=${OVERRIDE_AGENT!.slice(0, 10)}...)` : 'single-agent (no OVERRIDE_AGENT_ADDRESS)'}`,
  );
  console.log(`  Expect:   node_count >= ${minNodeCount}`);
  console.log();

  // Step 1 — Create SessionClient
  const client = new SessionClient({ gatewayUrl: GATEWAY_URL, apiKey: API_KEY });
  ok(1, 'SessionClient created');

  // Step 2 — Start session
  const session = await client.start({
    studio_address: STUDIO,
    agent_address: AGENT,
    task_type: 'bugfix',
    work_mandate_id: 'e2e-test-mandate',
  });
  ok(2, `Session created: ${session.sessionId}`);

  // Step 3 — Log 4 events in sequence (single-agent)
  await session.log({ summary: 'Received task: fix null pointer in auth middleware' });
  depth++;
  ok(3, `Event logged (parent chain depth: ${depth})`);

  await session.step('planning', 'Identified root cause: missing null check on user.token');
  depth++;
  ok(3, `Event logged (parent chain depth: ${depth})`);

  await session.step('implementing', 'Added null guard to validateToken function');
  depth++;
  ok(3, `Event logged (parent chain depth: ${depth})`);

  await session.step('testing', 'All 23 tests pass including new regression test');
  depth++;
  ok(3, `Event logged (parent chain depth: ${depth})`);

  // Step 3b — Agent override events (multi-agent in same session)
  if (multiAgentMode) {
    await session.log({
      summary: 'Code review: null guard looks correct, suggest adding logging',
      agent: { agent_address: OVERRIDE_AGENT!, role: 'collaborator' },
    });
    depth++;
    ok(3, `Event logged with agent override [${OVERRIDE_AGENT!.slice(0, 8)}...] role=collaborator (depth: ${depth})`);

    await session.step('implementing', 'Added structured logging per review feedback');
    depth++;
    ok(3, `Event logged with default agent [${AGENT.slice(0, 8)}...] (depth: ${depth})`);

    await session.log({
      summary: 'Re-review: logging addition approved, LGTM',
      event_type: 'artifact_created',
      agent: { agent_address: OVERRIDE_AGENT!, role: 'collaborator' },
    });
    depth++;
    ok(3, `Event logged with agent override [${OVERRIDE_AGENT!.slice(0, 8)}...] role=collaborator (depth: ${depth})`);
  }

  // Step 4 — Complete session
  const result = await session.complete({ summary: 'Bug fixed and tested' });
  ok(4, 'Session completed');
  if (result.workflow_id) {
    console.log(`         workflow_id: ${result.workflow_id}`);
  } else {
    console.log('         workflow_id: null (gateway workflow engine not configured)');
  }
  console.log(`         data_hash:   ${result.data_hash ?? 'null'}`);

  // Step 5 — Verify context endpoint
  const ctxUrl = `${GATEWAY_URL}/v1/sessions/${session.sessionId}/context`;
  const ctxHeaders: Record<string, string> = {};
  if (API_KEY) ctxHeaders['X-API-Key'] = API_KEY;

  const ctxRes = await axios.get(ctxUrl, { headers: ctxHeaders, timeout: 15_000 });
  const ctx = ctxRes.data?.data ?? ctxRes.data;

  const sessionMeta = ctx.session_metadata;
  if (!sessionMeta || sessionMeta.session_id !== session.sessionId) {
    fail(5, `session_id mismatch: expected ${session.sessionId}, got ${sessionMeta?.session_id}`);
  }

  const summary = ctx.evidence_summary;
  if (!summary) fail(5, 'evidence_summary missing from context response');
  if (summary.node_count < minNodeCount) {
    fail(
      5,
      `node_count too low: expected >= ${minNodeCount} (${multiAgentMode ? 'multi-agent' : 'single-agent'} mode), got ${summary.node_count}`,
    );
  }

  ok(5, `Evidence summary: node_count=${summary.node_count}, roots=${(summary.roots ?? []).length}, terminals=${(summary.terminals ?? []).length}`);

  // Step 6 — Verify viewer endpoint
  const viewerUrl = `${GATEWAY_URL}/v1/sessions/${session.sessionId}/viewer`;
  const viewerRes = await axios.get(viewerUrl, { timeout: 15_000, validateStatus: () => true });
  if (viewerRes.status !== 200) {
    fail(6, `Viewer returned HTTP ${viewerRes.status} (expected 200)`);
  }
  ok(6, `Session viewer: ${viewerUrl}`);

  // Step 7 — Final summary
  console.log();
  console.log('=== Summary ===');
  console.log(`  Session ID:    ${session.sessionId}`);
  console.log(`  Events logged: ${depth}`);
  console.log(`  node_count:    ${summary.node_count}`);
  console.log(`  workflow_id:   ${result.workflow_id ?? 'null'}`);
  console.log(`  data_hash:     ${result.data_hash ?? 'null'}`);
  console.log(`  Viewer URL:    ${viewerUrl}`);
  console.log();
  console.log(passed ? 'RESULT: PASS' : 'RESULT: FAIL');
  process.exit(passed ? 0 : 1);
})().catch((err) => {
  console.error();
  console.error('FATAL:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
