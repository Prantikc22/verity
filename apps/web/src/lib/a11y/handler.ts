import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { entitlementsFor } from "@/lib/entitlements";
import type { Tables } from "@/lib/supabase/database.types";
import { a11yLimitsFor, activeLegacyA11yTier, ingestA11y, isA11yPayload, postA11yResults, pruneA11yScans } from "./ingest";

/** Shared by /api/ingest (token fallback) and /api/a11y/ingest. */
export async function handleA11yIngest(project: Tables<"projects">, body: unknown, origin: string) {
  if (!isA11yPayload(body)) {
    return NextResponse.json({ error: "Body must include commit_sha, branch, and a non-empty pages[] (each {url, axe})." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: org } = await admin.from("orgs").select("*").eq("id", project.org_id).maybeSingle();
  const limits = a11yLimitsFor(entitlementsFor(org), await activeLegacyA11yTier(project.org_id));
  if (body.pages.length > limits.maxPagesPerScan) {
    return NextResponse.json({ error: `Your plan allows ${limits.maxPagesPerScan} page(s) per accessibility scan; received ${body.pages.length}.` }, { status: 402 });
  }
  let result;
  try { result = await ingestA11y(project, body); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "ingest failed" }, { status: 500 }); }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;
  let checkUrl: string | null = null;
  if (limits.prGating) {
    try { checkUrl = await postA11yResults(project, body, result, limits.mergeBlocking, appUrl); }
    catch (err) { console.error("[a11y ingest] github post failed:", err); }
  }
  await pruneA11yScans(project.id, limits.maxScanHistory).catch(() => {});

  return NextResponse.json({
    ok: true,
    failed: result.failed && limits.mergeBlocking,
    baseline: result.pages.every((p) => p.baseline),
    commit: body.commit_sha,
    branch: body.branch,
    pages: result.pages.map((p) => ({ url: p.url, score: p.score, baseline: p.baseline, new: p.diff.counts.new, fixed: p.diff.counts.fixed, worsened: p.diff.counts.worsened })),
    check_run: checkUrl,
    report_url: `${appUrl.replace(/\/$/, "")}/dashboard/projects/${project.id}/accessibility`,
  });
}

export async function projectForA11yToken(token: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("*").eq("a11y_ingest_token", token).maybeSingle();
  return data;
}
