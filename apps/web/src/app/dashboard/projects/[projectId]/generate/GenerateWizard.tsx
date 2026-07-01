"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrdUpload } from "../PrdUpload";

interface Candidate { title: string; intent: string; priority: "high" | "medium" | "low"; plan: string[] }
type GenStatus = "pending" | "running" | "saved" | "failed";
interface GenRow { candidate: Candidate; status: GenStatus }

type Phase = "choose" | "mcp" | "setup" | "exploring" | "review" | "generating" | "done";

const EXPLORE_STEPS = [
  "Opening the page in a real browser",
  "Reading headings, forms and buttons",
  "Mapping the primary user flows",
  "Deciding which tests are worth writing",
];

export function GenerateWizard({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("choose");

  // setup
  const [testType, setTestType] = useState<"frontend" | "backend">("frontend");
  const [url, setUrl] = useState("");
  const [prd, setPrd] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [setName, setSetName] = useState("");

  // results
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const [headroom, setHeadroom] = useState<{ max: number; plan: string } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rows, setRows] = useState<GenRow[]>([]);
  const [added, setAdded] = useState(0);

  // exploring animation
  const [exStep, setExStep] = useState(0);
  const exTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (phase === "exploring") {
      setExStep(0);
      exTimer.current = setInterval(() => setExStep((s) => Math.min(s + 1, EXPLORE_STEPS.length - 1)), 1400);
    }
    return () => { if (exTimer.current) clearInterval(exTimer.current); };
  }, [phase]);

  async function explore() {
    if (!url.trim() && prd.trim().length < 5) { setError("Enter a URL and/or a PRD."); return; }
    setError(""); setPhase("exploring"); setCandidates([]); setAdded(0);
    try {
      const res = await fetch(`/api/projects/${projectId}/tests/propose`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() || undefined, prd: prd.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't propose tests.");
      const cands: Candidate[] = data.candidates ?? [];
      setCandidates(cands);
      setLive(!!data.used_live_context);
      setHeadroom(data.headroom ? { max: data.headroom.max, plan: data.headroom.plan } : null);
      setSelected(new Set(cands.map((_, i) => i))); // all selected — "all possible tests"
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("setup");
    }
  }

  function toggle(i: number) {
    setSelected((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  async function saveToPlan() {
    if (selected.size === 0) return;
    const suite = setName.trim() || (url ? `${safeHost(url)} — ${new Date().toLocaleDateString()}` : `Set ${new Date().toLocaleDateString()}`);
    const picks = [...selected].sort((a, b) => a - b).map((i) => candidates[i]);
    setRows(picks.map((c) => ({ candidate: c, status: "pending" })));
    setPhase("generating"); setError(""); setAdded(0);
    let ok = 0;
    for (let i = 0; i < picks.length; i++) {
      const c = picks[i];
      setRows((r) => r.map((row, idx) => (idx === i ? { ...row, status: "running" } : row)));
      try {
        const res = await fetch(`/api/projects/${projectId}/tests`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: url.trim() || undefined,
            description: `${c.title}. ${c.intent}\nSteps:\n- ${c.plan.join("\n- ")}`,
            name: c.title,
            suite,
            criticalPath: c.priority === "high",
            username: username.trim() || undefined,
            password: password.trim() || undefined,
          }),
        });
        if (res.ok) { ok++; setRows((r) => r.map((row, idx) => (idx === i ? { ...row, status: "saved" } : row))); }
        else {
          setRows((r) => r.map((row, idx) => (idx === i ? { ...row, status: "failed" } : row)));
          if (res.status === 402) { const d = await res.json().catch(() => ({})); setError(d.error ?? "You hit your plan's cap."); break; }
        }
      } catch {
        setRows((r) => r.map((row, idx) => (idx === i ? { ...row, status: "failed" } : row)));
      }
    }
    setAdded(ok);
    setPhase("done");
    router.refresh();
  }

  function reset() {
    setPhase("setup"); setCandidates([]); setRows([]); setAdded(0); setError("");
  }

  // ---- render ----
  return (
    <div className="border border-neutral-200 dark:border-neutral-800">
      <Steps phase={phase} />

      <div className="p-5">
        {phase === "choose" && <Choose onPick={(m) => setPhase(m === "mcp" ? "mcp" : "setup")} />}

        {phase === "mcp" && (
          <McpPanel projectId={projectId} onBack={() => setPhase("choose")} />
        )}

        {phase === "setup" && (
          <Setup
            {...{ testType, setTestType, url, setUrl, prd, setPrd, username, setUsername, password, setPassword, error }}
            onPrd={(t) => setPrd((p) => (p ? p + "\n\n" : "") + t)}
            onBack={() => setPhase("choose")}
            onSubmit={explore}
          />
        )}

        {phase === "exploring" && <Exploring url={url} step={exStep} />}

        {(phase === "review" || phase === "generating" || phase === "done") && (
          <Review
            phase={phase}
            candidates={candidates}
            selected={selected}
            toggle={toggle}
            live={live}
            headroom={headroom}
            setName={setName}
            setSetName={setSetName}
            rows={rows}
            added={added}
            error={error}
            projectId={projectId}
            onSave={saveToPlan}
            onReset={reset}
          />
        )}
      </div>
    </div>
  );
}

