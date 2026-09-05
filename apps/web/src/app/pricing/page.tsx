import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { VeritySelfServeCards } from "@/components/landing/VeritySelfServeCards";
import { Comparison } from "@/components/landing/Comparison";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Reveal } from "@/components/Reveal";
import { isIndia } from "@/lib/geo";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start free, go self-serve at $49/mo, or add a forward-deployed engineer on the QAShift platform. Unlimited CI runs, no per-test meter.",
};

const FAQ = [
  { q: "Is an engineer really included from Starter?", a: "Yes. Every paid plan includes a forward-deployed QA engineer who owns your suite — converts AI scripts into a maintainable Page Object Model, keeps it green, and triages failures. AI writes, the engineer verifies." },
  { q: "What does the test cap mean?", a: "It's the number of maintained tests in your suite (60 / 200 / 500), not a limit on runs. Runs are always unlimited in your CI — you never pay per execution." },
  { q: "Why is cloud capped but CI unlimited?", a: "Running browsers on our infra costs us money; running them in your CI doesn't. Cloud exists so you can get the feel in minutes — the product is built to live in your pipeline." },
  { q: "USD or INR?", a: "Prices are in USD by default. Teams in India can switch to INR with the toggle above the plans. Annual billing saves 15%." },
  { q: "Do I own the tests?", a: "Yes. The specs and the Page Object Model structure are yours, and the core runner (@qashift/verity-core) is MIT-licensed. No lock-in." },
  { q: "How is this different from per-test AI tools?", a: "They meter you and rarely heal, triage flakes, or predict risk — and there's no human accountable. Verity is flat-priced, self-heals, separates flaky from broken, predicts regressions, and puts an engineer on it." },
];

export default async function PricingPage() {
  const inIndia = await isIndia();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="w-full">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <span className="inline-block border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">Same pricing across the QAShift platform</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Start free. Go self-serve at $49. Add an engineer when you&apos;re ready.</h1>
            <p className="mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-300">
              Verity&apos;s self-serve tiers are below. The forward-deployed-engineer tiers (Starter and up) — with visual, agent (AI) testing, performance, security, and predictions — live on the
              {" "}<a href="https://qashifthq.com/pricing" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">canonical QAShift pricing page</a>.
            </p>
          </Reveal>

          <Reveal delay={0.1}><div className="mt-12"><VeritySelfServeCards inIndia={inIndia} /></div></Reveal>

          <section className="mt-24">
            <Reveal><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How we stack up</h2></Reveal>
            <Reveal delay={0.08}><div className="mt-8"><Comparison /></div></Reveal>
          </section>

          <section className="mt-24">
            <Reveal><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Questions, answered.</h2></Reveal>
            <div className="mt-8 grid gap-px overflow-hidden border border-neutral-200 bg-neutral-200 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-800">
              {FAQ.map((f) => (
                <div key={f.q} className="bg-background p-6">
                  <h3 className="font-medium">{f.q}</h3>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <SecuritySection />

        <Reveal>
          <section className="mx-auto my-16 max-w-6xl px-6">
            <div className="relative overflow-hidden rounded-[28px] bg-[#0b0d16] px-7 py-14 text-white sm:px-10 lg:px-14 lg:py-16">
              <div aria-hidden className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-violet-600/25 blur-[100px]" />
              <div aria-hidden className="absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-indigo-600/20 blur-[100px]" />
              <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-sm font-medium text-indigo-300">Need more than self-serve?</p>
                  <h2 className="mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Get the testing function—not another tool to manage.</h2>
                  <p className="mt-4 max-w-2xl leading-relaxed text-neutral-400">Add a forward-deployed engineer, enterprise controls, and a self-hosted runner. Verity becomes an owned QA system inside your team.</p>
                  <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-neutral-300">
                    {['Dedicated engineer', 'SSO + RBAC', 'Self-hosted runner', 'SOC 2 / GDPR support'].map((item) => (
                      <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{item}</span>
                    ))}
                  </div>
                </div>
                <div className="flex min-w-56 flex-col gap-3">
                  <a href="mailto:hello@qashifthq.com?subject=Verity%20Enterprise" className="rounded-xl bg-white px-6 py-3.5 text-center text-sm font-semibold text-neutral-950 transition hover:bg-indigo-50">Talk to us</a>
                  <a href="https://qashifthq.com/pricing" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/20 px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-white/[0.06]">View managed plans</a>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <SiteFooter />
    </div>
  );
}
