"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, planPrice, type Currency, type PlanTier } from "@/lib/plans";

const ORDER: PlanTier[] = ["free", "starter", "growth", "scale"];

export function PlanCards({
  currentTier,
  inIndia = false,
}: {
  currentTier: PlanTier | null;
  inIndia?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [error, setError] = useState("");
  // USD everywhere by default. Only inside India can users switch to INR.
  const [currency, setCurrency] = useState<Currency>(inIndia ? "INR" : "USD");

  async function choose(tier: PlanTier) {
    if (tier === "free") {
      router.push("/login?next=/dashboard");
      return;
    }
    setBusy(tier);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.push("/login?next=/dashboard");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {inIndia && (
        <div className="mb-6 inline-flex border border-neutral-300 p-0.5 text-xs dark:border-neutral-700">
          {(["USD", "INR"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-3 py-1 font-medium transition ${currency === c ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-500"}`}
            >
              {c === "USD" ? "$ USD" : "₹ INR"}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {ORDER.map((tier) => {
          const p = PLANS[tier];
          const isCurrent = currentTier === tier;
          const featured = tier === "growth";
          return (
            <div
              key={tier}
              className={`relative flex flex-col border p-6 ${
                featured ? "border-indigo-500 shadow-[0_0_0_1px_#6366f1]" : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              {featured && <div className="mb-3 inline-block w-fit bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Most popular</div>}
              {p.fde && !featured && <div className="mb-3 inline-block w-fit border border-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">Includes an FDE</div>}

              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-1 text-xs text-neutral-500">{p.tagline}</p>

              <div className="mt-3 text-3xl font-semibold tracking-tight">
                {planPrice(p, currency)}
                {p.priceUsd ? <span className="text-sm font-normal text-neutral-500">/mo</span> : null}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-neutral-400">{p.billingNote}</div>

              <ul className="mt-4 flex-1 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`mt-1 shrink-0 ${p.fde ? "text-amber-500" : "text-indigo-500"}`}><path d="M20 6L9 17l-5-5" /></svg>
                    {h}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => choose(tier)}
                disabled={isCurrent || busy === tier}
                className={`mt-6 px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
                  featured ? "bg-indigo-600 text-white hover:bg-indigo-500" : "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                }`}
              >
                {isCurrent ? "Current plan" : busy === tier ? "Starting…" : tier === "free" ? "Start free" : `Choose ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <p className="mt-4 text-xs text-neutral-500">
        Prices shown {inIndia ? "in your selected currency" : "in USD"}. <span className="font-medium text-neutral-700 dark:text-neutral-300">Every paid plan includes a forward-deployed engineer and unlimited CI runs.</span> Caps are on maintained tests, not runs. Annual billing saves 15%. Enterprise is custom — <a href="mailto:hello@qashifthq.com" className="underline">talk to us</a>.
      </p>
    </div>
  );
}
