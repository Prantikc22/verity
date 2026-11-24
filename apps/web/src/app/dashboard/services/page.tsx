import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { PageHeader } from "@/components/shell/ui";
import { ServiceRequest } from "@/components/shell/ServiceRequest";

export const metadata: Metadata = { title: "Services", robots: { index: false } };

const CHECK = "M5 12l5 5L20 7";

/* Mirrors qashifthq.com/managed-qa (marketing lib/catalog.ts MANAGED_PLANS). Keep in sync. */
const MANAGED = [
  { key: "managed-launch", name: "Managed Launch", price: "$1,499", hours: "12 engineer hours a month", who: "Shared pool, consistent engineer", cadence: "Weekly",
    gets: ["1 app", "Up to 25 maintained critical journeys", "Weekly failure triage", "A release report you can forward"] },
  { key: "managed-growth", name: "Managed Growth", price: "$3,499", hours: "30 engineer hours a month", who: "A named QA lead", cadence: "Every weekday", featured: true,
    gets: ["Up to 2 apps", "Up to 60 maintained journeys", "Weekday failure review", "Scale platform plan included"] },
  { key: "managed-scale", name: "Managed Scale", price: "$7,999", hours: "80 engineer hours a month", who: "Named QA lead plus backup", cadence: "Weekdays, priority",
    gets: ["Up to 4 apps", "Up to 150 maintained journeys", "Priority response (4 business hours)", "Quarterly governance review"] },
];

const TERMS = [
  "Setting up your suite uses your monthly hours. Journey counts are caps, not day-one coverage.",
  "Hours are engineer time on your account: writing, fixing and triaging tests, and reviewing results with you.",
  "Mon to Fri, 9:00 to 18:00 IST, with US overlap on Growth and above.",
  "Extra work beyond your hours is $75 an hour, only with your written approval first.",
];

function Tick() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"><path d={CHECK} /></svg>;
}

