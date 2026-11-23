/**
 * QAShift 2.0 plan catalog — the machine-readable LIMITS for the new plans.
 * Display copy and prices live in the marketing repo (qashift/lib/catalog.ts);
 * keys and numbers here must match it. All values are DRAFT until approved.
 *
 * Every autonomous plan unlocks all six agents. Plans differ by projects,
 * credits, history, concurrency and team features — never by agent.
 *
 * Each plan also carries the legacy gating fields the existing API routes read
 * (testGensPerMonth, cloudRunsPerMonth, selfHealing, …) so routes can switch
 * from planFor() to entitlementsFor() with no behaviour change for legacy orgs.
 */

export type AgentKey = "ui" | "api" | "performance" | "security" | "accessibility" | "visual";
export type AgentStatus = "live" | "beta" | "roadmap";

export interface AgentDef {
  key: AgentKey;
  /** Short product name, always shown with the role. */
  codename: string;
  name: string;
  status: AgentStatus;
  /** test_runs.discipline / tests.kind values this agent owns. */
  disciplines: string[];
  /** Where the agent's work starts inside a project. */
  projectPath: string | null;
  summary: string;
}

export const AGENTS: AgentDef[] = [
  { key: "ui", codename: "Scout", name: "UI Agent", status: "live", disciplines: ["ui"], projectPath: "generate", summary: "Journeys and functional regressions in a real browser." },
  { key: "api", codename: "Relay", name: "API Agent", status: "live", disciplines: ["api", "contract"], projectPath: "api/generate", summary: "Contracts, auth rules and multi-step API workflows." },
  { key: "visual", codename: "Prism", name: "Visual Agent", status: "live", disciplines: ["visual"], projectPath: "visual", summary: "Screenshot baselines and reviewable diffs." },
  { key: "accessibility", codename: "Lumen", name: "Accessibility Agent", status: "live", disciplines: ["accessibility"], projectPath: "accessibility", summary: "WCAG regressions per deploy, gated in the PR." },
  { key: "performance", codename: "Pulse", name: "Performance Agent", status: "beta", disciplines: ["performance"], projectPath: "performance", summary: "Latency smoke checks and scoped load profiles." },
  { key: "security", codename: "Warden", name: "Security Agent", status: "beta", disciplines: ["security"], projectPath: "security", summary: "Authorised, non-destructive dynamic and static checks." },
];

/** Accessibility still lives on its own host until the Clearpath import lands. */
export const ACCESSIBILITY_APP_URL = process.env.NEXT_PUBLIC_CLEARPATH_URL ?? "https://clearpath.qashifthq.com/dashboard";

export type AutonomousPlanKey = "free" | "builder" | "growth" | "scale";
export type ReportsPlanKey = "reports-free" | "reports-plus" | "reports-team";
export type ManagedPlanKey = "assist" | "launch" | "growth" | "scale" | "enterprise";

/** The gating fields existing routes already read from PlanLimits. */
export interface GateLimits {
  maxTests: number;
  maxProjects: number;
  testGensPerMonth: number;
  cloudRunsPerMonth: number;
  cloudTrialsPerMonth: number;
  maxRunHistory: number;
  selfHealing: boolean;
  prGating: boolean;
  mergeBlocking: boolean;
  predictionsGA: boolean;
  predictionsBeta: boolean;
  fde: boolean;
  pomConversion: boolean;
}

export interface AutonomousPlan extends GateLimits {
  key: AutonomousPlanKey;
  name: string;
  priceUsd: number;
  creditsPerMonth: number;
  seats: number;
  concurrency: number;
}

