import Link from "next/link";
import type { AgentStatus } from "@/lib/catalog";

/*
 * Workspace primitives. Deliberately quiet: white panels, 1px borders, 6px radii,
 * 13px UI text, tabular numbers, one accent. No gradients, glows or shadows.
 */

export function PageHeader({ title, lead, action, crumbs }: { title: string; lead?: React.ReactNode; action?: React.ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1.5 text-[12.5px] text-neutral-500">
            {crumbs.map((c) => (
              <span key={c.href} className="flex items-center gap-1.5"><Link href={c.href} className="hover:text-neutral-900 dark:hover:text-white">{c.label}</Link><span aria-hidden>/</span></span>
            ))}
          </nav>
        )}
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-neutral-950 dark:text-white">{title}</h1>
        {lead && <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-neutral-500">{lead}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function Button({ href, children, variant = "primary", external }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary"; external?: boolean }) {
  const cls = variant === "primary"
    ? "bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
    : "border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200";
  const c = `inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition ${cls}`;
  return external ? <a href={href} className={c}>{children}</a> : <Link href={href} className={c}>{children}</Link>;
}

export function Panel({ title, action, children, className = "", flush }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
          <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
          {action && <div className="text-[12.5px] text-neutral-500">{action}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/** Kept for existing callers. */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>{children}</div>;
}

export function KpiStrip({ items }: { items: { label: string; value: string; sub?: React.ReactNode; tone?: "ok" | "bad" | "warn" }[] }) {
  const tone = { ok: "text-emerald-700 dark:text-emerald-400", bad: "text-red-700 dark:text-red-400", warn: "text-amber-700 dark:text-amber-400" };
  return (
    <div className="grid grid-cols-2 divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white sm:grid-cols-4 sm:divide-x dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
      {items.map((k, i) => (
        <div key={k.label} className={`px-4 py-3.5 ${i >= 2 ? "border-t border-neutral-200 sm:border-t-0 dark:border-neutral-800" : ""} ${i % 2 ? "border-l border-neutral-200 sm:border-l-0 dark:border-neutral-800" : ""}`}>
          <div className="text-[12px] text-neutral-500">{k.label}</div>
          <div className={`tnum mt-1 text-[22px] font-semibold tracking-[-0.02em] ${k.tone ? tone[k.tone] : "text-neutral-950 dark:text-white"}`}>{k.value}</div>
          {k.sub && <div className="mt-0.5 text-[12px] text-neutral-500">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Stacked result bar: passed / flaky / failed / skipped. */
export function RunBar({ passed, failed, flaky, skipped = 0, className = "" }: { passed: number; failed: number; flaky: number; skipped?: number; className?: string }) {
  const total = Math.max(1, passed + failed + flaky + skipped);
  const seg = (n: number, c: string, label: string) => n > 0 ? <span className={c} style={{ width: `${(n / total) * 100}%` }} title={`${n} ${label}`} /> : null;
  return (
    <span className={`flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800 ${className}`} aria-label={`${passed} passed, ${failed} failed, ${flaky} flaky`}>
      {seg(passed, "bg-emerald-500", "passed")}{seg(flaky, "bg-amber-400", "flaky")}{seg(failed, "bg-red-500", "failed")}{seg(skipped, "bg-neutral-300", "skipped")}
    </span>
  );
}

export function RunStatus({ status, failed, flaky }: { status: string; failed: number; flaky: number }) {
  if (status !== "completed") return <Chip tone="neutral">{status}</Chip>;
  if (failed > 0) return <Chip tone="bad">Failed</Chip>;
  if (flaky > 0) return <Chip tone="warn">Flaky</Chip>;
  return <Chip tone="ok">Passed</Chip>;
}

export function Chip({ tone = "neutral", children }: { tone?: "ok" | "bad" | "warn" | "neutral" | "accent"; children: React.ReactNode }) {
  const t = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-600/15 dark:bg-emerald-950 dark:text-emerald-300",
    bad: "bg-red-50 text-red-800 ring-red-600/15 dark:bg-red-950 dark:text-red-300",
    warn: "bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300",
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-500/10 dark:bg-neutral-800 dark:text-neutral-300",
    accent: "bg-violet-50 text-violet-800 ring-violet-600/15 dark:bg-violet-950 dark:text-violet-300",
  }[tone];
  return <span className={`inline-flex h-5 items-center rounded px-1.5 text-[11.5px] font-medium ring-1 ring-inset ${t}`}>{children}</span>;
}

const PILL: Record<AgentStatus, "ok" | "warn" | "neutral"> = { live: "ok", beta: "warn", roadmap: "neutral" };
const PILL_LABEL: Record<AgentStatus, string> = { live: "Live", beta: "Beta", roadmap: "Coming soon" };
export function StatusPill({ status }: { status: AgentStatus }) {
  return <Chip tone={PILL[status]}>{PILL_LABEL[status]}</Chip>;
}

export function Empty({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <div className="text-[14px] font-medium text-neutral-900 dark:text-neutral-100">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-neutral-500">{body}</p>
      {href && cta && <div className="mt-4"><Button href={href}>{cta}</Button></div>}
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card>
      <div className="tnum text-[22px] font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[12px] text-neutral-500">{label}</div>
    </Card>
  );
}

/** Tiny dependency-free bar chart. values 0..1 (or raw with max). */
export function MiniBars({ values, max, tones, height = 56, label }: { values: number[]; max?: number; tones?: ("ok" | "bad" | "warn")[]; height?: number; label: string }) {
  const m = max ?? Math.max(1, ...values);
  const c = { ok: "bg-emerald-500", bad: "bg-red-500", warn: "bg-amber-400" };
  return (
    <div role="img" aria-label={label} className="flex items-end gap-[3px]" style={{ height }}>
      {values.map((v, i) => (
        <span key={i} className={`flex-1 rounded-[2px] ${tones?.[i] ? c[tones[i]!] : "bg-neutral-800 dark:bg-neutral-300"}`} style={{ height: `${Math.max(4, (v / m) * 100)}%`, opacity: tones ? 1 : 0.85 }} />
      ))}
    </div>
  );
}

export const th = "px-4 py-2 text-left text-[11.5px] font-medium text-neutral-500";
export const td = "px-4 py-2.5 align-middle";

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function fmtDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** ISO timestamp `days` ago. Server components only (request-time value). */
export function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

/** The last `days` calendar days (oldest first), as ISO date keys and short labels. */
export function lastNDays(days: number): { key: string; label: string }[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now - (days - 1 - i) * 86400_000);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
  });
}

export function ImpactChip({ impact }: { impact: string | null }) {
  const tone = impact === "critical" || impact === "serious" ? "bad" : impact === "moderate" ? "warn" : "neutral";
  return <Chip tone={tone}>{impact ?? "unknown"}</Chip>;
}
