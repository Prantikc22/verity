"use server";

import { revalidatePath } from "next/cache";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Confirm the signed-in user is an admin/owner of the org that owns `projectId`. */
async function assertProjectAdmin(projectId: string): Promise<string | null> {
  const orgCtx = await getPrimaryOrg();
  if (!orgCtx || (orgCtx.role !== "owner" && orgCtx.role !== "admin")) return null;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, org_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.org_id !== orgCtx.org.id) return null;
  return project.id;
}

/**
 * Resolve a self-healing suggestion. 'applied' records that the human accepted
 * the suggested diff into source — Verity itself never writes to the repo, so
 * this is just bookkeeping that the user did. 'rejected' dismisses it.
 */
export async function resolveHealing(
  projectId: string,
  eventId: string,
  status: "applied" | "rejected",
): Promise<{ ok: boolean; error?: string }> {
  const ok = await assertProjectAdmin(projectId);
  if (!ok) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("healing_events")
    .update({ status })
    .eq("id", eventId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}

/** Move a generated test from draft → active (or quarantine/archive). */
export async function setTestStatus(
  projectId: string,
  testId: string,
  status: "draft" | "active" | "quarantined" | "archived",
): Promise<{ ok: boolean; error?: string }> {
  const ok = await assertProjectAdmin(projectId);
  if (!ok) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", testId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}
