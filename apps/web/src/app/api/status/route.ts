import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { llmConfig } from "@/lib/llm/provider";
import { checkRate, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 10;
// Cache at the edge for 30s so the blinking dot doesn't hammer the backend.
export const revalidate = 0;

type SystemStatus = "operational" | "degraded" | "down";
interface SystemReport { key: string; label: string; status: SystemStatus; detail: string }

async function checkDatabase(): Promise<SystemStatus> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("projects").select("id", { count: "exact", head: true }).limit(1);
    return error ? "down" : "operational";
  } catch {
    return "down";
  }
}

async function checkRunner(): Promise<SystemStatus> {
  const url = process.env.RUNNER_SERVICE_URL;
  if (!url || !process.env.RUNNER_SERVICE_TOKEN) return "down";
  try {
    // Fly may need a few seconds to wake a scale-to-zero machine. Give the
    // health probe enough time to observe a cold start without masking a real
    // outage behind an overly aggressive timeout.
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(8000) });
    return res.ok ? "operational" : "degraded";
  } catch {
    // Scale-to-zero: a cold runner may not answer instantly. Treat as degraded, not down.
    return "degraded";
  }
}

export async function GET(req: NextRequest) {
  // Public endpoint — bound per IP so it can't be used to hammer our checks.
  const rate = await checkRate("status", clientIp(req), { max: 60, window: "1 m" });
  if (!rate.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const cfg = llmConfig();
  const [db, runner] = await Promise.all([checkDatabase(), checkRunner()]);

  const ai: SystemStatus = cfg.configured ? "operational" : "down";
  const systems: SystemReport[] = [
    { key: "ai", label: "AI generation", status: ai, detail: cfg.configured ? "Generation service ready" : "Generation service unavailable" },
    { key: "healing", label: "Self-healing", status: ai, detail: cfg.configured ? "Locator + flow repair online" : "Needs LLM" },
    { key: "predictions", label: "Prediction engine", status: db, detail: db === "operational" ? "Flake + regression + confidence scoring live" : "Data store unreachable" },
    { key: "ingestion", label: "Ingestion API", status: db, detail: db === "operational" ? "Accepting CI results" : "Data store unreachable" },
    { key: "runner", label: "Cloud runner", status: runner, detail: runner === "operational" ? "Health endpoint reachable" : runner === "down" ? "Not configured" : "Health check unavailable; execution not confirmed" },
  ];

  // Overall reflects every critical dependency, including the cloud runner.
  const critical = systems;
  const overall: SystemStatus = critical.some((s) => s.status === "down")
    ? "down"
    : critical.some((s) => s.status === "degraded")
      ? "degraded"
      : "operational";

  return NextResponse.json(
    { overall, systems, checked_at: new Date().toISOString() },
    { headers: { "cache-control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60" } },
  );
}
