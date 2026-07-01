"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Candidate { title: string; intent: string; priority: "high" | "medium" | "low"; plan: string[] }
type GenStatus = "pending" | "running" | "saved" | "failed";
type Phase = "setup" | "exploring" | "review" | "generating" | "done";

const PRIO: Record<string, string> = { high: "text-indigo-600 dark:text-indigo-400", medium: "text-amber-600 dark:text-amber-400", low: "text-neutral-500" };

export function MobileGenerateWizard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [appContext, setAppContext] = useState("");
  const [screenContext, setScreenContext] = useState("");
  const [appId, setAppId] = useState("");
  const [platform, setPlatform] = useState<"android" | "ios" | "both">("both");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [setName, setSetName] = useState("");

  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [statuses, setStatuses] = useState<Record<number, GenStatus>>({});
  const [added, setAdded] = useState(0);

  async function propose() {
    if (appContext.trim().length < 5) { setError("Describe your app / the screens to test."); return; }
    setError(""); setPhase("exploring"); setCandidates([]); setAdded(0);
    try {
      const res = await fetch(`/api/projects/${projectId}/mobile-tests/propose`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ appContext: appContext.trim(), screenContext: screenContext.trim() || undefined, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't propose flows.");
      const cands: Candidate[] = data.candidates ?? [];
      setCandidates(cands); setSelected(new Set(cands.map((_, i) => i))); setPhase("review");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); setPhase("setup"); }
  }

  function toggle(i: number) { setSelected((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; }); }

  async function saveAll() {
    if (selected.size === 0) return;
    const suite = setName.trim() || `Mobile — ${new Date().toLocaleDateString()}`;
    const picks = [...selected].sort((a, b) => a - b);
    setPhase("generating"); setError(""); setAdded(0);
    setStatuses(Object.fromEntries(picks.map((i) => [i, "pending"])));
    let ok = 0;
    for (const i of picks) {
      const c = candidates[i];
      setStatuses((s) => ({ ...s, [i]: "running" }));
      try {
        const res = await fetch(`/api/projects/${projectId}/mobile-tests`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            description: `${c.title}. ${c.intent}\nSteps:\n- ${c.plan.join("\n- ")}`,
            name: c.title, suite, appId: appId.trim() || undefined,
            screenContext: screenContext.trim() || undefined, needsAuth, criticalPath: c.priority === "high",
          }),
        });
        if (res.ok) { ok++; setStatuses((s) => ({ ...s, [i]: "saved" })); }
        else { setStatuses((s) => ({ ...s, [i]: "failed" })); if (res.status === 402) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Plan limit reached."); break; } }
      } catch { setStatuses((s) => ({ ...s, [i]: "failed" })); }
    }
    setAdded(ok); setPhase("done"); router.refresh();
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3 text-xs dark:border-neutral-800">
        {["Set up", "Propose", "Flows"].map((l, i) => {
          const idx = phase === "setup" ? 0 : phase === "exploring" ? 1 : 2;
          return <span key={l} className="flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${i <= idx ? "bg-indigo-600 text-white" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800"}`}>{i + 1}</span>
            <span className={i <= idx ? "font-medium" : "text-neutral-400"}>{l}</span>{i < 2 && <span className="mx-1 text-neutral-300 dark:text-neutral-700">›</span>}
          </span>;
        })}
      </div>

      <div className="p-5">
        {phase === "setup" && (
          <form onSubmit={(e) => { e.preventDefault(); propose(); }} className="space-y-4">
            <h3 className="text-base font-semibold">Set up your mobile flows</h3>
            <p className="text-xs text-neutral-500">Describe the app and the screens. Verity proposes mobile app flows (YAML) and self-heals broken selectors from the accessibility tree.</p>
            <label className="block">
              <span className="text-sm font-medium">App / screens to test</span>
              <textarea value={appContext} onChange={(e) => setAppContext(e.target.value)} rows={4} placeholder="e.g. A food-delivery app. Login screen (email + password), a restaurant list, add-to-cart, checkout with saved card."
                className="mt-1.5 w-full border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Accessibility / screen context <span className="text-xs font-normal text-neutral-400">(optional, grounds selectors)</span></span>
              <textarea value={screenContext} onChange={(e) => setScreenContext(e.target.value)} rows={3} placeholder="Paste an accessibility-tree dump or a list of visible labels/ids."
                className="mt-1.5 w-full border border-neutral-300 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-neutral-700" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">App ID / bundle id <span className="text-xs font-normal text-neutral-400">(optional)</span></span>
                <input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="com.example.app"
                  className="mt-1.5 w-full border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700" />
              </label>
              <div>
                <span className="text-sm font-medium">Platform</span>
                <div className="mt-2.5 flex gap-3 text-sm">
                  {(["android", "ios", "both"] as const).map((p) => (
                    <label key={p} className="flex items-center gap-1.5"><input type="radio" name="plat" checked={platform === p} onChange={() => setPlatform(p)} /> <span className="capitalize">{p}</span></label>
                  ))}
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={needsAuth} onChange={(e) => setNeedsAuth(e.target.checked)} /> Flows need login (creds come from CI env vars)</label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="bg-indigo-600 px-5 py-2 text-sm font-medium text-white">Propose flows →</button>
          </form>
        )}

        {phase === "exploring" && (
          <div>
            <h3 className="text-base font-semibold">Planning your flows…</h3>
            <div className="mt-4 flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500" /> Proposing happy-path, negative, validation, and auth flows…</div>
          </div>
        )}

        {(phase === "review" || phase === "generating" || phase === "done") && (
          <div>
            {phase === "done" ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-950">✓</div>
                <h3 className="mt-3 text-base font-semibold">Saved {added} flow{added === 1 ? "" : "s"}</h3>
                {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
                <div className="mt-4 flex justify-center gap-2">
                  <Link href={`/dashboard/projects/${projectId}/mobile/tests`} className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white">View flows →</Link>
                  <Link href={`/dashboard/projects/${projectId}/ci`} className="border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Wire CI</Link>
                  <button onClick={() => setPhase("setup")} className="border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Generate more</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">Your mobile flow plan</h3>
                    <p className="text-xs text-neutral-500">{candidates.length} flows proposed. {phase === "generating" ? "Saving…" : "All selected — deselect any you don't want."}</p>
                  </div>
                  {phase === "review" && (
                    <div className="flex items-center gap-2">
                      <input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Suite name (optional)" className="border border-neutral-300 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700" />
                      <button onClick={saveAll} disabled={selected.size === 0} className="bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save {selected.size} →</button>
                    </div>
                  )}
                </div>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <div className="mt-3 space-y-2">
                  {candidates.map((c, i) => {
                    const st = statuses[i];
                    return (
                      <label key={i} className={`flex cursor-pointer gap-3 border p-3 transition ${selected.has(i) ? "border-indigo-400 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/20" : "border-neutral-200 dark:border-neutral-800"}`}>
                        {phase === "review" && <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="mt-1" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{c.title}</span>
                            <span className={`text-[10px] font-semibold uppercase ${PRIO[c.priority]}`}>{c.priority}</span>
                            {st && <span className="ml-auto text-[11px] text-neutral-400">{st === "saved" ? "saved ✓" : st === "running" ? "generating…" : st === "failed" ? "failed" : "queued"}</span>}
                          </div>
                          <p className="text-xs text-neutral-500">{c.intent}</p>
                          <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-[11px] text-neutral-600 dark:text-neutral-400">{c.plan.map((s, j) => <li key={j}>{s}</li>)}</ol>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
