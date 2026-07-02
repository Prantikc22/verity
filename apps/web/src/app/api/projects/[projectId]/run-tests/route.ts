import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planFor } from "@/lib/plans";
import { recordRun, type IngestResultInput } from "@/lib/ingest";
import { healTest } from "@/lib/llm/generate";
import { llmConfig } from "@/lib/llm/provider";
import { explainPlaywrightError, hardenSpec } from "@qashift/verity-core";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  testIds: z.array(z.string().uuid()).optional(), // omit = run all active of this kind
  baseURL: z.string().url().optional(),
  heal: z.boolean().optional(), // default true — auto-heal failures
  kind: z.enum(["ui", "api"]).optional(), // restrict to UI or API tests
});

interface RunnerResult {
  name: string; spec_path: string; status: string;
  attempts: boolean[]; durationMs: number; error: string | null; screenshotBase64: string | null;
}
interface TestRow { id: string; name: string; spec_path: string; spec_content: string; source_url: string | null; plan: unknown }

/**
 * Cloud test run — streams NDJSON progress to the client and auto-heals failures.
 * Pipeline: run real specs on the Fly runner → for every failure, re-fetch the
 * live page and have the LLM rewrite the spec (self-healing) → rerun the healed
 * specs → persist fixes that now pass → record the run. Each phase is streamed so
 * the UI can show exactly what's happening. Capped per plan; CI is unlimited.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const runnerUrl = process.env.RUNNER_SERVICE_URL;
  const runnerToken = process.env.RUNNER_SERVICE_TOKEN;
  if (!runnerUrl || !runnerToken) {
    return NextResponse.json({ error: "Cloud runner isn't configured. Run in your CI — it's unlimited." }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const healEnabled = parsed.data.heal !== false && llmConfig().configured;

  const admin = createAdminClient();

  // Cap cloud runs per plan. Count ONLY runs on our infra (branch "cloud") — local
  // MCP runs (also trigger="manual", on the user's own machine) must NOT consume the
  // cloud-run budget.
  const plan = planFor((await admin.from("orgs").select("plan").eq("id", project.org_id).maybeSingle()).data?.plan);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count: used } = await admin.from("test_runs").select("id", { count: "exact", head: true })
    .eq("project_id", projectId).eq("trigger", "manual").eq("branch", "cloud").gte("created_at", monthStart.toISOString());
  if ((used ?? 0) >= plan.cloudRunsPerMonth) {
    return NextResponse.json({ error: `Cloud runs are capped at ${plan.cloudRunsPerMonth}/mo on ${plan.name}. Run unlimited in your CI.` }, { status: 402 });
  }

  // Which tests to run.
  let q = supabase.from("tests").select("id, name, spec_path, spec_content, source_url, plan").eq("project_id", projectId).neq("status", "archived");
  if (parsed.data.kind) q = q.eq("kind", parsed.data.kind);
  if (parsed.data.testIds?.length) q = q.in("id", parsed.data.testIds);
  const { data: tests } = await q;
  if (!tests || tests.length === 0) return NextResponse.json({ error: "No tests to run." }, { status: 400 });

  // Deterministic hardening pre-pass: fix the brittle patterns (bare text=
  // locators, strict-mode-prone getByText/getByRole, hardcoded URL assertions)
  // before they even run. Safe + idempotent, so persist the cleanup once.
  await Promise.all(tests.map(async (t) => {
    const hardened = hardenSpec(t.spec_content);
    if (hardened !== t.spec_content) {
      t.spec_content = hardened;
      await admin.from("tests").update({ spec_content: hardened }).eq("id", t.id);
    }
  }));

  const baseURL = parsed.data.baseURL;
  const runFolder = randomUUID();
  const rerunCount = project.rerun_count ?? 2;

  // ---- stream the run ----
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      const callRunner = async (specs: { name: string; spec_path: string; spec_content: string }[]): Promise<RunnerResult[]> => {
        const res = await fetch(`${runnerUrl.replace(/\/$/, "")}/run`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${runnerToken}` },
          body: JSON.stringify({ tests: specs, baseURL, reruns: rerunCount }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? `runner ${res.status}`);
        return data.results as RunnerResult[];
      };

      const uploadShot = async (b64: string | null, key: string): Promise<string | null> => {
        if (!b64) return null;
        const path = `runs/${runFolder}/${key}.png`;
        await admin.storage.from("exploration-shots").upload(path, Buffer.from(b64, "base64"), { contentType: "image/png", upsert: true });
        return admin.storage.from("exploration-shots").getPublicUrl(path).data.publicUrl;
      };

      interface Row {
        id: string; name: string; spec_path: string; source_url: string | null;
        status: "passed" | "failed" | "flaky" | "healed";
        durationMs: number; error: string | null; explanation: string | null;
        screenshot_url: string | null; healed: boolean; healExplanation: string | null;
        finalAttempts: boolean[]; plan: string[];
      }
      const asPlan = (p: unknown): string[] => (Array.isArray(p) ? p.map(String) : []);
      // Match by basename — the runner returns `tests/<file>` and drops any
      // subdir (e.g. tests/api/), so a basename key is the only stable join.
      const base = (p: string) => p.split("/").pop() ?? p;
      const bySpec = new Map<string, TestRow>(tests.map((t) => [base(t.spec_path), t as TestRow]));
      const oneSpec = (t: TestRow) => ({ name: t.name, spec_path: t.spec_path, spec_content: t.spec_content });
      const loadFailure = (t: TestRow): RunnerResult => ({
        name: t.name, spec_path: t.spec_path, status: "failed", attempts: [false], durationMs: 0,
        error: "Test file failed to load — top-level code threw (e.g. reading a missing file). It will be auto-healed.",
        screenshotBase64: null,
      });

      try {
        send({ type: "queued", tests: tests.map((t) => ({ name: t.name, spec_path: t.spec_path })) });

        // 1) Initial run. If the batch returns fewer results than specs sent, one
        // bad file likely aborted collection — fall back to running the missing
        // ones individually so a single broken spec can't zero out the run.
        let first = await callRunner(tests.map(oneSpec));
        const got = new Set(first.map((r) => base(r.spec_path)));
        const missing = tests.filter((t) => !got.has(base(t.spec_path)));
        if (missing.length) {
          for (const t of missing) {
            let one: RunnerResult[] = [];
            try { one = await callRunner([oneSpec(t)]); } catch { /* isolate */ }
            first.push(one.find((r) => base(r.spec_path) === base(t.spec_path)) ?? loadFailure(t));
          }
        }

        const rows: Row[] = [];
        for (let i = 0; i < first.length; i++) {
          const r = first[i];
          const src = bySpec.get(base(r.spec_path));
          const screenshot_url = await uploadShot(r.screenshotBase64, `init-${i}`);
          const explanation = r.status === "passed" ? null : explainPlaywrightError(r.error);
          const row: Row = {
            id: src?.id ?? "", name: src?.name ?? r.name, spec_path: src?.spec_path ?? r.spec_path, source_url: src?.source_url ?? baseURL ?? null,
            status: r.status as Row["status"], durationMs: r.durationMs, error: r.error, explanation,
            screenshot_url, healed: false, healExplanation: null,
            finalAttempts: r.attempts?.length ? r.attempts : [r.status === "passed"],
            plan: asPlan(src?.plan),
          };
          rows.push(row);
          send({ type: "result", index: i, name: row.name, spec_path: row.spec_path, status: row.status, durationMs: row.durationMs, error: row.error, explanation, screenshot_url, plan: row.plan });
        }

        // 2) Self-healing pass over failures.
        const failures = rows.filter((r) => r.status === "failed" && healEnabled);
        const healedSpecs: { row: Row; spec_content: string; explanation: string }[] = [];
        const healEventIds: string[] = [];
        if (failures.length) {
          send({ type: "phase", phase: "healing", count: failures.length });
          for (const r of failures) send({ type: "healing", name: r.name, spec_path: r.spec_path });

          const healOutcomes = await Promise.all(failures.map(async (r) => {
            const src = bySpec.get(base(r.spec_path));
            if (!src) return null;
            try {
              // API tests have no HTML page to re-read — heal from the spec + error alone.
              const healBase = parsed.data.kind === "api" ? undefined : (r.source_url ?? baseURL ?? undefined);
              const healed = await healTest({ specContent: src.spec_content, error: r.error ?? "failed", baseUrl: healBase });
              if (healed.specContent && healed.specContent !== src.spec_content && healed.confidence >= 0.3) {
                return { row: r, spec_content: healed.specContent, explanation: healed.explanation };
              }
            } catch { /* heal failed; leave as-is */ }
            return null;
          }));
          for (const o of healOutcomes) if (o) healedSpecs.push(o);
        }

        // 3) Rerun healed specs.
        if (healedSpecs.length) {
          const rerun = await callRunner(healedSpecs.map((h) => ({ name: h.row.name, spec_path: h.row.spec_path, spec_content: h.spec_content })));
          for (let i = 0; i < rerun.length; i++) {
            const rr = rerun[i];
            const h = healedSpecs.find((x) => base(x.row.spec_path) === base(rr.spec_path));
            if (!h) continue;
            const row = h.row;
            const nowPassed = rr.status === "passed";
            row.healExplanation = h.explanation;
            if (nowPassed) {
              row.status = "healed";
              row.healed = true;
              row.error = null;
              row.explanation = null;
              row.durationMs = rr.durationMs;
              row.finalAttempts = [true];
              row.screenshot_url = null;
              // Persist the fix — durable self-healing.
              if (row.id) {
                await admin.from("tests").update({ spec_content: h.spec_content }).eq("id", row.id);
                const { data: ev } = await admin.from("healing_events").insert({
                  project_id: projectId, test_id: row.id, old_selector: "(spec)", new_selector: h.explanation.slice(0, 200),
                  dom_context: (h.explanation ?? "").slice(0, 8000), confidence: 0.9, status: "applied",
                }).select("id").single();
                if (ev?.id) healEventIds.push(ev.id);
              }
            } else {
              row.error = rr.error;
              row.explanation = explainPlaywrightError(rr.error);
              row.durationMs = rr.durationMs;
              row.finalAttempts = rr.attempts?.length ? rr.attempts : [false];
              row.screenshot_url = (await uploadShot(rr.screenshotBase64, `heal-${i}`)) ?? row.screenshot_url;
            }
            send({
              type: "healed", name: row.name, spec_path: row.spec_path, status: row.status, healed: row.healed,
              healExplanation: row.healExplanation, explanation: row.explanation, error: row.error,
              durationMs: row.durationMs, screenshot_url: row.screenshot_url,
            });
          }
        }

        // 4) Record the run with final (post-heal) results.
        const ingestResults: IngestResultInput[] = rows.map((r) => ({
          spec_path: r.spec_path, name: r.name, attempts: r.finalAttempts,
          duration_ms: r.durationMs, error_message: r.error,
        }));
        const recorded = await recordRun(project, {
          tier: "full", trigger: "manual", commit_sha: `cloud-${Date.now().toString(36)}`, branch: "cloud",
          discipline: parsed.data.kind === "api" ? "api" : "ui", results: ingestResults,
        });
        // Link this run's healing events so the run report can show what was healed.
        if (healEventIds.length) await admin.from("healing_events").update({ run_id: recorded.runId }).in("id", healEventIds);

        const summary = {
          total: recorded.total,
          passed: rows.filter((r) => r.status === "passed").length,
          healed: rows.filter((r) => r.status === "healed").length,
          failed: rows.filter((r) => r.status === "failed").length,
          flaky: rows.filter((r) => r.status === "flaky").length,
        };
        send({
          type: "done",
          run_id: recorded.runId,
          summary,
          report: rows.map((r) => ({
            name: r.name, spec_path: r.spec_path, status: r.status, durationMs: r.durationMs,
            error: r.error, explanation: r.explanation, healed: r.healed, healExplanation: r.healExplanation,
            screenshot_url: r.screenshot_url, plan: r.plan,
          })),
        });
      } catch (err) {
        send({ type: "error", error: `Cloud run failed: ${err instanceof Error ? err.message : "runner error"}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
