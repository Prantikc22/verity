import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/analytics/posthog-server";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
import type { Enums } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const provider = getPaymentProvider();

  if (!provider.verifyWebhook(raw, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = provider.parseWebhookEvent(raw);
  if (!event) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, org_id, status, tier")
    .eq("provider_subscription_id", event.providerSubscriptionId)
    .maybeSingle();
  if (!sub) return NextResponse.json({ ok: true });

  // Tier: prefer the webhook's notes.tier, but fall back to the tier we stored at
  // checkout — so the customer ALWAYS gets the plan they paid for even if the
  // provider omits notes from an event.
  const tier = event.tier ?? sub.tier;

  await admin
    .from("subscriptions")
    .update({
      status: event.status as Enums<"subscription_status">,
      ...(tier ? { tier } : {}),
      ...(event.currentPeriodEnd ? { current_period_end: event.currentPeriodEnd } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  // Keep orgs.plan (the gating source of truth) in sync with the subscription.
  if (event.status === "active" && tier) {
    await admin.from("orgs").update({ plan: tier }).eq("id", sub.org_id);
  } else if (event.status === "cancelled" || event.status === "halted") {
    await admin.from("orgs").update({ plan: "free" }).eq("id", sub.org_id);
  }

  if (event.status === "active" && sub.status !== "active") {
    await captureServer(sub.org_id, FUNNEL_EVENTS.subscriptionActive, {
      tier: event.tier,
      provider_subscription_id: event.providerSubscriptionId,
    });
  }

  return NextResponse.json({ ok: true });
}
