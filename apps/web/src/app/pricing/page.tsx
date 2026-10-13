import type { Metadata } from "next";
import Link from "next/link";
import { Comparison } from "@/components/landing/Comparison";
import { LandingFooter, LandingNav } from "@/components/landing/LandingExperience";
import { VeritySelfServeCards } from "@/components/landing/VeritySelfServeCards";
import { isIndia } from "@/lib/geo";
import styles from "./PricingPage.module.css";

const DESCRIPTION =
  "Verity pricing: free forever for one project, Pro at $49/mo, Team at $149/mo. Every plan writes UI, API, visual, AI-agent, load and security tests, with unlimited runs in your own CI.";

export const metadata: Metadata = {
  title: "Pricing — AI test generation from $0, unlimited CI runs",
  alternates: { canonical: "/pricing" },
  description: DESCRIPTION,
  openGraph: { title: "Verity pricing — free plan, unlimited CI runs", description: DESCRIPTION, url: "/pricing" },
};

const faqFor = (yearly: boolean) => [
  { q: "What counts toward my monthly allowance?", a: "Only AI-written tests: each test Verity generates for you — UI, API, visual, AI-agent eval or load test — counts once. Running tests never counts, so your suite can run on every commit." },
  { q: "Are CI runs really unlimited?", a: "Yes, on every plan including Free. Your CI provides the compute, so Verity never meters executions there. Cloud runs (our browsers, no CI needed) are capped per plan." },
  { q: "Which test types are on the Free plan?", a: "All of them: UI, API, visual, AI-agent, load and security. Paid plans add volume, self-healing, pull-request checks and more projects." },
  { q: "How is this different from credit-based testing tools?", a: "Credit-based tools usually charge every time a test runs on their servers. Verity charges for writing tests and lets you run them free, forever, in your own pipeline — as plain Playwright code you own." },
  { q: "Do we own the tests?", a: "Yes. Tests are readable Playwright (plus a load-test script and an eval YAML file) committed to your repository. If you cancel, they keep running." },
  { q: "Can I change or cancel my plan?", a: yearly
    ? "Yes. Pay monthly, or yearly to save 20%; there is no contract beyond the period you've paid for. Email hello@qashifthq.com to change or cancel. Your tests stay in your repo either way."
    : "Yes. Plans are month to month with no contract — email hello@qashifthq.com to change or cancel. Your tests stay in your repo either way." },
  { q: "When should we choose Managed Testing?", a: "When you want the outcome owned rather than another tool to operate. A QAShift engineer takes responsibility for strategy, coverage, maintenance, failure triage and release reporting." },
  { q: "What about security and private code?", a: "Tests and scans run inside your CI, so code and secrets stay in your infrastructure; only results are sent to Verity." },
];

const jsonLdFor = (FAQ: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      name: "Verity",
      description: DESCRIPTION,
      brand: { "@type": "Brand", name: "QAShift" },
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: "49", priceCurrency: "USD", priceSpecification: { "@type": "UnitPriceSpecification", price: "49", priceCurrency: "USD", unitCode: "MON" } },
        { "@type": "Offer", name: "Team", price: "149", priceCurrency: "USD", priceSpecification: { "@type": "UnitPriceSpecification", price: "149", priceCurrency: "USD", unitCode: "MON" } },
      ],
    },
    { "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ],
});

const OWNERSHIP = [
  ["01", "Test strategy", "OWNED WITH YOU"],
  ["02", "Suite architecture", "BUILT + MAINTAINED"],
  ["03", "Failure triage", "EVERY RUN"],
  ["04", "Release reporting", "SHIPPED TO THE TEAM"],
] as const;

/** A tier/period is only offered once its Razorpay plan exists (never sell what can't be bought). */
function billingAvailability() {
  const has = (k: string) => Boolean(process.env[k]);
  const solo = has("RAZORPAY_PLAN_SOLO");
  const yearly = has("RAZORPAY_PLAN_PRO_YEARLY") && has("RAZORPAY_PLAN_TEAM_YEARLY") && (!solo || has("RAZORPAY_PLAN_SOLO_YEARLY"));
  return { solo, yearly };
}

export default async function PricingPage() {
  const inIndia = await isIndia();
  const billing = billingAvailability();
  const FAQ = faqFor(billing.yearly);
  const jsonLd = jsonLdFor(FAQ);

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <LandingNav />
      <main>
        <section className={styles.hero}>
          <div className={`${styles.shell} ${styles.heroInner}`}>
            <h1>Pay to write tests.<span>Run them free, forever.</span></h1>
            <div className={styles.heroCopy}>
              <p>Every plan — including Free — writes UI, API, visual, AI-agent, load and security tests. You pay for the tests Verity writes, never for runs in your own CI. Add a QAShift engineer when you want the suite owned for you.</p>
              <div className={styles.heroActions}>
                <Link href="/login?next=/dashboard" className={styles.primary}>Start free →</Link>
                <a href="https://qashifthq.com/managed-testing" className={styles.secondary}>Explore managed testing</a>
              </div>
            </div>
          </div>
        </section>

        <div className={`${styles.shell} ${styles.terms}`}>
          <div><strong>Unlimited CI runs</strong><span>No per-run meter on your infrastructure, on any plan.</span></div>
          <div><strong>All six test types</strong><span>UI, API, visual, AI agent, load and security — Free included.</span></div>
          <div><strong>Playwright you own</strong><span>Readable code in your repository. Cancel and it keeps running.</span></div>
        </div>

        <section className={styles.plans}>
          <div className={styles.shell}>
            <header className={styles.sectionHeading}>
              <h2>Start free.<br /><span>Upgrade when it saves you time.</span></h2>
              <p>Four self-serve plans, no sales call. Plans differ by how many tests Verity writes for you each month, self-healing, pull-request checks and projects.</p>
            </header>
            <VeritySelfServeCards inIndia={inIndia} billing={billing} />
          </div>
        </section>

        <section className={styles.managed}>
          <div className={`${styles.shell} ${styles.managedGrid}`}>
            <div className={styles.managedCopy}>
              <h2>Software when you want control.<span>An engineer when you want ownership.</span></h2>
              <p>Managed Testing pairs Verity with a forward-deployed engineer who works inside your release rhythm. They do not hand you reports; they keep the verification system useful.</p>
              <a href="https://qashifthq.com/managed-testing" className={styles.primary}>Explore FDE Managed Testing →</a>
            </div>
            <div className={styles.ownershipList}>
              {OWNERSHIP.map(([number, title, state]) => (
                <div key={number}><span>{number}</span><strong>{title}</strong><small>{state}</small></div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.comparisonSection}>
          <div className={styles.shell}>
            <h2>Know what you are buying.</h2>
            <div className={styles.comparison}><Comparison /></div>
          </div>
        </section>

        <section className={styles.securityNote}>
          <div className={`${styles.shell} ${styles.securityGrid}`}>
            <div className={styles.shield} aria-hidden>◇</div>
            <div>
              <h2>Your code and secrets can stay in your CI.</h2>
              <p>Self-hosted execution keeps sensitive application access within your infrastructure, while Verity returns the verdict and retained evidence your team needs.</p>
            </div>
            <a href="https://qashifthq.com/security">Read security architecture →</a>
          </div>
        </section>

        <section className={styles.faq}>
          <div className={styles.shell}>
            <h2>Questions, answered.</h2>
            <div className={styles.faqGrid}>
              {FAQ.map((item) => (
                <article key={item.q}><h3>{item.q}</h3><p>{item.a}</p></article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
