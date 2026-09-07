import type { Metadata } from "next";
import Link from "next/link";
import { Comparison } from "@/components/landing/Comparison";
import { LandingFooter, LandingNav } from "@/components/landing/LandingExperience";
import { VeritySelfServeCards } from "@/components/landing/VeritySelfServeCards";
import { isIndia } from "@/lib/geo";
import styles from "./PricingPage.module.css";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start Verity free, run without limits in your CI, or add a forward-deployed engineer to own product verification with your team.",
};

const FAQ = [
  { q: "Does every plan include an engineer?", a: "No. Cloud Sandbox, Self-Serve Pro, and Team are software-only. QAShift managed plans add a forward-deployed engineer who builds, maintains, and triages the suite with your team." },
  { q: "What does the test allowance mean?", a: "It is the number of AI-authored UI and API tests generated in Verity Cloud each month. It is not a limit on executions: run your maintained suite as often as you want in your own CI." },
  { q: "Why are CI runs unlimited?", a: "Your CI provides the compute, so Verity does not meter every execution. Cloud runs use managed browser infrastructure and are included according to your plan." },
  { q: "Do we own the tests?", a: "Yes. Verity produces readable Playwright specs that live in your repository. Your team can inspect, edit, and run them without a proprietary test format." },
  { q: "When should we choose FDE Managed Testing?", a: "Choose it when you want the outcome owned, not another tool to operate. An FDE takes responsibility for strategy, coverage, maintenance, failure triage, and release reporting." },
  { q: "What about security and private code?", a: "Verity can execute inside your CI so code and secrets stay in your infrastructure. QAShift also documents its data handling and enterprise security controls publicly." },
];

const OWNERSHIP = [
  ["01", "Test strategy", "OWNED WITH YOU"],
  ["02", "Suite architecture", "BUILT + MAINTAINED"],
  ["03", "Failure triage", "EVERY RUN"],
  ["04", "Release reporting", "SHIPPED TO THE TEAM"],
] as const;

export default async function PricingPage() {
  const inIndia = await isIndia();

  return (
    <div className={styles.page}>
      <LandingNav />
      <main>
        <section className={styles.hero}>
          <div className={`${styles.shell} ${styles.heroInner}`}>
            <h1>Pay for the system.<span>Choose the ownership.</span></h1>
            <div className={styles.heroCopy}>
              <p>Start with one verification engine for UI, API, visual, agent/AI, performance, and security. Run it without limits in your CI. Add a forward-deployed engineer when the function needs an owner.</p>
              <div className={styles.heroActions}>
                <Link href="/login?next=/dashboard" className={styles.primary}>Start free →</Link>
                <a href="https://qashifthq.com/managed-testing" className={styles.secondary}>Explore managed testing</a>
              </div>
            </div>
          </div>
        </section>

        <div className={`${styles.shell} ${styles.terms}`}>
          <div><strong>Unlimited CI runs</strong><span>No per-execution meter on your infrastructure.</span></div>
          <div><strong>Metered cloud runs</strong><span>Managed browsers when you do not want runner upkeep.</span></div>
          <div><strong>Playwright you own</strong><span>Readable, portable and reviewable in your repository.</span></div>
        </div>

        <section className={styles.plans}>
          <div className={styles.shell}>
            <header className={styles.sectionHeading}>
              <h2>Start self-serve.<br /><span>Scale with proof.</span></h2>
              <p>One engine, three software plans. Cloud allowances cover AI authoring and managed execution; the tests can keep running in your own pipeline.</p>
            </header>
            <VeritySelfServeCards inIndia={inIndia} />
          </div>
        </section>

        <section className={styles.managed}>
          <div className={`${styles.shell} ${styles.managedGrid}`}>
            <div className={styles.managedCopy}>
              <h2>Software when you want control.<span>An FDE when you want ownership.</span></h2>
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
