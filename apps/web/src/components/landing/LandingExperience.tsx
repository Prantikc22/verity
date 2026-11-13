"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { PLANS } from "@/lib/plans";
import styles from "./LandingExperience.module.css";
import { LANDING_FAQ } from "./faq";

const CUSTOMERS = [
  ["Flemingo Duty Free", "/logos/customers/flemingo.png"],
  ["WordPress", "/logos/customers/wordpress.png"],
  ["Metomic", "/logos/customers/metomic.png"],
  ["BharatSure", "/logos/customers/bharatsure.png"],
  ["Workday", "/logos/customers/workday.png"],
  ["Zoho", "/logos/customers/zoho.png"],
  ["Novu", "/logos/customers/novu.png"],
  ["SuperMemory", "/logos/customers/supermemory.png"],
] as const;

const HOW_STEPS = [
  ["01", "Paste your app's URL", "Verity opens it in a real browser and maps the journeys worth testing."],
  ["02", "Review the tests", "Readable Playwright plus visual, AI-agent, load and security checks. Edit anything."],
  ["03", "Commit one workflow", "Copy the file for GitHub Actions, GitLab or Jenkins. Runs are unlimited."],
  ["04", "Get a verdict on every PR", "Real failures arrive with evidence; flaky tests are told apart and never block."],
] as const;

const TEST_TYPES = [
  ["UI journeys", "Sign-up, checkout and settings, clicked through in a real browser.", "/solutions/playwright-test-generator"],
  ["API", "Endpoints, auth and request chains, plus contract checks from your spec.", "/solutions/api-testing"],
  ["Visual", "Unintended layout changes, diffed against a baseline in your repo.", "/solutions/visual-regression-testing"],
  ["AI agent evals", "Prompt injection, data leaks and grounding for your own AI features.", "/solutions/llm-evals"],
  ["Load", "Latency and errors under load — a smoke check on every PR.", "/solutions/load-testing"],
  ["Security", "Your running app and your code, scanned on every change.", "/solutions/security-testing"],
] as const;

const WHY = [
  ["You own the code", "Tests are plain Playwright in your repository. Cancel Verity and they keep running."],
  ["Unlimited runs in your CI", "You pay for the tests Verity writes — never for runs on your own runners."],
  ["Verdicts you can trust", "Flaky is told apart from broken, and every failure comes with the evidence to fix it."],
] as const;

const TESTIMONIALS = [
  {
    quote: "We own every Playwright spec it generates, and it runs in our CI. Self-healing means a UI refactor does not become a day of fixing selectors.",
    name: "Yonatan Cohen",
    role: "Staff Engineer · Novu",
    logo: "/logos/customers/novu.png",
  },
  {
    quote: "QAShift separates real failures from noise, so when a check goes red, we trust it and act.",
    name: "Sophie Bennett",
    role: "Head of Engineering · Metomic",
    logo: "/logos/customers/metomic.png",
  },
  {
    quote: "QAShift gives us maintained coverage with an engineer accountable for the result, not a per-test meter that punishes us for testing more.",
    name: "Karthik Sundaram",
    role: "Engineering Manager · Zoho",
    logo: "/logos/customers/zoho.png",
  },
  {
    quote: "API coverage catches contract breaks across carriers before our partners ever see them.",
    name: "Rahul Menon",
    role: "VP Engineering · ShipDelight",
    logo: "/logos/customers/shipdelight.png",
  },
] as const;

/** Self-serve plans shown on the landing page — numbers come from lib/plans.ts. */
const PLAN_STRIP = (["free", "solo", "pro", "team"] as const).map((tier) => {
  const p = PLANS[tier];
  return { tier, name: p.name, price: p.priceUsd ?? 0, tests: p.testGensPerMonth, projects: p.maxProjects, healing: p.selfHealing };
});

/** Flat primary nav — every marketing page shares it. */
const NAV_LINKS = [
  ["How it works", "/#how"],
  ["What it tests", "/solutions"],
  ["Pricing", "/pricing"],
  ["Docs", "/docs"],
] as const;

function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={down ? styles.arrowDown : styles.arrow}>
      <path d={down ? "M10 3v13m0 0 5-5m-5 5-5-5" : "M3 10h13m0 0-5-5m5 5-5 5"} />
    </svg>
  );
}