export const AUTONOMOUS: Record<AutonomousPlanKey, AutonomousPlan> = {
  free: {
    key: "free", name: "Free", priceUsd: 0, creditsPerMonth: 25, seats: 1, concurrency: 1,
    maxProjects: 1, maxTests: 15, testGensPerMonth: 15, cloudRunsPerMonth: 10, cloudTrialsPerMonth: 1, maxRunHistory: 14,
    selfHealing: false, prGating: false, mergeBlocking: false, predictionsGA: false, predictionsBeta: false, fde: false, pomConversion: false,
  },
  builder: {
    key: "builder", name: "Builder", priceUsd: 29, creditsPerMonth: 150, seats: 3, concurrency: 2,
    maxProjects: 2, maxTests: 40, testGensPerMonth: 75, cloudRunsPerMonth: 15, cloudTrialsPerMonth: 2, maxRunHistory: 30,
    selfHealing: true, prGating: true, mergeBlocking: false, predictionsGA: false, predictionsBeta: false, fde: false, pomConversion: false,
  },
  growth: {
    key: "growth", name: "Growth", priceUsd: 99, creditsPerMonth: 600, seats: 10, concurrency: 4,
    maxProjects: 5, maxTests: 150, testGensPerMonth: 300, cloudRunsPerMonth: 40, cloudTrialsPerMonth: 5, maxRunHistory: 90,
    selfHealing: true, prGating: true, mergeBlocking: true, predictionsGA: true, predictionsBeta: false, fde: false, pomConversion: false,
  },
  scale: {
    key: "scale", name: "Scale", priceUsd: 299, creditsPerMonth: 2000, seats: 30, concurrency: 10,
    maxProjects: 20, maxTests: 600, testGensPerMonth: 1000, cloudRunsPerMonth: 120, cloudTrialsPerMonth: 15, maxRunHistory: 365,
    selfHealing: true, prGating: true, mergeBlocking: true, predictionsGA: true, predictionsBeta: true, fde: false, pomConversion: true,
  },
};

export interface ReportsPlan { key: ReportsPlanKey; name: string; priceUsd: number; resultsPerMonth: number; projects: number; historyDays: number }

export const REPORTS: Record<ReportsPlanKey, ReportsPlan> = {
  "reports-free": { key: "reports-free", name: "Reports Free", priceUsd: 0, resultsPerMonth: 2000, projects: 1, historyDays: 7 },
  "reports-plus": { key: "reports-plus", name: "Reports Plus", priceUsd: 12, resultsPerMonth: 20000, projects: 5, historyDays: 30 },
  "reports-team": { key: "reports-team", name: "Reports Team", priceUsd: 49, resultsPerMonth: 100000, projects: 20, historyDays: 90 },
};

export interface ManagedPlan { key: ManagedPlanKey; name: string; priceUsd: number | null; engineerHours: number | null; namedLead: boolean; includes: AutonomousPlanKey }

export const MANAGED: Record<ManagedPlanKey, ManagedPlan> = {
  assist: { key: "assist", name: "QA Assist", priceUsd: 499, engineerHours: 4, namedLead: false, includes: "growth" },
  launch: { key: "launch", name: "Managed Launch", priceUsd: 1499, engineerHours: 12, namedLead: false, includes: "growth" },
  growth: { key: "growth", name: "Managed Growth", priceUsd: 3499, engineerHours: 30, namedLead: true, includes: "scale" },
  scale: { key: "scale", name: "Managed Scale", priceUsd: 7999, engineerHours: 80, namedLead: true, includes: "scale" },
  enterprise: { key: "enterprise", name: "Enterprise", priceUsd: null, engineerHours: null, namedLead: true, includes: "scale" },
};

/** Draft credit debits per action. Shown as an estimate before a run. */
export const CREDIT_COSTS = {
  ciRun: 0,
  uiJourneyGeneration: 2,
  apiEndpointGroupGeneration: 1,
  failureInvestigation: 1,
  accessibilityScanPer10Pages: 1,
  visualBaselinePer20Screens: 1,
  performanceCloudSmoke: 3,
  securityCloudBaseline: 5,
} as const;

export function isAutonomousKey(v: unknown): v is AutonomousPlanKey {
  return typeof v === "string" && v in AUTONOMOUS;
}
export function isReportsKey(v: unknown): v is ReportsPlanKey {
  return typeof v === "string" && v in REPORTS;
}
export function isManagedKey(v: unknown): v is ManagedPlanKey {
  return typeof v === "string" && v in MANAGED;
}
