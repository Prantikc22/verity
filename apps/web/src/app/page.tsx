import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Reveal } from "@/components/Reveal";
import { Logo } from "@/components/Logo";
import { Pipeline } from "@/components/landing/Pipeline";
import { Comparison } from "@/components/landing/Comparison";
import { VeritySelfServeCards } from "@/components/landing/VeritySelfServeCards";
import { PredictionsShowcase } from "@/components/landing/PredictionsShowcase";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { isIndia } from "@/lib/geo";

const STACK = ["GitHub", "GitHub Actions", "GitLab CI", "Vercel", "Netlify", "CircleCI", "Playwright"];

const PILLARS = [
  { n: "Generate", accent: "indigo", d: "Describe a flow or drop a URL. Verity writes a runnable Playwright spec in TypeScript — role-based locators, real assertions, ready to run.", icon: "M12 2v20M2 12h20" },
  { n: "Maintain", accent: "violet", d: "When a selector breaks, Verity proposes the fix from the live DOM. Flaky tests are re-run and separated from real failures, so noise never blocks a merge.", icon: "M4 4v6h6M20 20v-6h-6M20 4l-7 7M4 20l7-7" },
  { n: "Verify", accent: "amber", d: "A forward-deployed engineer turns disposable AI scripts into a maintained Page Object Model suite they own — the part automation alone never gives you.", icon: "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" },
  { n: "Predict", accent: "emerald", d: "Regression-prone files, flake-vs-real calls, and a deploy confidence score — posted right inside the pull request, before you ship.", icon: "M3 17l6-6 4 4 8-8" },
];

const FEATURES = [
  { t: "AI test generation", d: "From a sentence or a URL to a runnable spec. Zero setup to your first test." },
  { t: "Self-healing locators", d: "Broken selector → AI-proposed fix from the live DOM, surfaced as a diff you approve. Never silently merged." },
  { t: "Two-tier execution", d: "A fast diff-aware Quick check on every commit, and a Full regression suite on merge — honestly labeled, never conflated." },
  { t: "Flake detection & quarantine", d: "Suspect failures re-run N times; flaky is split from broken; per-test flake rate tracked over time." },
  { t: "Confidence scoring", d: "Not just pass/fail — does a green test meaningfully cover a critical path, or is it technically-green theatre?" },
  { t: "Managed POM conversion", d: "Our FDEs restructure flat AI scripts into a maintainable Page Object Model — the moat that makes tests an owned asset." },
];

const accentClass: Record<string, string> = {
  indigo: "border-indigo-500 text-indigo-600 dark:text-indigo-400",
  violet: "border-violet-500 text-violet-600 dark:text-violet-400",
  amber: "border-amber-500 text-amber-600 dark:text-amber-400",
  emerald: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
};

