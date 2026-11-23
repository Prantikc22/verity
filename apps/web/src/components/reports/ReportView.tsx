import type { ReactNode } from "react";
import { KpiStrip, Panel, fmtDuration, th, td } from "@/components/shell/ui";
import type { ReportData, ReportRow } from "@/lib/reports/build";

/** Read-only report body, shared by the workspace Reports page and public share links. */
export function ReportView({ data, days, extraPanel, usage }: { data: ReportData; days: number; extraPanel?: ReactNode; usage?: ReactNode }) {
  const { total, passed, failed, flaky, buckets, maxDay } = data;
  return (
    <>
      <KpiStrip items={[
        { label: "Test results", value: total.toLocaleString(), sub: `${data.runs} runs` },
        { label: "Pass rate", value: total ? `${((passed / total) * 100).toFixed(1)}%` : "—", tone: total && passed / total >= 0.95 ? "ok" : "warn" },
        { label: "Failed · flaky", value: `${failed} · ${flaky}`, tone: failed ? "bad" : flaky ? "warn" : "ok" },
        { label: "Median run time", value: fmtDuration(data.medianMs) },
      ]} />
      {usage}

      <Panel className="mt-5" title="Results per day" action={<span className="flex gap-3"><Key c="bg-emerald-500" l="passed" /><Key c="bg-amber-400" l="flaky" /><Key c="bg-red-500" l="failed" /></span>}>
        <div role="img" aria-label={`Daily results for the last ${days} days`} className="flex h-40 items-end gap-1">
          {buckets.map((b) => {
            const n = b.passed + b.failed + b.flaky;
            return (
              <div key={b.key} className="relative flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${b.passed} passed, ${b.flaky} flaky, ${b.failed} failed`}>
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-[2px]" style={{ height: `${Math.max((n / maxDay) * 100, n ? 3 : 1)}%` }}>
                  <span className="bg-emerald-500" style={{ flex: b.passed }} /><span className="bg-amber-400" style={{ flex: b.flaky }} /><span className="bg-red-500" style={{ flex: b.failed }} />
                  {n === 0 && <span className="flex-1 bg-neutral-200 dark:bg-neutral-800" />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11.5px] text-neutral-400"><span>{buckets[0].label}</span><span>{buckets[buckets.length - 1].label}</span></div>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <TestTable title="Flakiest tests" empty="No flaky tests. Failures that pass on retry show up here." rows={data.flakiest} />
        <TestTable title="Most failing tests" empty="No failures in this range." rows={data.failing} />
        <TestTable title="Slowest tests" empty="No timing data yet." rows={data.slowest} />
        {extraPanel}
      </div>
    </>
  );
}

function Key({ c, l }: { c: string; l: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-sm ${c}`} />{l}</span>;
}

function TestTable({ title, rows, empty }: { title: string; empty: string; rows: ReportRow[] }) {
  const tone = { warn: "text-amber-700 dark:text-amber-400", bad: "text-red-700 dark:text-red-400", neutral: "text-neutral-900 dark:text-neutral-100" };
  return (
    <Panel title={title} flush>
      {rows.length === 0 ? <p className="p-4 text-[13px] text-neutral-500">{empty}</p> : (
        <table className="w-full text-[13px]">
          <thead className="sr-only"><tr><th className={th}>Test</th><th className={th}>Value</th></tr></thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={`${td} max-w-0 w-full`}><div className="truncate font-medium">{r.name}</div><div className="truncate font-mono text-[11.5px] text-neutral-500">{r.sub}</div></td>
                <td className={`${td} whitespace-nowrap text-right`}><div className={`tnum font-semibold ${tone[r.tone]}`}>{r.value}</div><div className="text-[11.5px] text-neutral-500">{r.note}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
