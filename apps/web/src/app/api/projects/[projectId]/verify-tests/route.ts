import { type NextRequest, NextResponse } from "next/server";
import { canUseProject } from "@/lib/project-access";
import { uniqueRunnerPaths } from "@/lib/runner/spec-paths";
import { runnerFetch, RUNNER_BUSY } from "@/lib/runner-fetch";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fixStrictModeLocator } from "@/lib/verify/strict-mode";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  testIds: z.array(z.string().uuid()).max(20).optional(),
  kind: z.enum(["ui", "api"]).default("ui"),
});

interface RunnerResult { name: string; spec_path: string; status: string; attempts: boolean[]; durationMs: number; error: string | null }

/**
 * Verified generation — the reliability guarantee. RUN the generated UI specs in a
 * real browser on the Fly runner, then mark each test 'active' (Verified ✓, it
 * actually passed) or 'quarantined' (Needs review, still red). This is what makes
 * generated tests trustworthy instead of guessed. It is part of AUTHORING, so it records no run and consumes NO
 * cloud-run cap. Only UI tests are verifiable here (visual needs committed baselines;
 * agent needs a live AI endpoint).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const runnerUrl = process.env.RUNNER_SERVICE_URL;
  const runnerToken = process.env.RUNNER_SERVICE_TOKEN;
  if (!runnerUrl || !runnerToken) {
    return NextResponse.json({ error: "Verification runner isn't configured — tests stay unverified until you run them in CI." }, { status: 503 });
  }

  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  // Seeing a project (public ones are visible to all) is not the same as being allowed to act on it.
  if (!project || !(await canUseProject(supabase, projectId))) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  // Load the UI tests to verify: the given IDs, else all current drafts.
  let q = supabase.from("tests").select("id, name, spec_path, spec_content, source_url")
    .eq("project_id", projectId).eq("kind", parsed.data.kind).neq("status", "archived");
  q = parsed.data.testIds?.length ? q.in("id", parsed.data.testIds) : q.eq("status", "draft");
  const { data: loaded } = await q.limit(20);
  const tests = loaded ? uniqueRunnerPaths(loaded) : loaded;
  if (!tests || tests.length === 0) return NextResponse.json({ ok: true, verified: [], message: "No tests to verify." });

  const base = (p: string) => p;
  const callRunner = async (specs: { name: string; spec_path: string; spec_content: string }[]): Promise<RunnerResult[]> => {
    const res = await runnerFetch(`${runnerUrl.replace(/\/$/, "")}/run`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${runnerToken}` },
      body: JSON.stringify({ tests: specs, reruns: 2 }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(res.status === 503 ? RUNNER_BUSY : data.error ?? `runner ${res.status}`);
    return data.results as RunnerResult[];
  };

  try {
    // 1) Run everything once in a real browser.
    const byPath = new Map<string, RunnerResult>();
    for (const r of await callRunner(tests.map((t) => ({ name: t.name, spec_path: t.spec_path, spec_content: t.spec_content })))) {
      byPath.set(base(r.spec_path), r);
    }

    // 2) Locator repair, at most 3 rounds: when a click target matched several
    //    elements, use the unambiguous locator Playwright itself suggests, re-run,
    //    and keep the change ONLY if the test then really passes. Assertions are
    //    never loosened; a test that still fails stays in review.
    const specOf = new Map(tests.map((t) => [t.id, t.spec_content]));
    const healed = new Set<string>();
    for (let round = 0; round < 3; round++) {
      const fixes = tests.flatMap((t) => {
        const r = byPath.get(base(t.spec_path));
        if (!r || r.status === "passed") return [];
        const next = fixStrictModeLocator(specOf.get(t.id)!, r.error);
        return next ? [{ t, next }] : [];
      });
      if (!fixes.length) break;
      const rerun = await callRunner(fixes.map(({ t, next }) => ({ name: t.name, spec_path: t.spec_path, spec_content: next })));
      for (const { t, next } of fixes) {
        const r = rerun.find((x) => base(x.spec_path) === base(t.spec_path));
        if (!r) continue;
        byPath.set(base(t.spec_path), r);
        specOf.set(t.id, next); // keep iterating on the repaired spec (a test can have several ambiguous steps)
        if (r.status === "passed") healed.add(t.id);
      }
    }

    const verified: { id: string; name: string; status: "active" | "quarantined"; healed: boolean; reason: string | null }[] = [];
    const now = new Date().toISOString();
    for (const t of tests) {
      const r = byPath.get(base(t.spec_path));
      const passed = r?.status === "passed";
      const status: "active" | "quarantined" = passed ? "active" : "quarantined";
      const reason = passed ? null : (r?.error ?? "The test did not run.").slice(0, 1200);
      const update = { status, last_verify_error: reason, last_verified_at: now, ...(passed && healed.has(t.id) ? { spec_content: specOf.get(t.id)! } : {}) };
      const { error } = await supabase.from("tests").update(update).eq("id", t.id);
      if (error) throw new Error(error.message);
      verified.push({ id: t.id, name: t.name, status, healed: passed && healed.has(t.id), reason });
    }

    const pass = verified.filter((v) => v.status === "active").length;
    return NextResponse.json({ ok: true, verified, summary: { total: verified.length, verified: pass, needsReview: verified.length - pass, autoFixed: verified.filter((v) => v.healed).length } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verification failed." }, { status: 500 });
  }
}
