import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export interface OrgContext {
  org: Tables<"orgs">;
  role: Tables<"org_members">["role"];
}

/** Returns the signed-in user (or null) using the request-scoped server client. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Resolve the user's primary org + role. Returns null if the user has no
 * membership yet (the callback provisions one on first login).
 */
export async function resolvePendingInvites(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;
  // Idempotent: joins any org that invited this email, then clears the invites.
  await supabase.rpc("resolve_org_invites", { p_user_id: user.id, p_email: user.email });
}

export async function getPrimaryOrg(): Promise<OrgContext | null> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("org_members")
    .select("role, org_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: org } = await supabase
    .from("orgs")
    .select("*")
    .eq("id", membership.org_id)
    .maybeSingle();

  if (!org) return null;
  return { org, role: membership.role };
}

/**
 * Ensure the signed-in user has an org. Idempotent: if they already belong to
 * one, returns it; otherwise creates a personal org + owner membership.
 * Returns { orgId, created } so callers can fire the signup funnel event once.
 */
export async function ensureOrgForCurrentUser(): Promise<{
  orgId: string;
  created: boolean;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Best-effort "created" flag for the signup funnel event (not race-critical).
  const { data: existing } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "My";

  // Atomic, advisory-locked provisioning — concurrent first-login calls can't
  // create duplicate orgs.
  const { data: orgId, error } = await supabase.rpc("ensure_personal_org", {
    p_name: `${displayName}'s Org`,
  });
  if (error || !orgId) return null;

  return { orgId: orgId as string, created: !existing };
}
