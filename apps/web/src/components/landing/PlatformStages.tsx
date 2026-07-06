import { Reveal } from "@/components/Reveal";

/**
 * "One platform, every stage" — a capability map (Plan → Author → Execute →
 * Analyze). Complements the four narrative pillars: this one is an honest
 * inventory of what actually ships, so it must only list built capabilities.
 */
const STAGES: { stage: string; role: string; accent: string; items: string[] }[] = [
  {
    stage: "Plan",
    role: "Organize the suite",
    accent: "indigo",
    items: [
      "Unified Test Library — every discipline, one searchable view",
      "Group into sets · tag critical paths",
      "Bulk activate, archive, move & push to CI",
    ],
  },
  {
    stage: "Author",
    role: "Generate with AI",
    accent: "violet",
    items: [
      "AI generation from a URL or PRD (UI + API)",
      "Visual (screenshot) & agent (AI) specs",
      "Author from your editor via the MCP server",
    ],
  },
  {
    stage: "Execute",
    role: "Run in your CI",
    accent: "amber",
    items: [
      "Unlimited runs in your own pipeline — we never host your browsers",
      "Quick check on commits · Full regression on merge",
      "Live cloud runs to get the first feel",
    ],
  },
  {
    stage: "Analyze",
    role: "Keep it green",
    accent: "emerald",
    items: [
      "Self-healing locators — proposed as a diff you approve",
      "Flake detection, quarantine & confidence scoring",
      "Regression & deploy-confidence predictions, in the PR",
    ],
  },
];

const dot: Record<string, string> = {
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
};
const text: Record<string, string> = {
  indigo: "text-indigo-600 dark:text-indigo-400",
  violet: "text-violet-600 dark:text-violet-400",
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
};

export function PlatformStages() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="text-sm font-medium text-indigo-600">One platform, every stage</p>
        <h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Plan, author, execute, analyze — in one place.
        </h2>
        <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-300">
          Not a recorder and not a grid. The full testing lifecycle across UI, API, visual and agent — authored by AI, run in your CI, kept green with a human accountable.
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="mt-12 grid gap-px overflow-hidden border border-neutral-200 bg-neutral-200 md:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-800">
          {STAGES.map((s, i) => (
            <div key={s.stage} className="flex flex-col bg-background p-6">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 ${dot[s.accent]}`} />
                <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Stage {i + 1}</span>
              </div>
              <h3 className={`mt-3 text-lg font-semibold ${text[s.accent]}`}>{s.stage}</h3>
              <p className="text-sm text-neutral-500">{s.role}</p>
              <ul className="mt-5 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
                {s.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" className={`mt-0.5 shrink-0 ${text[s.accent]}`}><path d="M20 6L9 17l-5-5" /></svg>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