export default async function Home() {
  const inIndia = await isIndia();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Hero />

      <main className="w-full">
        {/* Stack strip */}
        <div className="border-b border-neutral-200 dark:border-neutral-900">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-7 opacity-70">
            <span className="text-xs uppercase tracking-widest text-neutral-400">Slots into your stack</span>
            {STACK.map((s) => <span key={s} className="text-sm font-semibold tracking-tight text-neutral-500 dark:text-neutral-400">{s}</span>)}
          </div>
        </div>

        {/* Four pillars */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-sm font-medium text-indigo-600">The whole loop, not a recorder</p>
            <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Four jobs most tools leave to you. Verity does all four.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p, i) => (
              <Reveal key={p.n} delay={i * 0.07}>
                <div className={`group relative h-full border-t-2 ${accentClass[p.accent]} bg-neutral-50 p-6 transition hover:-translate-y-1 dark:bg-neutral-900/40`}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" className={accentClass[p.accent].split(" ").slice(1).join(" ")}><path d={p.icon} /></svg>
                  <h3 className="mt-4 text-lg font-semibold">{p.n}</h3>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works — pipeline */}
        <section id="how" className="scroll-mt-24 border-y border-neutral-200 bg-neutral-50/60 py-24 dark:border-neutral-900 dark:bg-neutral-950/40">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <p className="text-sm font-medium text-indigo-600">How it works</p>
              <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">One pipeline. From commit to confidence.</h2>
            </Reveal>
            <div className="mt-12"><Pipeline /></div>
            <Reveal delay={0.1}>
              <div className="mt-10 overflow-x-auto border border-neutral-800 bg-neutral-950 p-5 text-sm shadow-lg">
                <pre className="font-mono leading-relaxed text-neutral-300">
{`# .github/workflows/verity.yml
- name: Verity — Quick check (every PR commit)
  uses: qashift/verity-action@v1
  with: { tier: fast, token: \${{ secrets.VERITY_INGEST_TOKEN }} }

- name: Verity — Full regression (on merge to main)
  if: github.ref == 'refs/heads/main'
  uses: qashift/verity-action@v1
  with: { tier: full, token: \${{ secrets.VERITY_INGEST_TOKEN }} }`}
                </pre>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Two-tier honesty */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-sm font-medium text-indigo-600">We label it honestly</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">A fast check is not a safety net. We never pretend otherwise.</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Reveal>
              <div className="h-full border border-amber-300 p-7 dark:border-amber-900/60">
                <span className="inline-block bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">Quick check</span>
                <h3 className="mt-4 text-xl font-semibold">Speed, on every commit</h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">Runs only the tests mapped to your changed files. Fast feedback in the PR — a sanity check, explicitly <em>not</em> full coverage. It can never block a merge.</p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full border border-indigo-400 p-7 dark:border-indigo-800">
                <span className="inline-block bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Full regression</span>
                <h3 className="mt-4 text-xl font-semibold">The real safety net</h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">The entire suite on merge, schedule, or pre-deploy. No diff-aware shortcuts, ever. This is the only tier allowed to block a merge.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 border-y border-neutral-200 py-24 dark:border-neutral-900">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal><h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Everything the suite needs to stay alive.</h2></Reveal>
            <div className="mt-12 grid gap-px overflow-hidden border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-800">
              {FEATURES.map((f, i) => (
                <Reveal key={f.t} delay={(i % 3) * 0.05}>
                  <div className="h-full bg-background p-7 transition hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                    <div className="flex h-9 w-9 items-center justify-center bg-indigo-600 text-white">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <h3 className="mt-4 font-semibold">{f.t}</h3>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{f.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Predictions — the intelligence layer */}
        <PredictionsShowcase />

        {/* FDE — the moat */}
        <section id="fde" className="scroll-mt-24 bg-neutral-950 py-24 text-white">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <Reveal>
                <span className="inline-block border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">The moat · human + AI</span>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">AI writes. Engineers verify. <span className="text-amber-400">Neither works without the other.</span></h2>
                <p className="mt-4 max-w-xl text-neutral-300">
                  Generated tests are disposable until someone owns them. On <strong className="text-white">every paid plan — from Starter</strong>, a
                  forward-deployed engineer joins your team: they convert AI scripts into a maintainable Page Object Model, keep the suite green as your
                  product changes, triage every failure, and tune the predictions to your codebase. You get the output of a QA team without building one.
                </p>
                <Link href="/pricing" className="mt-7 inline-block bg-amber-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400">See plans with an engineer →</Link>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="space-y-3">
                  {[
                    { k: "AI", t: "Generates the first draft", d: "Specs from flows/URLs in seconds." },
                    { k: "Platform", t: "Keeps it alive", d: "Self-heals locators, quarantines flakes, predicts risk." },
                    { k: "FDE", t: "Owns the outcome", d: "POM architecture, maintenance, triage — a human accountable for green." },
                  ].map((row) => (
                    <div key={row.k} className="flex items-start gap-4 border border-neutral-800 bg-neutral-900/60 p-5">
                      <span className="w-20 shrink-0 border-r border-neutral-700 pr-4 text-xs font-semibold uppercase tracking-wide text-amber-400">{row.k}</span>
                      <div>
                        <div className="font-medium">{row.t}</div>
                        <div className="text-sm text-neutral-400">{row.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Cloud vs CI vs FDE */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Try it in the cloud. Live in your CI. Hand it to an FDE.</h2>
            <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-300">Cloud is for the first feel — it&apos;s capped on purpose. The product is built to run in your pipeline, where it&apos;s unlimited.</p>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { tag: "Cloud", sub: "Get the feel", d: "Generate a spec and run a few times on our infra — no setup. Capped, because this is the demo, not the product.", cls: "border-neutral-300 dark:border-neutral-700", strong: "Minutes to first test" },
              { tag: "CI", sub: "The engine", d: "Wire one workflow in. Unlimited Quick checks and Full regressions in your own pipeline — we never host your browsers.", cls: "border-indigo-500", strong: "Unlimited runs, flat price" },
              { tag: "FDE", sub: "Done for you", d: "A forward-deployed engineer builds, owns and maintains the suite end-to-end. AI + platform + a human accountable for it.", cls: "border-amber-500", strong: "A QA team, without hiring one" },
            ].map((c, i) => (
              <Reveal key={c.tag} delay={i * 0.07}>
                <div className={`h-full border-t-2 ${c.cls} p-6`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-semibold">{c.tag}</span>
                    <span className="text-xs uppercase tracking-wide text-neutral-400">{c.sub}</span>
                  </div>
                  <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">{c.d}</p>
                  <p className="mt-4 text-sm font-medium">{c.strong}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section id="compare" className="scroll-mt-24 border-y border-neutral-200 bg-neutral-50/60 py-24 dark:border-neutral-900 dark:bg-neutral-950/40">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <p className="text-sm font-medium text-indigo-600">Why Verity</p>
              <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">The only one that does generation, maintenance, prediction — and a human.</h2>
            </Reveal>
            <div className="mt-10"><Comparison /></div>
          </div>
        </section>

        {/* Security */}
        <SecuritySection />

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-24 mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="text-sm font-medium text-indigo-600">Pricing</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Start free. Self-serve at $49. Add an engineer when ready.</h2>
            <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-300">Verity&apos;s self-serve tiers below. The forward-deployed-engineer tiers (Starter and up) — with visual, agent (AI) testing, performance, security, and predictions — share one canonical price across the QAShift platform.</p>
          </Reveal>
          <Reveal delay={0.1}><div className="mt-10"><VeritySelfServeCards inIndia={inIndia} /></div></Reveal>
        </section>

        {/* CTA */}
        <Reveal>
          <section className="mx-auto my-16 max-w-6xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-16 text-center text-white">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Generate your first test in 30 seconds.</h2>
            <p className="mx-auto mt-3 max-w-xl text-indigo-100">Try it free in the cloud, wire it into your CI, or hand the whole suite to a forward-deployed engineer.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/login?next=/dashboard" className="bg-white px-6 py-3 text-sm font-semibold text-indigo-700">Start free</Link>
              <Link href="/pricing" className="border border-white/40 px-6 py-3 text-sm font-semibold">See pricing</Link>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 sm:flex-row sm:items-center">
          <div>
            <Logo />
            <p className="mt-2 max-w-sm text-sm text-neutral-500">
              Verity is part of the QAShift testing platform —{" "}
              <a href="https://www.qashifthq.com" target="_blank" rel="noreferrer" className="font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">Explore QAShift →</a>
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-neutral-500">
            <Link href="/docs" className="hover:text-neutral-900 dark:hover:text-white">Docs</Link>
            <a href="#fde" className="hover:text-neutral-900 dark:hover:text-white">FDE</a>
            <Link href="/pricing" className="hover:text-neutral-900 dark:hover:text-white">Pricing</Link>
            <Link href="/login" className="hover:text-neutral-900 dark:hover:text-white">Sign in</Link>
          </div>
        </div>
        <div className="border-t border-neutral-100 dark:border-neutral-900">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-neutral-400 sm:flex-row">
            <span>© {new Date().getFullYear()} Verity — part of the QAShift testing platform. AI writes, engineers verify.</span>
            <span className="flex items-center gap-3">
              <span className="uppercase tracking-widest text-[0.62rem] text-neutral-400">Platform</span>
              <a href="https://www.qashifthq.com" target="_blank" rel="noreferrer" className="hover:text-neutral-900 dark:hover:text-white">QAShift</a>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <span className="font-medium text-neutral-700 dark:text-neutral-200">Verity</span>
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
              <a href="https://clearpath.qashifthq.com" target="_blank" rel="noreferrer" className="hover:text-neutral-900 dark:hover:text-white">Clearpath</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
