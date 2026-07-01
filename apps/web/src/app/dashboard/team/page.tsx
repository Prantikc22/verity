import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, getPrimaryOrg } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamManager, type Member } from "./TeamManager";

export const metadata: Metadata = { title: "Team", robots: { index: false } };

const ROLE_RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 };

export default async function TeamPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/dashboard/team");
  const ctx = await getPrimaryOrg();
  if (!ctx) redirect("/dashboard");

  // Service role: read all memberships of the org + their emails from the users mirror.
  const admin = createAdminClient();
  const { data: rows } = await admin.from("org_members").select("user_id, role").eq("org_id", ctx.org.id);
  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: users } = ids.length
    ? await admin.from("users").select("id, email, full_name").in("id", ids)
    : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  const members: Member[] = (rows ?? [])
    .map((r) => ({
      userId: r.user_id,
      email: byId.get(r.user_id)?.email ?? "(unknown)",
      name: byId.get(r.user_id)?.full_name ?? null,
      role: r.role,
      isSelf: r.user_id === user.id,
    }))
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]);

  const canManage = ctx.role === "owner" || ctx.role === "admin";
  const { data: invites } = canManage
    ? await admin.from("org_invites").select("email, role, created_at").eq("org_id", ctx.org.id).order("created_at", { ascending: false })
    : { data: [] as { email: string; role: string; created_at: string }[] };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-neutral-500">{ctx.org.name} · {members.length} member{members.length === 1 ? "" : "s"}. {canManage ? "Invite teammates by email — they join automatically when they sign in." : "Ask an admin to add or remove teammates."}</p>
      </div>
      <TeamManager members={members} canManage={canManage} pending={(invites ?? []).map((i) => ({ email: i.email, role: i.role }))} />
    </div>
  );
}
