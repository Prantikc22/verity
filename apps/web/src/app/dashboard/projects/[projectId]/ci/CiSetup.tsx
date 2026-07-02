"use client";

import { useMemo, useState } from "react";
import {
  CAPABILITIES,
  DEFAULT_CONFIG,
  ENGINES,
  enginesCsv,
  requiredSecrets,
  workflowFor,
  type CiConfig,
  type EngineKey,
  type Provider,
} from "@/lib/ci/workflow";

const PROVIDERS: { key: Provider; label: string; logo: string }[] = [
  { key: "github", label: "GitHub Actions", logo: "M12 .5C5.7.5.5 5.7.5 12a11.5 11.5 0 008 11c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.4-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6a11.5 11.5 0 008-11C23.5 5.7 18.3.5 12 .5z" },
  { key: "gitlab", label: "GitLab CI", logo: "M12 21.4l3.7-11.3H8.3L12 21.4zM3.2 10.1l-1.1 3.5a.8.8 0 00.3.9l9.6 7-8.8-11.4zm17.6 0l-8.8 11.4 9.6-7a.8.8 0 00.3-.9l-1.1-3.5zM3.2 10.1H8.3L6.1 3.3c-.1-.3-.6-.3-.7 0L3.2 10.1zm12.5 0h5.1l-2.2-6.8c-.1-.3-.6-.3-.7 0l-2.2 6.8z" },
  { key: "jenkins", label: "Jenkins", logo: "M12 2a10 10 0 100 20 10 10 0 000-20zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z" },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-indigo-600" : "bg-neutral-300 dark:bg-neutral-700"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-4" : "left-0.5"}`} />
    </button>
  );
}

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`mt-1 w-full border border-neutral-300 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-neutral-700 ${mono ? "font-mono" : ""}`} />
    </label>
  );
}

export function CiSetup({ defaultApiUrl, defaultBranch }: { defaultApiUrl: string; defaultBranch: string }) {
  const [c, setC] = useState<CiConfig>({ ...DEFAULT_CONFIG, apiUrl: defaultApiUrl, branch: defaultBranch });
  const [provider, setProvider] = useState<Provider>("github");
  const [copied, setCopied] = useState(false);

  const config = useMemo(() => workflowFor(provider, c), [provider, c]);
  const anyEngine = Object.values(c.engines).some(Boolean);
  const secrets = requiredSecrets(c);

  function toggleEngine(k: EngineKey) {
    setC((p) => ({ ...p, engines: { ...p.engines, [k]: !p.engines[k] } }));
  }
  function setPerf<K extends keyof CiConfig["perf"]>(k: K, v: CiConfig["perf"][K]) { setC((p) => ({ ...p, perf: { ...p.perf, [k]: v } })); }
  function setSec<K extends keyof CiConfig["security"]>(k: K, v: CiConfig["security"][K]) { setC((p) => ({ ...p, security: { ...p.security, [k]: v } })); }
  function setVis<K extends keyof CiConfig["visual"]>(k: K, v: CiConfig["visual"][K]) { setC((p) => ({ ...p, visual: { ...p.visual, [k]: v } })); }
  function setAgent<K extends keyof CiConfig["agent"]>(k: K, v: CiConfig["agent"][K]) { setC((p) => ({ ...p, agent: { ...p.agent, [k]: v } })); }
  function setCon<K extends keyof CiConfig["contract"]>(k: K, v: CiConfig["contract"][K]) { setC((p) => ({ ...p, contract: { ...p.contract, [k]: v } })); }

  async function copy() {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-8">
      {/* ── 1. Pick your tests ─────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold">1 · Pick the tests you want to run</h3>
        <p className="mt-0.5 text-xs text-neutral-500">You don&apos;t need all of them. Toggle only what you need — everything runs in <strong>your</strong> CI and reports to Verity. <span className="text-amber-600">Toggling here updates the config below; you commit that to your repo to actually run them.</span></p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {ENGINES.map((e) => {
            const on = c.engines[e.key];
            return (
              <button key={e.key} type="button" onClick={() => toggleEngine(e.key)}
                className={`flex items-start gap-3 border p-3 text-left transition ${on ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/30" : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800"}`}>
                <Toggle on={on} onClick={() => toggleEngine(e.key)} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{e.label}</span>
                    {e.docker && <span className="bg-neutral-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-neutral-500 dark:bg-neutral-800">docker</span>}
                  </span>
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{e.tool}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">{e.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
        {!anyEngine && <p className="mt-2 text-xs text-amber-600">Pick at least one to generate your config.</p>}
      </section>

      {/* ── 2. Options for the engines you picked ──────────────────── */}
      {(c.engines.perf || c.engines.security || c.engines.visual || c.engines.agent || c.engines.contract) && (
        <section>
          <h3 className="text-sm font-semibold">2 · Configure them</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {c.engines.perf && (
              <div className="border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-medium">⚡ Performance</div>
                <p className="text-[11px] text-neutral-500">Choose which performance checks run.</p>
                <div className="mt-3 space-y-2 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={c.perf.smoke} onChange={(e) => setPerf("smoke", e.target.checked)} /> <span><strong>Perf smoke check</strong> on every PR <span className="text-neutral-400">— light, ~30s, a few endpoints (never a full load test)</span></span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={c.perf.fullLoad} onChange={(e) => setPerf("fullLoad", e.target.checked)} /> <span><strong>Full load test</strong> on merge/schedule</span></label>
                  {c.perf.fullLoad && (
                    <div className="grid grid-cols-3 gap-2 pl-6">
                      <Field label="VUs/sec" value={String(c.perf.arrivalRate)} onChange={(v) => setPerf("arrivalRate", Number(v) || 0)} />
                      <Field label="Duration (s)" value={String(c.perf.durationSec)} onChange={(v) => setPerf("durationSec", Number(v) || 0)} />
                      <Field label="Ramp to (opt)" value={c.perf.rampTo ? String(c.perf.rampTo) : ""} onChange={(v) => setPerf("rampTo", v ? Number(v) : undefined)} />
                    </div>
                  )}
                  <label className="flex items-center gap-2"><input type="checkbox" checked={c.perf.distributed} onChange={(e) => setPerf("distributed", e.target.checked)} /> <span>Distributed/serverless load <span className="text-neutral-400">(more load than one runner)</span></span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={c.perf.lighthouse} onChange={(e) => setPerf("lighthouse", e.target.checked)} /> <span><strong>Core Web Vitals</strong> (page-load score)</span></label>
                  {c.perf.lighthouse && <div className="pl-6"><Field label="Page URL" value={c.perf.lighthouseUrl} onChange={(v) => setPerf("lighthouseUrl", v)} placeholder="https://staging.example.com" /></div>}
                </div>
              </div>
            )}

            {c.engines.security && (
              <div className="border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-medium">🔐 Security</div>
                <p className="text-[11px] text-neutral-500">Pick which scans run. Findings show as severity-ranked issues, never pass/fail.</p>
                <div className="mt-3 space-y-2 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={c.security.sast} onChange={(e) => setSec("sast", e.target.checked)} /> <span><strong>Static analysis</strong> — scans your code <span className="text-neutral-400">(diff on PR, full repo on merge)</span></span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={c.security.dast} onChange={(e) => setSec("dast", e.target.checked)} /> <span><strong>Dynamic analysis</strong> — scans your running app</span></label>
                  {c.security.dast && (
                    <div className="space-y-2 pl-6">
                      <Field label="Target URL (staging/preview)" value={c.security.dastTarget} onChange={(v) => setSec("dastTarget", v)} placeholder="https://staging.example.com" />
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-neutral-500">Scan depth:</span>
                        {(["baseline", "full"] as const).map((d) => (
                          <label key={d} className="flex items-center gap-1"><input type="radio" name="dastDepth" checked={c.security.dastDepth === d} onChange={() => setSec("dastDepth", d)} /> <span>{d === "baseline" ? "Baseline (fast, PR)" : "Full active (merge)"}</span></label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {c.engines.visual && (
              <div className="border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-medium">🖼️ Visual</div>
                <p className="text-[11px] text-neutral-500">Screenshot regression. Baselines are committed to your repo — a diff over the threshold shows as &ldquo;changed&rdquo;.</p>
                <div className="mt-3 space-y-2 text-xs">
                  <Field label="Snapshots / baselines directory" value={c.visual.snapshotsDir} onChange={(v) => setVis("snapshotsDir", v)} mono />
                  <Field label="Max diff pixel ratio (0–1)" value={String(c.visual.maxDiffPixelRatio)} onChange={(v) => setVis("maxDiffPixelRatio", Number(v) || 0)} />
                  <p className="text-[10px] text-neutral-400">Lower = stricter. 0.01 flags ~1% of pixels changing.</p>
                </div>
              </div>
            )}

            {c.engines.agent && (
              <div className="border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-medium">🤖 Agent (AI) evals</div>
                <p className="text-[11px] text-neutral-500">Evals for your <strong>own</strong> AI feature. Verity calls your endpoint and asserts a property of the reply (grounding, injection resistance, tool-use).</p>
                <div className="mt-3 space-y-2 text-xs">
                  <Field label="AI endpoint (reachable from CI)" value={c.agent.endpoint} onChange={(v) => setAgent("endpoint", v)} placeholder="https://api.example.com/chat" />
                  <Field label="Token secret name" value={c.agent.authTokenSecret} onChange={(v) => setAgent("authTokenSecret", v)} mono />
                  <p className="text-[10px] text-amber-600">Store the token as a CI secret under this name — never in the config.</p>
                </div>
              </div>
            )}

            {c.engines.contract && (
              <div className="border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-sm font-medium">🔁 API contract testing</div>
                <p className="text-[11px] text-neutral-500">Reuses the spec you already use for API tests — no second upload. Needs a reachable base URL.</p>
                <div className="mt-3 space-y-2">
                  <Field label="OpenAPI spec (path or URL)" value={c.contract.openapiSpec} onChange={(v) => setCon("openapiSpec", v)} mono />
                  <Field label="API base URL (reachable from CI)" value={c.contract.apiBaseUrl} onChange={(v) => setCon("apiBaseUrl", v)} placeholder="https://staging.example.com" />
                  <p className="text-[10px] text-amber-600">Internal/firewalled APIs: this only runs inside your own CI.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 3. Your CI config ──────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">3 · Copy &amp; commit your CI config</h3>
          <div className="flex gap-1">
            {PROVIDERS.map((p) => (
              <button key={p.key} onClick={() => setProvider(p.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${provider === p.key ? "bg-indigo-600 text-white" : "border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"}`}>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d={p.logo} /></svg>{p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
          <span>Engines: <code className="text-indigo-600 dark:text-indigo-400">{enginesCsv(c)}</code></span>
          {secrets.map((s) => <span key={s.name}>Secret: <code>{s.name}</code> — {s.why}</span>)}
        </div>

        <div className="relative mt-2">
          <button onClick={copy} className="absolute right-2 top-2 z-10 border border-neutral-700 bg-neutral-900/80 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-800">{copied ? "Copied ✓" : "Copy"}</button>
          <pre className="max-h-[460px] overflow-auto border border-neutral-200 bg-neutral-950 p-4 text-[11px] leading-relaxed text-neutral-300 dark:border-neutral-800">{anyEngine ? config : "# Pick at least one test type above to generate your config."}</pre>
        </div>
        {provider !== "github" && (
          <p className="mt-2 text-[11px] text-neutral-500">GitLab & Jenkins fetch the same self-contained Verity runners via <code>curl</code> (no GitHub Action needed) — identical behavior, reporting to the same dashboard.</p>
        )}

        {/* The toggles don't run anything by themselves — this is what makes it real. */}
        <div className="mt-4 border border-amber-300 bg-amber-50/60 p-4 text-xs dark:border-amber-800/60 dark:bg-amber-950/20">
          <p className="font-semibold text-amber-800 dark:text-amber-300">⚠️ This config doesn&apos;t run until you commit it</p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            Toggling the cards above only <strong>regenerates the config</strong> here — it does <strong>not</strong> change what runs in CI.
            To actually run these engines, commit this file to your repo:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-neutral-600 dark:text-neutral-400">
            <li>Copy the config above.</li>
            <li>Save it to {provider === "github" ? <code>.github/workflows/verity.yml</code> : provider === "gitlab" ? <code>.gitlab-ci.yml</code> : <code>Jenkinsfile</code>} in your repo, <strong>replacing</strong> any existing Verity workflow.</li>
            <li>Make sure your secrets are set ({provider === "github" ? <><code>VERITY_INGEST_TOKEN</code> in repo Settings → Secrets</> : <code>VERITY_INGEST_TOKEN</code>}).</li>
            <li>Commit &amp; push — the engines run on the next PR/merge and results appear in Verity.</li>
          </ol>
          <p className="mt-2 text-[11px] text-neutral-500">Already wired the Verity workflow once? You only need to update it again when you change which engines are on.</p>
        </div>
      </section>

      {/* ── 4. What you get on each provider ───────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold">4 · What you get on each provider</h3>
        <div className="mt-3 overflow-x-auto border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 font-medium">Capability</th>
                <th className="px-3 py-2 text-center font-medium">GitHub</th>
                <th className="px-3 py-2 text-center font-medium">GitLab</th>
                <th className="px-3 py-2 text-center font-medium">Jenkins</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((cap, i) => (
                <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800/60">
                  <td className="px-3 py-2">
                    {cap.feature}
                    {cap.note && <span className="block text-[10px] text-neutral-400">{cap.note}</span>}
                  </td>
                  {(["github", "gitlab", "jenkins"] as const).map((pk) => {
                    const v = cap[pk];
                    return <td key={pk} className="px-3 py-2 text-center">{v === true ? <span className="text-emerald-600">✓</span> : v === "partial" ? <span className="text-amber-500" title="Partial / needs setup">◑</span> : <span className="text-neutral-300 dark:text-neutral-600">—</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-neutral-500"><span className="text-emerald-600">✓</span> full · <span className="text-amber-500">◑</span> partial / needs setup · — not available. The <strong>Verity dashboard always has complete results</strong> regardless of provider.</p>
      </section>
    </div>
  );
}