export default async function ServicesPage() {
  const ctx = await getPrimaryOrg();
  const ent = entitlementsFor(ctx?.org);
  const current = ent.managed?.name ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Services" lead="Prefer people to run it? QAShift engineers can own your testing, or audit your accessibility, on top of the same agents and reports you use here." />

      {/* ── Managed QA ─────────────────────────────────────────── */}
      <section aria-labelledby="managed" className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[12px] font-medium text-indigo-600 dark:text-indigo-400">White-glove QA</p>
            <h2 id="managed" className="mt-1 text-xl font-semibold tracking-tight">Managed QA: we run your testing</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-300">A QAShift engineer writes and maintains your tests, triages every failure, and tells you what&apos;s safe to ship. You approve releases. Hours are stated per plan, so you know exactly what you&apos;re buying.</p>
          </div>
          {current && <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">You&apos;re on {current}</span>}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {MANAGED.map((p) => (
            <div key={p.key} className={`flex flex-col rounded-xl border p-5 ${p.featured ? "border-indigo-400 shadow-[0_8px_30px_-12px_rgba(106,75,255,0.45)] dark:border-indigo-500" : "border-neutral-200 dark:border-neutral-800"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold">{p.name}</h3>
                {p.featured && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">Most chosen</span>}
              </div>
              <p className="mt-2"><span className="text-2xl font-semibold tracking-tight">{p.price}</span><span className="text-[13px] text-neutral-500"> /month</span></p>
              <p className="mt-1 text-[13px] font-medium text-neutral-800 dark:text-neutral-200">{p.hours}</p>
              <p className="text-[12.5px] text-neutral-500">{p.who} · reviews {p.cadence.toLowerCase()}</p>
              <ul className="mt-4 space-y-2 text-[13px] text-neutral-700 dark:text-neutral-300">
                {p.gets.map((g) => <li key={g} className="flex gap-2"><Tick />{g}</li>)}
                <li className="flex gap-2"><Tick />All six agents, evidence and reports</li>
              </ul>
              <div className="mt-auto pt-5">
                <Link href={`/dashboard/usage?plan=${p.key}#plans`} className={`block rounded-lg px-3.5 py-2 text-center text-[13px] font-medium ${p.featured ? "bg-indigo-600 text-white hover:bg-indigo-700" : "border border-neutral-300 hover:border-neutral-500 dark:border-neutral-700"}`}>Choose {p.name.replace("Managed ", "")}</Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950">
            <h3 className="text-[14px] font-medium">Not sure yet? Start with a free diagnostic</h3>
            <p className="mt-1 text-[13px] text-neutral-500">One app, one week. An engineer tests your critical journeys and sends a written findings report. No card, no open-ended trial.</p>
            <div className="mt-3"><ServiceRequest service="managed-diagnostic" primary label="Request a free diagnostic" placeholder="Which app should we look at? Any journeys you care about most (sign-up, checkout…)?" /></div>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950">
            <h3 className="text-[14px] font-medium">Enterprise</h3>
            <p className="mt-1 text-[13px] text-neutral-500">SAP, CRM, data/ETL and mobile. Compliance evidence packs, a negotiated SLA, security review and DPA, dedicated staffing.</p>
            <div className="mt-3"><ServiceRequest service="managed-enterprise" label="Talk to us" placeholder="Tell us about your systems, team size and timeline." /></div>
          </div>
        </div>

        <details className="mt-4 text-[13px] text-neutral-600 dark:text-neutral-400">
          <summary className="cursor-pointer font-medium text-neutral-800 dark:text-neutral-200">How hours and scope work</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{TERMS.map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      </section>

      {/* ── Accessibility ─────────────────────────────────────── */}
      <section aria-labelledby="a11y" className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-[12px] font-medium text-indigo-600 dark:text-indigo-400">Accessibility testing</p>
        <h2 id="a11y" className="mt-1 text-xl font-semibold tracking-tight">Catch accessibility issues, and prove conformance</h2>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-300">Automated checks catch many WCAG issues on every deploy. Full conformance also needs a person with a keyboard and a screen reader. Use one or both.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-center justify-between"><h3 className="text-[15px] font-semibold">Automated checks (Lumen)</h3><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Included in your plan</span></div>
            <ul className="mt-4 space-y-2 text-[13px] text-neutral-700 dark:text-neutral-300">
              {["WCAG 2.2 A and AA rule checks on every deploy", "What got worse since the last deploy, page by page", "A comment and pass/fail check on each pull request", "Detection of accessibility overlay scripts", "Runs in your CI, unlimited"].map((g) => <li key={g} className="flex gap-2"><Tick />{g}</li>)}
            </ul>
            <p className="mt-3 text-[12px] text-neutral-500">Automated rules catch a subset of WCAG issues, not full conformance.</p>
            <div className="mt-auto pt-5"><Link href="/dashboard/projects" className="block rounded-lg border border-neutral-300 px-3.5 py-2 text-center text-[13px] font-medium hover:border-neutral-500 dark:border-neutral-700">Set up in a project</Link></div>
          </div>

          <div className="flex flex-col rounded-xl border border-indigo-400 p-5 shadow-[0_8px_30px_-12px_rgba(106,75,255,0.45)] dark:border-indigo-500">
            <div className="flex items-center justify-between"><h3 className="text-[15px] font-semibold">Accessibility audit by an expert</h3><span className="text-[12px] text-neutral-500">Quoted per site</span></div>
            <ul className="mt-4 space-y-2 text-[13px] text-neutral-700 dark:text-neutral-300">
              {["Manual WCAG 2.2 AA review of your key journeys", "Keyboard-only and screen reader testing (NVDA, VoiceOver)", "A prioritised issue report with how to fix each one", "One re-test after your fixes", "An Accessibility Conformance Report (VPAT) on request"].map((g) => <li key={g} className="flex gap-2"><Tick />{g}</li>)}
            </ul>
            <p className="mt-3 text-[12px] text-neutral-500">Tell us the site and the journeys that matter; you get a fixed quote before any work starts.</p>
            <div className="mt-auto pt-5"><ServiceRequest service="accessibility-audit" primary label="Request an audit quote" placeholder="Site URL, the journeys that matter most, and any deadline (e.g. a customer asking for a VPAT)." /></div>
          </div>
        </div>
      </section>
    </div>
  );
}
