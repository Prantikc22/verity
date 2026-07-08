import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanTier } from "@/lib/plans";
import type {
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentProvider,
  WebhookEvent,
  SubscriptionStatusEvent,
} from "./provider";

/** Map our plan tiers to Razorpay plan IDs (created in the Razorpay dashboard). */
function planId(tier: PlanTier, currency: "USD" | "INR" = "INR"): string | undefined {
  // USD-specific plan if configured; otherwise the base (INR) plan.
  const usd: Partial<Record<PlanTier, string | undefined>> = {
    pro: process.env.RAZORPAY_PLAN_PRO_USD,
    team: process.env.RAZORPAY_PLAN_TEAM_USD,
    starter: process.env.RAZORPAY_PLAN_STARTER_USD,
    growth: process.env.RAZORPAY_PLAN_GROWTH_USD,
    scale: process.env.RAZORPAY_PLAN_SCALE_USD,
  };
  const inr: Partial<Record<PlanTier, string | undefined>> = {
    pro: process.env.RAZORPAY_PLAN_PRO,
    team: process.env.RAZORPAY_PLAN_TEAM,
    starter: process.env.RAZORPAY_PLAN_STARTER,
    growth: process.env.RAZORPAY_PLAN_GROWTH,
    scale: process.env.RAZORPAY_PLAN_SCALE,
  };
  return (currency === "USD" ? usd[tier] : inr[tier]) ?? inr[tier];
}

/** Razorpay status → our subscription status enum. */
function mapStatus(status: string): SubscriptionStatusEvent {
  switch (status) {
    case "active":
    case "authenticated":
    case "charged":
      return "active";
    case "halted":
      return "halted";
    case "cancelled":
    case "completed":
    case "expired":
      return "cancelled";
    case "paused":
      return "paused";
    default:
      return "created";
  }
}

export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";
  private client: Razorpay | null;

  constructor() {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    this.client = key_id && key_secret ? new Razorpay({ key_id, key_secret }) : null;
  }

  get configured(): boolean {
    return this.client !== null;
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    if (!this.client) throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID/SECRET).");
    const plan_id = planId(input.tier, input.currency ?? "INR");
    if (!plan_id) {
      throw new Error(`No Razorpay plan is configured for the ${input.tier} plan${input.currency === "USD" ? " (USD)" : ""}. Set RAZORPAY_PLAN_${input.tier.toUpperCase()}${input.currency === "USD" ? "_USD" : ""} to a valid plan id.`);
    }

    let sub;
    try {
      sub = await this.client.subscriptions.create({
        plan_id,
        total_count: 12,
        customer_notify: 1,
        notes: { org_id: input.orgId, tier: input.tier },
      });
    } catch (e) {
      // Razorpay SDK throws { statusCode, error: { code, description } } — surface
      // the REAL reason instead of a generic "could not start checkout".
      const rz = e as { error?: { description?: string; code?: string }; message?: string };
      const detail = rz?.error?.description || rz?.message || "Razorpay rejected the subscription.";
      throw new Error(`${detail} (plan ${plan_id}, ${input.currency ?? "INR"})`);
    }

    return {
      providerSubscriptionId: sub.id,
      checkoutUrl: (sub as { short_url?: string }).short_url ?? "",
    };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    if (!this.client) throw new Error("Razorpay is not configured.");
    await this.client.subscriptions.cancel(providerSubscriptionId);
  }

  verifyWebhook(rawBody: string, signature: string | null): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhookEvent(rawBody: string): WebhookEvent | null {
    let body: {
      payload?: { subscription?: { entity?: { id?: string; status?: string; notes?: { tier?: PlanTier }; current_end?: number } } };
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return null;
    }
    const entity = body.payload?.subscription?.entity;
    if (!entity?.id || !entity.status) return null;
    return {
      providerSubscriptionId: entity.id,
      status: mapStatus(entity.status),
      tier: entity.notes?.tier,
      currentPeriodEnd: entity.current_end
        ? new Date(entity.current_end * 1000).toISOString()
        : null,
    };
  }
}
