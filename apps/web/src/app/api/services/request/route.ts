import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPrimaryOrg, getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const Body = z.object({
  service: z.enum(["managed-diagnostic", "managed-enterprise", "accessibility-audit"]),
  details: z.string().max(2000).optional(),
});

const LABEL: Record<string, string> = {
  "managed-diagnostic": "Managed QA: free diagnostic",
  "managed-enterprise": "Managed QA: Enterprise",
  "accessibility-audit": "Accessibility audit",
};

/** A signed-in team asks for a people-delivered service. Stored, then the QAShift team is notified. */
export async function POST(req: NextRequest) {
  const [user, ctx] = await Promise.all([getUser(), getPrimaryOrg()]);
  if (!user || !ctx) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a service." }, { status: 400 });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("service_requests").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id).gte("created_at", since);
  if ((count ?? 0) >= 5) return NextResponse.json({ error: "We already have your request. We'll reply soon." }, { status: 429 });

  const { error } = await admin.from("service_requests").insert({
    org_id: ctx.org.id, user_id: user.id, email: user.email ?? null, service: parsed.data.service, details: parsed.data.details?.trim() || null,
  });
  if (error) return NextResponse.json({ error: "Couldn't send your request. Email hello@qashifthq.com instead." }, { status: 500 });

  const to = process.env.SERVICE_REQUEST_EMAIL ?? "hello@qashifthq.com";
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<p><b>${esc(LABEL[parsed.data.service])}</b></p><p>Org: ${esc(ctx.org.name)}<br>From: ${esc(user.email ?? "unknown")}</p>${parsed.data.details ? `<p>${esc(parsed.data.details)}</p>` : ""}`;
  if (process.env.NODE_ENV === "production") await sendEmail({ to, subject: `Service request: ${LABEL[parsed.data.service]} (${ctx.org.name})`, html });
  else console.log(`[service request] would email ${to}: ${LABEL[parsed.data.service]} from ${user.email}`);

  return NextResponse.json({ ok: true });
}
