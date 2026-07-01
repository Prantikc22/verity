import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

interface Step { label: string; status: string; screenshot_url: string | null }

/**
 * Receives streamed frames from the Fly cloud runner during an exploration.
 * Authenticated with the shared RUNNER_SERVICE_TOKEN. Each call appends a step
 * (uploading any screenshot to Storage) or finalizes the run, so the dashboard's
 * polling sees frames appear live.
 */
export async function POST(req: NextRequest) {
  const token = process.env.RUNNER_SERVICE_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    explorationId?: string; label?: string; status?: string;
    screenshotBase64?: string; final?: boolean; error?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  if (!body.explorationId) return NextResponse.json({ error: "explorationId required" }, { status: 400 });

  const admin = createAdminClient();

  if (body.final) {
    await admin.from("explorations").update({
      status: body.status === "error" ? "error" : "passed",
      error: body.error ?? null,
      completed_at: new Date().toISOString(),
    }).eq("id", body.explorationId);
    return NextResponse.json({ ok: true });
  }

  // Load current steps, append the new one.
  const { data: exp } = await admin.from("explorations").select("steps").eq("id", body.explorationId).maybeSingle();
  if (!exp) return NextResponse.json({ error: "not found" }, { status: 404 });
  const steps = (Array.isArray(exp.steps) ? exp.steps : []) as unknown as Step[];

  let screenshot_url: string | null = null;
  if (body.screenshotBase64) {
    const path = `${body.explorationId}/${steps.length}.png`;
    const buf = Buffer.from(body.screenshotBase64, "base64");
    await admin.storage.from("exploration-shots").upload(path, buf, { contentType: "image/png", upsert: true });
    screenshot_url = admin.storage.from("exploration-shots").getPublicUrl(path).data.publicUrl;
  }

  steps.push({ label: body.label ?? "step", status: body.status ?? "passed", screenshot_url });
  await admin.from("explorations").update({ steps: steps as unknown as Json }).eq("id", body.explorationId);

  return NextResponse.json({ ok: true });
}
