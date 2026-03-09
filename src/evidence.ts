/**
 * Evidence DAG utilities for ChaosChain PoA scoring.
 *
 * These helpers operate on evidence graphs produced by the gateway's DKG engine.
 * Verifier agents use them to derive Proof-of-Agency scores from evidence structure.
 *
 * Architecture (3 layers per VA scoring spec):
 *
 *   Layer 1 — extractAgencySignals(evidence, context?)
 *             Deterministic signal extraction. 0..1 normalized.
 *             Same evidence + same policy = same signals.
 *
 *   Layer 2 — composeScoreVector(signals, assessment?)
 *             Verifier agent produces final score vector.
 *             Accepts 0..1 or 0..100 inputs, normalizes internally.
 *             Output: integer tuple [0..100] × 5 for on-chain submission.
 *
 *   Layer 3 — Contract aggregation (outside SDK)
 *             Median / MAD / stake-weighted consensus over verifier vectors.
 */

// =============================================================================
// Core Evidence Types
// =============================================================================

export interface EvidencePackage {
  arweave_tx_id: string;
  author: string;
  timestamp: number;
  parent_ids: string[];
  payload_hash: string;
  artifact_ids: string[];
  signature: string;
}

/** @deprecated Use WorkVerificationResult instead */
export interface WorkEvidenceVerificationResult {
  valid: boolean;
  scores: number[];
}

export interface WorkVerificationResult {
  valid: boolean;
  signals?: AgencySignals;
}

/**
 * Verifier assessment for production scoring.
 * Compliance and efficiency are REQUIRED — verifier agents must provide them.
 * Values can be in 0..1 (normalized) or 0..100 (integer); the SDK
 * auto-detects and normalizes internally.
 */
export type VerifierAssessment = {
  complianceScore: number;
  efficiencyScore: number;
  initiativeScore?: number;
  collaborationScore?: number;
  reasoningScore?: number;
  rationale?: string;
};

/**
 * Relaxed assessment for demo/test use only.
 * All fields optional — missing compliance/efficiency fall back to signals or 0.
 */
export type DemoAssessment = {
  initiativeScore?: number;
  collaborationScore?: number;
  reasoningScore?: number;
  complianceScore?: number;
  efficiencyScore?: number;
};

// =============================================================================
// Agency Signals
// =============================================================================

/**
 * Deterministic agency signals extracted from an evidence DAG.
 *
 * Signals are normalized to [0, 1]. The `observed` block carries raw graph
 * features so verifier agents can apply their own judgment on top.
 */
export type AgencySignals = {
  initiativeSignal: number;
  collaborationSignal: number;
  reasoningSignal: number;
  complianceSignal?: number;
  efficiencySignal?: number;

  observed: {
    totalNodes: number;
    rootCount: number;
    edgeCount: number;
    maxDepth: number;
    artifactCount: number;
    terminalCount: number;
    integrationNodeCount: number;
    uniqueAuthors?: number;
    testsPresent?: boolean;
    policyViolations?: string[];
    requiredArtifactsPresent?: string[];
    missingArtifacts?: string[];
    durationMs?: number;
    fragmentationPenalty?: number;
    overcomplexityPenalty?: number;
  };
};

// =============================================================================
// Policy & Mandate Types (Phase 2)
// =============================================================================

export type ScoreRange = {
  min: number;
  target: number;
  max: number;
};

export type EngineeringStudioPolicy = {
  version: string;
  studioName: string;

  scoring: {
    initiative: {
      rootRatio: ScoreRange;
    };

    collaboration: {
      edgeDensity: ScoreRange;
      integrationRatio: ScoreRange;
      weights: {
        edgeDensity: number;
        integrationRatio: number;
      };
    };

    reasoning: {
      depthRatio: ScoreRange;
    };

    compliance: {
      requiredChecks: string[];
      forbiddenPatterns: string[];
      requiredArtifacts: string[];
      weights: {
        testsPresent: number;
        requiredArtifactsPresent: number;
        noPolicyViolations: number;
      };
    };

    efficiency: {
      durationRatio?: ScoreRange;
      artifactCountRatio?: ScoreRange;
      weights: {
        durationRatio?: number;
        artifactCountRatio?: number;
      };
    };
  };

  verifierInstructions: {
    initiative: string;
    collaboration: string;
    reasoning: string;
    compliance: string;
    efficiency: string;
  };
};

