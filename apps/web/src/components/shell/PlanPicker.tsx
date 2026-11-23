"use client";

import { useEffect, useState } from "react";

type P = { key: string; product: "autonomous" | "reports" | "managed"; name: string; usd: number; inr: number; requiresScope?: boolean; current: boolean };
type RzpOptions = { key: string; subscription_id: string; name: string; description: string; prefill?: { email?: string }; theme?: { color: string }; handler: (r: Record<string, string>) => void; modal?: { ondismiss?: () => void } };
type RzpCtor = new (o: RzpOptions) => { open: () => void };
const rzpWin = () => window as unknown as { Razorpay?: RzpCtor };

const GROUPS: [P["product"], string][] = [["autonomous", "Autonomous QA"], ["reports", "Reports"], ["managed", "Managed QA"]];

function loadCheckout(): Promise<void> {
  if (rzpWin().Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load checkout."));
    document.body.appendChild(s);
  });
}

export function PlanPicker({ plans, initial }: { plans: P[]; initial?: string }) {
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [scope, setScope] = useState(false);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    if (initial) document.getElementById(`plan-${initial}`)?.scrollIntoView({ block: "center" });
  }, [initial]);

  async function buy(p: P) {
    setMsg(null);
    setBusy(p.key);
    try {
      const r = await fetch("/api/billing/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: p.key, currency, acceptScope: p.requiresScope ? scope : undefined }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not start checkout.");
      setTestMode(Boolean(j.testMode));
      await loadCheckout();
      const Rzp = rzpWin().Razorpay;
      if (!Rzp) throw new Error("Checkout did not load.");
      const rzp = new Rzp({
        key: j.keyId,
        subscription_id: j.subscriptionId,
        name: "QAShift",
        description: j.name,
        prefill: { email: j.email },
        theme: { color: "#4A2FE0" },
        handler: async (resp) => {
          const v = await fetch("/api/billing/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(resp) });
          const vj = await v.json();
          if (v.ok && vj.active) {
            setMsg({ tone: "ok", text: `${p.name} is active.` });
            window.setTimeout(() => window.location.reload(), 900);
          } else {
            setMsg({ tone: "bad", text: vj.error || "Payment received; activation is pending. Refresh in a minute." });
          }
          setBusy(null);
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.open();
    } catch (e) {
      setMsg({ tone: "bad", text: e instanceof Error ? e.message : "Checkout failed." });
      setBusy(null);
    }
  }

  const price = (p: P) => (currency === "USD" ? `$${p.usd.toLocaleString("en-US")}` : `₹${p.inr.toLocaleString("en-IN")}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
          {(["USD", "INR"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCurrency(c)} className={`rounded px-2.5 py-1 text-[12.5px] ${currency === c ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-600"}`}>{c}</button>
          ))}
        </div>
        <span className="text-[12px] text-neutral-500">Monthly. Taxes shown at checkout. Cancel any time.{testMode ? " Test mode: use Razorpay test cards." : ""}</span>
      </div>
      {msg && <p role="status" className={`rounded-md px-3 py-2 text-[13px] ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}
      {GROUPS.map(([g, label]) => (
        <section key={g} className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-200 px-4 py-2.5 text-[13px] font-semibold dark:border-neutral-800">{label}</div>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {plans.filter((p) => p.product === g).map((p) => (
              <li key={p.key} id={`plan-${p.key}`} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${initial === p.key ? "bg-violet-50/60 dark:bg-violet-950/30" : ""}`}>
                <span className="text-[13.5px]"><span className="font-medium">{p.name}</span> <span className="tnum text-neutral-500">{price(p)}/mo</span></span>
                {p.current ? (
                  <span className="text-[12.5px] font-medium text-emerald-700">Current plan</span>
                ) : (
                  <button type="button" disabled={busy !== null || (p.requiresScope && !scope)} onClick={() => buy(p)} className="h-8 rounded-md bg-neutral-950 px-3 text-[13px] font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950">
                    {busy === p.key ? "Opening…" : "Choose"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {g === "managed" && (
            <label className="flex items-start gap-2 border-t border-neutral-200 px-4 py-3 text-[12.5px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              <input type="checkbox" checked={scope} onChange={(e) => setScope(e.target.checked)} className="mt-0.5" />
              <span>I accept the managed QA scope: engineer hours are stated per plan, initial buildout uses those hours, journey counts are caps, and extra work is quoted and approved before it starts. <a href="https://qashifthq.com/managed-qa#terms" target="_blank" rel="noopener noreferrer" className="underline">Full terms</a></span>
            </label>
          )}
        </section>
      ))}
    </div>
  );
}
