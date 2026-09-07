"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import styles from "./LandingExperience.module.css";

const SIGNALS = [
  ["01", "Live product opened", "checkout / production mirror", "cyan"],
  ["02", "Critical paths mapped", "42 journeys · 318 assertions", "violet"],
  ["03", "Release executed", "231 passed · 2 isolated", "green"],
] as const;

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

const STATS = [
  ["~2 min", "Prompt to first executable test"],
  ["<5 min", "To run 200 checks across the stack"],
  ["40+", "Engineering teams shipping with QAShift"],
  ["1.2M", "Checks moving through customer pipelines monthly"],
] as const;

const SYSTEM_STEPS = [
  {
    number: "01",
    label: "Observe",
    title: "It uses the product, not a description of it.",
    copy: "Verity opens the running app, walks the journeys that matter, and grounds every locator and assertion in live product evidence.",
  },
  {
    number: "02",
    label: "Author",
    title: "Readable Playwright lands in your repository.",
    copy: "UI and API coverage is generated as code your team can inspect, edit, run locally, and keep—even if you leave.",
  },
  {
    number: "03",
    label: "Prove",
    title: "Every verdict arrives with the evidence.",
    copy: "Runs return the broken step, video, DOM, network trail, logs, and a proposed repair. Passing means the product actually worked.",
  },
] as const;

const COVERAGE = [
  ["01", "UI functional", "Real browser journeys across roles, states and devices", "PLAYWRIGHT"],
  ["02", "API integration", "Contracts, schemas, authentication and full request chains", "REST · GRAPHQL"],
  ["03", "Visual", "Meaningful interface drift across stable product states", "PIXEL + DOM"],
  ["04", "Agent & AI", "Grounding, tool use, safety and output guarantees", "EVALS"],
  ["05", "Performance", "Load, soak, latency budgets and release regressions", "K6"],
  ["06", "Security", "DAST, SAST, dependency and common release risks", "OWASP"],
] as const;

const TESTIMONIALS = [
  {
    quote: "QAShift gives us maintained coverage with an engineer accountable for the result, not a per-test meter that punishes us for testing more.",
    name: "Karthik Sundaram",
    role: "Engineering Manager · Zoho",
    logo: "/logos/customers/zoho.png",
  },
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
    quote: "API coverage catches contract breaks across carriers before our partners ever see them.",
    name: "Rahul Menon",
    role: "VP Engineering · ShipDelight",
    logo: "/logos/customers/shipdelight.png",
  },
] as const;

const X_QUOTES = [
  {
    quote: "AI-generated code without automated tests is technical debt at 10x speed.",
    name: "Wojak Codes",
    handle: "@wojakcodes",
  },
  {
    quote: "Testing is the most neglected part of vibe coding projects.",
    name: "Meathill",
    handle: "@meathill1",
  },
] as const;

function Arrow({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={down ? styles.arrowDown : styles.arrow}>
      <path d={down ? "M10 3v13m0 0 5-5m-5 5-5-5" : "M3 10h13m0 0-5-5m5 5-5 5"} />
    </svg>
  );
}

