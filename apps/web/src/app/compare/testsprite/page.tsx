import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingNav, UrlStart } from "@/components/landing/LandingExperience";
import landing from "@/components/landing/LandingExperience.module.css";
import styles from "@/components/landing/SeoPage.module.css";
import { SITE_URL } from "@/lib/site";

const TITLE = "Verity vs TestSprite — an honest comparison for AI testing (2026)";
const DESCRIPTION =
  "Comparing Verity and TestSprite: pricing models, test types, where tests run and who owns them. Verity charges for AI-written tests and runs them free in your CI; TestSprite uses monthly credits.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/compare/testsprite" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/compare/testsprite", type: "article" },
};

// Competitor facts come only from their public pricing page; keep CHECKED current when editing.
const CHECKED = "October 2026";

const ROWS: [string, string, string][] = [
  ["Pricing model", "Pay for AI-written tests per month; runs in your own CI are unlimited on every plan", "Monthly credits per plan"],
  ["Free plan", "15 AI-written tests / month, 1 project, unlimited CI runs", "150 credits / month, 1 environment"],
  ["Entry paid plan", "Pro — $49 / month (200 AI-written tests)", "Starter — $19 / month (400 credits), first month free"],
  ["Mid / upper plans", "Team — $149 / month (750 tests, 10 projects)", "Standard $39, Pro $69 / month; Enterprise from $199"],
  ["Test types", "UI, API, visual regression, AI-agent / LLM evals, load testing, security scanning", "Frontend and backend (API) testing"],
  ["Where tests run", "Your CI — GitHub Actions, GitLab or Jenkins — plus capped cloud runs", "TestSprite cloud, with a CLI for running in your own CI"],
  ["Test format", "Playwright TypeScript, a load-test script and an eval YAML file, committed to your repo", "Created and run from the TestSprite workspace or its CLI"],
  ["Self-healing", "From Pro, delivered as a reviewable diff", "From Starter"],
  ["Integrations", "GitHub App, GitLab, Jenkins, MCP server for coding agents", "GitHub, Slack, Jira, Linear, MCP / IDE plugin"],
  ["Managed option", "QAShift engineer who owns the suite, from $499 / month", "Enterprise with a named CSM"],
];

const FAQ = [
  { q: "Is Verity a TestSprite alternative?", a: "Yes, for teams that want AI-written tests they own as code and run in their own CI without a per-run meter. Teams that prefer a fully hosted runner with built-in Slack, Jira and Linear integrations may prefer TestSprite." },
  { q: "Which is cheaper?", a: "It depends on how often you run. TestSprite's entry plan is cheaper ($19 vs $49). Because Verity never charges for runs in your CI, it tends to cost less for teams that run large suites on every commit." },
  { q: "Can I move my tests off Verity later?", a: "Yes. UI, API and visual tests are plain Playwright files in your repository, so they keep running without Verity." },
];

export default function CompareTestSprite() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Verity", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Verity vs TestSprite", item: `${SITE_URL}/compare/testsprite` },
        ],
      },
      { "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <div className={landing.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <LandingNav />
      <main className={styles.main}>
        <div className={styles.shell}>
          <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/">Verity</Link><span>/</span><span aria-current="page">Verity vs TestSprite</span></nav>
        </div>
        <section className={styles.hero}>
          <div className={styles.shell}>
            <span className={styles.eyebrow}>COMPARISON · UPDATED {CHECKED.toUpperCase()}</span>
            <h1>Verity vs TestSprite<span>Which AI testing tool fits?</span></h1>
            <p className={styles.intro}>
              Both use AI to write end-to-end tests. They differ in how you pay, which kinds of test they cover, and where the tests live.
              In short: Verity writes tests you own as code and runs them free in your CI; TestSprite runs tests on a credit plan in its cloud.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.shell}>
            <h2>Side by side</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th scope="col"></th><th scope="col">Verity</th><th scope="col">TestSprite</th></tr></thead>
                <tbody>{ROWS.map(([k, v, t]) => <tr key={k}><td>{k}</td><td>{v}</td><td>{t}</td></tr>)}</tbody>
              </table>
            </div>
            <p className={styles.note}>
              TestSprite details are taken from its public <a href="https://www.testsprite.com/pricing" rel="nofollow noopener noreferrer" target="_blank">pricing page</a> as of {CHECKED} and may have changed since.
              TestSprite is a trademark of its respective owner; this page is not affiliated with or endorsed by it.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.shell}>
            <h2>When to choose which</h2>
            <div className={styles.grid}>
              <div><h3>Choose Verity if…</h3><p>You want tests as Playwright code in your repo, you run your suite often and don&apos;t want to pay per run, or you need visual, AI-agent, load or security testing alongside UI and API.</p></div>
              <div><h3>Choose TestSprite if…</h3><p>You want a fully hosted runner with nothing in your CI, built-in Slack, Jira and Linear integrations, or the lowest-priced entry plan.</p></div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.shell}>
            <h2>Frequently asked questions</h2>
            <div className={styles.faq}>
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0}><summary><h3>{f.q}</h3><span aria-hidden>+</span></summary><p>{f.a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.cta}>
          <div className={styles.shell}>
            <h2>See it on your own app.</h2>
            <p>Free plan, no credit card. Every test type included.</p>
            <UrlStart id="compare-url" centered />
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
