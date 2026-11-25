import Razorpay from "razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyQsPlan } from "./activate";
import { qsPlan, type QsProduct } from "./qs-plans";

const PAID = ["active", "authenticated"];

/** Is the org's current subscription one the customer is actually paying for? */
export function isPaid(status: string | null | undefined): boolean {
  return PAID.includes(status ?? "");
}

/**
 * Finish a plan switch for a customer who already pays for a plan.
 *
 * Checkout for a switch creates the new Razorpay subscription with
 * notes.org_id / product / plan_key / replaces, but leaves the paid
 * subscription and its row alone: a customer who abandons the payment window
 * must keep the plan they pay for. Only once the NEW subscription is paid do we
 * cancel the old one and point the org at the new one. Idempotent.
 *
 * Returns true when it activated a switch, false when the subscription isn't a
 * pending switch for this org (or isn't paid yet).
 */
export async function completePlanSwitch(subscriptionId: string, expectedOrgId?: string): Promise<boolean> {
  const key_id = process.env.RAZORPAY_KEY_ID, key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return false;
  const rz = new Razorpay({ key_id, key_secret });
  const sub = await rz.subscriptions.fetch(subscriptionId);
  const notes = (sub.notes ?? {}) as Record<string, string | undefined>;
  const orgId = notes.org_id;
  const plan = qsPlan(notes.plan_key === undefined ? undefined : QS_KEY(notes.product, notes.plan_key));
  if (!orgId || !plan || (expectedOrgId && orgId !== expectedOrgId)) return false;
  if (!isPaid(sub.status)) return false;

  const admin = createAdminClient();
  const { data: current } = await admin.from("subscriptions").select("id, provider_subscription_id").eq("org_id", orgId).maybeSingle();
  if (current?.provider_subscription_id === subscriptionId) return true; // already switched

  // Paid for the new plan: now stop billing the old one.
  const old = notes.replaces || current?.provider_subscription_id;
  if (old && old !== subscriptionId) {
    try { await rz.subscriptions.cancel(old); } catch { /* already cancelled */ }
  }
  await admin.from("subscriptions").upsert({
    org_id: orgId, provider: "razorpay", provider_subscription_id: subscriptionId, tier: "free", status: "active",
    product: plan.product, plan_key: plan.planKey,
    current_period_end: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "org_id" });
  await applyQsPlan(orgId, plan.product as QsProduct, plan.planKey);
  return true;
}

/** notes carry product + planKey; QS_PLANS keys are e.g. "growth", "reports-plus", "managed-launch". */
function QS_KEY(product: string | undefined, planKey: string): string {
  return product === "managed" ? `managed-${planKey}` : planKey;
}
