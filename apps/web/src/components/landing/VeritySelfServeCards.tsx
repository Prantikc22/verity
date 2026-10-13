"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./PricingCards.module.css";
import { PLANS } from "@/lib/plans";

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void };
declare global {
  interface Window { Razorpay?: RazorpayCtor }
}

/** Load Razorpay Checkout.js once, for the in-page modal. */
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Tiers that can start a Razorpay checkout: self-serve here + FDE tiers via the
 *  QAShift "Pay & start now" deep link. The backend validates against PAID_TIERS. */
const CHECKOUT_TIERS = ["solo", "pro", "team", "starter", "growth", "scale"] as const;
type CheckoutTier = (typeof CHECKOUT_TIERS)[number];

interface Tier {
  name: string;
  blurb: string;
  usd: number;
  inr: number;
  cap: string;
  features: string[];
  /** What this tier does NOT get — loss-aversion framing, shown muted + struck. */
  missing?: string[];
  note?: string;
  cta: { label: string; href: string };
  /** A paid tier initiates Razorpay checkout instead of just linking. */
  paidTier?: "solo" | "pro" | "team";
  highlight?: boolean;
}

/** Every plan writes all six test types; plans differ by volume, self-healing, PR checks and projects. Must match lib/plans.ts. */
export const ALL_TYPES = "UI, API, visual, AI-agent, load & security tests";

const TIERS: Tier[] = [
  {
    name: "Free",
    blurb: "Everything you need to see it work on your own app. No card.",
    usd: 0, inr: 0,
    cap: "15 AI-written tests / month",
    features: [
      ALL_TYPES,
      "Unlimited runs in your CI — GitHub, GitLab or Jenkins",
      "Flaky vs. real failures, on every run",
      "10 cloud runs / month to try it before wiring CI",
      "1 project",
    ],
    missing: [
      "Self-healing when the UI changes",
      "Results posted on pull requests",
    ],
    cta: { label: "Start free", href: "/login?next=/dashboard" },
  },
  {
    name: "Solo",
    blurb: "One product, tests that fix themselves, results on every PR.",
    usd: 19, inr: 1199,
    cap: "60 AI-written tests / month",
    features: [
      "Everything in Free",
      "Self-healing: selector fixes as reviewable diffs",
      "Checks + comments on every pull request",
      "1 project · up to 25 tests",
      "10 cloud runs / month",
    ],
    cta: { label: "Start Solo", href: "/login?next=/pricing" },
    paidTier: "solo",
  },
  {
    name: "Pro",
    blurb: "For a team shipping one or a few products every week.",
    usd: 49, inr: 2999,
    cap: "200 AI-written tests / month",
    features: [
      "Everything in Free",
      "Self-healing: selector fixes as reviewable diffs",
      "Checks + comments on every pull request",
      "3 projects · up to 50 tests each",
      "15 cloud runs / month",
    ],
    cta: { label: "Start Pro", href: "/login?next=/pricing" },
    paidTier: "pro",
    highlight: true,
  },
  {
    name: "Team",
    blurb: "For several products, squads or services.",
    usd: 149, inr: 9999,
    cap: "750 AI-written tests / month",
    features: [
      "Everything in Pro",
      "10 projects · up to 150 tests each",
      "40 cloud runs / month",
      "Priority support",
    ],
    cta: { label: "Start Team", href: "/login?next=/pricing" },
    paidTier: "team",
  },
];

/** Which purchases are actually configured (server-side Razorpay plan ids). */
export interface BillingAvailability { solo: boolean; yearly: boolean }

