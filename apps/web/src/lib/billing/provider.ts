import type { PlanTier } from "@/lib/plans";

export interface CreateSubscriptionInput {
  orgId: string;
  tier: PlanTier;
  customerEmail?: string;
  /** Billing currency — selects the matching plan so the charge matches the price shown. */
  currency?: "USD" | "INR";
}

export interface CreateSubscriptionResult {
  providerSubscriptionId: string;
  /** Hosted checkout/authorization URL to redirect the user to. */
  checkoutUrl: string;
}

export type SubscriptionStatusEvent =
  | "created"
  | "active"
  | "halted"
  | "cancelled"
  | "paused";

export interface WebhookEvent {
  providerSubscriptionId: string;
  status: SubscriptionStatusEvent;
  tier?: PlanTier;
  currentPeriodEnd?: string | null;
}

/**
 * Provider-agnostic billing surface. ALL provider-specific code (Razorpay today,
 * a future merchant-of-record tomorrow) lives behind this interface so a swap
 * touches only the adapter — never the rest of the app.
 */
export interface PaymentProvider {
  readonly name: string;
  readonly configured: boolean;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  parseWebhookEvent(rawBody: string): WebhookEvent | null;
}
