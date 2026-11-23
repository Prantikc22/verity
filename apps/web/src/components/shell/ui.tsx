import Link from "next/link";
import type { AgentStatus } from "@/lib/catalog";

export function PageHeader({ title, lead, action }: { title: string; lead?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        {lead && <p className="mt-1.5 text-[15px] text-neutral-500">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

const PILL: Record<AgentStatus, string> = {
  live: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  beta: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  roadmap: "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400",
};
const PILL_LABEL: Record<AgentStatus, string> = { live: "Live", beta: "Beta", roadmap: "Coming soon" };

export function StatusPill({ status }: { status: AgentStatus }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11.5px] ${PILL[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{PILL_LABEL[status]}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#E6E2D6] bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>{children}</div>;
}

export function Empty({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <Card className="text-center">
      <div className="py-6">
        <div className="text-[15px] font-medium">{title}</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">{body}</p>
        {href && cta && <Link href={href} className="mt-4 inline-block rounded-full bg-[#6A4BFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#5534F2]">{cta}</Link>}
      </div>
    </Card>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card>
      <div className="tnum text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </Card>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** ISO timestamp `days` ago. Server components only (request-time value). */
export function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}