function safeHost(u: string) { try { return new URL(u).hostname; } catch { return "set"; } }

/* ---------- step rail ---------- */
function Steps({ phase }: { phase: Phase }) {
  const idx = phase === "choose" ? 0 : phase === "mcp" || phase === "setup" ? 1 : phase === "exploring" ? 2 : 3;
  const labels = ["Method", "Set up", "Explore", "Test plan"];
  return (
    <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3 text-xs dark:border-neutral-800">
      {labels.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${i <= idx ? "bg-indigo-600 text-white" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800"}`}>{i + 1}</span>
          <span className={i <= idx ? "font-medium" : "text-neutral-400"}>{l}</span>
          {i < labels.length - 1 && <span className="mx-1 text-neutral-300 dark:text-neutral-700">›</span>}
        </span>
      ))}
    </div>
  );
}

/* ---------- choose method ---------- */
function Choose({ onPick }: { onPick: (m: "mcp" | "web") => void }) {
  return (
    <div>
      <h3 className="text-base font-semibold">How would you like to test?</h3>
      <p className="mt-1 text-xs text-neutral-500">Choose your testing environment to get started. You can switch anytime.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button onClick={() => onPick("web")} className="group border border-neutral-200 p-4 text-left transition hover:border-indigo-400 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌐</span>
            <span className="text-sm font-medium">Live Web App</span>
            <span className="ml-auto bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Ready</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">Catch bugs in any live environment — just paste a production, staging, or preview URL. Verity explores it and proposes a full test plan.</p>
        </button>
        <button onClick={() => onPick("mcp")} className="group border border-neutral-200 p-4 text-left transition hover:border-indigo-400 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">💻</span>
            <span className="text-sm font-medium">Local / IDE via MCP</span>
            <span className="ml-auto bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">For developers</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">Catch bugs in your code editor — across local projects, open PRs, and staged changes. Runs Playwright on your machine. No deployment needed.</p>
        </button>
      </div>
    </div>
  );
}

/* ---------- MCP quickstart ---------- */
function McpPanel({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} className="text-xs text-neutral-400 hover:text-neutral-600">← Back</button>
      <h3 className="mt-2 text-base font-semibold">Test locally via MCP</h3>
      <p className="mt-1 text-xs text-neutral-500">Generate &amp; run tests on <strong>localhost</strong> from Cursor, Claude Code, or VS Code — the MCP runs Playwright in your own repo.</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-neutral-600 dark:text-neutral-300">
        <li>Open the <Link href={`/dashboard/projects/${projectId}/mcp`} className="text-indigo-600 underline">Local / MCP</Link> page and copy your project token.</li>
        <li>Add the <code>@qashifthq/verity-mcp</code> server to your IDE&apos;s MCP config with that token.</li>
        <li>In your IDE chat: <em>&quot;Use Verity to propose tests for http://localhost:3000, generate them, and run them.&quot;</em></li>
      </ol>
      <Link href={`/dashboard/projects/${projectId}/mcp`} className="mt-4 inline-block bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Open Local / MCP setup →</Link>
    </div>
  );
}

/* ---------- setup form ---------- */
function Setup(props: {
  testType: "frontend" | "backend"; setTestType: (t: "frontend" | "backend") => void;
  url: string; setUrl: (s: string) => void; prd: string; setPrd: (s: string) => void;
  username: string; setUsername: (s: string) => void; password: string; setPassword: (s: string) => void;
  error: string; onPrd: (t: string) => void; onBack: () => void; onSubmit: () => void;
}) {
  const { testType, setTestType, url, setUrl, prd, setPrd, username, setUsername, password, setPassword, error, onPrd, onBack, onSubmit } = props;
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <button type="button" onClick={onBack} className="text-xs text-neutral-400 hover:text-neutral-600">← Back</button>
      <h3 className="mt-2 text-base font-semibold">Set up your tests</h3>
      <p className="mt-1 text-xs text-neutral-500">Choose the type of test to create and share the details we&apos;ll use to generate your test plan.</p>

      <div className="mt-4 grid gap-4">
        <Field label="Test type">
          <div className="inline-grid grid-cols-2 border border-neutral-300 dark:border-neutral-700">
            <button type="button" disabled title="Coming soon"
              className="cursor-not-allowed px-4 py-2 text-sm text-neutral-400">
              Backend (APIs) <span className="ml-1 text-[10px]">soon</span>
            </button>
            <button type="button" onClick={() => setTestType("frontend")}
              className={`px-4 py-2 text-sm font-medium ${testType === "frontend" ? "bg-indigo-600 text-white" : ""}`}>
              Frontend (URLs)
            </button>
          </div>
        </Field>

        <Field label="Website URL">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://app.example.com/login"
            className="w-full border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700" />
        </Field>

        <Field label="Extra context or instructions" hint="Optional">
          <textarea value={prd} onChange={(e) => setPrd(e.target.value)} rows={3}
            placeholder="Any additional context for our agent — e.g. pages to prioritize, features to skip, known issues to watch for. Or paste a PRD / acceptance criteria."
            className="w-full border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700" />
          <div className="mt-2"><PrdUpload onText={onPrd} /></div>
        </Field>

        <div className="border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-sm font-medium">🔒 Test account <span className="text-xs font-normal text-neutral-400">(optional · recommended if your app needs login)</span></div>
          <p className="mt-1 text-xs text-neutral-500">Our agent uses this to sign in and explore pages behind authentication. Baked into the generated tests.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username / email"
              className="border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password"
              className="border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700" />
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button type="submit" className="mt-4 bg-indigo-600 px-5 py-2 text-sm font-medium text-white">Explore &amp; propose tests →</button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}{hint && <span className="ml-2 text-xs font-normal text-neutral-400">{hint}</span>}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

