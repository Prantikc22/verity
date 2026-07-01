import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { VeritySelfServeCards } from "@/components/landing/VeritySelfServeCards";
import { Comparison } from "@/components/landing/Comparison";
import { SecuritySection } from "@/components/landing/SecuritySection";
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
              Verity&apos;s self-serve tiers are below. The forward-deployed-engineer tiers (Starter and up) — with mobile, performance, security, and predictions — live on the
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
          <div className="mx-auto mb-16 mt-8 flex max-w-6xl flex-col items-center gap-4 border border-amber-300 bg-amber-50/50 px-6 py-10 text-center dark:border-amber-900/60 dark:bg-amber-950/20">
            <h2 className="text-2xl font-semibold tracking-tight">Need unlimited coverage or self-hosting?</h2>
            <p className="max-w-xl text-sm text-neutral-600 dark:text-neutral-300">Enterprise adds multiple engineers, SSO/SAML, RBAC, SOC 2 / GDPR support, and a self-hosted runner. Part of the QAShift managed-QA platform.</p>
            <a href="mailto:hello@qashifthq.com?subject=Verity%20Enterprise" className="bg-amber-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400">Talk to us about Enterprise</a>
            <Link href="/docs" className="text-xs text-neutral-500 underline">or read the docs first</Link>
          </div>
        </Reveal>
      </main>
    </div>
  );
}
