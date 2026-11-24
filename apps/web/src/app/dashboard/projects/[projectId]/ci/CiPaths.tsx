"use client";

import { useState } from "react";

/** The two ways to use QAShift in CI, as a clear either/or. */
export function CiPaths({ report, agents }: { report: React.ReactNode; agents: React.ReactNode }) {
  const [tab, setTab] = useState<"report" | "agents">("report");
  const opts = [
    { id: "report" as const, title: "Send results from tests you already have", body: "Playwright, Jest, pytest, Cypress… Add a reporter, see every run here. About two minutes." },
    { id: "agents" as const, title: "Run the tests QAShift wrote for you", body: "Pick which agent tests run on pull requests and on merge, then commit one workflow file." },
  ];
  return (
    <div>
      <div role="tablist" aria-label="How you want to use CI" className="grid gap-3 md:grid-cols-2">
        {opts.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={tab === o.id} onClick={() => setTab(o.id)}
            className={`rounded-xl border p-4 text-left transition ${tab === o.id ? "border-neutral-900 bg-white shadow-sm ring-1 ring-neutral-900 dark:border-white dark:bg-neutral-900 dark:ring-white" : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800"}`}>
            <span className="flex items-center gap-2 text-[14px] font-medium">
              <span className={`grid h-4 w-4 place-items-center rounded-full border ${tab === o.id ? "border-neutral-900 dark:border-white" : "border-neutral-300"}`}>{tab === o.id && <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-white" />}</span>
              {o.title}
            </span>
            <span className="mt-1 block pl-6 text-[12.5px] leading-relaxed text-neutral-500">{o.body}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-5">{tab === "report" ? report : agents}</div>
    </div>
  );
}
