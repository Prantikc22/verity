import { NextResponse, type NextRequest } from "next/server";
import Razorpay from "razorpay";
import { getUser, getPrimaryOrg, ensureOrgForCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { qsPlan, qsRazorpayPlanId } from "@/lib/billing/qs-plans";

export const runtime = "nodejs";

/** Start a QAShift 2.0 subscription (autonomous, reports or managed). */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to upgrade." }, { status: 401 });
  let orgCtx = await getPrimaryOrg();
  if (!orgCtx) { await ensureOrgForCurrentUser(); orgCtx = await getPrimaryOrg(); }
  if (!orgCtx) return NextResponse.json({ error: "No organization found." }, { status: 400 });
  if (orgCtx.role !== "owner" && orgCtx.role !== "admin") return NextResponse.json({ error: "Only org admins can change billing." }, { status: 403 });

  let body: { plan?: string; currency?: string; acceptScope?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const plan = qsPlan(body.plan);
  if (!plan || plan.retired) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  if (plan.requiresScope && body.acceptScope !== true) return NextResponse.json({ error: "Please accept the managed QA scope first." }, { status: 400 });
  const currency = body.currency === "INR" ? "INR" : "USD";
  const planId = qsRazorpayPlanId(plan, currency);
  const key_id = process.env.RAZORPAY_KEY_ID, key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret || !planId) return NextResponse.json({ error: "Checkout isn't configured for this plan yet." }, { status: 503 });

  const rz = new Razorpay({ key_id, key_secret });
  const admin = createAdminClient();
  const { data: existing } = await admin.from("subscriptions").select("provider_subscription_id, status, plan_key, product").eq("org_id", orgCtx.org.id).maybeSingle();
  if (existing?.provider_subscription_id) {
    if (["active", "authenticated"].includes(existing.status ?? "") && existing.plan_key === plan.planKey && existing.product === plan.product) {
      return NextResponse.json({ error: `You're already on ${plan.name}.` }, { status: 409 });
    }
    try { await rz.subscriptions.cancel(existing.provider_subscription_id); } catch { /* already gone */ }
  }

  let sub;
  try {
    sub = await rz.subscriptions.create({
      plan_id: planId, total_count: 120, customer_notify: 1,
      notes: { org_id: orgCtx.org.id, product: plan.product, plan_key: plan.planKey, scope_accepted: plan.requiresScope ? new Date().toISOString() : "n/a" },
    });
  } catch (e) {
    const err = e as { error?: { description?: string }; message?: string };
    return NextResponse.json({ error: err?.error?.description || err?.message || "Razorpay rejected the subscription." }, { status: 502 });
  }

  await admin.from("subscriptions").upsert({
    org_id: orgCtx.org.id, provider: "razorpay", provider_subscription_id: sub.id, tier: "free", status: "created",
    product: plan.product, plan_key: plan.planKey,
  }, { onConflict: "org_id" });

  return NextResponse.json({ subscriptionId: sub.id, keyId: key_id, name: plan.name, email: user.email ?? undefined, testMode: key_id.startsWith("rzp_test_") });
}