export function VeritySelfServeCards({ billing = { solo: false, yearly: false } }: { inIndia: boolean; billing?: BillingAvailability }) {
  // USD is the default for everyone (global-standard for dev tools); INR stays a
  // one-click toggle for teams who prefer to pay in rupees.
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  // Annual is the default once it can be bought: it is the better deal.
  const [interval, setBillingInterval] = useState<"monthly" | "yearly">(billing.yearly ? "yearly" : "monthly");
  const tiers = TIERS.filter((t) => t.paidTier !== "solo" || billing.solo);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Tier a checkout was auto-started for (from a QAShift deep link or a
  // post-login resume) — drives the "what's happening" banner.
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const money = (n: number) => (currency === "INR" ? `₹${n.toLocaleString("en-IN")}` : `$${n.toLocaleString("en-US")}`);
  // Yearly plans show the per-month equivalent, with the yearly charge underneath.
  const yearly = (t: Tier) => {
    const p = t.paidTier ? PLANS[t.paidTier] : null;
    const total = p ? (currency === "INR" ? p.priceInrYearly : p.priceUsdYearly) : undefined;
    return interval === "yearly" && total ? total : null;
  };
  const fmt = (t: Tier) => {
    const y = yearly(t);
    if (y) return money(Math.round(y / 12));
    const m = currency === "INR" ? t.inr : t.usd;
    return m === 0 ? money(0) : money(m);
  };

  // Resume checkout after a login round-trip, or when arriving from the QAShift
  // FDE "Pay & start now" deep link (?checkout=pro|team|starter|growth|scale).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const c = q.get("checkout");
    const i = q.get("interval");
    const resumeInterval = i === "yearly" || i === "monthly" ? i : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time resume of the period chosen before sign-in
    if (resumeInterval) setBillingInterval(resumeInterval);
    if (c && CHECKOUT_TIERS.includes(c as CheckoutTier)) startCheckout(c as CheckoutTier, resumeInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tierName = (t: string) => ({ solo: "Solo", pro: "Pro", team: "Team", starter: "Starter", growth: "Growth", scale: "Scale" }[t] ?? t);

  // Paid tier → Razorpay checkout. If not signed in, bounce to login and come
  // back to /pricing so the user can complete the purchase.
  async function startCheckout(tier: CheckoutTier, chosen: "monthly" | "yearly" = interval) {
    // Yearly only exists for the self-serve tiers (and only when configured).
    const period = chosen === "yearly" && billing.yearly && ["solo", "pro", "team"].includes(tier) ? "yearly" : "monthly";
    setDeepLink(tier); // remember the tier for the modal label + retry
    setBusy(tier);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, currency, interval: period }),
      });
      if (res.status === 401) {
        // Not signed in — send to login, then resume checkout on return.
        window.location.href = "/login?next=" + encodeURIComponent(`/pricing?checkout=${tier}&interval=${period}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");

      // Preferred: open the Razorpay Checkout modal in-page.
      if (data.subscriptionId && data.keyId && (await loadRazorpay()) && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: data.keyId,
          subscription_id: data.subscriptionId,
          name: "Verity",
          description: `Verity ${tierName(tier)} — ${period}`,
          theme: { color: "#4f46e5" },
          handler: () => window.location.assign("/dashboard?upgraded=1"),
          modal: { ondismiss: () => setBusy(null) },
        });
        rzp.open();
        return;
      }
      // Fallback: hosted Razorpay page.
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
      else throw new Error("Checkout unavailable — please contact us.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <div className={styles.pricingCards}>
      {/* Animated checkout-handoff modal — the QAShift → Verity → Razorpay
          hand-off is never a silent page load; the user always sees what's up. */}
      {(busy || error) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm border border-neutral-200 bg-background p-8 text-center shadow-2xl dark:border-neutral-800">
            {error ? (
              <>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600"><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg>
                </div>
                <h3 className="mt-4 text-base font-semibold">Checkout couldn&apos;t start</h3>
                <p className="mt-1.5 text-sm text-neutral-500">{error}</p>
                <div className="mt-5 flex justify-center gap-2">
                  <button onClick={() => { setError(""); if (deepLink) startCheckout(deepLink as CheckoutTier); }} className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">Try again</button>
                  <a href="mailto:hello@qashifthq.com" className="border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">Contact us</a>
                </div>
                <button onClick={() => { setError(""); setDeepLink(null); setBusy(null); }} className="mt-3 text-xs text-neutral-400 hover:text-neutral-600">Dismiss</button>
              </>
            ) : (
              <>
                <svg className="mx-auto h-10 w-10 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" /><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                <h3 className="mt-4 text-base font-semibold">Opening secure checkout{deepLink ? ` — ${tierName(deepLink)}` : ""}…</h3>
                <p className="mt-1.5 text-sm text-neutral-500">The Razorpay payment window is loading. If you&apos;re not signed in yet, we&apos;ll take you to sign in first, then bring you right back.</p>
                <p className="mt-3 text-[11px] text-neutral-400">Billing runs on Verity — the QAShift engine.</p>
              </>
            )}
          </div>
        </div>
      )}
      {/* Contrast anchor — a managed QA hire runs $8k–15k/mo; against that the
          self-serve prices below read as almost free. */}
      <p className={styles.costAnchor}>
        A dedicated QA hire can cost <s>$8,000+/mo</s>. Managed Verity with a forward-deployed engineer starts at <strong>$499/mo</strong>. Or start self-serve from <em>$0</em>.
      </p>
      {/* Currency toggle — above the cards, matching the platform pattern */}
      <div className={styles.currencyRow}>
        {billing.yearly && (
          <div className={styles.currencyToggle} role="group" aria-label="Billing period">
            {(["monthly", "yearly"] as const).map((i) => (
              <button key={i} onClick={() => setBillingInterval(i)} aria-pressed={interval === i}
                className={`${styles.currencyButton} ${interval === i ? styles.currencyActive : ""}`}>
                {i === "monthly" ? "Monthly" : "Annual · save 20%"}
              </button>
            ))}
          </div>
        )}
        <div className={styles.currencyToggle}>
          {(["USD", "INR"] as const).map((c) => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`${styles.currencyButton} ${currency === c ? styles.currencyActive : ""}`}>
              {c === "USD" ? "$ USD" : "₹ INR"}
            </button>
          ))}
        </div>
      </div>

      <div className={`${styles.tierGrid} ${tiers.length === 4 ? styles.tierGrid4 : ""}`}>
        {tiers.map((t) => (
          <div key={t.name} className={`${styles.tier} ${t.highlight ? styles.tierHighlight : ""}`}>
            {t.highlight && (
              <div className={styles.popular}>MOST POPULAR</div>
            )}
            <div className={styles.tierKind}>SELF-SERVE</div>
            <h3>{t.name}</h3>
            <p className={styles.blurb}>{t.blurb}</p>
            <div className={styles.price}>
              <strong>{fmt(t)}</strong>
              <span>{t.usd === 0 ? "" : "/mo"}</span>
            </div>
            {t.usd !== 0 && (
              <div className={styles.billedNote}>{yearly(t) ? `${money(yearly(t)!)} billed yearly` : "billed monthly"}</div>
            )}
            <div className={styles.cap}>{t.cap}</div>
            <ul className={styles.featureList}>
              {t.features.map((f) => <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>)}
              {t.note && <li><span>·</span>{t.note}</li>}
            </ul>
            {t.missing && (
              <div className={styles.missing}>
                <p>NOT INCLUDED</p>
                <ul>
                  {t.missing.map((m) => <li key={m}><span>✕</span><span>{m}</span></li>)}
                </ul>
              </div>
            )}
            {!t.missing && <div className={styles.spacer} />}
            {t.paidTier ? (
              <button
                onClick={() => startCheckout(t.paidTier!)}
                disabled={busy === t.paidTier}
                className={t.highlight ? styles.ctaPrimary : styles.cta}
              >
                {busy === t.paidTier ? "Starting checkout…" : t.cta.label}
              </button>
            ) : (
              <Link href={t.cta.href} className={t.highlight ? styles.ctaPrimary : styles.cta}>
                {t.cta.label}
              </Link>
            )}
          </div>
        ))}

        <div className={styles.fdeTier}>
          <div>
            <div className={styles.fdeKind}>MANAGED TESTING · FROM $499/MO</div>
            <h3>Want an engineer accountable for the suite?</h3>
            <p>A forward-deployed QAShift engineer builds, maintains and triages your suite inside your release rhythm — you get the outcome, not another tool to run.</p>
          </div>
          <div className={styles.fdeRight}>
            <ul>
              {["An engineer who owns strategy, coverage and upkeep", "Failure triage on every run", "Merge-blocking on full regression", "Regression & deploy-confidence predictions", "Unlimited AI-written tests"].map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a href="https://qashifthq.com/pricing" target="_blank" rel="noopener noreferrer" className={styles.ctaPrimary}>See managed plans →</a>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

      <p className={styles.footnote}>
        Same pricing across the QAShift platform. <a href="https://qashifthq.com/pricing" target="_blank" rel="noopener noreferrer">View full managed pricing →</a>
      </p>
    </div>
  );
}
