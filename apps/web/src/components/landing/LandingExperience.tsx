"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import styles from "./LandingExperience.module.css";
import { LANDING_FAQ } from "./faq";

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

const HOW_STEPS = [
  ["01", "Paste your app's URL", "Verity opens it in a real browser and maps the journeys, forms and endpoints worth testing. Add an OpenAPI spec or PRD for deeper coverage."],
  ["02", "Review readable tests", "Playwright specs for UI and API, plus visual, AI-agent, load and security checks. Edit anything — every line is yours."],
  ["03", "Commit one workflow file", "CI Setup writes it for GitHub Actions, GitLab or Jenkins. Tests run on your runners, against your environments, with no run limit."],
  ["04", "Get a verdict on every PR", "A Quick check on pull requests and a Full regression on merge. Flakes are split from real failures, and failures arrive with the error and a proposed fix."],
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
  ["01", "UI functional", "Real browser journeys across roles, states and devices", "PLAYWRIGHT", "/solutions/playwright-test-generator"],
  ["02", "API integration", "Contracts, schemas, authentication and full request chains", "REST · OPENAPI", "/solutions/api-testing"],
  ["03", "Visual", "Meaningful interface drift across stable product states", "SCREENSHOT DIFF", "/solutions/visual-regression-testing"],
  ["04", "Agent & AI", "Grounding, tool use, safety and output guarantees", "EVALS", "/solutions/llm-evals"],
  ["05", "Performance", "Load, soak, latency budgets and release regressions", "LOAD · CWV", "/solutions/load-testing"],
  ["06", "Security", "Dynamic and static scanning for common release risks", "OWASP", "/solutions/security-testing"],
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

const NAV_MENUS = {
  Product: [
    ["Verity Self-Serve", "Generate, run and maintain product verification yourself.", "/#system"],
    ["FDE Managed Testing", "A forward-deployed engineer who owns the testing function with you.", "https://qashifthq.com/managed-testing"],
    ["Verity Cloud", "Managed browsers, parallel runs and retained release evidence.", "/#runtime"],
    ["MCP Server", "Put live product verification inside your coding agent.", "/mcp"],
  ],
  Solutions: [
    ["Agentic coding", "Give every AI-authored change an independent verifier.", "/#gap"],
    ["How it works", "From a URL to a merge gate in four steps.", "/#how"],
    ["Coverage", "UI, API, visual, agent, performance and security.", "/solutions"],
    ["Self-healing", "Repair selector drift without hiding product failures.", "/#healing"],
  ],
  Developers: [
    ["Documentation", "Set up Verity and run your first verification.", "/docs"],
    ["MCP server", "Put product verification inside your coding agent.", "/mcp"],
    ["GitHub App", "Run, review and gate from the pull request.", "/github"],
    ["Execution options", "Run without limits on CI or use Verity Cloud.", "/#runtime"],
  ],
  About: [
    ["About QAShift", "The company building AI-native quality infrastructure.", "https://qashifthq.com/about"],
    ["Security", "Architecture, data handling and enterprise controls.", "https://qashifthq.com/security"],
    ["Careers", "Join the team rebuilding how software gets verified.", "https://qashifthq.com/about#careers"],
    ["Insights", "Read field notes on building dependable software.", "https://qashifthq.com/insights"],
  ],
} as const;

const APP_LOGOS: Record<string, string> = {
  "VS Code": "M23.15 2.587 18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z",
  Cursor: "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23",
  GitHub: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  GitLab: "m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0537.8585.8585 0 0 0-.3362.4049L.4332 9.5015l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.03.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.4619-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z",
  Playwright: "M23.996 7.462c-.056.837-.257 2.135-.716 3.85-.995 3.715-4.27 10.874-10.42 9.227-6.15-1.65-5.407-9.487-4.412-13.201.46-1.716.934-2.94 1.305-3.694.42-.853.846-.289 1.815.523.684.573 2.41 1.791 5.011 2.488 2.601.697 4.706.506 5.583.352 1.245-.219 1.897-.494 1.834.455Zm-9.807 3.863s-.127-1.819-1.773-2.286c-1.644-.467-2.613 1.04-2.613 1.04Zm4.058 4.539-7.769-2.172s.446 2.306 3.338 3.153c2.862.836 4.43-.98 4.43-.981Zm2.701-2.51s-.13-1.818-1.773-2.286c-1.644-.469-2.612 1.038-2.612 1.038ZM8.57 18.23c-4.749 1.279-7.261-4.224-8.021-7.08C.197 9.831.044 8.832.003 8.188c-.047-.73.455-.52 1.415-.354.677.118 2.3.261 4.308-.28a11.28 11.28 0 0 0 2.41-.956c-.058.197-.114.4-.17.61-.433 1.618-.827 4.055-.632 6.426-1.976.732-2.267 2.423-2.267 2.423l2.524-.715c.227 1.002.6 1.987 1.15 2.838a5.914 5.914 0 0 1-.171.049Zm-4.188-6.298c1.265-.333 1.363-1.631 1.363-1.631l-3.374.888s.745 1.076 2.01.743Z",
  "Any MCP client": "M13.85 0a4.16 4.16 0 0 0-2.95 1.217L1.456 10.66a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l9.442-9.442a2.49 2.49 0 0 1 3.541 0 2.49 2.49 0 0 1 0 3.541L8.59 12.97l-.1.1a.835.835 0 0 0 0 1.18.835.835 0 0 0 1.18 0l.1-.098 7.03-7.034a2.49 2.49 0 0 1 3.542 0l.049.05a2.49 2.49 0 0 1 0 3.54l-8.54 8.54a1.96 1.96 0 0 0 0 2.755l1.753 1.753a.835.835 0 0 0 1.18 0 .835.835 0 0 0 0-1.18l-1.753-1.753a.266.266 0 0 1 0-.394l8.54-8.54a4.185 4.185 0 0 0 0-5.9l-.05-.05a4.16 4.16 0 0 0-2.95-1.218c-.2 0-.401.02-.6.048a4.17 4.17 0 0 0-1.17-3.552A4.16 4.16 0 0 0 13.85 0m0 3.333a.84.84 0 0 0-.59.245L6.275 10.56a4.186 4.186 0 0 0 0 5.902 4.186 4.186 0 0 0 5.902 0L19.16 9.48a.835.835 0 0 0 0-1.18.835.835 0 0 0-1.18 0l-6.985 6.984a2.49 2.49 0 0 1-3.54 0 2.49 2.49 0 0 1 0-3.54l6.983-6.985a.835.835 0 0 0 0-1.18.84.84 0 0 0-.59-.245",
};

const APP_COLORS: Record<string, string> = {
  "VS Code": "#23a8f2", Cursor: "#f5f5f0", GitHub: "#f5f5f0", GitLab: "#fc6d26",
  Playwright: "#45ba63", "Any MCP client": "#f5f5f0",
};

function AppLogo({ name }: { name: string }) {
  return <div className={styles.appLogo} style={{ color: APP_COLORS[name] }}><svg viewBox="0 0 24 24" role="img" aria-label={`${name} logo`}><path d={APP_LOGOS[name]} /></svg></div>;
}

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
        {error ? "Enter a public URL, like staging.your-app.com." : "Free plan · no credit card · 15 AI tests a month · unlimited CI runs"}
      </p>
    </form>
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

export function LandingNav() {
  const [authed, setAuthed] = useState(false);
  const [openMenu, setOpenMenu] = useState<keyof typeof NAV_MENUS | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
  }, []);

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.navLogo} aria-label="Verity home"><Logo /></Link>
        <nav aria-label="Primary navigation">
          {(Object.keys(NAV_MENUS) as Array<keyof typeof NAV_MENUS>).map((label) => (
            <button
              type="button"
              key={label}
              aria-expanded={openMenu === label}
              onMouseEnter={() => setOpenMenu(label)}
              onClick={() => setOpenMenu(openMenu === label ? null : label)}
            >
              {label}<span>⌄</span>
            </button>
          ))}
          <Link href="/pricing" onMouseEnter={() => setOpenMenu(null)}>Pricing</Link>
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
        {openMenu && (
          <motion.div className={styles.megaMenu} onMouseLeave={() => setOpenMenu(null)} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .18 }}>
            <div className={styles.megaInner}>
              <div className={styles.megaIntro}>
                <span>{openMenu}</span>
                <strong>{openMenu === "Product" ? "Software and expert ownership for every testing maturity." : openMenu === "Solutions" ? "Built for teams whose shipping speed outgrew manual QA." : openMenu === "Developers" ? "Own the tests. Run them wherever your team works." : "Verity is built by QAShift in Bengaluru."}</strong>
              </div>
              <div className={styles.megaLinks}>
                {NAV_MENUS[openMenu].map(([title, copy, href]) => (
                  <Link key={title} href={href} onClick={() => setOpenMenu(null)}>
                    <strong>{title}</strong><span>{copy}</span><Arrow />
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className={styles.mobileMenu} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Link href="/#how" onClick={() => setMobileOpen(false)}>How it works</Link>
            <Link href="/#system" onClick={() => setMobileOpen(false)}>Product</Link>
            <Link href="/#gap" onClick={() => setMobileOpen(false)}>Solutions</Link>
            <Link href="/#stack" onClick={() => setMobileOpen(false)}>Developers</Link>
            <Link href="/pricing" onClick={() => setMobileOpen(false)}>Pricing</Link>
            <a href="https://qashifthq.com/about">About</a>
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
      <div className={styles.railLabel}><span>Trusted in production by teams at</span></div>
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
  const signals = [
    ["AGENT", "Checkout marked complete without a browser run", "UNVERIFIED"],
    ["RELEASE", "One change broke fourteen passing journeys", "REGRESSION"],
    ["STAGING", "Payment confirmation returned a blank state", "REAL BUG"],
    ["PR #842", "The tests passed. The product never opened.", "FALSE DONE"],
    ["SELECTOR", "Navigation refactor moved the submit action", "DRIFT"],
  ] as const;

  const costs = [
    ["01", "Nobody has a sprint to spare for end-to-end tests.", "So the riskiest paths — sign-up, checkout, billing — ship with the least coverage, and the gap widens with every release."],
    ["02", "A green unit suite is not a working checkout.", "Mocks pass while the real page breaks. Only something that drives the running product can say a customer journey still works."],
    ["03", "AI-written changes need an independent check.", "When an agent writes the code, Verity is the second pair of eyes: it runs the real flows on every pull request, so regressions surface before a customer finds them."],
  ] as const;

  return (
    <section id="gap" className={styles.gapSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.gapHeading}>
          <h2>Code ships in hours.<br /><em>Proof still arrives late.</em></h2>
          <p>AI removed the bottleneck from writing code. It did not remove the need to open the product, follow the journey, and prove the outcome.</p>
        </RevealBlock>
      </div>
      <div className={styles.gapTicker}>
        <div className={styles.gapTickerTrack}>
          {[...signals, ...signals].map(([source, message, verdict], index) => (
            <div className={styles.gapSignal} key={`${source}-${index}`} aria-hidden={index >= signals.length}>
              <span>{source}</span><strong>{message}</strong><b>{verdict}</b>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.sectionShell}>
        <div className={styles.gapCards}>
          {costs.map(([number, title, copy], index) => (
            <motion.article key={number} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .45 }} transition={{ delay: index * .08 }}>
              <span>{number}</span><div className={styles.gapIcon}>{index === 0 ? "⌁" : index === 1 ? "×" : "↘"}</div><h3>{title}</h3><p>{copy}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoSection() {
  return (
    <section id="demo" className={styles.demoSection} aria-labelledby="demo-title">
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.demoHeading}>
          <span className={styles.eyebrow}>SEE IT WORK · 48 SECONDS</span>
          <h2 id="demo-title">From a URL to a verdict<br /><span>on every pull request.</span></h2>
        </RevealBlock>
        <div className={styles.demoFrame}>
          <video
            controls
            playsInline
            preload="metadata"
            poster="/demo/verity-demo-poster.jpg"
            aria-label="Verity product demo: paste a URL, Verity writes Playwright tests, commit one workflow, and every pull request gets a verdict with evidence."
          >
            <source src="/demo/verity-demo.mp4" type="video/mp4" />
          </video>
        </div>
        <p className={styles.demoNote}>Real output from Verity — the generated Playwright, the CI workflow, and a pull request&apos;s verdict with a flaky test told apart from a real failure.</p>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className={styles.howSection} aria-labelledby="how-title">
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.howHeading}>
          <span className={styles.eyebrow}>HOW IT WORKS</span>
          <h2 id="how-title">From a URL to a merge gate<br /><span>in four steps.</span></h2>
        </RevealBlock>
        <ol className={styles.howGrid}>
          {HOW_STEPS.map(([number, title, copy], index) => (
            <motion.li key={number} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .4 }} transition={{ delay: index * .07 }}>
              <span>{number}</span><h3>{title}</h3><p>{copy}</p>
            </motion.li>
          ))}
        </ol>
        <div className={styles.howCta}>
          <Link href="/login?next=/dashboard" className={styles.primaryCta}>Start free <Arrow /></Link>
          <Link href="/docs" className={styles.textCta}>Read the setup guide <Arrow /></Link>
          <a href="https://github.com/qashift/verity-demo" className={styles.textCta} target="_blank" rel="noopener noreferrer">See an example repo on GitHub <Arrow /></a>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className={styles.faqSection} aria-labelledby="faq-title">
      <div className={styles.sectionShell}>
        <div className={styles.faqGrid}>
          <RevealBlock className={styles.faqHeading}>
            <span className={styles.eyebrow}>FAQ</span>
            <h2 id="faq-title">Questions teams ask before they switch.</h2>
            <p>Still deciding? <Link href="/docs">Read the docs</Link> or <a href="https://qashifthq.com/contact">talk to an engineer</a>.</p>
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

function StatsSection() {
  return (
    <section id="numbers" className={styles.statsSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.statsHeader}>
          <div>
            <h2>Coverage in minutes,<br /><span>not sprints.</span></h2>
          </div>
          <p>Hand-writing an end-to-end suite takes weeks. Verity drafts it from your live app in minutes, and your engineers spend their time reviewing tests instead of typing selectors.</p>
        </RevealBlock>
        <div className={styles.statsGrid}>
          {STATS.map(([value, label], index) => (
            <motion.div
              key={value}
              className={styles.stat}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
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
            <h2>One system for every<br />layer that can break.</h2>
          </div>
          <p>No stitched-together vendor stack. Every discipline maps into one run history, one risk model, and one verdict your team can understand.</p>
        </RevealBlock>
        <div className={styles.coverageRows}>
          {COVERAGE.map(([number, name, copy, tool, href], index) => (
            <motion.article key={number} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .5 }} transition={{ delay: index * .05 }}>
              <span>{number}</span><h3><Link href={href} className={styles.coverageLink}>{name}</Link></h3><p>{copy}</p><b>{tool}</b><Arrow />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function OwnershipSection() {
  return (
    <section id="healing" className={styles.ownershipSection}>
      <div className={styles.sectionShell}>
        <div className={styles.ownershipGrid}>
          <RevealBlock className={styles.ownershipCopy}>
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

function AlwaysOnSection() {
  const modes = [
    {
      title: "Every merge",
      headline: "The verdict lands on the pull request.",
      copy: "A Quick check runs on every PR and a Full regression on merge. Results post as a check and a comment, right where the review happens.",
      visual: <div className={styles.mergeVisual}><span>PR #1284 · checkout-refactor</span><strong><i /> Verity verified 42 journeys</strong><small>Required check · ready to merge</small></div>,
    },
    {
      title: "Every night",
      headline: "Scheduled runs catch silent breakage.",
      copy: "Add a nightly or weekly schedule to the same workflow. Breakage from a dependency, a config change or a third party shows up without a code change.",
      visual: <div className={styles.cadenceVisual}>{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span className={index < 5 ? styles.dayActive : ""} key={`${day}-${index}`}>{day}</span>)}<b>02:00 / nightly</b></div>,
    },
    {
      title: "Every run kept",
      headline: "Trends, not just today's result.",
      copy: "Flake rates and regression history are tracked per test, so you can see which journeys are getting less reliable before they start failing.",
      visual: <div className={styles.historyVisual}><span><i /> Release 1284 <b>VERIFIED</b></span><span><i /> Nightly 06 Sep <b>VERIFIED</b></span><span><i /> PR #1278 <b>REPAIRED</b></span></div>,
    },
  ];

  return (
    <section id="always-on" className={styles.alwaysSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.alwaysHeading}>
          <h2>Wired into every merge,<br /><span>not anyone&apos;s memory.</span></h2>
          <p>Tests only protect you when they run without someone remembering to start them. Verity lives in your pipeline.</p>
        </RevealBlock>
        <div className={styles.alwaysGrid}>
          {modes.map((mode, index) => (
            <motion.article key={mode.title} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }} transition={{ delay: index * .08 }}>
              <span>{mode.title}</span><h3>{mode.headline}</h3><p>{mode.copy}</p>{mode.visual}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StackSection() {
  const integrations = [
    ["VS Code", "MCP"], ["Cursor", "MCP"], ["GitHub", "PR GATE"],
    ["GitLab", "CI CONFIG"], ["Playwright", "YOUR CODE"], ["Any MCP client", "MCP"],
  ] as const;

  return (
    <section id="stack" className={styles.stackSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.stackHeading}>
          <h2>Bring Verity into<br />the stack you already use.</h2>
          <p>Call the verifier from your agent, terminal, pull request, or delivery pipeline. The same suite and evidence follow the release everywhere.</p>
        </RevealBlock>
        <div className={styles.stackGrid}>
          <RevealBlock className={styles.mcpConsole}>
            <div className={styles.mcpTabs}><b>MCP server</b><span>CLI</span><span>CI/CD</span><span>IDEs</span></div>
            <div className={styles.mcpFile}><span>mcp.json</span><b>CONNECTED</b></div>
            <pre><code>{`{
  "mcpServers": {
    "verity": {
      "command": "npx",
      "args": ["-y", "@qashifthq/verity-mcp"],
      "env": { "VERITY_TOKEN": "your_project_token" }
    }
  }
}`}</code></pre>
            <div className={styles.mcpPrompt}><span>›</span><p>Verify checkout against the current branch and return release evidence.</p><b>RUNNING</b></div>
          </RevealBlock>
          <RevealBlock className={styles.integrationPanel} delay={.1}>
            <div className={styles.integrationTop}><span>Works where your team works</span><b>{String(integrations.length).padStart(2, "0")} CONNECTORS</b></div>
            <div className={styles.integrationGrid}>
              {integrations.map(([name, role]) => <div key={name}><AppLogo name={name} /><strong>{name}</strong><span>{role}</span></div>)}
            </div>
          </RevealBlock>
        </div>
      </div>
    </section>
  );
}

function RuntimeSection() {
  return (
    <section id="runtime" className={styles.runtimeSection}>
      <div className={styles.sectionShell}>
        <RevealBlock className={styles.runtimeHeading}>
          <h2>Your tests. Your choice of where they run.</h2>
          <p>Keep execution on your infrastructure, or let Verity Cloud handle it. Move between both without rewriting the suite.</p>
        </RevealBlock>
        <div className={styles.runtimeGrid}>
          <RevealBlock className={styles.runtimeCard}>
            <div className={styles.runtimeSymbol}>∞</div>
            <span>YOUR INFRASTRUCTURE</span>
            <h3>Unlimited on your CI.</h3>
            <p>Run as many tests as your own runners can handle. Ideal for active development, merge gates and private environments.</p>
            <ul><li>Playwright stays in your repository</li><li>No per-run Verity limit</li><li>Works with existing CI secrets and networks</li></ul>
            <Link href="/docs">View CI setup <Arrow /></Link>
          </RevealBlock>
          <RevealBlock className={`${styles.runtimeCard} ${styles.runtimeCloud}`} delay={.1}>
            <div className={styles.runtimeSymbol}>◌</div>
            <span>VERITY INFRASTRUCTURE</span>
            <h3>Metered on Verity Cloud.</h3>
            <p>Use managed browsers when you want zero runner maintenance. Included runs get you started; scale when the team is ready.</p>
            <ul><li>Managed browsers and evidence storage</li><li>Parallel execution without runner setup</li><li>Clear usage before you scale</li></ul>
            <Link href="/pricing">See cloud pricing <Arrow /></Link>
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
          <span>Builders on X, on the verification gap</span>
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
          <h2>Show Verity the product.<br /><span>Get the test and the proof.</span></h2>
          <p>Start with a URL. Keep the Playwright. Know what changed before a customer has to tell you.</p>
          <UrlStart id="final-url" centered />
          <div className={styles.finalActions}>
            <Link href="/pricing" className={styles.outlineCta}>See pricing <Arrow /></Link>
            <a href="https://qashifthq.com/contact" className={styles.outlineCta}>Talk to an engineer <Arrow /></a>
          </div>
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
            <p>Product verification you can run, inspect, and own. A QAShift product.</p>
            <div className={styles.footerSecurity}>
              <strong>Security is part of the architecture.</strong>
              <span>Your code and secrets stay in your infrastructure when you run Verity on CI.</span>
              <a href="https://qashifthq.com/security">Read the security overview <Arrow /></a>
            </div>
          </div>
          <div className={styles.footerLinks}>
            <div><span>PRODUCTS</span><Link href="/#system">Verity Self-Serve</Link><a href="https://qashifthq.com/managed-testing">FDE Managed Testing</a><Link href="/#runtime">Verity Cloud</Link><Link href="/pricing">Pricing</Link></div>
            <div><span>SOLUTIONS</span><Link href="/solutions/playwright-test-generator">AI Playwright tests</Link><Link href="/solutions/api-testing">API testing</Link><Link href="/solutions/visual-regression-testing">Visual regression</Link><Link href="/solutions/llm-evals">LLM evals</Link><Link href="/solutions/load-testing">Load testing</Link><Link href="/solutions/security-testing">Security testing</Link><Link href="/compare/testsprite">Verity vs TestSprite</Link></div>
            <div><span>DEVELOPERS</span><Link href="/docs">Documentation</Link><Link href="/mcp">MCP server</Link><Link href="/github">GitHub App</Link><Link href="/#stack">Integrations</Link></div>
            <div><span>QASHIFT</span><a href="https://qashifthq.com/about">About</a><a href="https://qashifthq.com/about#careers">Careers</a><a href="https://qashifthq.com/contact">Contact</a><a href="https://qashifthq.com/security">Security</a><a href="https://qashifthq.com/insights">Insights</a></div>
          </div>
        </div>
        <div className={styles.footerWordmark} aria-hidden>Verity</div>
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
            {/* Hero text is visible on first paint (no opacity:0 start): it is the LCP element. */}
            <div className={styles.kicker}><span>●</span> AI TEST GENERATION · PLAYWRIGHT YOU OWN</div>
            <motion.h1
              initial={{ y: 26 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.75, delay: 0.08, ease: [0.2, 0.8, 0.2, 1] }}
            >
              AI writes the tests.
              <span>Your CI keeps the proof.</span>
            </motion.h1>
            <motion.p
              initial={{ y: 16 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Paste a URL. Verity opens your live app, writes readable Playwright tests for UI and API flows — plus visual, AI-agent, load and security checks — and runs them in your own CI on every pull request. Failures come back with evidence, and you keep every line of code.
            </motion.p>
            <motion.div
              initial={{ y: 14 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
            >
              <UrlStart id="hero-url" />
              <a href="#demo" className={`${styles.textCta} ${styles.heroHow}`}>Watch the 48-second demo <Arrow down /></a>
            </motion.div>
            <motion.div
              className={styles.heroFootnotes}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.6 }}
            >
              <span>UI · API · VISUAL</span><span>AGENT · PERFORMANCE · SECURITY</span><span>PLAYWRIGHT YOU OWN</span>
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
        <DemoSection />
        <HowItWorks />
        <GapSection />
        <StatsSection />
        <SystemStory />
        <CoverageSection />
        <OwnershipSection />
        <AlwaysOnSection />
        <StackSection />
        <RuntimeSection />
        <CustomerProof />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
