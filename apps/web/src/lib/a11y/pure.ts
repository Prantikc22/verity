import type { AxeLikeResult, ScanDiff } from "./index";

export interface A11yPage { url: string; axe: AxeLikeResult }
export interface A11yPayload { commit_sha: string; branch: string; pr_number?: number | null; pages: A11yPage[] }
export interface A11yPageResult { url: string; score: number; scanId: string; diff: ScanDiff; baseline: boolean }
export interface A11yResult { failed: boolean; pages: A11yPageResult[] }

export function isA11yPayload(v: unknown): v is A11yPayload {
  const p = v as A11yPayload;
  return !!p && typeof p.commit_sha === "string" && typeof p.branch === "string" && Array.isArray(p.pages) && p.pages.length > 0
    && p.pages.every((x) => x && typeof x.url === "string" && typeof x.axe === "object" && x.axe !== null);
}

/** Accessibility limits: every new plan includes Lumen; pre-2.0 accessibility plans are grandfathered. */
export interface A11yLimits { maxPagesPerScan: number; maxScanHistory: number; prGating: boolean; mergeBlocking: boolean }

const LEGACY: Record<string, A11yLimits> = {
  free: { maxPagesPerScan: 1, maxScanHistory: 3, prGating: false, mergeBlocking: false },
  starter: { maxPagesPerScan: 25, maxScanHistory: 30, prGating: true, mergeBlocking: false },
  growth: { maxPagesPerScan: 100, maxScanHistory: 100, prGating: true, mergeBlocking: true },
  scale: { maxPagesPerScan: 500, maxScanHistory: 365, prGating: true, mergeBlocking: true },
  enterprise: { maxPagesPerScan: 100000, maxScanHistory: 100000, prGating: true, mergeBlocking: true },
};

export function a11yLimitsFor(gates: { prGating: boolean; mergeBlocking: boolean; maxProjects: number }, legacyTier?: string | null): A11yLimits {
  const fromPlan: A11yLimits = {
    maxPagesPerScan: gates.maxProjects >= 20 ? 250 : gates.maxProjects >= 5 ? 100 : gates.maxProjects >= 2 ? 25 : 5,
    maxScanHistory: gates.maxProjects >= 20 ? 365 : gates.maxProjects >= 5 ? 100 : 30,
    prGating: gates.prGating,
    mergeBlocking: gates.mergeBlocking,
  };
  const legacy = legacyTier ? LEGACY[legacyTier] : undefined;
  if (!legacy) return fromPlan;
  return {
    maxPagesPerScan: Math.max(fromPlan.maxPagesPerScan, legacy.maxPagesPerScan),
    maxScanHistory: Math.max(fromPlan.maxScanHistory, legacy.maxScanHistory),
    prGating: fromPlan.prGating || legacy.prGating,
    mergeBlocking: fromPlan.mergeBlocking || legacy.mergeBlocking,
  };
}

export const MARKER = "<!-- qashift-a11y-report -->";

export function buildA11ySummary(result: A11yResult, appUrl: string, projectId: string): string {
  const rows = result.pages.map((p) => {
    const d = p.diff.counts;
    const state = p.baseline ? "baseline" : d.new || d.worsened ? "regressed" : "ok";
    return `| ${p.url} | ${Math.round(p.score)} | ${p.baseline ? "—" : d.new} | ${p.baseline ? "—" : d.worsened} | ${p.baseline ? "—" : d.fixed} | ${state} |`;
  });
  const newRules = result.pages.flatMap((p) => p.diff.new.map((r) => `- \`${r.ruleId}\` (${r.impact ?? "unknown"}) on ${p.url}`)).slice(0, 15);
  return [
    MARKER,
    `## ♿ QAShift · Accessibility${result.failed ? " — regression" : ""}`,
    "",
    "| Page | Score | New | Worse | Fixed | |",
    "|---|---|---|---|---|---|",
    ...rows,
    ...(newRules.length ? ["", "**New issues**", ...newRules] : []),
    "",
    `[Open in QAShift](${appUrl.replace(/\/$/, "")}/dashboard/projects/${projectId}/accessibility)`,
    "",
    "<sub>Posted by <b>QAShift</b> · Lumen, the Accessibility Agent</sub>",
  ].join("\n");
}

