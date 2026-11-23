"use client";

import { useState } from "react";

const DEFAULT_API = "https://verity.qashifthq.com";

/**
 * Reports setup: the reporter-first path (like other Playwright reporting
 * tools). No agents, no CI rewrite: one dev dependency and one config line.
 */
export type ProjectToken = { id: string; name: string; token: string };

/** Step 3 helper: the real project token, masked until revealed, ready to copy. */
function TokenStep({ projects }: { projects: ProjectToken[] }) {
  const [pid, setPid] = useState(projects[0]?.id);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = projects.find((x) => x.id === pid) ?? projects[0];
  if (!p) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(p.token); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* blocked */ } };
  return (
    <div className="mt-1.5 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      {projects.length > 1 && (
        <label className="mb-2 flex items-center gap-2 text-[12.5px] text-neutral-500">
          Project
          <select value={pid} onChange={(e) => { setPid(e.target.value); setShown(false); }} className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-[12.5px] text-neutral-900 dark:border-neutral-700 dark:text-neutral-100">
            {projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12px] text-neutral-500">QASHIFT_TOKEN</span>
        <code className="min-w-0 flex-1 truncate rounded bg-neutral-950 px-2.5 py-1.5 font-mono text-[12px] text-neutral-100">{shown ? p.token : "•".repeat(28)}</code>
        <button type="button" onClick={() => setShown((v) => !v)} className="rounded border border-neutral-300 px-2 py-1 text-[11.5px] dark:border-neutral-700">{shown ? "Hide" : "Reveal"}</button>
        <button type="button" onClick={copy} className="rounded bg-neutral-900 px-2.5 py-1 text-[11.5px] font-medium text-white dark:bg-white dark:text-neutral-900">{copied ? "Copied" : "Copy token"}</button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
        In GitHub: <b className="font-medium text-neutral-700 dark:text-neutral-300">Settings → Secrets and variables → Actions → New repository secret</b>, name it <code className="font-mono">QASHIFT_TOKEN</code> and paste. Other CI tools have a similar &ldquo;secret variables&rdquo; setting. Keep it private, like a password.
      </p>
    </div>
  );
}

export function ReporterSetup({ apiUrl, compact = false, projects = [] }: { apiUrl: string; compact?: boolean; projects?: ProjectToken[] }) {
  const custom = apiUrl.replace(/\/$/, "") !== DEFAULT_API;
  type Step = { t: string; code: string; token?: boolean; done?: string };
  const tabs: { id: "pw" | "junit"; label: string; steps: Step[]; note: string }[] = [
    {
      id: "pw" as const,
      label: "Playwright",
      steps: [
        { t: "Install the reporter", code: "npm i -D @qashifthq/playwright-reporter" },
        {
          t: "Add it to playwright.config",
          code: `reporter: [\n  ['list'],\n  ['@qashifthq/playwright-reporter'${custom ? `, { apiUrl: '${apiUrl}' }` : ""}],\n],`,
        },
        { t: "Add your project token to CI", code: "QASHIFT_TOKEN=<your project token>", token: true },
        { t: "Run your tests as usual", code: "npx playwright test", done: "Results appear on this page a few seconds after the run ends." },
      ],
      note: "Works in any CI and on your laptop. Turn on retries to get flaky-test detection.",
    },
    {
      id: "junit" as const,
      label: "Any framework (JUnit XML)",
      steps: [
        { t: "Make your runner write JUnit XML", code: "# Jest: jest-junit · pytest: --junitxml=results.xml\n# Cypress, Go, JUnit, .NET: built-in JUnit output" },
        { t: "Add your project token to CI", code: "QASHIFT_TOKEN=<your project token>", token: true },
        { t: "Upload it after the test step", code: `npx @qashifthq/verity upload results.xml --token $QASHIFT_TOKEN${custom ? `\n# set QASHIFT_API_URL=${apiUrl}` : ""}`, done: "Results appear on this page a few seconds after the upload." },
      ],
      note: "Retries that appear as repeated test cases are counted as flaky.",
    },
  ];
  const [tab, setTab] = useState(tabs[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const t = tabs.find((x) => x.id === tab)!;
  const copy = async (code: string, key: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(key); setTimeout(() => setCopied(null), 1400); } catch { /* blocked */ }
  };

  return (
    <div className={compact ? "" : "rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"}>
      {!compact && (
        <>
          <h3 className="text-sm font-semibold">Connect the tests you already run</h3>
          <p className="mt-1 text-[13px] text-neutral-500">About two minutes. No agents and no pipeline rewrite. Pick how your tests run today.</p>
        </>
      )}
      <div role="tablist" aria-label="How your tests run" className="mt-3 inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
        {tabs.map((x) => (
          <button key={x.id} role="tab" type="button" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
            className={`rounded px-3 py-1.5 text-[12.5px] ${tab === x.id ? "bg-white font-medium text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white" : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"}`}>
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel"><ol className="mt-4 space-y-3">
        {t.steps.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white dark:bg-white dark:text-neutral-900">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{s.t}</div>
              <div className="relative mt-1.5">
                {s.token && projects.length ? <TokenStep projects={projects} /> : (
                  <>
                    <pre className="overflow-x-auto rounded-md bg-neutral-950 px-3 py-2.5 pr-16 font-mono text-[12px] leading-relaxed text-neutral-100">{s.code}</pre>
                    <button type="button" onClick={() => copy(s.code, `${tab}-${i}`)} className="absolute right-2 top-2 rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:text-white">
                      {copied === `${tab}-${i}` ? "Copied" : "Copy"}
                    </button>
                  </>
                )}
                {s.done && <p className="mt-1.5 text-[12px] text-emerald-700 dark:text-emerald-400">{s.done}</p>}
              </div>
            </div>
          </li>
        ))}
      </ol></div>
      <p className="mt-3 text-[12px] text-neutral-500">{t.note}</p>
    </div>
  );
}
