import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
import type { Enums } from "@/lib/supabase/database.types";

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

export default async function UsagePage() {
  const orgCtx = await getPrimaryOrg();
  const supabase = await createClient();
  const plan = planFor(orgCtx?.org.plan);
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
        <p className="mt-1 text-sm text-neutral-500">Everything metered, in the open — no hidden credit burn. Monthly meters reset on the 1st (UTC). <strong className="text-neutral-700 dark:text-neutral-300">Runs in your own CI are always unlimited and never metered.</strong></p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">This month · organization-wide</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Meter label="AI test generations" used={gensThisMonth ?? 0} cap={plan.testGensPerMonth} note="Every AI-authored test (UI, API, visual, agent). Regenerating/healing a test counts as one." />
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
          <li><strong>AI generations</strong> are the only real AI spend — capped per month, org-wide, and shown above to the exact count.</li>
          <li><strong>Cloud runs &amp; cloud trials</strong> run on <em>our</em> infra, so they&apos;re capped for convenience/anti-abuse. <strong>Local runs from the MCP run on your machine and are never metered.</strong></li>
          <li><strong>CI runs are unlimited</strong> — the product is meant to live in your pipeline. Wire it in <Link href={orgCtx ? `/dashboard` : "/dashboard"} className="text-indigo-600 underline">CI Setup</Link> and stop touching these caps entirely.</li>
        </ul>
        <p className="mt-3">Need more headroom? <Link href="/pricing" className="text-indigo-600 underline">Compare plans →</Link></p>
      </section>
    </div>
  );
}
