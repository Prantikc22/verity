import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const AGENTS: { name: string; role: string; result: string; d: string }[] = [
  { name: "Scout", role: "UI journeys", result: "14 / 14 passed", d: "M3 3l7 18 2.5-7.5L20 11z" },
  { name: "Relay", role: "API contracts", result: "112 checks passed", d: "M8 4c-2 0-3 1-3 3v2c0 1.5-1 2-2 3 1 1 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 2 2 3-1 1-2 1.5-2 3v2c0 2-1 3-3 3" },
  { name: "Pulse", role: "Performance", result: "p95 298 ms", d: "M3 12h4l3-8 4 16 3-8h4" },
  { name: "Warden", role: "Security", result: "0 high findings", d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" },
  { name: "Lumen", role: "Accessibility", result: "No new issues", d: "M12 5a2 2 0 100-4 2 2 0 000 4zM4 8h16M12 8v13M8 21l4-7 4 7" },
  { name: "Prism", role: "Visual", result: "Matches baseline", d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z" },
];

const TRUST: { t: string; d: string }[] = [
  { t: "Tests stay Playwright code in your repo", d: "M16 18l6-6-6-6M8 6l-6 6 6 6" },
  { t: "Runs in your own CI", d: "M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5" },
  { t: "Free plan, no card", d: "M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7c-2-3-6-3-6 0h6zM12 7c2-3 6-3 6 0h-6z" },
];

function Glyph({ d, className = "" }: { d: string; className?: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}><path d={d} /></svg>;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; product?: string }>;
}) {
  const { next: nextParam, error, product } = await searchParams;
  // Signed up from the Reports page: land in the focused Reports workspace.
  const reports = product === "reports";
  const next = reports && (!nextParam || nextParam === "/dashboard") ? "/dashboard/welcome/reports" : nextParam;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#0A0D18] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* soft brand glow + faint grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_85%_35%,rgba(106,75,255,.28),transparent_60%),radial-gradient(600px_300px_at_10%_100%,rgba(34,201,133,.10),transparent_60%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.35] [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_70%_40%,#000_20%,transparent_70%)]" />

        <div className="relative"><Link href="https://qashifthq.com" className="text-white"><Logo size={26} /></Link></div>

        <div className="relative max-w-[30rem]">
          {reports ? (
            <>
              <h2 className="text-[2.6rem] font-semibold leading-[1.04] tracking-tight">Every test run.<br /><span className="font-serif text-[2.9rem] font-normal italic text-violet-200">One clear answer.</span></h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-400">Run history, flaky tests, slow tests and failures across every run, from the Playwright tests you already have.</p>
              <ol className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur">
                {[["Install the reporter", "npm i -D @qashifthq/playwright-reporter"], ["Add one line to your config", "reporter: [['@qashifthq/playwright-reporter']]"], ["Set your token in CI", "QASHIFT_TOKEN"]].map(([t, c], i) => (
                  <li key={t} className="flex items-start gap-3 border-t border-white/[0.07] px-4 py-3.5 first:border-t-0">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-500 text-[12px] font-semibold">{i + 1}</span>
                    <span className="min-w-0"><span className="block text-[14px] font-medium">{t}</span><code className="mt-1 block truncate text-[12px] text-slate-400">{c}</code></span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <h2 className="text-[2.6rem] font-semibold leading-[1.04] tracking-tight">Find the bugs.<br /><span className="font-serif text-[2.9rem] font-normal italic text-violet-200">Ship the good stuff.</span></h2>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-400">Six specialist agents in one workspace, every one included in every plan.</p>
              <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 shadow-[0_40px_80px_-40px_rgba(0,0,0,.8)] backdrop-blur">
                <div className="flex items-baseline justify-between px-1 pb-3">
                  <span className="text-[14px] font-semibold">Release check</span>
                  <span className="text-[12px] text-slate-500">PR #1291 · sample</span>
                </div>
                <ul className="grid gap-1.5">
                  {AGENTS.map((a, i) => (
                    <li key={a.name} className="login-agent flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5" style={{ animationDelay: `${0.25 + i * 0.35}s` }}>
                      <Glyph d={a.d} className="shrink-0 text-violet-300" />
                      <span className="w-16 text-[13.5px] font-semibold">{a.name}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-400">{a.role}</span>
                      <span className="text-[12px] font-medium text-emerald-300">{a.result}</span>
                      <span className="login-tick grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-[#04140C]" style={{ animationDelay: `${0.35 + i * 0.35}s` }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="login-verdict mt-3 flex h-10 items-center justify-center rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-[13.5px] font-semibold text-[#04140C]">Safe to merge</div>
              </div>
            </>
          )}
        </div>

        <ul className="relative grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
          {(reports ? [TRUST[0], { t: "2,000 results a month free", d: TRUST[2].d }, { t: "Private by default", d: "M6 10V7a6 6 0 0112 0v3M5 10h14v11H5z" }] : TRUST).map((x) => (
            <li key={x.t} className="flex items-start gap-2 text-[12.5px] leading-snug text-slate-300">
              <Glyph d={x.d} className="mt-px shrink-0 text-violet-300" />{x.t}
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Link href="/"><Logo /></Link></div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to QAShift</h1>
          <p className="mt-1 text-sm text-neutral-500">{reports ? "Create an account or sign in to set up Reports." : "Create an account or sign in to continue."}</p>
          {error && <p className="mt-4 text-sm text-red-600">Sign-in failed. Please try again.</p>}
          <div className="mt-6"><LoginForm next={next} /></div>
        </div>
      </div>
    </main>
  );
}
