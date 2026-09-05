"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Step { done: boolean; title: string; body: string; href: string; cta: string }

export function GettingStarted({ projectId, hasTests, hasRuns }: { projectId: string; hasTests: boolean; hasRuns: boolean }) {
  const key = `verity-onboarding-dismissed-${projectId}`;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Show until everything is done, unless the user dismissed it.
    const dismissed = localStorage.getItem(key) === "1";
    const timer = window.setTimeout(() => setHidden(dismissed || (hasTests && hasRuns)), 0);
    return () => window.clearTimeout(timer);
  }, [key, hasTests, hasRuns]);

  if (hidden) return null;

  const base = `/dashboard/projects/${projectId}`;
  const steps: Step[] = [
    // Goal-gradient: creating a workspace already counts, so users start with
    // visible progress instead of an empty 0%.
    { done: true, title: "Workspace created", body: "Your project is live — you're already underway.", href: base, cta: "" },
    { done: hasTests, title: "Generate your first tests", body: "Point Verity at a URL or your OpenAPI spec — it proposes tests and you pick which to keep.", href: `${base}/generate`, cta: "Generate" },
    { done: hasRuns, title: "Run them in your CI", body: "Pick the tests you want, copy the config for GitHub / GitLab / Jenkins. Runs are unlimited in your CI.", href: `${base}/ci`, cta: "CI Setup" },
    { done: false, title: "Invite your team", body: "Add teammates so they can see results. They join automatically when they sign in.", href: `/dashboard/team`, cta: "Invite" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="mb-8 border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/20">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">👋 Get started with Verity</h2>
          <p className="text-xs text-neutral-500">You&apos;re {pct}% set up · {doneCount}/{steps.length} done</p>
        </div>
        <button onClick={() => { localStorage.setItem(key, "1"); setHidden(true); }} className="text-xs text-neutral-400 hover:text-neutral-600">Dismiss</button>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950/60">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={i} className={`border p-3 ${s.done ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20" : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"}`}>
            <div className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${s.done ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800"}`}>{s.done ? "✓" : i + 1}</span>
              <span className="text-sm font-medium">{s.title}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">{s.body}</p>
            {!s.done && <Link href={s.href} className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline">{s.cta} →</Link>}
          </div>
        ))}
      </div>
    </section>
  );
}
