import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { entitlementsFor } from "@/lib/entitlements";
import type { Enums } from "@/lib/supabase/database.types";
import { QS_PLANS } from "@/lib/billing/qs-plans";
import { PlanPicker } from "@/components/shell/PlanPicker";
import { CREDITS, UNLIMITED_CREDITS, nextResetDate } from "@/lib/credits";
import { AUTONOMOUS, REPORTS, MANAGED, isAutonomousKey, isReportsKey, isManagedKey } from "@/lib/catalog";

/** One plain line per plan, from the catalog, so buyers see what they get. */
function planSummary(product: string, key: string): string | undefined {
  if (product === "autonomous" && isAutonomousKey(key)) { const a = AUTONOMOUS[key]; return `${a.creditsPerMonth.toLocaleString()} agent credits a month · ${a.maxProjects} projects · ${a.seats} seats`; }
  if (product === "reports" && isReportsKey(key)) { const r = REPORTS[key]; return `${r.resultsPerMonth.toLocaleString()} test results a month · ${r.projects} projects · ${r.historyDays}-day history`; }
  if (product === "managed" && isManagedKey(key)) { const m = MANAGED[key]; const inc = AUTONOMOUS[m.includes]; return `${m.engineerHours ?? "Scoped"} QA engineer hours a month${m.namedLead ? " with a named lead" : ""} · includes ${inc.name} (${inc.creditsPerMonth.toLocaleString()} credits)`; }
  return undefined;
}

const AGENT_LABEL: Record<string, string> = {
  ui: "UI tests", api: "API tests", visual: "Visual checks", performance: "Performance",
  security: "Security", accessibility: "Accessibility", investigator: "Failure fixes", other: "AI-feature evals",
};
const REF_LABEL: Record<string, string> = {
  "ui-test": "Wrote a UI test", "ui-test:start": "Wrote your first test", "ui-test:mcp": "Wrote a UI test from your editor",
  "api-test": "Wrote an API test", "visual-test": "Wrote a visual check", "perf-script": "Wrote a performance script",
  "ai-eval": "Wrote an AI-feature eval", "ai-eval:suite": "Wrote an AI-feature eval suite", heal: "Suggested a fix for a broken test",
  "cloud:perf-smoke": "Ran a performance check in our cloud", "cloud:security-baseline": "Ran a security scan in our cloud",
};
const PRICE_LIST: [string, number | string][] = [
  ["Run tests in your own CI", "Free"],
  ["Write one UI test", CREDITS.uiTest],
  ["Write one API test", CREDITS.apiTest],
  ["Write one visual check", CREDITS.visualTest],
  ["Write a performance script or AI-feature eval", CREDITS.perfScript],
  ["Suggest a fix for a broken test", CREDITS.investigate],
  ["Performance check in our cloud", CREDITS.perfCloud],
  ["Security scan in our cloud", CREDITS.securityCloud],
];

export const metadata: Metadata = { title: "Usage", robots: { index: false } };

const UNLIMITED = 9999;