export type WorkMandate = {
  taskId: string;
  title: string;
  objective: string;

  taskType: 'bugfix' | 'feature' | 'refactor' | 'review' | 'research';

  constraints?: {
    mustPassTests?: boolean;
    requiredArtifacts?: string[];
    forbiddenPatterns?: string[];
    latencyBudgetMs?: number;
    targetFiles?: string[];
  };

  overrides?: Partial<EngineeringStudioPolicy['scoring']>;

  verifierPrompt?: string;
};

/**
 * Optional context passed to extractAgencySignals for policy-conditioned scoring.
 */
export type SignalExtractionContext = {
  studioPolicy?: EngineeringStudioPolicy;
  workMandate?: WorkMandate;
};

// =============================================================================
// rangeFit
// =============================================================================

/**
 * Maps a value to [0, 1] based on a (min, target, max) range.
 *
 * - value <= min or value >= max → 0
 * - value === target → 1
 * - value between min and target → linear interpolation 0..1
 * - value between target and max → linear interpolation 1..0
 *
 * Result is clamped to [0, 1].
 */
export function rangeFit(value: number, min: number, target: number, max: number): number {
  if (value <= min || value >= max) return 0;
  if (value === target) return 1;
  if (value < target) {
    return Math.max(0, Math.min(1, (value - min) / (target - min)));
  }
  return Math.max(0, Math.min(1, (max - value) / (max - target)));
}

// =============================================================================
// Internal: merge policy with mandate overrides
// =============================================================================

function resolveScoring(
  policy?: EngineeringStudioPolicy,
  mandate?: WorkMandate,
): EngineeringStudioPolicy['scoring'] | undefined {
  if (!policy) return undefined;
  if (!mandate?.overrides) return policy.scoring;

  const base = policy.scoring;
  const ov = mandate.overrides;

  return {
    initiative: ov.initiative ?? base.initiative,
    collaboration: ov.collaboration ?? base.collaboration,
    reasoning: ov.reasoning ?? base.reasoning,
    compliance: ov.compliance ?? base.compliance,
    efficiency: ov.efficiency ?? base.efficiency,
  };
}

// =============================================================================
// Internal: compute observed features from evidence
// =============================================================================

function computeObserved(evidence: EvidencePackage[]) {
  const totalNodes = evidence.length;

  const byId = new Map<string, EvidencePackage>();
  const childrenOf = new Map<string, string[]>();
  for (const e of evidence) {
    byId.set(e.arweave_tx_id, e);
    childrenOf.set(e.arweave_tx_id, []);
  }

  let edgeCount = 0;
  let rootCount = 0;
  let artifactCount = 0;

  for (const e of evidence) {
    edgeCount += e.parent_ids.length;
    if (e.parent_ids.length === 0) rootCount++;
    if (e.artifact_ids.length > 0) artifactCount++;

    for (const pid of e.parent_ids) {
      const c = childrenOf.get(pid);
      if (c) c.push(e.arweave_tx_id);
    }
  }

  // Build root-origin map: for each node, which root nodes are its ancestors?
  // A root node's origin set is just itself.
  const rootOrigins = new Map<string, Set<string>>();

  function getRootOrigins(id: string): Set<string> {
    if (rootOrigins.has(id)) return rootOrigins.get(id)!;
    const node = byId.get(id);
    if (!node || node.parent_ids.length === 0) {
      const s = new Set([id]);
      rootOrigins.set(id, s);
      return s;
    }
    const origins = new Set<string>();
    for (const pid of node.parent_ids) {
      for (const r of getRootOrigins(pid)) origins.add(r);
    }
    rootOrigins.set(id, origins);
    return origins;
  }

  for (const e of evidence) getRootOrigins(e.arweave_tx_id);

  // Only count integration nodes when parents originate from different roots
  let integrationNodeCount = 0;
  for (const e of evidence) {
    if (e.parent_ids.length < 2) continue;
    const parentRootSets = e.parent_ids
      .filter(pid => byId.has(pid))
      .map(pid => rootOrigins.get(pid)!);
    const uniqueRoots = new Set<string>();
    for (const s of parentRootSets) {
      for (const r of s) uniqueRoots.add(r);
    }
    if (uniqueRoots.size >= 2) integrationNodeCount++;
  }

  let terminalCount = 0;
  for (const [, children] of childrenOf) {
    if (children.length === 0) terminalCount++;
  }

  const uniqueAuthors = new Set(evidence.map(e => e.author)).size;

  const timestamps = evidence.map(e => e.timestamp).filter(t => t > 0);
  const durationMs = timestamps.length >= 2
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : undefined;

  const maxDepth = computeDepth(evidence);

  return {
    totalNodes,
    rootCount,
    edgeCount,
    maxDepth,
    artifactCount,
    terminalCount,
    integrationNodeCount,
    uniqueAuthors,
    durationMs,
  };
}

