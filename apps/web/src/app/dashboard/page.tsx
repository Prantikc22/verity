import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { redirect } from "next/navigation";
import { workspaceModeOf } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { entitlementsFor } from "@/lib/entitlements";
import { AGENTS } from "@/lib/catalog";
import { KpiStrip, Panel, PageHeader, Button, Empty, MiniBars, StatusPill, daysAgoISO, fmtDuration, timeAgo } from "@/components/shell/ui";
import { RunsTable, RUN_COLUMNS, type RunRow } from "@/components/shell/RunsTable";

export const metadata: Metadata = { title: "Overview", robots: { index: false } };

export default async function OverviewPage() {
  const orgCtx = await getPrimaryOrg();
  if (workspaceModeOf(orgCtx?.org) === "reports") redirect("/dashboard/reports");
  const ent = entitlementsFor(orgCtx?.org);
  const orgId = orgCtx?.org.id;
  const supabase = await createClient();
  const since = daysAgoISO(30);

  const [{ data: projects }, { data: runs }, { data: a11y }] = orgId
    ? await Promise.all([
        supabase.from("projects").select("id, name, repo, default_branch, created_at").eq("org_id", orgId).order("created_at", { ascending: false }),
        supabase.from("test_runs").select(RUN_COLUMNS).eq("org_id", orgId).gte("created_at", since).order("created_at", { ascending: false }).limit(300),
        supabase.from("a11y_scans").select("project_id, score, violations_count, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(50),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const list = (runs ?? []) as RunRow[];
  const done = list.filter((r) => r.status === "completed");
  const results = done.reduce((n, r) => n + r.total, 0);
  const passed = done.reduce((n, r) => n + r.passed, 0);
  const flaky = done.reduce((n, r) => n + r.flaky, 0);
  const failedRuns = done.filter((r) => r.failed > 0).length;
  const durations = done.map((r) => r.duration_ms).filter((d): d is number => !!d).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
  const names = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const recent = [...done].slice(0, 30).reverse();
  const perProject = new Map<string, RunRow[]>();
  for (const r of list) perProject.set(r.project_id, [...(perProject.get(r.project_id) ?? []), r]);
  const latestA11y = new Map<string, { score: number | null }>();
  for (const s of a11y ?? []) if (!latestA11y.has(s.project_id)) latestA11y.set(s.project_id, { score: s.score });

  if (!projects || projects.length === 0) {
    return (
      <>
        <PageHeader title="Overview" lead="Create a project to connect a staging URL, an OpenAPI spec, a repository or your existing Playwright tests." />
        <Empty title="No projects yet" body="A project is one app or service. All six agents are available on it from the start." href="/dashboard/projects" cta="Create your first project" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Overview" lead="Everything that ran across your projects in the last 30 days." action={<Button href="/dashboard/runs" variant="secondary">All runs</Button>} />

      {list.length === 0 && <GetStarted projectId={projects[projects.length - 1].id} />}

      {list.length > 0 && <KpiStrip items={[
        { label: "Test results", value: results.toLocaleString(), sub: `${done.length} runs` },
        { label: "Pass rate", value: results ? `${((passed / results) * 100).toFixed(1)}%` : "—", tone: results && passed / results >= 0.95 ? "ok" : results ? "warn" : undefined, sub: `${failedRuns} failing run${failedRuns === 1 ? "" : "s"}` },
        { label: "Flaky results", value: flaky.toLocaleString(), tone: flaky ? "warn" : undefined, sub: results ? `${((flaky / results) * 100).toFixed(1)}% of results` : undefined },
        { label: "Median run time", value: fmtDuration(median), sub: "completed runs" },
      ]} />}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {recent.length > 1 && (
            <Panel title="Last runs" action={<span className="flex items-center gap-3"><Legend c="bg-emerald-500" l="passed" /><Legend c="bg-amber-400" l="flaky" /><Legend c="bg-red-500" l="failed" /></span>}>
              <MiniBars label="Results of the most recent runs" values={recent.map((r) => r.total)} tones={recent.map((r) => (r.failed ? "bad" : r.flaky ? "warn" : "ok"))} height={64} />
              <div className="mt-2 flex justify-between text-[11.5px] text-neutral-400"><span>{timeAgo(recent[0].created_at)}</span><span>latest</span></div>
            </Panel>
          )}
          <Panel title="Recent runs" action={<Link href="/dashboard/runs" className="hover:text-neutral-900">View all →</Link>} flush>
            {list.length ? <RunsTable runs={list.slice(0, 8)} projectNames={names} /> : <p className="p-4 text-[13px] text-neutral-500">No runs in the last 30 days. Runs show up here as soon as your tests report in.</p>}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Projects" action={<Link href="/dashboard/projects" className="hover:text-neutral-900">Manage</Link>} flush>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {projects.slice(0, 6).map((p) => {
                const last = (perProject.get(p.id) ?? []).find((r) => r.status === "completed");
                const a = latestA11y.get(p.id);
                return (
                  <li key={p.id}>
                    <Link href={`/dashboard/projects/${p.id}`} className="block px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-950">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium">{p.name}</span>
                        <span className={`h-2 w-2 shrink-0 rounded-full ${!last ? "bg-neutral-300" : last.failed ? "bg-red-500" : last.flaky ? "bg-amber-400" : "bg-emerald-500"}`} aria-label={!last ? "no runs" : last.failed ? "failing" : "passing"} />
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-neutral-500">
                        <span className="truncate font-mono">{p.repo ?? "no repo"}</span>
                        <span className="shrink-0">{last ? timeAgo(last.created_at) : "no runs"}{a?.score != null ? ` · a11y ${Math.round(a.score)}` : ""}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Agents" action={<span>{ent.label}</span>} flush>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {AGENTS.map((a) => (
                <li key={a.key} className="flex items-center justify-between px-4 py-2">
                  <span className="text-[13px]"><span className="font-medium">{a.codename}</span> <span className="text-neutral-500">{a.name.replace(" Agent", "")}</span></span>
                  <StatusPill status={a.status} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Legend({ c, l }: { c: string; l: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-sm ${c}`} />{l}</span>;
}

/** First-run choice: two plain-English ways to start. */
function GetStarted({ projectId }: { projectId: string }) {
  const paths = [
    {
      href: `/dashboard/projects/${projectId}/create`, cta: "Create tests",
      title: "Let AI agents write tests", body: "Paste your app's address. Agents explore it and propose a test plan; you keep the tests you want.",
      meta: "No code needed · 2 credits per UI test",
    },
    {
      href: "/dashboard/reports", cta: "Connect my tests",
      title: "Connect tests you already have", body: "Already run Playwright, Jest, pytest or Cypress? See every run, flaky tests and failures in one place.",
      meta: "About two minutes · free",
    },
  ];
  return (
    <section aria-label="Get started" className="mb-5 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-[15px] font-semibold">Get started</h2>
      <p className="mt-0.5 text-[13px] text-neutral-500">Pick one. You can do both later.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {paths.map((p) => (
          <Link key={p.href} href={p.href} className="group flex flex-col rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400 hover:shadow-sm dark:border-neutral-800 dark:hover:border-neutral-600">
            <span className="text-[14px] font-medium">{p.title}</span>
            <span className="mt-1 text-[13px] leading-relaxed text-neutral-500">{p.body}</span>
            <span className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[12px] text-neutral-400">{p.meta}</span>
              <span className="shrink-0 whitespace-nowrap rounded-md bg-neutral-900 px-3 py-1.5 text-[12.5px] font-medium text-white group-hover:bg-neutral-700 dark:bg-white dark:text-neutral-900">{p.cta} →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