function Meter({ label, used, cap, note }: { label: string; used: number; cap: number; note?: string }) {
  const unlimited = cap > UNLIMITED;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(cap, 1)) * 100));
  const bar = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-500";
  return (
    <div className="border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="tnum text-sm text-neutral-500">{unlimited ? <span className="font-semibold text-emerald-600">Unlimited</span> : <><span className="font-semibold text-neutral-800 dark:text-neutral-100">{used}</span> / {cap}</>}</span>
      </div>
      {!unlimited && (
        <div className="mt-2 h-1.5 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {note && <p className="mt-1.5 text-[11px] text-neutral-400">{note}</p>}
    </div>
  );
}

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: wanted } = await searchParams;
  const orgCtx = await getPrimaryOrg();
  const supabase = await createClient();
  const plan = entitlementsFor(orgCtx?.org);
  const orgId = orgCtx?.org.id;

  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const monthISO = monthStart.toISOString();
  const CI_TRIGGERS: Enums<"run_trigger">[] = ["pr", "merge", "schedule", "predeploy"];

  const { data: projects } = orgId
    ? await supabase.from("projects").select("id, name").eq("org_id", orgId).order("created_at", { ascending: true })
    : { data: [] as { id: string; name: string }[] };
  const projectList = projects ?? [];

  // Org-wide meters.
  const [{ count: gensThisMonth }, { count: ciRunsThisMonth }] = orgId
    ? await Promise.all([
        supabase.from("tests").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", monthISO),
        supabase.from("test_runs").select("id", { count: "exact", head: true }).eq("org_id", orgId).in("trigger", CI_TRIGGERS).gte("created_at", monthISO),
      ])
    : [{ count: 0 }, { count: 0 }];

  // Credit ledger for this month (members can read their org's ledger via RLS).
  const { data: ledger } = orgId
    ? await supabase.from("usage_ledger").select("id, amount, agent, kind, ref, created_at").eq("org_id", orgId).eq("metric", "credits").gte("created_at", monthISO).order("created_at", { ascending: false }).limit(2000)
    : { data: [] as { id: number; amount: number; agent: string | null; kind: string; ref: string | null; created_at: string }[] };
  const rows = ledger ?? [];
  const signed = (r: { kind: string; amount: number }) => (r.kind === "debit" ? Number(r.amount) : r.kind === "refund" ? -Number(r.amount) : 0);
  const creditsUsed = Math.max(0, rows.reduce((n, r) => n + signed(r), 0));
  const creditLimit = plan.creditsPerMonth;
  const creditsUnlimited = creditLimit >= UNLIMITED_CREDITS;
  const creditsLeft = Math.max(0, creditLimit - creditsUsed);
  const creditPct = creditsUnlimited ? 0 : Math.min(100, Math.round((creditsUsed / Math.max(1, creditLimit)) * 100));
  const byAgent = new Map<string, number>();
  for (const r of rows) { const k = r.agent ?? "other"; byAgent.set(k, (byAgent.get(k) ?? 0) + signed(r)); }
  const agentSplit = [...byAgent.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const recent = rows.filter((r) => r.kind === "debit").slice(0, 8);
  const refundedIds = new Set(rows.filter((r) => r.kind === "refund" && r.ref?.startsWith("refund:")).map((r) => Number(r.ref!.slice(7))));
  const resetOn = nextResetDate().toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  const uiTestsLeft = Math.floor(creditsLeft / CREDITS.uiTest);

  // Per-project meters (cloud runs / cloud trials / maintained tests).
  const perProject = await Promise.all(
    projectList.map(async (p) => {
      const [{ count: tests }, { count: cloudRuns }, { count: cloudTrials }] = await Promise.all([
        supabase.from("tests").select("id", { count: "exact", head: true }).eq("project_id", p.id).neq("status", "archived"),
        supabase.from("test_runs").select("id", { count: "exact", head: true }).eq("project_id", p.id).eq("trigger", "manual").eq("branch", "cloud").gte("created_at", monthISO),
        supabase.from("test_runs").select("id", { count: "exact", head: true }).eq("project_id", p.id).eq("branch", "cloud-trial").gte("created_at", monthISO),
      ]);
      return { id: p.id, name: p.name, tests: tests ?? 0, cloudRuns: cloudRuns ?? 0, cloudTrials: cloudTrials ?? 0 };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <span className="border border-neutral-300 px-3 py-1 text-xs font-medium dark:border-neutral-700">{plan.name} plan</span>
        </div>
        <p className="mt-1 text-sm text-neutral-500">Agents use credits when they write tests or run checks in our cloud. <strong className="text-neutral-700 dark:text-neutral-300">Running your tests in your own CI is always free.</strong></p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Agent credits">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Agent credits this month</div>
            {creditsUnlimited ? (
              <div className="mt-1 text-3xl font-semibold tracking-tight text-emerald-600">Unlimited</div>
            ) : (
              <div className="tnum mt-1 text-3xl font-semibold tracking-tight">
                {creditsLeft.toLocaleString()} <span className="text-base font-normal text-neutral-500">left of {creditLimit.toLocaleString()}</span>
              </div>
            )}
            <p className="mt-1 text-[13px] text-neutral-500">
              {creditsUnlimited ? `${creditsUsed.toLocaleString()} used so far. Your plan keeps unlimited AI generation.` : <>Enough for about <b className="text-neutral-700 dark:text-neutral-200">{uiTestsLeft.toLocaleString()} more UI test{uiTestsLeft === 1 ? "" : "s"}</b>. Refills to {creditLimit.toLocaleString()} on {resetOn}.</>}
            </p>
          </div>
          <div className="text-right text-[12px] text-neutral-500">
            <div>{plan.label}</div>
            <div>All six agents share one pool</div>
          </div>
        </div>
        {!creditsUnlimited && (
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800" role="progressbar" aria-label="Credits used" aria-valuenow={creditPct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full ${creditPct >= 90 ? "bg-red-500" : creditPct >= 70 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${Math.max(creditPct, creditsUsed > 0 ? 2 : 0)}%` }} />
          </div>
        )}
        {creditPct >= 80 && !creditsUnlimited && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            You&apos;ve used {creditPct}% of this month&apos;s credits. <a href="#plans" className="font-medium underline">Upgrade</a> for more, or wait for the refill on {resetOn}.
          </p>
        )}

        <div className="mt-5 grid gap-5 border-t border-neutral-100 pt-4 sm:grid-cols-2 dark:border-neutral-800">
          <div>
            <div className="text-xs font-medium text-neutral-500">Where credits went</div>
            {agentSplit.length === 0 ? (
              <p className="mt-2 text-[13px] text-neutral-500">Nothing used yet this month.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {agentSplit.map(([k, v]) => (
                  <li key={k} className="flex items-center gap-2 text-[13px]">
                    <span className="w-28 shrink-0 text-neutral-600 dark:text-neutral-300">{AGENT_LABEL[k] ?? k}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><span className="block h-full rounded-full bg-indigo-400" style={{ width: `${Math.round((v / Math.max(1, creditsUsed)) * 100)}%` }} /></span>
                    <span className="tnum w-10 text-right text-neutral-500">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-neutral-500">Recent activity</div>
            {recent.length === 0 ? (
              <p className="mt-2 text-[13px] text-neutral-500">When an agent writes a test, it shows up here.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-baseline gap-2 text-[13px]">
                    <span className={`min-w-0 flex-1 truncate ${refundedIds.has(r.id) ? "text-neutral-400 line-through" : "text-neutral-600 dark:text-neutral-300"}`}>{REF_LABEL[r.ref ?? ""] ?? "Agent action"}</span>
                    <span className="shrink-0 text-[11.5px] text-neutral-400">{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <span className="tnum w-14 shrink-0 text-right text-neutral-500">{refundedIds.has(r.id) ? "refunded" : `−${Number(r.amount)}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs font-medium text-neutral-500">What uses credits</div>
          <table className="mt-2 w-full text-[13px]">
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {PRICE_LIST.map(([what, cost]) => (
                <tr key={what}><td className="py-1.5 text-neutral-600 dark:text-neutral-300">{what}</td><td className="tnum py-1.5 text-right font-medium">{typeof cost === "number" ? `${cost} credit${cost === 1 ? "" : "s"}` : <span className="text-emerald-600">{cost}</span>}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11.5px] text-neutral-400">If an agent fails or can&apos;t find a fix, the credits go straight back.</p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-xs font-medium text-neutral-500">{plan.managed ? "Managed QA" : "Billing"}</div>
          <div className="mt-1 font-medium">{plan.managed ? `${plan.managed.name} · ${plan.managed.engineerHours ?? "Scoped"} engineer hours a month` : plan.grandfathered ? "Your current price is kept" : "Billed monthly"}</div>
          <div className="mt-1 text-[12px] text-neutral-500">{plan.grandfathered ? "You keep your current plan, price and limits until you choose to change." : "Taxes are shown at checkout. Change or cancel any time below."}</div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">This month · organization-wide</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Meter label="Tests written by agents" used={gensThisMonth ?? 0} cap={plan.testGensPerMonth} note="A safety cap on tests per month, on top of credits." />
          <Meter label="Projects" used={projectList.length} cap={plan.maxProjects} note="Standing cap (not monthly)." />
          <Meter label="CI runs" used={ciRunsThisMonth ?? 0} cap={UNLIMITED + 1} note="Runs from your GitHub/GitLab/Jenkins pipeline. Never capped." />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-neutral-500">Per project</h2>
          <span className="text-[11px] text-neutral-400">caps: {plan.maxTests} tests · {plan.cloudRunsPerMonth} cloud runs/mo · {plan.cloudTrialsPerMonth} cloud trials/mo</span>
        </div>
        {perProject.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No projects yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-[11px] uppercase tracking-wide text-neutral-400 dark:border-neutral-800">
                  <th className="p-3 font-medium">Project</th>
                  <th className="p-3 font-medium">Saved tests</th>
                  <th className="p-3 font-medium">Cloud runs <span className="normal-case text-neutral-400">(mo)</span></th>
                  <th className="p-3 font-medium">Cloud trials <span className="normal-case text-neutral-400">(mo)</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {perProject.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3"><Link href={`/dashboard/projects/${p.id}`} className="font-medium hover:text-indigo-600">{p.name}</Link></td>
                    <td className="tnum p-3 text-neutral-600 dark:text-neutral-300">{p.tests} <span className="text-neutral-400">/ {plan.maxTests}</span></td>
                    <td className="tnum p-3 text-neutral-600 dark:text-neutral-300">{p.cloudRuns} <span className="text-neutral-400">/ {plan.cloudRunsPerMonth}</span></td>
                    <td className="tnum p-3 text-neutral-600 dark:text-neutral-300">{p.cloudTrials} <span className="text-neutral-400">/ {plan.cloudTrialsPerMonth}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border border-neutral-200 p-4 text-xs leading-relaxed text-neutral-500 dark:border-neutral-800">
        <p className="font-medium text-neutral-700 dark:text-neutral-300">How metering works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Credits</strong> pay for agent work: writing tests, suggesting fixes and cloud checks. One pool for all six agents; it refills on the 1st (UTC).</li>
          <li><strong>Cloud runs &amp; cloud trials</strong> run on <em>our</em> infra, so they&apos;re capped for convenience/anti-abuse. <strong>Local runs from the MCP run on your machine and are never metered.</strong></li>
          <li><strong>CI runs are unlimited</strong> — the product is meant to live in your pipeline. Wire it in <Link href={orgCtx ? `/dashboard` : "/dashboard"} className="text-indigo-600 underline">CI Setup</Link> and stop touching these caps entirely.</li>
        </ul>
        <p className="mt-3">Need more headroom? <Link href="/pricing" className="text-indigo-600 underline">Compare plans →</Link></p>
      </section>

      <section id="plans">
        <h2 className="mb-3 text-sm font-medium text-neutral-500">Change plan</h2>
        <PlanPicker initial={wanted} plans={QS_PLANS.filter((p) => !p.retired).map((p) => ({ key: p.key, product: p.product, name: p.name, usd: p.usd, inr: p.inr, requiresScope: p.requiresScope, summary: planSummary(p.product, p.planKey),
          current: (p.product === "autonomous" && orgCtx?.org.autonomous_plan === p.planKey) || (p.product === "reports" && orgCtx?.org.reports_plan === p.planKey) || (p.product === "managed" && orgCtx?.org.managed_plan === p.planKey) }))} />
      </section>
    </div>
  );
}