// =============================================================================
// Internal: compliance signal from policy
// =============================================================================

function computeComplianceSignal(
  evidence: EvidencePackage[],
  _observed: ReturnType<typeof computeObserved>,
  scoring: EngineeringStudioPolicy['scoring'],
  mandate?: WorkMandate,
): { signal: number; testsPresent: boolean; violations: string[]; present: string[]; missing: string[] } {
  const compliance = scoring.compliance;

  const allArtifacts = new Set<string>();
  for (const e of evidence) {
    for (const a of e.artifact_ids) allArtifacts.add(a);
  }

  const testPatterns = ['test', 'spec', '.test.', '.spec.', '__test__', '__spec__'];
  const testsPresent = [...allArtifacts].some(a => {
    const lower = a.toLowerCase();
    return testPatterns.some(p => lower.includes(p));
  });

  const requiredArtifacts = [
    ...(compliance.requiredArtifacts ?? []),
    ...(mandate?.constraints?.requiredArtifacts ?? []),
  ];
  const present: string[] = [];
  const missing: string[] = [];
  for (const req of requiredArtifacts) {
    const found = [...allArtifacts].some(a => a.toLowerCase().includes(req.toLowerCase()));
    if (found) present.push(req);
    else missing.push(req);
  }

  const forbiddenPatterns = [
    ...(compliance.forbiddenPatterns ?? []),
    ...(mandate?.constraints?.forbiddenPatterns ?? []),
  ];
  const violations: string[] = [];
  for (const pattern of forbiddenPatterns) {
    const lower = pattern.toLowerCase();
    if ([...allArtifacts].some(a => a.toLowerCase().includes(lower))) {
      violations.push(`forbidden pattern found: ${pattern}`);
    }
  }

  if (mandate?.constraints?.mustPassTests && !testsPresent) {
    violations.push('mandate requires tests but none detected');
  }

  const w = compliance.weights;
  const totalWeight = (w.testsPresent ?? 0) + (w.requiredArtifactsPresent ?? 0) + (w.noPolicyViolations ?? 0);

  if (totalWeight === 0) {
    return { signal: testsPresent ? 1 : 0, testsPresent, violations, present, missing };
  }

  const testsScore = testsPresent ? 1 : 0;
  const artifactScore = requiredArtifacts.length > 0 ? present.length / requiredArtifacts.length : 1;
  const violationScore = violations.length === 0 ? 1 : 0;

  const signal = Math.max(0, Math.min(1,
    (w.testsPresent * testsScore +
     w.requiredArtifactsPresent * artifactScore +
     w.noPolicyViolations * violationScore) / totalWeight,
  ));

  return { signal, testsPresent, violations, present, missing };
}

// =============================================================================
// Internal: efficiency signal from policy
// =============================================================================

function computeEfficiencySignal(
  observed: ReturnType<typeof computeObserved>,
  scoring: EngineeringStudioPolicy['scoring'],
  mandate?: WorkMandate,
): number | undefined {
  const eff = scoring.efficiency;
  const w = eff.weights;

  let totalWeight = 0;
  let weightedSum = 0;

  if (eff.durationRatio && w.durationRatio && observed.durationMs !== undefined) {
    const latencyBudget = mandate?.constraints?.latencyBudgetMs;
    if (latencyBudget && latencyBudget > 0) {
      const ratio = observed.durationMs / latencyBudget;
      weightedSum += w.durationRatio * rangeFit(ratio, eff.durationRatio.min, eff.durationRatio.target, eff.durationRatio.max);
      totalWeight += w.durationRatio;
    }
  }

  if (eff.artifactCountRatio && w.artifactCountRatio && observed.totalNodes > 0) {
    const ratio = observed.artifactCount / observed.totalNodes;
    weightedSum += w.artifactCountRatio * rangeFit(ratio, eff.artifactCountRatio.min, eff.artifactCountRatio.target, eff.artifactCountRatio.max);
    totalWeight += w.artifactCountRatio;
  }

  if (totalWeight === 0) return undefined;
  return Math.max(0, Math.min(1, weightedSum / totalWeight));
}

