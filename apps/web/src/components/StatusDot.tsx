"use client";

import { useEffect, useRef, useState } from "react";

type SystemStatus = "operational" | "degraded" | "down";
interface SystemReport { key: string; label: string; status: SystemStatus; detail: string }
interface StatusPayload { overall: SystemStatus; systems: SystemReport[]; checked_at: string }

const COLOR: Record<SystemStatus, { dot: string; ring: string; text: string; word: string }> = {
  operational: { dot: "bg-emerald-500", ring: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", word: "All systems operational" },
  degraded: { dot: "bg-amber-500", ring: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", word: "Partial degradation" },
  down: { dot: "bg-red-500", ring: "bg-red-500", text: "text-red-600 dark:text-red-400", word: "Service disruption" },
};

export function StatusDot({ compact = false, align = "right" }: { compact?: boolean; align?: "left" | "right" }) {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/status").then((r) => r.json()).then((d) => { if (active) setData(d); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { active = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const overall = data?.overall ?? "operational";
  const c = COLOR[overall];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-xs" aria-label="System status" title={c.word}>
        <span className="relative flex h-2.5 w-2.5">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${c.ring} opacity-75`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${c.dot}`} />
        </span>
        {!compact && <span className={`hidden sm:inline ${c.text}`}>{overall === "operational" ? "Operational" : c.word}</span>}
      </button>

      {open && (
        <div className={`absolute ${align === "left" ? "left-0" : "right-0"} z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-950`}>
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-2 dark:border-neutral-800">
            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
            <span className={`text-xs font-semibold ${c.text}`}>{c.word}</span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {(data?.systems ?? []).map((s) => {
              const sc = COLOR[s.status];
              return (
                <li key={s.key} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${sc.dot}`} />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium">{s.label}</span>
                    <span className="block text-[10px] text-neutral-500">{s.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {data?.checked_at && <p className="mt-2 border-t border-neutral-100 pt-1.5 text-[9px] text-neutral-400 dark:border-neutral-800">Checked {new Date(data.checked_at).toLocaleTimeString()}</p>}
        </div>
      )}
    </div>
  );
}
