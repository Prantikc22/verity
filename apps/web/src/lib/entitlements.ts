import { planFor, type PlanLimits, type PlanTier } from "@/lib/plans";
import {
  AUTONOMOUS, REPORTS, MANAGED, AGENTS, CREDIT_COSTS,
  isAutonomousKey, isReportsKey, isManagedKey,
  type AgentKey, type GateLimits,
} from "@/lib/catalog";

/**
 * One answer to "what can this org do?", merged from:
 *   - the legacy plan (orgs.plan, still written by the Razorpay webhook), and
 *   - the QAShift 2.0 plans (orgs.autonomous_plan / reports_plan / managed_plan).
 * For every limit the MORE GENEROUS value wins, so grandfathered customers
 * never lose anything and new customers get exactly their catalog plan.
 *
 * Accepts any org row; columns added by 0018 are optional so this works
 * before AND after that migration is applied (before: identical to planFor).
 */
export interface OrgPlanRow {
  plan?: PlanTier | null;
  autonomous_plan?: string | null;
  reports_plan?: string | null;
  managed_plan?: string | null;
  grandfathered?: boolean | null;
}

export interface Entitlements extends PlanLimits {
  /** Human label for the shell, e.g. "Growth · Reports Plus". */
  label: string;
  /** Every plan can use every agent. Kept as data so the UI never hardcodes it. */
  agents: AgentKey[];
  creditsPerMonth: number;
  reports: { resultsPerMonth: number; projects: number; historyDays: number } | null;
  managed: { name: string; engineerHours: number | null; namedLead: boolean } | null;
  grandfathered: boolean;
  /** Which sources contributed — useful for support and for the billing page. */
  sources: string[];
}

const NUM_KEYS = ["maxTests", "maxProjects", "testGensPerMonth", "cloudRunsPerMonth", "cloudTrialsPerMonth", "maxRunHistory"] as const;
const BOOL_KEYS = ["selfHealing", "prGating", "mergeBlocking", "predictionsGA", "predictionsBeta", "fde", "pomConversion"] as const;

function mergeGates(base: PlanLimits, extra: GateLimits): PlanLimits {
  const out = { ...base };
  for (const k of NUM_KEYS) out[k] = Math.max(base[k], extra[k]);
  for (const k of BOOL_KEYS) out[k] = base[k] || extra[k];
  return out;
}

export function entitlementsFor(org: OrgPlanRow | null | undefined): Entitlements {
  const legacy = planFor(org?.plan ?? "free");
  const autoKey = org?.autonomous_plan;
  const managedKey = org?.managed_plan;
  const reportsKey = org?.reports_plan;
  let gates: PlanLimits = { ...legacy };
  const sources: string[] = [];
  const labels: string[] = [];

  const hasNewPlan = isAutonomousKey(autoKey) || isManagedKey(managedKey);
  // A paid legacy plan, or no new plan at all, keeps the legacy label/source.
  if (legacy.tier !== "free" || !hasNewPlan) { sources.push(`legacy:${legacy.tier}`); labels.push(legacy.name); }

  let credits = 0;
  if (isAutonomousKey(autoKey)) {
    const p = AUTONOMOUS[autoKey];
    gates = mergeGates(gates, p);
    credits = Math.max(credits, p.creditsPerMonth);
    sources.push(`autonomous:${p.key}`);
    if (!labels.includes(p.name)) labels.unshift(p.name);
  }

  let managed: Entitlements["managed"] = null;
  if (isManagedKey(managedKey)) {
    const m = MANAGED[managedKey];
    const included = AUTONOMOUS[m.includes];
    gates = mergeGates(gates, { ...included, fde: true });
    credits = Math.max(credits, included.creditsPerMonth);
    managed = { name: m.name, engineerHours: m.engineerHours, namedLead: m.namedLead };
    sources.push(`managed:${m.key}`);
    labels.unshift(m.name);
  }

  let reports: Entitlements["reports"] = null;
  if (isReportsKey(reportsKey)) {
    const r = REPORTS[reportsKey];
    reports = { resultsPerMonth: r.resultsPerMonth, projects: r.projects, historyDays: r.historyDays };
    gates = { ...gates, maxProjects: Math.max(gates.maxProjects, r.projects), maxRunHistory: Math.max(gates.maxRunHistory, r.historyDays) };
    sources.push(`reports:${r.key}`);
    labels.push(r.name);
  }

  // Legacy orgs had no credit pool. Paying legacy customers keep at least the
  // AI generation volume they already had (each UI generation = 2 credits), so
  // credit metering never takes anything away from them.
  if (legacy.tier !== "free") {
    credits = Math.max(credits, legacyCreditEquivalent(legacy.tier), legacy.testGensPerMonth * CREDIT_COSTS.uiJourneyGeneration);
  }
  if (credits === 0) credits = AUTONOMOUS.free.creditsPerMonth;

  return {
    ...gates,
    name: labels[0] ?? legacy.name,
    label: labels.join(" · ") || legacy.name,
    agents: AGENTS.map((a) => a.key),
    creditsPerMonth: credits,
    reports,
    managed,
    grandfathered: Boolean(org?.grandfathered),
    sources,
  };
}

function legacyCreditEquivalent(tier: PlanTier): number {
  switch (tier) {
    case "free": return AUTONOMOUS.free.creditsPerMonth;
    case "solo": return AUTONOMOUS.builder.creditsPerMonth;
    case "pro": return AUTONOMOUS.builder.creditsPerMonth;
    case "team": return AUTONOMOUS.growth.creditsPerMonth;
    case "starter": return AUTONOMOUS.growth.creditsPerMonth;
    default: return AUTONOMOUS.scale.creditsPerMonth;
  }
}