// =============================================================================
// extractAgencySignals
// =============================================================================

/**
 * Deterministic agency signal extraction from an evidence DAG.
 *
 * Without context: produces raw structural ratio signals (Phase 1 baseline).
 * With studioPolicy/workMandate: produces policy-conditioned signals via
 * rangeFit, including deterministic compliance and efficiency (Phase 2).
 *
 * Same evidence + same context always produces the same signals.
 */
export function extractAgencySignals(
  evidence: EvidencePackage[],
  context?: SignalExtractionContext,
): AgencySignals {
  const totalNodes = evidence.length;

  if (totalNodes === 0) {
    return {
      initiativeSignal: 0,
      collaborationSignal: 0,
      reasoningSignal: 0,
      observed: {
        totalNodes: 0,
        rootCount: 0,
        edgeCount: 0,
        maxDepth: 0,
        artifactCount: 0,
        terminalCount: 0,
        integrationNodeCount: 0,
      },
    };
  }

  const observed = computeObserved(evidence);

  // Raw structural ratios
  const rootRatio = observed.rootCount / totalNodes;
  const edgeDensity = observed.edgeCount / Math.max(totalNodes - 1, 1);
  const integrationRatio = observed.integrationNodeCount / totalNodes;
  const depthRatio = observed.maxDepth / totalNodes;

  const scoring = resolveScoring(context?.studioPolicy, context?.workMandate);

  let initiativeSignal: number;
  let collaborationSignal: number;
  let reasoningSignal: number;
  let complianceSignal: number | undefined;
  let efficiencySignal: number | undefined;

  const observedBlock: AgencySignals['observed'] = {
    totalNodes,
    rootCount: observed.rootCount,
    edgeCount: observed.edgeCount,
    maxDepth: observed.maxDepth,
    artifactCount: observed.artifactCount,
    terminalCount: observed.terminalCount,
    integrationNodeCount: observed.integrationNodeCount,
    uniqueAuthors: observed.uniqueAuthors,
    durationMs: observed.durationMs,
  };

  if (!scoring) {
    // No-policy fallback: soft-cap at 0.9 so raw ratios never auto-saturate.
    // A perfect 1.0 should only be achievable via policy-fit scoring.
    const SOFT_CAP = 0.9;
    initiativeSignal = Math.max(0, Math.min(SOFT_CAP, rootRatio));
    collaborationSignal = Math.max(0, Math.min(SOFT_CAP, edgeDensity));
    reasoningSignal = Math.max(0, Math.min(SOFT_CAP, depthRatio));
  } else {
    // Phase 2: policy-conditioned signals via rangeFit
    const ir = scoring.initiative.rootRatio;
    const initiativeBase = rangeFit(rootRatio, ir.min, ir.target, ir.max);

    const cw = scoring.collaboration.weights;
    const ed = scoring.collaboration.edgeDensity;
    const intR = scoring.collaboration.integrationRatio;
    const collabWeightSum = (cw.edgeDensity || 0) + (cw.integrationRatio || 0);
    if (collabWeightSum > 0) {
      collaborationSignal =
        (cw.edgeDensity * rangeFit(edgeDensity, ed.min, ed.target, ed.max) +
         cw.integrationRatio * rangeFit(integrationRatio, intR.min, intR.target, intR.max))
        / collabWeightSum;
    } else {
      collaborationSignal = 0;
    }
    collaborationSignal = Math.max(0, Math.min(1, collaborationSignal));

    const dr = scoring.reasoning.depthRatio;
    const reasoningBase = rangeFit(depthRatio, dr.min, dr.target, dr.max);

    // Phase 3B: Anti-gaming penalties
    const fragmentationPenalty =
      rootRatio > ir.max
        ? (rootRatio - ir.max) * 0.5
        : 0;

    const overcomplexityPenalty =
      depthRatio > dr.max
        ? (depthRatio - dr.max) * 0.5
        : 0;

    initiativeSignal = Math.max(0, Math.min(1, initiativeBase - fragmentationPenalty));
    reasoningSignal = Math.max(0, Math.min(1, reasoningBase - overcomplexityPenalty));

    observedBlock.fragmentationPenalty = fragmentationPenalty;
    observedBlock.overcomplexityPenalty = overcomplexityPenalty;

    // Deterministic compliance
    const compResult = computeComplianceSignal(evidence, observed, scoring, context?.workMandate);
    complianceSignal = compResult.signal;
    observedBlock.testsPresent = compResult.testsPresent;
    observedBlock.policyViolations = compResult.violations;
    observedBlock.requiredArtifactsPresent = compResult.present;
    observedBlock.missingArtifacts = compResult.missing;

    // Deterministic efficiency
    efficiencySignal = computeEfficiencySignal(observed, scoring, context?.workMandate);
  }

  return {
    initiativeSignal,
    collaborationSignal,
    reasoningSignal,
    complianceSignal,
    efficiencySignal,
    observed: observedBlock,
  };
}

