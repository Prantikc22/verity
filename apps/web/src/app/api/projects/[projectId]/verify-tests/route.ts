import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  // Load the UI tests to verify: the given IDs, else all current drafts.
  let q = supabase.from("tests").select("id, name, spec_path, spec_content, source_url")
    .eq("project_id", projectId).eq("kind", parsed.data.kind).neq("status", "archived");
  q = parsed.data.testIds?.length ? q.in("id", parsed.data.testIds) : q.eq("status", "draft");
  const { data: tests } = await q.limit(20);
  if (!tests || tests.length === 0) return NextResponse.json({ ok: true, verified: [], message: "No tests to verify." });

  const base = (p: string) => p;
  const callRunner = async (specs: { name: string; spec_path: string; spec_content: string }[]): Promise<RunnerResult[]> => {
    const res = await fetch(`${runnerUrl.replace(/\/$/, "")}/run`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${runnerToken}` },
      body: JSON.stringify({ tests: specs, reruns: 2 }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error ?? `runner ${res.status}`);
    return data.results as RunnerResult[];
  };

  try {
    // 1) Run everything once in a real browser.
    const byPath = new Map<string, RunnerResult>();
    for (const r of await callRunner(tests.map((t) => ({ name: t.name, spec_path: t.spec_path, spec_content: t.spec_content })))) {
      byPath.set(base(r.spec_path), r);
    }

    // Verification never changes the assertions it is verifying.
    const verified: { id: string; name: string; status: "active" | "quarantined"; healed: boolean }[] = [];
    for (const t of tests) {
      const passed = byPath.get(base(t.spec_path))?.status === "passed";
      const status: "active" | "quarantined" = passed ? "active" : "quarantined";
      const { error } = await supabase.from("tests").update({ status }).eq("id", t.id);
      if (error) throw new Error(error.message);
      verified.push({ id: t.id, name: t.name, status, healed: false });
    }

    const pass = verified.filter((v) => v.status === "active").length;
    return NextResponse.json({ ok: true, verified, summary: { total: verified.length, verified: pass, needsReview: verified.length - pass } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verification failed." }, { status: 500 });
  }
}
