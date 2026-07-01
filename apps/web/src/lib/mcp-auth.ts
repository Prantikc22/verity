import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Authenticate an MCP/CLI request by the project's ingest token (Bearer). The
 * token is project-scoped, so it authorizes generation/listing/runs for that
 * one project. Returns the project row or null.
 */
export async function projectFromToken(req: NextRequest): Promise<Tables<"projects"> | null> {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  if (!token) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("*").eq("ingest_token", token).maybeSingle();
  return data ?? null;
}
