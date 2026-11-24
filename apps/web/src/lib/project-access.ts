import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Can the signed-in user ACT on this project? Being able to SEE a project is
 * not enough: public projects are readable by everyone (for their public
 * results page), so every route that runs agents, writes data or spends
 * credits must also check membership of the project's organization.
 */
export async function canUseProject(supabase: SupabaseClient<Database>, projectId: string): Promise<boolean> {
  const { data: project } = await supabase.from("projects").select("org_id").eq("id", projectId).maybeSingle();
  if (!project) return false;
  const { data: member } = await supabase.rpc("is_org_member", { target_org: project.org_id });
  return member === true;
}
