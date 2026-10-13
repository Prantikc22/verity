import type { Metadata } from "next";
import { LandingExperience } from "@/components/landing/LandingExperience";
import { LANDING_FAQ } from "@/components/landing/faq";
import { SITE_URL } from "@/lib/site";

const TITLE = "Verity — AI test generation for Playwright, API & CI";
const DESCRIPTION =
  "Verity writes Playwright end-to-end and API tests from your live app, plus visual, AI-agent, load and security checks. You own the code; your CI runs it on every pull request.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  keywords: [
    "AI test generation", "Playwright test generator", "end-to-end testing", "API testing",
    "visual regression testing", "LLM evals", "load testing", "security testing", "CI testing", "self-healing tests",
  ],
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { title: TITLE, description: DESCRIPTION },
};

// Structured data: who makes it, what it is (with the free offer), and the FAQ.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "QAShift",
      url: "https://qashifthq.com",
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@type": "SoftwareApplication",
      name: "Verity",
      url: SITE_URL,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web, GitHub Actions, GitLab CI, Jenkins",
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#org` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free plan: 1 project, 15 AI test generations a month, unlimited CI runs." },
    },
    {
      "@type": "FAQPage",
      mainEntity: LANDING_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <LandingExperience />
    </>
  );
}
