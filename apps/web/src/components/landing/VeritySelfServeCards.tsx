"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
const CHECKOUT_TIERS = ["pro", "team", "starter", "growth", "scale"] as const;
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
  paidTier?: "pro" | "team";
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Cloud Sandbox",
    blurb: "Get the feel instantly in our cloud sandbox — no card.",
    usd: 0, inr: 0,
    cap: "AI UI tests — 15/month",
    features: [
      "AI test generation, UI — 15/month",
      "Try it instantly in our cloud sandbox",
      "Unlimited CI runs once you wire your pipeline",
    ],
    missing: [
      "Self-healing locators — broken tests stay broken",
      "Flake detection & confidence scoring",
      "API, visual & agent (AI) tests",
      "Regression & deploy-confidence predictions",
      "More than 1 project",
    ],
    cta: { label: "Start free", href: "/login?next=/dashboard" },
  },
  {
    name: "Self-Serve Pro",
    blurb: "The full engine, self-driven. No engineer, no call.",
    usd: 49, inr: 2999,
    cap: "AI UI + API tests — 200/month",
    features: [
      "AI test generation, UI + API — 200/month",
      "Every generated test self-heals its locators + flake detection",
      "Unlimited CI runs",
      "3 projects",
    ],
    missing: [
      "A forward-deployed engineer who owns your suite",
      "Merge-blocking PR gates + full predictions",
      "Visual, agent (AI), performance & security",
    ],
    cta: { label: "Start Self-Serve Pro", href: "/login?next=/pricing" },
    paidTier: "pro",
    highlight: true,
  },
  {
    name: "Team",
    blurb: "Self-serve, scaled for a whole team.",
    usd: 149, inr: 9999,
    cap: "AI UI + API tests — 750/month",
    features: [
      "AI test generation, UI + API — 750/month",
      "Every generated test self-heals its locators + flake detection",
      "Unlimited CI runs · 10 projects",
      "Priority support — still no engineer, no call",
    ],
    cta: { label: "Start Team", href: "/login?next=/pricing" },
    paidTier: "team",
  },
];

export function VeritySelfServeCards({ inIndia }: { inIndia: boolean }) {
  const [currency, setCurrency] = useState<"USD" | "INR">(inIndia ? "INR" : "USD");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fmt = (t: Tier) =>
    currency === "INR" ? (t.inr === 0 ? "₹0" : `₹${t.inr.toLocaleString("en-IN")}`) : t.usd === 0 ? "$0" : `$${t.usd}`;

  // Resume checkout after a login round-trip, or when arriving from the QAShift
  // FDE "Pay & start now" deep link (?checkout=pro|team|starter|growth|scale).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = new URLSearchParams(window.location.search).get("checkout");
    if (c && CHECKOUT_TIERS.includes(c as CheckoutTier)) startCheckout(c as CheckoutTier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paid tier → Razorpay checkout. If not signed in, bounce to login and come
  // back to /pricing so the user can complete the purchase.
  async function startCheckout(tier: CheckoutTier) {
    setBusy(tier);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, currency }),
      });
      if (res.status === 401) {
        // Not signed in — send to login, then resume checkout on return.
        window.location.href = "/login?next=" + encodeURIComponent("/pricing?checkout=" + tier);
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
          description: `Verity ${tier.charAt(0).toUpperCase() + tier.slice(1)} — monthly`,
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
    <div>
      {/* Currency toggle — above the cards, matching the platform pattern */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div className="inline-flex border border-neutral-300 p-0.5 dark:border-neutral-700">
          {(["USD", "INR"] as const).map((c) => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-3 py-1 text-xs font-medium transition ${currency === c ? "bg-indigo-600 text-white" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"}`}>
              {c === "USD" ? "$ USD" : "₹ INR"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => (
          <div key={t.name} className={`flex flex-col border p-6 ${t.highlight ? "border-indigo-500 dark:border-indigo-500" : "border-neutral-200 dark:border-neutral-800"}`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Self-serve · no FDE</div>
            <h3 className="mt-1 text-xl font-semibold">{t.name}</h3>
            <p className="mt-1 min-h-[40px] text-sm text-neutral-500">{t.blurb}</p>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-bold">{fmt(t)}</span>
              <span className="text-sm text-neutral-400">{t.usd === 0 ? "" : "/mo"}</span>
            </div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">{t.cap}</div>
            <ul className="mt-4 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
              {t.features.map((f) => <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>)}
              {t.note && <li className="flex gap-2 text-neutral-400"><span>·</span>{t.note}</li>}
            </ul>
            {t.missing && (
              <div className="mt-4 flex-1 border-t border-dashed border-neutral-200 pt-3 dark:border-neutral-800">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">You&apos;d be leaving on the table</p>
                <ul className="space-y-1.5 text-sm text-neutral-400 dark:text-neutral-500">
                  {t.missing.map((m) => <li key={m} className="flex gap-2"><span className="text-neutral-300 dark:text-neutral-600">✕</span><span className="line-through decoration-neutral-300 dark:decoration-neutral-700">{m}</span></li>)}
                </ul>
              </div>
            )}
            {!t.missing && <div className="flex-1" />}
            {t.paidTier ? (
              <button
                onClick={() => startCheckout(t.paidTier!)}
                disabled={busy === t.paidTier}
                className={`mt-5 block w-full px-4 py-2.5 text-center text-sm font-medium disabled:opacity-60 ${t.highlight ? "bg-indigo-600 text-white hover:bg-indigo-500" : "border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"}`}
              >
                {busy === t.paidTier ? "Starting checkout…" : t.cta.label}
              </button>
            ) : (
              <Link href={t.cta.href} className={`mt-5 block px-4 py-2.5 text-center text-sm font-medium ${t.highlight ? "bg-indigo-600 text-white hover:bg-indigo-500" : "border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"}`}>
                {t.cta.label}
              </Link>
            )}
          </div>
        ))}

        {/* FDE-backed tiers live on the canonical platform pricing page */}
        <div className="flex flex-col justify-between border border-amber-300 bg-amber-50/50 p-6 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">FDE-backed · Starter and up</div>
            <h3 className="mt-1 text-xl font-semibold">Want an engineer on it?</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">A forward-deployed engineer plus the full-discipline engine:</p>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-600 dark:text-neutral-300">
              {["Visual (screenshot) regression", "Agent (AI) test generation", "Performance & load testing", "Dynamic + static security scanning", "Regression & deploy-confidence predictions"].map((f) => (
                <li key={f} className="flex gap-2"><span className="text-amber-500">✓</span>{f}</li>
              ))}
            </ul>
          </div>
          <a href="https://qashifthq.com/pricing" target="_blank" rel="noopener noreferrer" className="mt-5 block bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-neutral-950 transition hover:bg-amber-400">
            See all six tiers →
          </a>
        </div>
      </div>

      {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

      <p className="mt-6 text-center text-xs text-neutral-500">
        Same pricing across the QAShift platform. <a href="https://qashifthq.com/pricing" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">View the full canonical pricing →</a>
      </p>
    </div>
  );
}
