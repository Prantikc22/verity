"use client";

import { useState } from "react";

const DEFAULT_API = "https://verity.qashifthq.com";

/**
 * Reports setup: the reporter-first path (like other Playwright reporting
 * tools). No agents, no CI rewrite: one dev dependency and one config line.
 */
export function ReporterSetup({ apiUrl, compact = false }: { apiUrl: string; compact?: boolean }) {
  const custom = apiUrl.replace(/\/$/, "") !== DEFAULT_API;
  const tabs = [
    {
      id: "pw",
      label: "Playwright",
      steps: [
        { t: "Install the reporter", code: "npm i -D @qashifthq/playwright-reporter" },
        {
          t: "Add it to playwright.config",
          code: `reporter: [\n  ['list'],\n  ['@qashifthq/playwright-reporter'${custom ? `, { apiUrl: '${apiUrl}' }` : ""}],\n],`,
        },
        { t: "Add QASHIFT_TOKEN to your CI secrets", code: "QASHIFT_TOKEN=<your project token>" },
      ],
      note: "Works in any CI and on your laptop. Turn on retries to get flaky-test detection.",
    },
    {
      id: "junit",
      label: "Any framework (JUnit XML)",
      steps: [
        { t: "Make your runner write JUnit XML", code: "# Jest: jest-junit · pytest: --junitxml=results.xml\n# Cypress, Go, JUnit, .NET: built-in JUnit output" },
        { t: "Upload it after the test step", code: `npx @qashifthq/verity upload results.xml --token $QASHIFT_TOKEN${custom ? `\n# set VERITY_API_URL=${apiUrl}` : ""}` },
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
          <h3 className="text-sm font-semibold">Send results from the tests you already run</h3>
          <p className="mt-1 text-[13px] text-neutral-500">No agents and no pipeline rewrite. Pick how your tests run today.</p>
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
                <pre className="overflow-x-auto rounded-md bg-neutral-950 px-3 py-2.5 pr-16 font-mono text-[12px] leading-relaxed text-neutral-100">{s.code}</pre>
                <button type="button" onClick={() => copy(s.code, `${tab}-${i}`)} className="absolute right-2 top-2 rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:text-white">
                  {copied === `${tab}-${i}` ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol></div>
      <p className="mt-3 text-[12px] text-neutral-500">{t.note}</p>
    </div>
  );
}
