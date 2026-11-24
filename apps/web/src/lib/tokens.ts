import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A project's upload tokens, for members only. Signed-in users can't read the
 * token columns directly (migration 0025): project_tokens() checks membership,
 * so a public project's token never leaks to other companies.
 */
export async function projectTokens(supabase: SupabaseClient<Database>, projectId: string): Promise<{ ingest: string | null; a11y: string | null }> {
  const { data, error } = await supabase.rpc("project_tokens", { p_project: projectId });
  if (error && /project_tokens|function|schema cache/i.test(error.message)) {
    // Migration 0025 not applied yet: fall back to the old direct read (RLS still applies).
    const { data: p } = await supabase.from("projects").select("ingest_token, a11y_ingest_token").eq("id", projectId).maybeSingle();
    return { ingest: p?.ingest_token ?? null, a11y: p?.a11y_ingest_token ?? null };
  }
  const row = data?.[0];
  return { ingest: row?.ingest_token ?? null, a11y: row?.a11y_ingest_token ?? null };
}
