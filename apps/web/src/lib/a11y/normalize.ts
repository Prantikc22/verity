import type {
  AxeLikeResult,
  AxeNode,
  Impact,
  NormalizedIssue,
  NormalizedScan,
} from "./types";

const IMPACT_WEIGHT: Record<Impact, number> = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 1,
};

const VALID_IMPACTS: Impact[] = ["minor", "moderate", "serious", "critical"];

function coerceImpact(value?: string | null): Impact | null {
  if (value && (VALID_IMPACTS as string[]).includes(value)) {
    return value as Impact;
  }
  return null;
}

function targetToSelector(target?: (string | string[])[]): string {
  if (!target || target.length === 0) return "";
  const first = target[0];
  return Array.isArray(first) ? first.join(" ") : String(first);
}

function mapNodes(nodes: AxeNode[] = []) {
  return nodes.map((n) => ({
    selector: targetToSelector(n.target),
    html: (n.html ?? "").slice(0, 2000),
    failureSummary: n.failureSummary,
  }));
}

/**
 * Accessibility score, 0..100.
 *
 * Deliberately computed from impact-weighted *rule* counts (not per-node
 * counts) so the score is stable across runs even when page content shifts
 * the number of affected nodes. Rounded to an integer to avoid float jitter.
 */
export function computeScore(issues: NormalizedIssue[]): number {
  let penalty = 0;
  for (const issue of issues) {
    penalty += issue.impact ? IMPACT_WEIGHT[issue.impact] : 1;
  }
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export interface NormalizeOptions {
  url: string;
  overlayVendors?: string[];
  scannedAt?: string;
}

/** Convert a raw axe-core result into Clearpath's canonical NormalizedScan. */
export function normalizeAxe(
  axe: AxeLikeResult,
  opts: NormalizeOptions,
): NormalizedScan {
  const issues: NormalizedIssue[] = (axe.violations ?? []).map((v) => ({
    ruleId: v.id,
    impact: coerceImpact(v.impact),
    description: v.description ?? "",
    help: v.help ?? "",
    helpUrl: v.helpUrl ?? "",
    wcagTags: (v.tags ?? []).filter(
      (t) => t.startsWith("wcag") || t.startsWith("best-practice"),
    ),
    nodeCount: v.nodes?.length ?? 0,
    nodes: mapNodes(v.nodes),
  }));

  const impactCounts: Record<Impact, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const issue of issues) {
    if (issue.impact) impactCounts[issue.impact] += 1;
  }

  const engine = axe.testEngine?.version
    ? `${axe.testEngine.name ?? "axe-core"}@${axe.testEngine.version}`
    : "axe-core";

  return {
    summary: {
      url: opts.url,
      engine,
      score: computeScore(issues),
      violationsCount: issues.length,
      passesCount: axe.passes?.length ?? 0,
      incompleteCount: axe.incomplete?.length ?? 0,
      impact: impactCounts,
      overlayVendors: opts.overlayVendors ?? [],
      scannedAt: opts.scannedAt ?? new Date().toISOString(),
    },
    issues,
  };
}
