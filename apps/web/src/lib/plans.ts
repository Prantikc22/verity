import type { Enums } from "@/lib/supabase/database.types";

export type PlanTier = Enums<"plan_tier">;
export type Currency = "USD" | "INR";

export interface PlanLimits {
  tier: PlanTier;
  name: string;
  tagline: string;
  /** USD per month. null = custom/contact. */
  priceUsd: number | null;
  /** INR per month. null = custom/contact. */
  priceInr: number | null;
  billingNote: string;
  /** Max maintained tests in the suite (runs are always unlimited). */
  maxTests: number;
  /** Max projects in the org. */
  maxProjects: number;
  /** AI test generations per month. */
  testGensPerMonth: number;
  /** UI cloud runs / month — capped on purpose; the product lives in your CI. */
  cloudRunsPerMonth: number;
  /**
   * One-off cloud "trials" of the heavier disciplines (performance / security)
   * against a PUBLIC target, just to get the feel. Deliberately tiny — 1 on free,
   * 3 on paid. The real thing runs unlimited in your CI.
   */
  cloudTrialsPerMonth: number;
  /** CI runs are ALWAYS unlimited. */
  ciRuns: "unlimited";
  /** Run history retained (days). */
  maxRunHistory: number;
  selfHealing: boolean;
  prGating: boolean;
  mergeBlocking: boolean;
  /** Mature predictions (regression flagging + flake disambiguation). */
  predictionsGA: boolean;
  /** Data-gated predictions (correlation + deploy confidence). */
  predictionsBeta: boolean;
  /** Forward-deployed engineer included (from Starter, per QAShift). */
  fde: boolean;
  pomConversion: boolean;
  highlights: string[];
}

