import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One login for all of QAShift. The workspace mode only decides which
 * navigation an org sees:
 *   - "full":    agents, tests, coverage, reports — everything.
 *   - "reports": Reports, runs, setup, billing. For teams that only send test
 *                results (signed up from the Reports page, or bought Reports only).
 * It is a display preference, never an entitlement.
 */
export type WorkspaceMode = "full" | "reports";

export function workspaceModeOf(org: { workspace_mode?: string | null } | null | undefined): WorkspaceMode {
  return org?.workspace_mode === "reports" ? "reports" : "full";
}

/**
 * Has this org started using the agent side? If so we never hide it from them.
 * Agent plans, a paid legacy plan, or any AI-written test all count.
 */
export async function usesAgents(orgId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: org } = await admin.from("orgs").select("plan, autonomous_plan, managed_plan").eq("id", orgId).maybeSingle();
  if (!org) return false;
  if (org.autonomous_plan || org.managed_plan) return true;
  if (org.plan && org.plan !== "free") return true;
  const { count } = await admin.from("tests").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  return (count ?? 0) > 0;
}

/** Switch to reports-only, but only for orgs that haven't used the agents. */
export async function preferReportsMode(orgId: string): Promise<WorkspaceMode> {
  if (await usesAgents(orgId)) return "full";
  await createAdminClient().from("orgs").update({ workspace_mode: "reports" }).eq("id", orgId);
  return "reports";
}

export async function setWorkspaceMode(orgId: string, mode: WorkspaceMode): Promise<void> {
  await createAdminClient().from("orgs").update({ workspace_mode: mode }).eq("id", orgId);
}