// =============================================================================
// computeDepth
// =============================================================================

/**
 * Returns the maximum causal depth of the evidence DAG.
 * A single-node graph has depth 1. A linear chain of N nodes has depth N.
 */
export function computeDepth(evidence: EvidencePackage[]): number {
  if (evidence.length === 0) return 0;

  const byId = new Map<string, EvidencePackage>();
  for (const e of evidence) byId.set(e.arweave_tx_id, e);

  const memo = new Map<string, number>();

  function dfs(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    const node = byId.get(id);
    if (!node || node.parent_ids.length === 0) {
      memo.set(id, 1);
      return 1;
    }
    let maxParent = 0;
    for (const pid of node.parent_ids) {
      maxParent = Math.max(maxParent, dfs(pid));
    }
    const depth = maxParent + 1;
    memo.set(id, depth);
    return depth;
  }

  let maxDepth = 0;
  for (const e of evidence) {
    maxDepth = Math.max(maxDepth, dfs(e.arweave_tx_id));
  }
  return maxDepth;
}

// =============================================================================
// composeScoreVector
// =============================================================================

/**
 * Normalizes a verifier-provided value to [0, 1].
 * Accepts either 0..1 (float) or 0..100 (integer) range.
 * Heuristic: values > 1 are treated as 0..100 scale.
 */
function normalizeInput(value: number): number {
  const v = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, v));
}

const CLAMP_100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Internal: resolve an optional override against a signal fallback.
 */
function resolveDimension(
  override: number | undefined,
  signal: number | undefined,
): number {
  if (override !== undefined) return normalizeInput(override);
  return signal ?? 0;
}

/**
 * Production score vector composition for verifier agents.
 *
 * Compliance and efficiency are REQUIRED — verifier agents must explicitly
 * provide these based on their judgment + deterministic signals. Throws if
 * either is missing.
 *
 * Initiative, collaboration, and reasoning default to deterministic signals
 * unless the verifier provides overrides.
 *
 * Input values can be in 0..1 or 0..100; the SDK auto-detects.
 * Output is always integer tuple [0..100] × 5 ready for contract submission.
 */
export function composeScoreVector(
  signals: AgencySignals,
  assessment: VerifierAssessment,
): [number, number, number, number, number] {
  if (assessment.complianceScore === undefined || assessment.complianceScore === null) {
    throw new Error('complianceScore is required for production scoring');
  }
  if (assessment.efficiencyScore === undefined || assessment.efficiencyScore === null) {
    throw new Error('efficiencyScore is required for production scoring');
  }

  return [
    CLAMP_100(resolveDimension(assessment.initiativeScore, signals.initiativeSignal) * 100),
    CLAMP_100(resolveDimension(assessment.collaborationScore, signals.collaborationSignal) * 100),
    CLAMP_100(resolveDimension(assessment.reasoningScore, signals.reasoningSignal) * 100),
    CLAMP_100(normalizeInput(assessment.complianceScore) * 100),
    CLAMP_100(normalizeInput(assessment.efficiencyScore) * 100),
  ];
}