export const PLANS: Record<PlanTier, PlanLimits> = {
  free: {
    tier: "free",
    name: "Cloud Sandbox",
    tagline: "Get the feel — free, no card.",
    priceUsd: 0,
    priceInr: 0,
    billingNote: "Free forever",
    // Keep up to 15 saved tests — matches the 15 monthly generations so the
    // headline "15/mo" holds (you can keep everything you generate).
    maxTests: 15,
    maxProjects: 1,
    testGensPerMonth: 15,
    cloudRunsPerMonth: 10,
    cloudTrialsPerMonth: 1,
    ciRuns: "unlimited",
    maxRunHistory: 14,
    selfHealing: false,
    prGating: false,
    mergeBlocking: false,
    predictionsGA: false,
    predictionsBeta: false,
    fde: false,
    pomConversion: false,
    highlights: [
      "15 AI test generations / mo · keep up to 15 tests",
      "Run a few times in the cloud to try it",
      "Unlimited runs once you wire your CI",
      "1 project · self-serve",
    ],
  },
  pro: {
    tier: "pro",
    name: "Self-Serve Pro",
    tagline: "The full engine, self-driven. No engineer, no call.",
    priceUsd: 49,
    priceInr: 2999,
    billingNote: "per month · billed monthly",
    maxTests: 50,
    maxProjects: 3,
    testGensPerMonth: 200,
    cloudRunsPerMonth: 15,
    cloudTrialsPerMonth: 3,
    ciRuns: "unlimited",
    maxRunHistory: 30,
    selfHealing: true,
    // PR checks post, but merge-blocking is a managed (Starter+) feature.
    prGating: true,
    mergeBlocking: false,
    // Predictions are a managed/data-gated value; self-serve gets flake detection.
    predictionsGA: false,
    predictionsBeta: false,
    fde: false,
    pomConversion: false,
    highlights: [
      "AI test generation, UI + API (200 / mo)",
      "Self-healing locators + flake detection",
      "Unlimited CI runs · 3 projects",
      "Self-serve — no engineer, no call",
    ],
  },
  team: {
    tier: "team",
    name: "Team",
    tagline: "Self-serve, scaled for a whole team.",
    priceUsd: 149,
    priceInr: 9999,
    billingNote: "per month · billed monthly",
    maxTests: 150,
    maxProjects: 10,
    testGensPerMonth: 750,
    cloudRunsPerMonth: 40,
    cloudTrialsPerMonth: 3,
    ciRuns: "unlimited",
    maxRunHistory: 60,
    selfHealing: true,
    prGating: true,
    mergeBlocking: false,
    predictionsGA: false,
    predictionsBeta: false,
    fde: false,
    pomConversion: false,
    highlights: [
      "AI test generation, UI + API (750 / mo)",
      "Self-healing locators + flake detection",
      "Unlimited CI runs · 10 projects",
      "Priority support · still self-serve, no call",
    ],
  },
  starter: {
    tier: "starter",
    name: "Starter",
    tagline: "AI + a forward-deployed engineer. From day one.",
    priceUsd: 499,
    priceInr: 34999,
    billingNote: "per month · billed monthly",
    maxTests: 60,
    maxProjects: 3,
    // FDE tiers: AI generation is unlimited — the engineer drives it, and the unit
    // customers care about is the MAINTAINED suite (capped, since a human keeps it
    // green), not generations. Extra maintained tests are billed per-test.
    testGensPerMonth: 100000,
    cloudRunsPerMonth: 25,
    cloudTrialsPerMonth: 3,
    ciRuns: "unlimited",
    maxRunHistory: 90,
    selfHealing: true,
    prGating: true,
    // Merge-blocking is included from Starter (no cost reason to tier-gate it).
    mergeBlocking: true,
    predictionsGA: true,
    // All predictions are available; the two "Beta" ones gate on a DATA threshold
    // (20+ deploys of history), not on tier — shown as "Calibrating" until then.
    predictionsBeta: true,
    fde: true,
    pomConversion: true,
    highlights: [
      "Unlimited AI generation · a living 60-test suite, kept green as you ship",
      "A dedicated forward-deployed engineer who owns the suite",
      "Self-healing locators + flake detection",
      "Predictions: regression-prone + flake triage",
    ],
  },
  growth: {
    tier: "growth",
    name: "Growth",
    tagline: "Scale the suite. Gate every merge.",
    priceUsd: 1799,
    priceInr: 109999,
    billingNote: "per month · billed monthly",
    maxTests: 200,
    maxProjects: 10,
    testGensPerMonth: 100000,
    cloudRunsPerMonth: 25,
    cloudTrialsPerMonth: 3,
    ciRuns: "unlimited",
    maxRunHistory: 180,
    selfHealing: true,
    prGating: true,
    mergeBlocking: true,
    predictionsGA: true,
    predictionsBeta: true,
    fde: true,
    pomConversion: true,
    highlights: [
      "Unlimited AI generation · a living 200-test suite that evolves as you ship",
      "Dedicated engineer + merge-blocking · UI, API, visual & agent",
      "Full predictions: correlation + deploy confidence",
      "10 projects · 180-day history",
    ],
  },
  scale: {
    tier: "scale",
    name: "Scale",
    tagline: "Everything included. High-velocity coverage with an SLA.",
    priceUsd: 3499,
    priceInr: 214999,
    billingNote: "per month · billed monthly",
    maxTests: 500,
    maxProjects: 50,
    testGensPerMonth: 100000,
    cloudRunsPerMonth: 50,
    cloudTrialsPerMonth: 3,
    ciRuns: "unlimited",
    maxRunHistory: 365,
    selfHealing: true,
    prGating: true,
    mergeBlocking: true,
    predictionsGA: true,
    predictionsBeta: true,
    fde: true,
    pomConversion: true,
    highlights: [
      "Everything included — performance, security & agent, none metered",
      "Unlimited AI generation · a living 500-test suite that evolves as you ship",
      "Priority triage SLA · monthly strategy sync",
      "50 projects · 365-day history",
    ],
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    tagline: "Unlimited coverage, SSO, self-host.",
    priceUsd: null,
    priceInr: null,
    billingNote: "Custom",
    maxTests: 100000,
    maxProjects: 100000,
    testGensPerMonth: 100000,
    cloudRunsPerMonth: 100,
    cloudTrialsPerMonth: 3,
    ciRuns: "unlimited",
    maxRunHistory: 100000,
    selfHealing: true,
    prGating: true,
    mergeBlocking: true,
    predictionsGA: true,
    predictionsBeta: true,
    fde: true,
    pomConversion: true,
    highlights: [
      "Unlimited maintained tests · a team of engineers",
      "SOC 2 / GDPR · SSO / SAML · RBAC",
      "Self-host the MIT runner",
      "White-glove onboarding",
    ],
  },
};

export const PAID_TIERS: PlanTier[] = ["pro", "team", "starter", "growth", "scale"];

export function planFor(tier: PlanTier | null | undefined): PlanLimits {
  return PLANS[tier ?? "free"];
}

export function formatUsd(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

export function formatInr(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export function planPrice(p: PlanLimits, currency: Currency): string {
  if (currency === "INR") return p.priceInr === null ? "Custom" : p.priceInr === 0 ? "₹0" : formatInr(p.priceInr);
  return p.priceUsd === null ? "Custom" : p.priceUsd === 0 ? "$0" : formatUsd(p.priceUsd);
}

/** Annual commitment discount, matching the QAShift platform. */
export const ANNUAL_DISCOUNT = 0.15;
