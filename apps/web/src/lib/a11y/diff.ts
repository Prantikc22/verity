import type { Impact, NormalizedIssue } from "./types";

export interface RuleDelta {
  ruleId: string;
  impact: Impact | null;
  prevCount: number; // affected nodes in the previous scan
  currCount: number; // affected nodes in the current scan
}

export interface ScanDiff {
  /** Rules failing now that weren't before. */
  new: RuleDelta[];
  /** Rules that were failing and are now clean. */
  fixed: RuleDelta[];
  /** Rules still failing with MORE affected nodes than before. */
  worsened: RuleDelta[];
  /** Rules still failing, same-or-fewer nodes. */
  unchanged: RuleDelta[];
  counts: { new: number; fixed: number; worsened: number; unchanged: number };
}

function byRule(issues: NormalizedIssue[]): Map<string, NormalizedIssue> {
  const m = new Map<string, NormalizedIssue>();
  for (const i of issues) m.set(i.ruleId, i);
  return m;
}

/**
 * Per-deploy regression diff at the rule level. The headline of Clearpath:
 * what got worse since the last deploy, keyed off the prior scan of the same
 * page on the same branch. `prev` is null for a page's first-ever scan.
 */
export function diffScans(
  prev: NormalizedIssue[] | null,
  curr: NormalizedIssue[],
): ScanDiff {
  const prevMap = byRule(prev ?? []);
  const currMap = byRule(curr);

  const diff: ScanDiff = {
    new: [],
    fixed: [],
    worsened: [],
    unchanged: [],
    counts: { new: 0, fixed: 0, worsened: 0, unchanged: 0 },
  };

  for (const [ruleId, cur] of currMap) {
    const before = prevMap.get(ruleId);
    const delta: RuleDelta = {
      ruleId,
      impact: cur.impact,
      prevCount: before?.nodeCount ?? 0,
      currCount: cur.nodeCount,
    };
    if (!before) diff.new.push(delta);
    else if (cur.nodeCount > before.nodeCount) diff.worsened.push(delta);
    else diff.unchanged.push(delta);
  }

  for (const [ruleId, before] of prevMap) {
    if (!currMap.has(ruleId)) {
      diff.fixed.push({
        ruleId,
        impact: before.impact,
        prevCount: before.nodeCount,
        currCount: 0,
      });
    }
  }

  diff.counts = {
    new: diff.new.length,
    fixed: diff.fixed.length,
    worsened: diff.worsened.length,
    unchanged: diff.unchanged.length,
  };
  return diff;
}

/** Whether a diff should block a merge under a given policy. */
export type FailPolicy = "off" | "new" | "new_or_worsened";

export function shouldFail(diff: ScanDiff, policy: FailPolicy): boolean {
  if (policy === "off") return false;
  if (policy === "new") return diff.counts.new > 0;
  return diff.counts.new > 0 || diff.counts.worsened > 0;
}