/** Normalize what someone pastes into a URL we can open (adds https:// when missing). */
function toUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.includes(".") || u.hostname === "localhost" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The primary conversion: paste a URL → sign in → first generated test (/start). */
export function UrlStart({ id, centered = false }: { id: string; centered?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  return (
    <form
      className={`${styles.urlStart} ${centered ? styles.urlStartCentered : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        const url = toUrl(value);
        if (!url) { setError(true); return; }
        router.push(`/start?input=${encodeURIComponent(url)}`);
      }}
    >
      <label htmlFor={id} className={styles.srOnly}>Your app&apos;s URL</label>
      <div className={`${styles.urlField} ${error ? styles.urlFieldError : ""}`}>
        <span aria-hidden>https://</span>
        <input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="your-app.com"
          value={value}
          aria-invalid={error}
          aria-describedby={`${id}-note`}
          onChange={(e) => { setValue(e.target.value.replace(/^https?:\/\//i, "")); setError(false); }}
        />
        <button type="submit" className={styles.primaryCta}>Generate my first test <Arrow /></button>
      </div>
      <p id={`${id}-note`} className={styles.urlNote}>
        {error ? "Enter a public URL, like staging.your-app.com." : "Free plan · no credit card · unlimited CI runs"}
      </p>
    </form>
  );
}

export function LandingNav() {
  const [authed, setAuthed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
  }, []);

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.navLogo} aria-label="Verity home"><Logo /></Link>
        <nav aria-label="Primary navigation">
          {NAV_LINKS.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
        </nav>
        <div className={styles.navActions}>
          {!authed && <Link href="/login" className={styles.signIn}>Sign in</Link>}
          <Link href={authed ? "/dashboard" : "/login?next=/dashboard"} className={styles.navCta}>
            {authed ? "Open dashboard" : "Start free"}<Arrow />
          </Link>
          <button className={styles.mobileToggle} type="button" aria-label="Toggle navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
            <i /><i />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className={styles.mobileMenu} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            {NAV_LINKS.map(([label, href]) => <Link key={label} href={href} onClick={() => setMobileOpen(false)}>{label}</Link>)}
            {!authed && <Link href="/login" onClick={() => setMobileOpen(false)}>Sign in</Link>}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function RevealBlock({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The real product demo as the hero visual. Desktop: plays muted and looped
 * (it's silent-first by design). Phones and reduced-motion: poster + controls,
 * so nobody downloads 10MB they didn't ask for.
 */
function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [withControls, setWithControls] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 760px)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability check on mount
      setWithControls(true);
      return;
    }
    v.preload = "auto";
    v.play().catch(() => setWithControls(true));
  }, []);

  function watchWithSound() {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    v.loop = false;
    setWithControls(true);
    void v.play();
  }

  return (
    <div className={styles.heroVideo}>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster="/demo/verity-demo-poster.jpg"
        controls={withControls}
        aria-label="Verity product demo: paste a URL, Verity writes Playwright tests, commit one workflow, and every pull request gets a verdict with evidence."
      >
        <source src="/demo/verity-demo.mp4" type="video/mp4" />
      </video>
      {!withControls && (
        <button type="button" className={styles.heroVideoButton} onClick={watchWithSound}>
          <span aria-hidden>▶</span> Watch the 48s demo with sound
        </button>
      )}
    </div>
  );
}

function CustomerRail() {
  return (
    <section className={styles.customerRail} aria-label="Teams using Verity and QAShift">
      <div className={styles.railLabel}><span>Trusted by teams at</span></div>
      <div className={styles.logoViewport}>
        <div className={styles.logoTrack}>
          {[...CUSTOMERS, ...CUSTOMERS].map(([name, src], index) => (
            <div className={styles.customerLogo} key={`${name}-${index}`} aria-hidden={index >= CUSTOMERS.length}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={index < CUSTOMERS.length ? `${name} logo` : ""} />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className={styles.section} aria-labelledby="how-title">
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.sectionHead}>
          <span className={styles.eyebrow}>HOW IT WORKS</span>
          <h2 id="how-title">From a URL to a merge gate in four steps.</h2>
        </RevealBlock>
        <ol className={styles.howGrid}>
          {HOW_STEPS.map(([number, title, copy]) => (
            <li key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function TestTypes() {
  return (
    <section id="tests" className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="tests-title">
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.sectionHead}>
          <span className={styles.eyebrow}>WHAT IT TESTS</span>
          <h2 id="tests-title">Six kinds of test. Every plan.</h2>
          <p>UI and API are the start. Verity also covers the layers most tools skip — from one place, with one verdict per release.</p>
        </RevealBlock>
        <div className={styles.typeGrid}>
          {TEST_TYPES.map(([name, copy, href]) => (
            <Link key={name} href={href} className={styles.typeCard}>
              <h3>{name}</h3><p>{copy}</p><span>Learn more <Arrow /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyVerity() {
  return (
    <section id="why" className={styles.section} aria-labelledby="why-title">
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.sectionHead}>
          <span className={styles.eyebrow}>WHY VERITY</span>
          <h2 id="why-title">Built for engineers who don&apos;t trust a black box.</h2>
        </RevealBlock>
        <div className={styles.whyGrid}>
          {WHY.map(([title, copy], i) => (
            <div key={title}><span>0{i + 1}</span><h3>{title}</h3><p>{copy}</p></div>
          ))}
        </div>
        <div className={styles.quoteGrid}>
          {TESTIMONIALS.map((t) => (
            <blockquote key={t.name}>
              <p>&ldquo;{t.quote}&rdquo;</p>
              <footer>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.logo} alt="" />
                <span><strong>{t.name}</strong><small>{t.role}</small></span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingStrip() {
  return (
    <section id="pricing" className={`${styles.section} ${styles.sectionAlt}`} aria-labelledby="pricing-title">
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.sectionHead}>
          <span className={styles.eyebrow}>PRICING</span>
          <h2 id="pricing-title">Start free. Pay for tests written, not runs.</h2>
        </RevealBlock>
        <div className={styles.planGrid}>
          {PLAN_STRIP.map((p) => (
            <div key={p.tier} className={p.tier === "pro" ? styles.planPopular : undefined}>
              <h3>{p.name}</h3>
              <strong>{p.price === 0 ? "$0" : `$${p.price}`}<small>{p.price === 0 ? " forever" : "/mo"}</small></strong>
              <p>{p.tests} AI-written tests a month · {p.projects} project{p.projects === 1 ? "" : "s"}{p.healing ? " · self-healing" : ""}</p>
            </div>
          ))}
        </div>
        <p className={styles.planNote}>
          Every plan includes all six test types and unlimited CI runs. Yearly billing saves 20%. <Link href="/pricing">Compare plans <Arrow /></Link>
        </p>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className={styles.sectionShell}>
        <div className={styles.faqGrid}>
          <RevealBlock className={styles.faqHeading}>
            <span className={styles.eyebrow}>FAQ</span>
            <h2 id="faq-title">Questions, answered.</h2>
            <p>Something else? <Link href="/docs">Read the docs</Link> or <a href="https://qashifthq.com/contact">talk to an engineer</a>.</p>
          </RevealBlock>
          <div className={styles.faqList}>
            {LANDING_FAQ.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary><h3>{item.q}</h3><span aria-hidden>+</span></summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={styles.finalSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.finalInner}>
          <h2>See your first test in minutes.</h2>
          <p>Paste a URL. Keep the Playwright. Know what broke before your customers do.</p>
          <UrlStart id="final-url" centered />
        </RevealBlock>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer id="footer" className={styles.footer}>
      <div className={styles.sectionShell}>
        <div className={styles.footerTop}>
          <div>
            <Logo />
            <p>AI-written tests you own, run in your CI. A QAShift product.</p>
            <div className={styles.footerSecurity}>
              <strong>Your code stays in your CI.</strong>
              <span>Tests and scans run on your runners; only results reach Verity.</span>
              <a href="https://qashifthq.com/security">Read the security overview <Arrow /></a>
            </div>
          </div>
          <div className={styles.footerLinks}>
            <div><span>PRODUCT</span><Link href="/#how">How it works</Link><Link href="/pricing">Pricing</Link><Link href="/mcp">MCP server</Link><Link href="/github">GitHub App</Link><a href="https://qashifthq.com/managed-testing">Managed testing</a></div>
            <div><span>WHAT IT TESTS</span><Link href="/solutions/playwright-test-generator">AI Playwright tests</Link><Link href="/solutions/api-testing">API testing</Link><Link href="/solutions/visual-regression-testing">Visual regression</Link><Link href="/solutions/llm-evals">LLM evals</Link><Link href="/solutions/load-testing">Load testing</Link><Link href="/solutions/security-testing">Security testing</Link></div>
            <div><span>RESOURCES</span><Link href="/docs">Documentation</Link><Link href="/compare/testsprite">Verity vs TestSprite</Link><a href="https://github.com/qashift/verity-demo">Example repo</a></div>
            <div><span>QASHIFT</span><a href="https://qashifthq.com/about">About</a><a href="https://qashifthq.com/about#careers">Careers</a><a href="https://qashifthq.com/contact">Contact</a><a href="https://qashifthq.com/security">Security</a></div>
          </div>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} VERITY / QASHIFT</span><span>BUILT IN BENGALURU</span></div>
      </div>
    </footer>
  );
}

export function LandingExperience() {
  return (
    <div className={styles.page}>
      <LandingNav />
      <main>
        <section className={styles.hero}>
          <div className={`${styles.sectionShell} ${styles.heroGrid}`}>
            {/* Hero text is visible on first paint (no opacity:0 start): it is the LCP element. */}
            <div className={styles.heroCopy}>
              <div className={styles.kicker}><span>●</span> AI TEST GENERATION · PLAYWRIGHT YOU OWN</div>
              <h1>AI writes the tests.<span>Your CI keeps the proof.</span></h1>
              <p>Paste a URL. Verity writes readable Playwright tests — plus API, visual, AI-agent, load and security checks — and runs them in your own CI on every pull request.</p>
              <UrlStart id="hero-url" />
            </div>
            <HeroVideo />
          </div>
        </section>
        <CustomerRail />
        <HowItWorks />
        <TestTypes />
        <WhyVerity />
        <PricingStrip />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
