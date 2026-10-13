import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create tests", robots: { index: false } };

type Kind = "ui" | "api" | "visual" | "agent" | "performance";

/**
 * One place to start any kind of test. Each card says what it checks, what
 * Verity needs from you, and links to the existing generator for that type —
 * so the sidebar no longer needs a menu per discipline.
 */
const TYPES: {
  key: string;
  kind?: Kind;
  title: string;
  checks: string;
  needs: string;
  primary: { label: string; seg: string };
  more?: { label: string; seg: string }[];
}[] = [
  {
    key: "ui", kind: "ui", title: "UI journeys",
    checks: "Sign-up, checkout and other flows, clicked through in a real browser.",
    needs: "Your app's URL (and login, if the flow needs one)",
    primary: { label: "Generate UI tests", seg: "generate" },
    more: [{ label: "Run one in the cloud", seg: "cloud" }],
  },
  {
    key: "api", kind: "api", title: "API",
    checks: "Endpoints, request chains, auth and response contracts.",
    needs: "An OpenAPI spec or your API base URL",
    primary: { label: "Generate API tests", seg: "api/generate" },
    more: [{ label: "API tests", seg: "api/tests" }, { label: "Cloud run", seg: "api/run" }, { label: "Coverage", seg: "api/results" }],
  },
  {
    key: "visual", kind: "visual", title: "Visual",
    checks: "Unintended layout and styling changes, against a committed baseline.",
    needs: "Your app's URL",
    primary: { label: "Generate visual tests", seg: "visual" },
  },
  {
    key: "agent", kind: "agent", title: "AI agent evals",
    checks: "Prompt injection, data leaks, grounding and answer format for your own AI feature.",
    needs: "Your AI endpoint (reachable from CI)",
    primary: { label: "Generate evals", seg: "agent" },
  },
  {
    key: "performance", kind: "performance", title: "Performance",
    checks: "Latency and errors under load — smoke on every PR, a heavier profile on merge.",
    needs: "An OpenAPI spec or base URL",
    primary: { label: "Generate a load test", seg: "performance/configure" },
    more: [{ label: "Results", seg: "performance" }],
  },
  {
    key: "security", title: "Security",
    checks: "Your running app and your code, scanned for common vulnerabilities.",
    needs: "Nothing to generate — switch it on in CI Setup (a staging URL for the app scan)",
    primary: { label: "Turn on in CI Setup", seg: "ci" },
    more: [{ label: "Findings", seg: "security" }],
  },
];

export default async function CreateTests({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: rows } = await supabase.from("tests").select("kind").eq("project_id", projectId);
  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.kind ?? "ui", (counts.get(r.kind ?? "ui") ?? 0) + 1);
  const base = `/dashboard/projects/${projectId}`;

  return (
    <div>
      <h1 className="text-xl font-semibold">Create tests</h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-500">
        Pick what you want to check. Verity writes the test, you review it, and it runs in your CI on every pull request.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TYPES.map((t) => {
          const n = t.kind ? counts.get(t.kind) ?? 0 : null;
          return (
            <section key={t.key} className="v-card flex flex-col border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{t.title}</h2>
                {n !== null && (
                  <span className={`tnum shrink-0 px-1.5 py-0.5 text-[11px] ${n ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-900"}`}>
                    {n ? `${n} test${n === 1 ? "" : "s"}` : "none yet"}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{t.checks}</p>
              <p className="mt-3 text-xs text-neutral-500"><span className="font-medium text-neutral-700 dark:text-neutral-300">You need:</span> {t.needs}</p>
              <div className="mt-auto pt-5">
                <Link href={`${base}/${t.primary.seg}`} className="inline-block bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                  {t.primary.label} →
                </Link>
                {t.more && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {t.more.map((m) => (
                      <Link key={m.seg} href={`${base}/${m.seg}`} className="text-indigo-600 hover:underline dark:text-indigo-400">{m.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-neutral-500">
        Tests are only proposals until you keep them. Once you have some, <Link href={`${base}/ci`} className="text-indigo-600 hover:underline dark:text-indigo-400">set up CI</Link> to run them on every pull request — runs in your CI are unlimited.
      </p>
    </div>
  );
}