/**
 * Demo/test score vector composition — all fields optional.
 *
 * Falls back to deterministic signals (or 0) for any missing dimension.
 * Use this for demo scripts and testing only — production verifier agents
 * must use composeScoreVector() which enforces compliance/efficiency.
 */
export function composeScoreVectorWithDefaults(
  signals: AgencySignals,
  assessment?: DemoAssessment,
): [number, number, number, number, number] {
  return [
    CLAMP_100(resolveDimension(assessment?.initiativeScore, signals.initiativeSignal) * 100),
    CLAMP_100(resolveDimension(assessment?.collaborationScore, signals.collaborationSignal) * 100),
    CLAMP_100(resolveDimension(assessment?.reasoningScore, signals.reasoningSignal) * 100),
    CLAMP_100(resolveDimension(assessment?.complianceScore, signals.complianceSignal) * 100),
    CLAMP_100(resolveDimension(assessment?.efficiencyScore, signals.efficiencySignal) * 100),
  ];
}

// =============================================================================
// derivePoAScores
// =============================================================================

/**
 * @deprecated
 * Demo helper for quick scoring without verifier judgment.
 * Verifier agents should use verifyWorkEvidence() + composeScoreVector().
 *
 * Convenience wrapper: extract signals + compose score vector in one call.
 * Returns [Initiative, Collaboration, Reasoning, Compliance, Efficiency]
 * as integers 0..100 for on-chain submission.
 * Uses composeScoreVectorWithDefaults internally — compliance and efficiency
 * fall back to signals or 0 when not provided.
 */
export function derivePoAScores(
  evidence: EvidencePackage[],
  options?: { compliance?: number; efficiency?: number },
): [number, number, number, number, number] {
  if (evidence.length === 0) {
    return [0, 0, 0,
      CLAMP_100(options?.compliance !== undefined ? normalizeInput(options.compliance) * 100 : 0),
      CLAMP_100(options?.efficiency !== undefined ? normalizeInput(options.efficiency) * 100 : 0),
    ];
  }

  const signals = extractAgencySignals(evidence);

  return composeScoreVectorWithDefaults(signals, {
    complianceScore: options?.compliance,
    efficiencyScore: options?.efficiency,
  });
}

// =============================================================================
// validateEvidenceGraph
// =============================================================================

/**
 * Validates that the evidence forms a valid DAG:
 * - No cycles
 * - All parent_ids reference existing nodes
 */
export function validateEvidenceGraph(evidence: EvidencePackage[]): boolean {
  const ids = new Set(evidence.map(e => e.arweave_tx_id));

  for (const e of evidence) {
    for (const pid of e.parent_ids) {
      if (!ids.has(pid)) return false;
    }
  }

  // Cycle detection via topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const e of evidence) {
    if (!inDegree.has(e.arweave_tx_id)) inDegree.set(e.arweave_tx_id, 0);
    if (!children.has(e.arweave_tx_id)) children.set(e.arweave_tx_id, []);
  }

  for (const e of evidence) {
    for (const pid of e.parent_ids) {
      inDegree.set(e.arweave_tx_id, (inDegree.get(e.arweave_tx_id) ?? 0) + 1);
      const c = children.get(pid) ?? [];
      c.push(e.arweave_tx_id);
      children.set(pid, c);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    visited++;
    for (const child of children.get(node) ?? []) {
      const newDeg = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, newDeg);
      if (newDeg === 0) queue.push(child);
    }
  }

  return visited === evidence.length;
}

/**
 * High-level verifier helper:
 * 1) validates evidence graph integrity
 * 2) extracts deterministic agency signals (optionally policy-conditioned)
 *
 * Returns { valid, signals } — the verifier then uses composeScoreVector()
 * to produce the final on-chain score vector.
 */
export function verifyWorkEvidence(
  evidence: EvidencePackage[],
  context?: SignalExtractionContext,
): WorkVerificationResult {
  const valid = validateEvidenceGraph(evidence);
  if (!valid) {
    return { valid: false };
  }
  const signals = extractAgencySignals(evidence, context);
  return { valid: true, signals };
}
