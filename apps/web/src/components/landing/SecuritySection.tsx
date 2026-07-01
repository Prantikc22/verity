"use client";

import { motion } from "framer-motion";

const ITEMS = [
  {
    t: "Your browsers and secrets never leave your CI",
    d: "Verity is CI-native. Tests run in your own pipeline against your own environments. We never host your browsers or receive your app secrets — only test results and metadata are sent to us.",
    icon: "M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z",
  },
  {
    t: "Tenant isolation with row-level security",
    d: "Every row is scoped to an organization and enforced in the database with Postgres RLS. One customer can never read another's projects, tests, or runs.",
    icon: "M4 4h16v6H4zM4 14h16v6H4z",
  },
  {
    t: "Scoped, revocable ingest tokens",
    d: "CI authenticates with a per-project token that can only post results for that project. Rotate or revoke it any time — no broad API keys, no standing access to your repo.",
    icon: "M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z",
  },
  {
    t: "We never write to your source",
    d: "Self-healing proposes a corrected locator as a diff you approve. Verity has no write access to your code — a human always lands the change.",
    icon: "M16 3l5 5L8 21H3v-5z",
  },
  {
    t: "Least-privilege GitHub App",
    d: "The app requests only Pull requests, Checks and Contents (read). Webhooks are HMAC-signed and verified on every call. No org-wide or account permissions.",
    icon: "M12 2l3 7h7l-5.5 4 2 7L12 17l-6.5 5 2-7L2 9h7z",
  },
  {
    t: "Auditable, open-source core",
    d: "The execution and scoring engine (@qashift/verity-core) is MIT-licensed and inspectable. The model that decides flaky-vs-real and risk is not a black box.",
    icon: "M8 3H5v18h3M16 3h3v18h-3M9 12h6",
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-24 mx-auto max-w-6xl px-6 py-24">
      <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <p className="text-sm font-medium text-indigo-600">Security &amp; data</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Built so your code and secrets stay yours.</h2>
        <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-300">
          Verity is designed for teams that can&apos;t hand their codebase to a SaaS. The architecture keeps execution in your
          infrastructure and gives us the least access that still does the job.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-px overflow-hidden border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-800">
        {ITEMS.map((it, i) => (
          <motion.div
            key={it.t}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (i % 3) * 0.06 }}
            className="bg-background p-6"
          >
            <div className="flex h-9 w-9 items-center justify-center bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter"><path d={it.icon} /></svg>
            </div>
            <h3 className="mt-4 font-semibold">{it.t}</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{it.d}</p>
          </motion.div>
        ))}
      </div>

      <p className="mt-6 text-xs text-neutral-500">
        Enterprise plans add SSO/SAML, RBAC, and SOC 2 / GDPR support via the QAShift platform. Security questions? <a href="mailto:hello@qashifthq.com" className="underline">hello@qashifthq.com</a>.
      </p>
    </section>
  );
}
