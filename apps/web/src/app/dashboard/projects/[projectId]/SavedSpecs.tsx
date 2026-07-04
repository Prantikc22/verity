/**
 * Compact server-rendered list of saved specs for a non-UI discipline (visual,
 * agent, performance). Shows what generation actually produced — name, path,
 * status, expandable plan + code — so a self-serve user can review and copy the
 * spec into their repo without leaving the discipline's page.
 */
interface SpecRow {
  id: string;
  name: string;
  spec_path: string;
  status: string;
  description?: string | null;
  plan?: unknown;
  spec_content: string;
  created_at: string;
}

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  active: { cls: "text-emerald-600 dark:text-emerald-400", label: "Verified ✓" },
  quarantined: { cls: "text-amber-600 dark:text-amber-400", label: "Needs review" },
  draft: { cls: "text-neutral-400", label: "Draft" },
  archived: { cls: "text-neutral-300", label: "Archived" },
};

export function SavedSpecs({ title, hint, rows }: { title: string; hint: string; rows: SpecRow[] }) {
  return (
    <section>
      <h3 className="text-sm font-medium text-neutral-500">{title} ({rows.length})</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-400">{hint}</p>
      ) : (
        <div className="mt-2 divide-y divide-neutral-100 border border-neutral-200 dark:divide-neutral-800/60 dark:border-neutral-800">
          {rows.map((t) => {
            const badge = STATUS_BADGE[t.status] ?? { cls: "text-neutral-500", label: t.status };
            const plan = Array.isArray(t.plan) ? (t.plan as unknown[]).map(String) : [];
            return (
              <details key={t.id} className="group">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3 text-sm">
                  <span className={`text-[10px] font-semibold uppercase ${badge.cls}`}>{badge.label}</span>
                  <span className="font-medium">{t.name}</span>
                  <code className="font-mono text-[10px] text-neutral-400">{t.spec_path}</code>
                  <span className="ml-auto text-[10px] text-neutral-400">{new Date(t.created_at).toLocaleDateString()}</span>
                </summary>
                <div className="space-y-3 border-t border-neutral-100 p-3 dark:border-neutral-800/60">
                  {t.description && <p className="text-xs text-neutral-500">{t.description}</p>}
                  {plan.length > 0 && (
                    <ol className="list-decimal space-y-0.5 pl-5 text-xs text-neutral-600 dark:text-neutral-400">
                      {plan.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  )}
                  <pre className="max-h-80 overflow-auto bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-300">{t.spec_content}</pre>
                  <p className="text-[11px] text-neutral-400">Commit this file to <code>{t.spec_path}</code> in your repo (or use Export on the Tests page) — it runs in your CI, unlimited.</p>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
