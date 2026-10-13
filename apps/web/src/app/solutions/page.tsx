import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingNav } from "@/components/landing/LandingExperience";
import landing from "@/components/landing/LandingExperience.module.css";
import styles from "@/components/landing/SeoPage.module.css";
import { SOLUTION_PAGES } from "@/lib/seo-pages";

export const metadata: Metadata = {
  title: "Solutions — AI testing for UI, API, visual, AI agents, load and security",
  description:
    "Every kind of test Verity writes and runs in your CI: AI-generated Playwright UI and API tests, visual regression, LLM evals, load testing and security scanning.",
  alternates: { canonical: "/solutions" },
};

export default function Solutions() {
  return (
    <div className={landing.page}>
      <LandingNav />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.shell}>
            <span className={styles.eyebrow}>SOLUTIONS</span>
            <h1>Every test your release needs.<span>One place to run them.</span></h1>
            <p className={styles.intro}>Verity writes and runs six kinds of test from your live app and your API spec, all as code in your repository and all on your own CI runners.</p>
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.shell}>
            <div className={styles.related} style={{ marginTop: 0 }}>
              {SOLUTION_PAGES.map((p) => (
                <Link key={p.slug} href={`/solutions/${p.slug}`}>{p.name}<small>{p.description.split(". ")[0]}.</small></Link>
              ))}
              <Link href="/compare/testsprite">Verity vs TestSprite<small>Pricing models, test types and where each tool fits.</small></Link>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
