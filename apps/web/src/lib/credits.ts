import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CREDIT_COSTS } from "@/lib/catalog";
import type { Entitlements } from "@/lib/entitlements";

/**
 * Credit metering. Every agent action that does AI or cloud work draws from
 * the org's monthly pool (Entitlements.creditsPerMonth). Runs in the
 * customer's own CI are never metered.
 *
 * Pattern for a route:
 *   const hold = await reserveCredits({ orgId, plan, cost: CREDITS.uiTest, agent: "ui", projectId, ref });
 *   if (!hold.ok) return hold.response;          // 402 with a plain-English reason
 *   try { ...do the work... } catch (e) { await hold.refund(); throw e; }
 *
 * Reserving before the work (not charging after) means two parallel requests
 * can never spend the same credits; the DB function locks per org.
 */

export const CREDITS = {
  uiTest: CREDIT_COSTS.uiJourneyGeneration,
  apiTest: CREDIT_COSTS.apiEndpointGroupGeneration,
  visualTest: CREDIT_COSTS.visualBaselinePer20Screens,
  perfScript: CREDIT_COSTS.performanceScriptGeneration,
  aiEval: CREDIT_COSTS.aiFeatureEvalGeneration,
  investigate: CREDIT_COSTS.failureInvestigation,
  perfCloud: CREDIT_COSTS.performanceCloudSmoke,
  securityCloud: CREDIT_COSTS.securityCloudBaseline,
} as const;

/** Ledger agent values allowed by the usage_ledger check constraint. */
export type MeterAgent = "ui" | "api" | "performance" | "security" | "accessibility" | "visual" | "investigator";

/** Plans at or above this are shown as "Unlimited" (grandfathered unlimited-generation plans). */
export const UNLIMITED_CREDITS = 100_000;

export function nextResetDate(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
const resetLabel = () => nextResetDate().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export async function creditsUsed(orgId: string): Promise<number> {
  const { data, error } = await createAdminClient().rpc("credits_used_this_month", { p_org: orgId });
  if (error) throw new Error(`credit balance unavailable: ${error.message}`);
  return Number(data ?? 0);
}

export async function creditBalance(orgId: string, plan: Pick<Entitlements, "creditsPerMonth">) {
  const used = await creditsUsed(orgId);
  const limit = plan.creditsPerMonth;
  return { used, limit, left: Math.max(0, limit - used), unlimited: limit >= UNLIMITED_CREDITS };
}

/** How many actions of `cost` the org can still afford this month. */
export async function affordable(orgId: string, plan: Pick<Entitlements, "creditsPerMonth">, cost: number): Promise<number> {
  if (cost <= 0) return Number.POSITIVE_INFINITY;
  const { left } = await creditBalance(orgId, plan);
  return Math.floor(left / cost);
}

export function outOfCreditsMessage(plan: Pick<Entitlements, "creditsPerMonth" | "name">, used: number, cost: number): string {
  const left = Math.max(0, plan.creditsPerMonth - used);
  return `This needs ${cost} credit${cost === 1 ? "" : "s"} and you have ${left} of ${plan.creditsPerMonth.toLocaleString()} left on ${plan.name} this month. ` +
    `Credits reset on ${resetLabel()}. Upgrade for more; runs in your own CI stay free.`;
}

export type Hold =
  | { ok: true; ledgerId: number | null; cost: number; refund: () => Promise<void> }
  | { ok: false; response: NextResponse };

export async function reserveCredits(opts: {
  orgId: string;
  plan: Pick<Entitlements, "creditsPerMonth" | "name">;
  cost: number;
  agent?: MeterAgent | null;
  projectId?: string | null;
  ref?: string | null;
}): Promise<Hold> {
  const { orgId, plan, cost } = opts;
  if (cost <= 0) return { ok: true, ledgerId: null, cost: 0, refund: async () => {} };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_credits", {
    p_org: orgId, p_amount: cost, p_limit: plan.creditsPerMonth,
    p_agent: opts.agent ?? null, p_project: opts.projectId ?? null, p_ref: opts.ref ?? null,
  });
  if (error || !data?.[0]) {
    return { ok: false, response: NextResponse.json({ error: "We couldn't check your credit balance. Try again in a moment." }, { status: 503 }) };
  }
  const row = data[0];
  if (!row.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: outOfCreditsMessage(plan, Number(row.used), cost), code: "OUT_OF_CREDITS", credits: { used: Number(row.used), limit: plan.creditsPerMonth, cost } },
        { status: 402 },
      ),
    };
  }
  let refunded = false;
  return {
    ok: true,
    ledgerId: row.ledger_id,
    cost,
    refund: async () => {
      if (refunded) return;
      refunded = true;
      await admin.from("usage_ledger").insert({
        org_id: orgId, project_id: opts.projectId ?? null, metric: "credits", amount: cost,
        agent: opts.agent ?? null, kind: "refund", ref: row.ledger_id ? `refund:${row.ledger_id}` : opts.ref ?? null,
      });
    },
  };
}
