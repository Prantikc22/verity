import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { getUser, getPrimaryOrg } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyQsPlan } from "@/lib/billing/activate";
import type { QsProduct } from "@/lib/billing/qs-plans";

export const runtime = "nodejs";

/**
 * Confirms a Razorpay Checkout result server-side (signature = HMAC(payment_id|subscription_id, key_secret)),
 * re-reads the subscription from Razorpay, and activates the plan. The webhook does the same in production;
 * this makes activation immediate and work where webhooks can't reach (localhost).
 */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const orgCtx = await getPrimaryOrg();
  if (!orgCtx) return NextResponse.json({ error: "No organization." }, { status: 400 });
  let b: { razorpay_payment_id?: string; razorpay_subscription_id?: string; razorpay_signature?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
  const secret = process.env.RAZORPAY_KEY_SECRET, key_id = process.env.RAZORPAY_KEY_ID;
  if (!secret || !key_id || !b.razorpay_payment_id || !b.razorpay_subscription_id || !b.razorpay_signature) return NextResponse.json({ error: "Missing fields." }, { status: 400 });

  const expected = createHmac("sha256", secret).update(`${b.razorpay_payment_id}|${b.razorpay_subscription_id}`).digest("hex");
  const ok = expected.length === b.razorpay_signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(b.razorpay_signature));
  if (!ok) return NextResponse.json({ error: "Signature check failed." }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin.from("subscriptions").select("id, org_id, product, plan_key").eq("provider_subscription_id", b.razorpay_subscription_id).maybeSingle();
  if (!row || row.org_id !== orgCtx.org.id) return NextResponse.json({ error: "Subscription not found for this workspace." }, { status: 404 });

  const rz = new Razorpay({ key_id, key_secret: secret });
  const sub = await rz.subscriptions.fetch(b.razorpay_subscription_id);
  const active = ["active", "authenticated"].includes(sub.status);
  await admin.from("subscriptions").update({
    status: active ? "active" : "created",
    current_period_end: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (active && row.product !== "legacy" && row.plan_key) await applyQsPlan(row.org_id, row.product as QsProduct, row.plan_key);
  return NextResponse.json({ ok: true, active });
}
