import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRate, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Resolve the caller's primary org + role (RLS lets them read their own membership). */
async function callerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: m } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!m) return null;
  return { userId: user.id, orgId: m.org_id, role: m.role };
}

function canManage(role: string) { return role === "owner" || role === "admin"; }

/**
 * Best-effort invite email via Resend's REST API (no SDK dependency). No-ops
 * silently when RESEND_API_KEY isn't set — the invite still works because it
 * auto-resolves when the person signs up with the invited email.
 */
async function sendInviteEmail(email: string, orgId: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL ?? "Verity <onboarding@qashift.com>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://verity-kappa-ebon.vercel.app";
  if (!key) return;
  const admin = createAdminClient();
  const { data: org } = await admin.from("orgs").select("name").eq("id", orgId).maybeSingle();
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: `You've been invited to ${org?.name ?? "a team"} on Verity`,
      html: `<p>You've been invited to join <strong>${org?.name ?? "a team"}</strong> on Verity — AI-augmented testing.</p>
<p><a href="${appUrl}/login?next=/dashboard">Create your account</a> with this email and you'll join the team automatically.</p>`,
    }),
  });
}

const AddBody = z.object({ email: z.string().email(), role: z.enum(["admin", "member"]).default("member") });
const PatchBody = z.object({ userId: z.string().uuid(), role: z.enum(["admin", "member"]) });

/** Add a member by email. Admin/owner only. The user must already have an account. */
export async function POST(req: NextRequest) {
  const ctx = await callerContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canManage(ctx.role)) return NextResponse.json({ error: "Only org admins can add members." }, { status: 403 });
  const rate = await checkRate("member-add", clientIp(req), { max: 20, window: "1 h" });
  if (!rate.success) return NextResponse.json({ error: "Too many invites — try again later." }, { status: 429 });

  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid email and role." }, { status: 400 });

  const admin = createAdminClient();
  const { data: target } = await admin.from("users").select("id, email").ilike("email", parsed.data.email).maybeSingle();

  // Already has an account → add immediately.
  if (target) {
    const { data: existing } = await admin.from("org_members").select("id").eq("org_id", ctx.orgId).eq("user_id", target.id).maybeSingle();
    if (existing) return NextResponse.json({ error: "That person is already in this org." }, { status: 409 });
    const { error } = await admin.from("org_members").insert({ org_id: ctx.orgId, user_id: target.id, role: parsed.data.role });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "added" });
  }

  // No account yet → store a pending invite that auto-resolves when they sign up.
  const { error } = await admin
    .from("org_invites")
    .upsert({ org_id: ctx.orgId, email: parsed.data.email.toLowerCase(), role: parsed.data.role, invited_by: ctx.userId }, { onConflict: "org_id,email" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort invite email (only if an email provider is configured).
  await sendInviteEmail(parsed.data.email, ctx.orgId).catch(() => {});
  return NextResponse.json({ ok: true, status: "invited" });
}

/** Change a member's role. Admin/owner only; cannot change an owner. */
export async function PATCH(req: NextRequest) {
  const ctx = await callerContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canManage(ctx.role)) return NextResponse.json({ error: "Only org admins can change roles." }, { status: 403 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const admin = createAdminClient();
  const { data: m } = await admin.from("org_members").select("role").eq("org_id", ctx.orgId).eq("user_id", parsed.data.userId).maybeSingle();
  if (!m) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (m.role === "owner") return NextResponse.json({ error: "The owner's role can't be changed." }, { status: 403 });

  const { error } = await admin.from("org_members").update({ role: parsed.data.role }).eq("org_id", ctx.orgId).eq("user_id", parsed.data.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Remove a member. Admin/owner only; cannot remove an owner or yourself. */
export async function DELETE(req: NextRequest) {
  const ctx = await callerContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canManage(ctx.role)) return NextResponse.json({ error: "Only org admins can remove members." }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const admin = createAdminClient();

  // Revoke a pending (not-yet-accepted) invite by email.
  const invite = params.get("invite");
  if (invite) {
    const { error } = await admin.from("org_invites").delete().eq("org_id", ctx.orgId).ilike("email", invite);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const userId = params.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  if (userId === ctx.userId) return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });

  const { data: m } = await admin.from("org_members").select("role").eq("org_id", ctx.orgId).eq("user_id", userId).maybeSingle();
  if (!m) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (m.role === "owner") return NextResponse.json({ error: "The org owner can't be removed." }, { status: 403 });

  const { error } = await admin.from("org_members").delete().eq("org_id", ctx.orgId).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