function ReleaseConsole() {
  return (
    <div className={styles.consoleShell} aria-label="Verity release verification example">
      <div className={styles.consoleTopline}>
        <div className={styles.windowDots}><i /><i /><i /></div>
        <span>verity / release-1284</span>
        <strong><i /> LIVE</strong>
      </div>

      <div className={styles.consoleBody}>
        <aside className={styles.consoleRail}>
          <div className={styles.miniMark}>V</div>
          {["Run", "Flows", "API", "Visual", "Risk"].map((label, index) => (
            <div key={label} className={index === 0 ? styles.railActive : styles.railItem}>
              <span>{String(index + 1).padStart(2, "0")}</span>{label}
            </div>
          ))}
        </aside>

        <div className={styles.consoleMain}>
          <div className={styles.runHeading}>
            <div>
              <span>MORNING RELEASE DECISION</span>
              <h2>Safe to ship.</h2>
            </div>
            <div className={styles.runScore}>
              <small>CONFIDENCE</small>
              <strong>96</strong><sup>%</sup>
            </div>
          </div>

          <div className={styles.runMetrics}>
            <div><strong>231</strong><span>checks passed</span></div>
            <div><strong>02</strong><span>issues isolated</span></div>
            <div><strong>00</strong><span>release blockers</span></div>
          </div>

          <div className={styles.tracePanel}>
            <div className={styles.traceHeader}><span>EXECUTION TRACE</span><span>08:57:14 IST</span></div>
            {SIGNALS.map(([number, label, detail, tone], index) => (
              <motion.div
                key={number}
                className={styles.traceRow}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 + index * 0.16, duration: 0.45 }}
              >
                <span className={`${styles.signalDot} ${styles[tone]}`} />
                <b>{number}</b>
                <div><strong>{label}</strong><small>{detail}</small></div>
                <span className={styles.traceVerdict}>{index === 2 ? "PROVED" : "DONE"}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        className={styles.evidenceCard}
        initial={{ opacity: 0, y: 22, rotate: 2 }}
        animate={{ opacity: 1, y: [0, -5, 0], rotate: 2 }}
        transition={{ opacity: { delay: 1, duration: 0.45 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
      >
        <div><span>REGRESSION / 02</span><strong>Checkout promo state</strong></div>
        <small>Reproduced · video + DOM attached</small>
        <b>JIRA-4821 <Arrow /></b>
      </motion.div>
    </div>
  );
}

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [authed, setAuthed] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (value) => setScrolled(value > 32));
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
  }, []);

  return (
    <header className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.navLogo} aria-label="Verity home"><Logo /></Link>
        <nav aria-label="Primary navigation">
          <a href="#system">System</a>
          <a href="#coverage">Coverage</a>
          <a href="#proof">Proof</a>
          <Link href="/docs">Docs</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <div className={styles.navActions}>
          {!authed && <Link href="/login" className={styles.signIn}>Sign in</Link>}
          <Link href={authed ? "/dashboard" : "/login?next=/dashboard"} className={styles.navCta}>
            {authed ? "Open dashboard" : "Start free"}<Arrow />
          </Link>
        </div>
      </div>
    </header>
  );
}

