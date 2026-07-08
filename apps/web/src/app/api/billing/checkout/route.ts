import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/billing";
import { getUser, getPrimaryOrg, ensureOrgForCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/analytics/posthog-server";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
import { PAID_TIERS, type PlanTier } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to upgrade." }, { status: 401 });

  // Provision an org on-demand — a user who upgrades before ever opening the
  // dashboard wouldn't have one yet.
  let orgCtx = await getPrimaryOrg();
  if (!orgCtx) { await ensureOrgForCurrentUser(); orgCtx = await getPrimaryOrg(); }
  if (!orgCtx) return NextResponse.json({ error: "No organization found." }, { status: 400 });
  if (orgCtx.role !== "owner" && orgCtx.role !== "admin") {
    return NextResponse.json({ error: "Only org admins can change billing." }, { status: 403 });
  }

  let body: { tier?: PlanTier; currency?: "USD" | "INR" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const tier = body.tier;
  if (!tier || !PAID_TIERS.includes(tier)) {
    return NextResponse.json({ error: "Invalid plan tier." }, { status: 400 });
  }

  const provider = getPaymentProvider();
  if (!provider.configured) {
    return NextResponse.json(
      { error: "Billing isn't configured yet. Please contact us to upgrade." },
      { status: 503 },
    );
  }

  await captureServer(orgCtx.org.id, FUNNEL_EVENTS.upgradeInitiated, { tier });

  const admin = createAdminClient();

  // Upgrade / downgrade / retry. Look at the org's existing subscription:
  //  - Only a GENUINELY PAID sub (active/authenticated) of the SAME tier blocks
  //    re-checkout ("you're already on it").
  //  - A paid sub on a DIFFERENT tier is cancelled first (no double billing).
  //  - A never-completed sub ("created"/"pending" — e.g. a payment that failed)
  //    must NOT block a retry; we just cancel the stale one and proceed.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("provider_subscription_id, status, tier")
    .eq("org_id", orgCtx.org.id)
    .maybeSingle();
  const paidStatuses = ["active", "authenticated"];
  const isPaid = paidStatuses.includes(existing?.status ?? "");
  if (existing?.provider_subscription_id) {
    if (isPaid && existing.tier === tier) {
      return NextResponse.json({ error: `You're already on the ${tier} plan.` }, { status: 409 });
    }
    // Different paid tier, or a stale/failed attempt — cancel it so nothing lingers.
    try { await provider.cancelSubscription(existing.provider_subscription_id); } catch { /* already gone / never activated */ }
  }

  try {
    const result = await provider.createSubscription({
      orgId: orgCtx.org.id,
      tier,
      customerEmail: user.email,
      currency: body.currency === "USD" ? "USD" : "INR",
    });

    await admin.from("subscriptions").upsert(
      {
        org_id: orgCtx.org.id,
        provider: provider.name,
        provider_subscription_id: result.providerSubscriptionId,
        tier,
        status: "created",
      },
      { onConflict: "org_id" },
    );

    // Return subscription id + public key so the client can open the in-page
    // Razorpay Checkout modal; checkoutUrl stays as a hosted-page fallback.
    return NextResponse.json({
      checkoutUrl: result.checkoutUrl,
      subscriptionId: result.providerSubscriptionId,
      keyId: process.env.RAZORPAY_KEY_ID ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
