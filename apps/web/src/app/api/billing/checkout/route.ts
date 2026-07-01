import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/billing";
import { getUser, getPrimaryOrg } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServer } from "@/lib/analytics/posthog-server";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
import { PAID_TIERS, type PlanTier } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to upgrade." }, { status: 401 });

  const orgCtx = await getPrimaryOrg();
  if (!orgCtx) return NextResponse.json({ error: "No organization found." }, { status: 400 });
  if (orgCtx.role !== "owner" && orgCtx.role !== "admin") {
    return NextResponse.json({ error: "Only org admins can change billing." }, { status: 403 });
  }

  let body: { tier?: PlanTier };
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

  try {
    const result = await provider.createSubscription({
      orgId: orgCtx.org.id,
      tier,
      customerEmail: user.email,
    });

    const admin = createAdminClient();
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

    return NextResponse.json({ checkoutUrl: result.checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
