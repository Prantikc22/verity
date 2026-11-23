import { AUTONOMOUS, REPORTS, MANAGED } from "@/lib/catalog";

/**
 * QAShift 2.0 purchasable plans → product column, display, and the env var
 * holding the Razorpay plan id (RAZORPAY_QS_PLAN_<ENV>_<USD|INR>).
 */
export type QsProduct = "autonomous" | "reports" | "managed";
export interface QsPlan { key: string; product: QsProduct; planKey: string; name: string; usd: number; inr: number; env: string; requiresScope?: boolean; /** Kept for existing subscribers and webhooks; not offered to new buyers. */ retired?: boolean }

export const QS_PLANS: QsPlan[] = [
  { key: "builder", product: "autonomous", planKey: "builder", name: AUTONOMOUS.builder.name, usd: 29, inr: 2499, env: "BUILDER" },
  { key: "growth", product: "autonomous", planKey: "growth", name: AUTONOMOUS.growth.name, usd: 99, inr: 8499, env: "GROWTH" },
  { key: "scale", product: "autonomous", planKey: "scale", name: AUTONOMOUS.scale.name, usd: 299, inr: 24999, env: "SCALE" },
  { key: "reports-plus", product: "reports", planKey: "reports-plus", name: REPORTS["reports-plus"].name, usd: 12, inr: 999, env: "REPORTS_PLUS" },
  { key: "reports-team", product: "reports", planKey: "reports-team", name: REPORTS["reports-team"].name, usd: 49, inr: 3999, env: "REPORTS_TEAM" },
  { key: "managed-assist", product: "managed", planKey: "assist", name: MANAGED.assist.name, usd: 499, inr: 41999, env: "MANAGED_ASSIST", requiresScope: true, retired: true },
  { key: "managed-launch", product: "managed", planKey: "launch", name: MANAGED.launch.name, usd: 1499, inr: 124999, env: "MANAGED_LAUNCH", requiresScope: true },
  { key: "managed-growth", product: "managed", planKey: "growth", name: MANAGED.growth.name, usd: 3499, inr: 289999, env: "MANAGED_GROWTH", requiresScope: true },
  { key: "managed-scale", product: "managed", planKey: "scale", name: MANAGED.scale.name, usd: 7999, inr: 664999, env: "MANAGED_SCALE", requiresScope: true },
];

export function qsPlan(key: string | undefined | null): QsPlan | undefined {
  return QS_PLANS.find((p) => p.key === key);
}

export function qsRazorpayPlanId(p: QsPlan, currency: "USD" | "INR"): string | undefined {
  return process.env[`RAZORPAY_QS_PLAN_${p.env}_${currency}`];
}

/** Which org column a product writes. */
export const PRODUCT_COLUMN = { autonomous: "autonomous_plan", reports: "reports_plan", managed: "managed_plan" } as const;