/* ---------- exploring ---------- */
function Exploring({ url, step }: { url: string; step: number }) {
  return (
    <div>
      <h3 className="text-base font-semibold">Exploring your application</h3>
      <p className="mt-1 text-xs text-neutral-500">Our agent is visiting your app to understand how it behaves. This usually takes under a minute.</p>
      {url && <p className="mt-2 truncate font-mono text-xs text-neutral-400">{url}</p>}
      <ul className="mt-4 space-y-2">
        {EXPLORE_STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-indigo-600 text-white" : "bg-neutral-200 dark:bg-neutral-800"}`}>
              {i < step ? "✓" : i === step ? <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" /> : ""}
            </span>
            <span className={i <= step ? "" : "text-neutral-400"}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- review + generate + done ---------- */
function Review(props: {
  phase: Phase; candidates: Candidate[]; selected: Set<number>; toggle: (i: number) => void;
  live: boolean; headroom: { max: number; plan: string } | null;
  setName: string; setSetName: (s: string) => void; rows: GenRow[]; added: number; error: string;
  projectId: string; onSave: () => void; onReset: () => void;
}) {
  const { phase, candidates, selected, toggle, live, headroom, setName, setSetName, rows, added, error, projectId, onSave, onReset } = props;
  const prClass = (p: string) => p === "high" ? "text-red-600 dark:text-red-400" : p === "medium" ? "text-amber-600 dark:text-amber-400" : "text-neutral-500";
  const dot = (s: GenStatus) => s === "saved" ? "bg-emerald-500" : s === "running" ? "bg-indigo-600 animate-pulse" : s === "failed" ? "bg-red-500" : "bg-neutral-300 dark:bg-neutral-700";

  if (phase === "done") {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-950">✓</div>
        <h3 className="mt-3 text-base font-semibold">Saved {added} test{added === 1 ? "" : "s"} to your test plan</h3>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <p className="mt-1 text-xs text-neutral-500">They&apos;re active and ready to run in the cloud or your CI.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href={`/dashboard/projects/${projectId}/tests`} className="bg-indigo-600 px-4 py-2 text-sm font-medium text-white">View test plan →</Link>
          <Link href={`/dashboard/projects/${projectId}/cloud`} className="border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Run in cloud</Link>
          <button onClick={onReset} className="border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">Generate more</button>
        </div>
      </div>
    );
  }

  const generating = phase === "generating";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Your test plan</h3>
          <p className="text-xs text-neutral-500">
            {candidates.length} test{candidates.length === 1 ? "" : "s"} proposed{live ? " · from your live page ✓" : ""}
            {headroom ? ` · ${headroom.plan} plan` : ""}. {generating ? "Saving…" : "All selected by default — deselect any you don't want."}
          </p>
        </div>
        {!generating && (
          <div className="flex items-center gap-2">
            <input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Suite name (optional)"
              className="border border-neutral-300 bg-transparent px-2 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700" />
            <button onClick={onSave} disabled={selected.size === 0} className="bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Save {selected.size} to test plan →
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 space-y-2">
        {generating
          ? rows.map((r, i) => (
              <div key={i} className="flex items-start gap-3 border border-neutral-200 p-3 dark:border-neutral-800">
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dot(r.status)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.candidate.title}</span>
                    <span className="ml-auto text-[11px] text-neutral-400">
                      {r.status === "saved" ? "saved ✓" : r.status === "running" ? "generating…" : r.status === "failed" ? "failed" : "queued"}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">{r.candidate.intent}</p>
                </div>
              </div>
            ))
          : candidates.map((c, i) => (
              <label key={i} className={`flex cursor-pointer gap-3 border p-3 transition ${selected.has(i) ? "border-indigo-400 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/20" : "border-neutral-200 dark:border-neutral-800"}`}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.title}</span>
                    <span className={`text-[10px] font-semibold uppercase ${prClass(c.priority)}`}>{c.priority}</span>
                  </div>
                  <p className="text-xs text-neutral-500">{c.intent}</p>
                  <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-[11px] text-neutral-600 dark:text-neutral-400">
                    {c.plan.map((s, j) => <li key={j}>{s}</li>)}
                  </ol>
                </div>
              </label>
            ))}
      </div>
    </div>
  );
}
