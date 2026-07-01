import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { GithubInstallVisual } from "@/components/GithubInstallVisual";

export const metadata: Metadata = {
  title: "GitHub App",
  description: "Install Verity on your repositories to automatically generate, run, and gate Playwright tests on every pull request.",
};

const INSTALL_URL = "https://github.com/apps/verity-by-qashift";

const STEPS = [
  { n: "1", t: "Install the app", d: "Add Verity by QAShift to the repositories you want covered. You control exactly which repos it can see." },
  { n: "2", t: "Generate your tests", d: "Use the Verity MCP in your IDE, or the dashboard, to generate Playwright tests for your app — saved to your project." },
  { n: "3", t: "Open a pull request", d: "Verity detects your tests and runs them on every PR — exploratory and regression — then comments the results." },
  { n: "4", t: "Merge with confidence", d: "Pass rate, flake triage, and a deploy-confidence prediction posted right in the PR, before you ship." },
];

const PERMS = [
  { t: "Checks & commit statuses", d: "So Verity can post pass/fail and gate merges." },
  { t: "Pull requests", d: "To comment results, predictions, and self-healing diffs." },
  { t: "Contents (read/write)", d: "To read your test specs and push generated tests as a PR." },
  { t: "Metadata", d: "Standard read-only access GitHub requires for every app." },
];

export default function GithubAppPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="w-full">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <span className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              <GithubMark className="h-3.5 w-3.5" /> GitHub App
            </span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Run Verity on every pull request.</h1>
            <p className="mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
              Connect your repositories to automate your testing lifecycle. Once you&apos;ve generated tests with Verity, our GitHub
              integration detects and runs them on every PR — so your changes are production-ready before they merge.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={INSTALL_URL} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
                <GithubMark className="h-4 w-4" /> Install on GitHub
              </a>
              <Link href="/docs#github-action" className="border border-neutral-300 px-6 py-3 text-sm font-semibold dark:border-neutral-700">Read the docs</Link>
            </div>
            <p className="mt-3 text-xs text-neutral-500">Free to install · choose specific repos · uninstall anytime from your GitHub settings.</p>
          </Reveal>

          {/* Visual */}
          <Reveal delay={0.1}>
            <div className="mt-12 border border-neutral-200 bg-white p-6 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              <GithubInstallVisual className="mx-auto w-full max-w-3xl" />
            </div>
          </Reveal>

          {/* How it works */}
          <section className="mt-24">
            <Reveal><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2></Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.05}>
                  <div className="h-full border border-neutral-200 p-5 dark:border-neutral-800">
                    <div className="flex h-8 w-8 items-center justify-center bg-indigo-600 text-sm font-semibold text-white">{s.n}</div>
                    <h3 className="mt-3 text-sm font-semibold">{s.t}</h3>
                    <p className="mt-1.5 text-xs text-neutral-500">{s.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Permissions */}
          <section className="mt-24">
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What it can access</h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">
                Least-privilege by design. You pick the repositories during install, and Verity only requests what it needs to run and report tests.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {PERMS.map((p, i) => (
                <Reveal key={p.t} delay={i * 0.05}>
                  <div className="flex gap-3 border border-neutral-200 p-4 dark:border-neutral-800">
                    <span className="mt-0.5 text-emerald-500">✓</span>
                    <div>
                      <h3 className="text-sm font-medium">{p.t}</h3>
                      <p className="text-xs text-neutral-500">{p.d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* CTA */}
          <Reveal>
            <section className="mx-auto my-24 max-w-6xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-16 text-center text-white">
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Add Verity to your repos in two clicks.</h2>
              <p className="mx-auto mt-3 max-w-xl text-indigo-100">Install the GitHub App, then generate your first test from the dashboard or your IDE.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a href={INSTALL_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-white px-6 py-3 text-sm font-semibold text-indigo-700">
                  <GithubMark className="h-4 w-4" /> Install on GitHub
                </a>
                <Link href="/login?next=/dashboard" className="border border-white/40 px-6 py-3 text-sm font-semibold">Open dashboard</Link>
              </div>
            </section>
          </Reveal>
        </div>
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
            <Link href="/github" className="hover:text-neutral-900 dark:hover:text-white">GitHub App</Link>
            <Link href="/pricing" className="hover:text-neutral-900 dark:hover:text-white">Pricing</Link>
            <Link href="/login" className="hover:text-neutral-900 dark:hover:text-white">Sign in</Link>
          </div>
        </div>
        <div className="border-t border-neutral-100 py-5 text-center text-xs text-neutral-400 dark:border-neutral-900">
          © {new Date().getFullYear()} Verity — part of the QAShift testing platform. AI writes, engineers verify.
        </div>
      </footer>
    </div>
  );
}

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
