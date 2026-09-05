import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Reveal } from "@/components/Reveal";
import { VerificationShowcase } from "@/components/landing/VerificationShowcase";
import { SiteFooter } from "@/components/landing/SiteFooter";

const RISKS = [
  {
    number: "01",
    pain: "The flow nobody tested",
    answer: "Verity opens the live product and turns real user journeys into runnable Playwright tests.",
    signal: "UNTESTED",
    signalClass: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-300",
    glowClass: "bg-red-500",
  },
  {
    number: "02",
    pain: "The test that passed for the wrong reason",
    answer: "Every generated spec is grounded in the DOM and executed before Verity calls it ready.",
    signal: "FALSE GREEN",
    signalClass: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    glowClass: "bg-amber-500",
  },
  {
    number: "03",
    pain: "The selector that broke after launch",
    answer: "Verity finds the new element from the live page and proposes a reviewable repair.",
    signal: "DOM DRIFT",
    signalClass: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    glowClass: "bg-violet-500",
  },
] as const;

const STEPS = [
  ["01", "Point", "Give Verity a URL and the journey that matters."],
  ["02", "Ground", "It observes the live UI, roles, states, requests and assertions."],
  ["03", "Prove", "It writes Playwright, runs it, and returns code plus evidence."],
] as const;

const COVERAGE = [
  ["UI", "Real browser journeys"],
  ["API", "Contracts and responses"],
  ["Visual", "Unexpected UI changes"],
  ["Agent", "AI behavior and tools"],
  ["Performance", "Slow pages and regressions"],
  ["Security", "Common release risks"],
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <Hero />

      <main className="w-full">
        <section id="product" className="scroll-mt-24 border-b border-neutral-200 dark:border-neutral-900">
          <div className="mx-auto grid max-w-6xl gap-14 px-6 py-24 lg:grid-cols-[.82fr_1.18fr] lg:py-28">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">The release gap</p>
                <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  Code got faster. Proof didn&apos;t.
                </h2>
                <p className="mt-5 max-w-lg text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
                  AI can ship a feature in an afternoon. Your team still has to guess what it broke, write the tests, and keep them alive. That gap becomes a production incident.
                </p>
              </div>
            </Reveal>

            <div className="space-y-3">
              {RISKS.map((risk, index) => (
                <Reveal key={risk.number} delay={index * 0.06}>
                  <article className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 p-6 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700">
                    <div aria-hidden className={`absolute -right-12 -top-12 h-28 w-28 rounded-full ${risk.glowClass} opacity-[0.08] blur-2xl transition group-hover:opacity-[0.14]`} />
                    <div className="relative grid gap-4 sm:grid-cols-[3rem_1fr_auto] sm:items-start">
                      <span className="font-mono text-xs text-indigo-500">{risk.number}</span>
                      <div>
                        <h3 className="text-xl font-semibold tracking-tight">{risk.pain}</h3>
                        <p className="mt-2 leading-relaxed text-neutral-600 dark:text-neutral-300">{risk.answer}</p>
                      </div>
                      <span className={`w-fit rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] ${risk.signalClass}`}>{risk.signal}</span>
                    </div>
                    <div className="relative mt-5 flex items-center gap-3 border-t border-neutral-200 pt-4 text-[10px] text-neutral-400 dark:border-neutral-800">
                      <span className={`h-1.5 w-1.5 rounded-full ${risk.glowClass}`} />
                      <span>Live product signal</span>
                      <span className="text-neutral-300 dark:text-neutral-700">→</span>
                      <span className="font-medium text-neutral-600 dark:text-neutral-300">Verity evidence</span>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-24 bg-[#080910] py-24 text-white lg:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <p className="text-sm font-medium text-indigo-300">One verification loop</p>
                  <h2 className="mt-3 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                    From URL to verified test. No theatre in between.
                  </h2>
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-neutral-400">
                  If the generated code cannot run against the real product, it is not presented as a finished test.
                </p>
              </div>
            </Reveal>

            <div className="mt-12 grid border border-white/10 md:grid-cols-3">
              {STEPS.map(([number, title, description], index) => (
                <Reveal key={number} delay={index * 0.08}>
                  <article className="h-full border-b border-white/10 p-7 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                    <span className="font-mono text-xs text-indigo-300">{number}</span>
                    <h3 className="mt-8 text-2xl font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-400">{description}</p>
                  </article>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.1}>
              <VerificationShowcase />
            </Reveal>

            <Reveal delay={0.12}>
              <div id="coverage" className="scroll-mt-24 mt-12 border-t border-white/10 pt-7">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <p className="max-w-xs text-sm font-medium text-neutral-300">One place to verify the surfaces your release can break.</p>
                  <div className="grid flex-1 grid-cols-2 gap-px overflow-hidden bg-white/10 sm:grid-cols-3 lg:max-w-3xl lg:grid-cols-6">
                    {COVERAGE.map(([type, detail]) => (
                      <div key={type} className="bg-[#0d0f19] p-4">
                        <div className="text-sm font-semibold text-white">{type}</div>
                        <div className="mt-1 text-[11px] leading-snug text-neutral-500">{detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="fde" className="scroll-mt-24 border-b border-neutral-200 dark:border-neutral-900">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center lg:py-28">
            <Reveal>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">AI speed. Human ownership.</p>
              <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                A generated test is useful. A maintained suite is the product.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
                Verity keeps locators healthy, separates flakes from failures, and can add a forward-deployed engineer who owns the suite with your team.
              </p>
              <Link href="/pricing" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-neutral-950 underline decoration-indigo-400 decoration-2 underline-offset-4 transition hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">
                See self-serve and managed plans <span aria-hidden>→</span>
              </Link>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="relative overflow-hidden rounded-[24px] border border-neutral-800 bg-[#0b0d15] p-5 text-white shadow-2xl sm:p-6">
                <div aria-hidden className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-violet-600/20 blur-3xl" />
                <div className="relative flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-300">Repair proposal</div>
                    <div className="mt-1 text-sm font-medium">checkout.spec.ts</div>
                  </div>
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[9px] font-semibold text-amber-300">REVIEW REQUIRED</span>
                </div>

                <div className="relative mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-black/20 font-mono text-[10px] leading-6 sm:text-[11px]">
                  <div className="border-b border-red-400/10 bg-red-400/[0.06] px-4 py-2 text-red-300">
                    <span className="mr-3 text-red-500">−</span>page.locator(<span className="text-red-200">&apos;#submit-order&apos;</span>)
                  </div>
                  <div className="bg-emerald-400/[0.07] px-4 py-2 text-emerald-300">
                    <span className="mr-3 text-emerald-500">+</span>page.getByRole(<span className="text-emerald-200">&apos;button&apos;</span>, &#123; name: <span className="text-emerald-200">&apos;Place order&apos;</span> &#125;)
                  </div>
                </div>

                <div className="relative mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-[9px] text-neutral-500">MATCH CONFIDENCE</div>
                    <div className="mt-2 flex items-end gap-2"><span className="text-2xl font-semibold">96%</span><span className="pb-1 text-[9px] text-emerald-300">live DOM</span></div>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                    <div className="text-[9px] text-neutral-500">RERUN</div>
                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-300"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/10">✓</span>Passed</div>
                  </div>
                </div>

                <div className="relative mt-4 flex items-center justify-between rounded-xl bg-indigo-500 px-4 py-3 text-xs font-semibold shadow-lg shadow-indigo-950/30">
                  <span>Approve repair</span>
                  <span aria-hidden>→</span>
                </div>
              </div>
            </Reveal>
          </div>

          <div id="security" className="scroll-mt-24 border-t border-neutral-200 dark:border-neutral-900">
            <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold">Built to fit your engineering system.</span>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-neutral-500 dark:text-neutral-400">
                <span>Your code stays yours</span>
                <span>Runs in your CI</span>
                <span>GitHub + GitLab</span>
                <span>Playwright-native</span>
              </div>
            </div>
          </div>
        </section>

        <Reveal>
          <section className="mx-auto my-16 max-w-6xl px-6">
            <div className="relative overflow-hidden bg-indigo-600 px-7 py-16 text-center text-white sm:px-12 sm:py-20">
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,.2),transparent_38%),radial-gradient(circle_at_90%_100%,rgba(139,92,246,.8),transparent_42%)]" />
              <div className="relative">
                <p className="text-sm font-medium text-indigo-100">Your next release needs evidence, not confidence theatre.</p>
                <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Show Verity the product. Get the test and the proof.</h2>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link href="/login?next=/dashboard" className="bg-white px-7 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-50">Start free</Link>
                  <Link href="/pricing" className="border border-white/35 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10">See pricing</Link>
                </div>
                <p className="mt-5 text-xs text-indigo-100/80">No card · You own the generated code · First test in minutes</p>
              </div>
            </div>
          </section>
        </Reveal>
      </main>

      <SiteFooter />
    </div>
  );
}
