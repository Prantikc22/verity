import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingFooter, LandingNav, UrlStart } from "@/components/landing/LandingExperience";
import landing from "@/components/landing/LandingExperience.module.css";
import styles from "@/components/landing/SeoPage.module.css";
import { SOLUTION_SLUGS, solutionBySlug } from "@/lib/seo-pages";
import { SITE_URL } from "@/lib/site";

export const dynamicParams = false;
export function generateStaticParams() {
  return SOLUTION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = solutionBySlug((await params).slug);
  if (!page) return {};
  const url = `/solutions/${page.slug}`;
  return {
    title: { absolute: `${page.title} | Verity` },
    description: page.description,
    alternates: { canonical: url },
    openGraph: { title: page.title, description: page.description, url, type: "article" },
    twitter: { title: page.title, description: page.description },
  };
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = solutionBySlug((await params).slug);
  if (!page) notFound();
  const url = `${SITE_URL}/solutions/${page.slug}`;
  const related = page.related.map(solutionBySlug).filter((p) => p !== undefined);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Verity", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Solutions", item: `${SITE_URL}/solutions` },
          { "@type": "ListItem", position: 3, name: page.name, item: url },
        ],
      },
      { "@type": "FAQPage", mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <div className={landing.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <LandingNav />
      <main className={styles.main}>
        <div className={styles.shell}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/">Verity</Link><span>/</span><Link href="/solutions">Solutions</Link><span>/</span><span aria-current="page">{page.name}</span>
          </nav>
        </div>

        <section className={styles.hero}>
          <div className={styles.shell}>
            <span className={styles.eyebrow}>{page.eyebrow}</span>
            <h1>{page.h1}<span>{page.h1Accent}</span></h1>
            <p className={styles.intro}>{page.intro}</p>
            <UrlStart id={`${page.slug}-url`} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.shell}>
            <h2>What it checks</h2>
            <div className={styles.grid}>
              {page.checks.map(([t, c]) => <div key={t}><h3>{t}</h3><p>{c}</p></div>)}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.shell}>
            <h2>How it works</h2>
            <ol className={styles.steps}>
              {page.steps.map(([t, c], i) => <li key={t}><span>0{i + 1}</span><h3>{t}</h3><p>{c}</p></li>)}
            </ol>
            <div className={styles.code}>
              <div className={styles.codeTop}><span>{page.code.file}</span><span>EXAMPLE</span></div>
              <pre><code>{page.code.body}</code></pre>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.shell}>
            <h2>Why teams choose Verity</h2>
            <div className={styles.grid}>
              {page.why.map(([t, c]) => <div key={t}><h3>{t}</h3><p>{c}</p></div>)}
              <div><h3>One place for every test type</h3><p>UI, API, visual, AI-agent, load and security results share one run history and one verdict per release. <Link href="/pricing" className="underline">Every plan includes all six.</Link></p></div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.shell}>
            <h2>Frequently asked questions</h2>
            <div className={styles.faq}>
              {page.faq.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary><h3>{f.q}</h3><span aria-hidden>+</span></summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
            <h2 style={{ marginTop: 88 }}>Related</h2>
            <div className={styles.related}>
              {related.map((r) => (
                <Link key={r.slug} href={`/solutions/${r.slug}`}>{r.name}<small>{r.description.split(". ")[0]}.</small></Link>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.cta}>
          <div className={styles.shell}>
            <h2>Try it on your own app.</h2>
            <p>Free plan, no credit card: 15 AI-written tests a month and unlimited runs in your CI.</p>
            <UrlStart id={`${page.slug}-url-bottom`} centered />
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