function RevealBlock({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function CustomerRail() {
  return (
    <section className={styles.customerRail} aria-label="Teams using Verity and QAShift">
      <div className={styles.railLabel}><span>LIVE CUSTOMER NETWORK</span><b>08 COMPANIES SHOWN</b></div>
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

function GapSection() {
  const alerts = [
    ["PR #842", "Coding agent marked checkout complete", "UNVERIFIED"],
    ["STAGING", "Payment confirmation returned a blank state", "REAL BUG"],
    ["TEST RUN", "Selector drifted after navigation redesign", "REPAIRED"],
    ["RELEASE", "One change touched fourteen critical journeys", "MAPPED"],
  ] as const;

  return (
    <section className={styles.gapSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.gapHeading}>
          <div className={styles.sectionCode}>02 / THE VERIFICATION GAP</div>
          <h2>Your coding agent says <em>done.</em><br />Verity asks for evidence.</h2>
        </RevealBlock>
        <div className={styles.alertStack}>
          {alerts.map(([source, message, verdict], index) => (
            <motion.div
              key={source}
              className={styles.alertRow}
              initial={{ opacity: 0, x: index % 2 ? 55 : -55 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: .55 }}
              transition={{ duration: .62, delay: index * .08 }}
            >
              <span>{source}</span><strong>{message}</strong><b>{verdict}</b>
            </motion.div>
          ))}
        </div>
        <RevealBlock className={styles.gapStatement}>
          <span>THE COST OF A FALSE “DONE”</span>
          <p>AI can produce a feature in an afternoon. If nobody drives the running product afterward, speed just moves the regression closer to your customer.</p>
        </RevealBlock>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className={styles.statsSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.statsHeader}>
          <div>
            <div className={styles.sectionCode}>03 / BY THE NUMBERS</div>
            <h2>Weeks of test authoring.<br /><span>Minutes to evidence.</span></h2>
          </div>
          <p>Verification should move at the speed of the team writing the code. Verity turns live behavior into a suite, then keeps that suite moving with every release.</p>
        </RevealBlock>
        <div className={styles.statsGrid}>
          {STATS.map(([value, label], index) => (
            <motion.div
              key={value}
              className={styles.stat}
              initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
              whileInView={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }}
              viewport={{ once: true, amount: .5 }}
              transition={{ duration: .75, delay: index * .09 }}
            >
              <span>0{index + 1}</span><strong>{value}</strong><p>{label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SystemVisual({ active }: { active: number }) {
  const scenes = [
    <div className={styles.observeScene} key="observe">
      <div className={styles.browserBar}><i /><span>staging.acme.dev/checkout</span><b>CONNECTED</b></div>
      <div className={styles.browserPage}>
        <div className={styles.browserCopy}><span>CHECKOUT / STEP 03</span><strong>Complete order</strong><i /></div>
        <div className={styles.browserForm}><i /><i /><motion.button animate={{ boxShadow: ["0 0 0 rgba(118,87,255,0)", "0 0 38px rgba(118,87,255,.48)", "0 0 0 rgba(118,87,255,0)"] }} transition={{ duration: 2.8, repeat: Infinity }}>Place order</motion.button></div>
        <motion.div className={styles.locatorTag} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>role=button · name=&quot;Place order&quot;</motion.div>
      </div>
    </div>,
    <div className={styles.codeScene} key="author">
      <div className={styles.codeTop}><span>tests/verity/checkout.spec.ts</span><b>PLAYWRIGHT</b></div>
      <pre><code><span>test</span>(&apos;checkout survives release&apos;, async ({`{ page }`}) ={">"} {`{`}<br />
        &nbsp;&nbsp;<em>await</em> page.goto(<strong>&apos;/checkout&apos;</strong>);<br />
        &nbsp;&nbsp;<em>await</em> page.getByRole(<strong>&apos;button&apos;</strong>, {`{ name: `}<strong>&apos;Place order&apos;</strong>{` }`}).click();<br />
        &nbsp;&nbsp;<em>await</em> expect(page.getByText(<strong>&apos;Order confirmed&apos;</strong>)).toBeVisible();<br />
        {`});`}</code></pre>
      <div className={styles.commitLine}><span>+ 18 TESTS</span><span>+ 164 ASSERTIONS</span><b>READY TO COMMIT</b></div>
    </div>,
    <div className={styles.proveScene} key="prove">
      <div className={styles.verdictMark}>✓</div>
      <span>RELEASE VERDICT / 08:57 IST</span>
      <h3>Verified to ship.</h3>
      <p>231 checks passed. Two regressions isolated with replay, logs and ownership. Zero blockers remain.</p>
      <div className={styles.evidenceFiles}><span>checkout-failure.webm</span><span>network.har</span><span>console.log</span></div>
    </div>,
  ];

  return (
    <div className={styles.systemVisual}>
      <div className={styles.systemVisualTop}><span>VERITY / VERIFICATION ENGINE</span><b>STEP 0{active + 1}</b></div>
      <AnimatePresence mode="wait">
        <motion.div key={active} className={styles.systemScene} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: .42 }}>
          {scenes[active]}
        </motion.div>
      </AnimatePresence>
      <div className={styles.systemProgress}>{SYSTEM_STEPS.map((step, index) => <i key={step.number} className={index <= active ? styles.progressActive : ""} />)}</div>
    </div>
  );
}

function SystemStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start center", "end center"] });
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    setActive(value < 0.5 ? 0 : value < 0.78 ? 1 : 2);
  });

  return (
    <section ref={sectionRef} id="system" className={styles.systemSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.systemHeading}>
          <div className={styles.sectionCode}>04 / ONE VERIFICATION LOOP</div>
          <h2>From live behavior<br />to owned evidence.</h2>
        </RevealBlock>
        <div className={styles.systemGrid}>
          <div className={styles.systemSteps}>
            {SYSTEM_STEPS.map((step, index) => (
              <article key={step.number} className={`${styles.systemStep} ${active === index ? styles.systemStepActive : ""}`}>
                <span>{step.number} / {step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
          <div className={styles.systemSticky}><SystemVisual active={active} /></div>
        </div>
      </div>
    </section>
  );
}

function CoverageSection() {
  return (
    <section id="coverage" className={styles.coverageSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.coverageHeading}>
          <div>
            <div className={styles.sectionCode}>05 / COVER THE RELEASE SURFACE</div>
            <h2>One system for every<br />layer that can break.</h2>
          </div>
          <p>No stitched-together vendor stack. Every discipline maps into one run history, one risk model, and one verdict your team can understand.</p>
        </RevealBlock>
        <div className={styles.coverageRows}>
          {COVERAGE.map(([number, name, copy, tool], index) => (
            <motion.article key={number} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .5 }} transition={{ delay: index * .05 }}>
              <span>{number}</span><h3>{name}</h3><p>{copy}</p><b>{tool}</b><Arrow />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function OwnershipSection() {
  return (
    <section className={styles.ownershipSection}>
      <div className={styles.sectionShell}>
        <div className={styles.ownershipGrid}>
          <RevealBlock className={styles.ownershipCopy}>
            <div className={styles.sectionCode}>06 / THE SUITE STAYS ALIVE</div>
            <h2>Self-healing without hiding the bug.</h2>
            <p>When the interface moves, Verity proposes the smallest grounded repair, reruns it, and keeps a human in control. Product failures stay failures.</p>
            <ul>
              <li><span>01</span> Locator drift is repaired from the live DOM</li>
              <li><span>02</span> Flakes are separated from real regressions</li>
              <li><span>03</span> Every change remains reviewable Playwright</li>
            </ul>
          </RevealBlock>
          <RevealBlock className={styles.diffConsole} delay={.12}>
            <div className={styles.diffTop}><span>checkout.spec.ts</span><b>REPAIR / REVIEW</b></div>
            <div className={styles.diffMeta}><span>SELECTOR CONFIDENCE</span><strong>96%</strong></div>
            <div className={styles.diffLineOld}><b>−</b> page.locator(<span>&apos;#submit-order&apos;</span>)</div>
            <div className={styles.diffLineNew}><b>+</b> page.getByRole(<span>&apos;button&apos;</span>, {`{ name: `}<span>&apos;Place order&apos;</span>{` }`})</div>
            <div className={styles.diffResult}><span><i /> RERUN PASSED · 2.8s</span><button>Approve repair <Arrow /></button></div>
            <motion.div className={styles.scanLine} animate={{ top: ["18%", "86%", "18%"] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
          </RevealBlock>
        </div>
      </div>
    </section>
  );
}

function CustomerProof() {
  return (
    <section id="proof" className={styles.proofSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.proofHeading}>
          <div className={styles.sectionCode}>07 / CUSTOMER PROOF</div>
          <h2>Teams that ship often<br />need evidence they trust.</h2>
          <p>Customer stories from the QAShift platform.</p>
        </RevealBlock>
        <div className={styles.testimonialGrid}>
          {TESTIMONIALS.map((item, index) => (
            <motion.blockquote key={item.name} className={index === 0 ? styles.testimonialLead : styles.testimonial} initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .4 }} transition={{ delay: index * .07 }}>
              <span className={styles.quoteMark}>“</span>
              <p>{item.quote}</p>
              <footer>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.logo} alt="" />
                <span><strong>{item.name}</strong><small>{item.role}</small></span>
              </footer>
            </motion.blockquote>
          ))}
        </div>

        <RevealBlock className={styles.xHeading}>
          <div className={styles.xMark}>𝕏</div>
          <span>BUILDERS ON X / THE VERIFICATION GAP IN THEIR WORDS</span>
        </RevealBlock>
        <div className={styles.xGrid}>
          {X_QUOTES.map((item, index) => (
            <motion.blockquote key={item.handle} initial={{ opacity: 0, x: index ? 40 : -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: .6 }}>
              <div className={styles.xQuoteTop}><span>𝕏</span><small>PUBLIC POST</small></div>
              <p>“{item.quote}”</p>
              <footer><strong>{item.name}</strong><span>{item.handle}</span></footer>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={styles.finalSection}>
      <motion.div className={styles.finalBeam} animate={{ x: ["-25%", "115%"] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} aria-hidden />
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.finalInner}>
          <div className={styles.sectionCode}>08 / YOUR NEXT RELEASE</div>
          <h2>Show Verity the product.<br /><span>Get the test and the proof.</span></h2>
          <p>Start with a URL. Keep the Playwright. Know what changed before a customer has to tell you.</p>
          <div className={styles.finalActions}>
            <Link href="/login?next=/dashboard" className={styles.primaryCta}>Start free <Arrow /></Link>
            <Link href="/pricing" className={styles.outlineCta}>See pricing <Arrow /></Link>
          </div>
        </RevealBlock>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.sectionShell}>
        <div className={styles.footerTop}>
          <div><Logo /><p>Product verification you can run, inspect, and own. A QAShift product.</p></div>
          <div className={styles.footerLinks}>
            <div><span>PRODUCT</span><a href="#system">How it works</a><a href="#coverage">Coverage</a><Link href="/pricing">Pricing</Link></div>
            <div><span>DEVELOPERS</span><Link href="/docs">Documentation</Link><Link href="/mcp">MCP server</Link><Link href="/github">GitHub App</Link></div>
            <div><span>COMPANY</span><a href="https://qashifthq.com/about">About</a><a href="https://qashifthq.com/contact">Contact</a><a href="https://qashifthq.com/security">Security</a></div>
          </div>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} VERITY / QASHIFT</span><span>BUILT IN BENGALURU · TESTS STAY IN YOUR GITHUB</span></div>
      </div>
    </footer>
  );
}

export function LandingExperience() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 22, mass: 0.35 });
  const copyY = useTransform(smoothProgress, [0, 1], [0, 120]);
  const visualY = useTransform(smoothProgress, [0, 1], [0, 210]);
  const visualScale = useTransform(smoothProgress, [0, 1], [1, 0.92]);
  const opacity = useTransform(smoothProgress, [0, 0.86], [1, 0]);

  return (
    <div className={styles.page}>
      <LandingNav />
      <main>
        <section ref={heroRef} className={styles.hero}>
          <div className={styles.heroNoise} aria-hidden />
          <div className={styles.heroBeam} aria-hidden />
          <motion.div className={styles.heroCopy} style={{ y: copyY, opacity }}>
            <motion.div
              className={styles.kicker}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span>01</span> PRODUCT VERIFICATION FOR TEAMS THAT SHIP DAILY
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
            >
              Ship the change.
              <span>Keep the proof.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Verity opens the real product, writes the Playwright suite, runs every critical path, and returns evidence your team can act on. No test theatre. No proprietary lock-in.
            </motion.p>
            <motion.div
              className={styles.heroActions}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
            >
              <Link href="/login?next=/dashboard" className={styles.primaryCta}>Run your first verification <Arrow /></Link>
              <a href="#system" className={styles.textCta}>See the system <Arrow down /></a>
            </motion.div>
            <motion.div
              className={styles.heroFootnotes}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.6 }}
            >
              <span>NO CARD</span><span>FIRST TEST IN MINUTES</span><span>PLAYWRIGHT YOU OWN</span>
            </motion.div>
          </motion.div>

          <motion.div className={styles.heroVisual} style={{ y: visualY, scale: visualScale, opacity }}>
            <ReleaseConsole />
          </motion.div>

          <div className={styles.heroIndex} aria-hidden>
            <span>V / 26</span><span>SCROLL TO VERIFY</span>
          </div>
        </section>
        <CustomerRail />
        <GapSection />
        <StatsSection />
        <SystemStory />
        <CoverageSection />
        <OwnershipSection />
        <CustomerProof />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
