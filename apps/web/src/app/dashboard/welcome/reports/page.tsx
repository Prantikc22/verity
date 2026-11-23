import { redirect } from "next/navigation";
import { getPrimaryOrg, ensureOrgForCurrentUser } from "@/lib/auth";
import { preferReportsMode } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { qsPlan } from "@/lib/billing/qs-plans";

/**
 * Landing step for people who signed up from the Reports page. Turns on the
 * focused Reports workspace (unless they already use the agents), makes sure
 * there is a project to send results to, then shows the setup.
 */
export default async function ReportsWelcome({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  // Brand-new sign-ups may reach this before the layout has provisioned their org (idempotent).
  await ensureOrgForCurrentUser();
  const ctx = await getPrimaryOrg();
  if (!ctx) redirect("/dashboard");
  if (ctx.role === "owner" || ctx.role === "admin") {
    await preferReportsMode(ctx.org.id);
    const admin = createAdminClient();
    const { count } = await admin.from("projects").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id);
    if (!count) await admin.from("projects").insert({ org_id: ctx.org.id, name: "My test suite" });
  }
  // Came from a paid Reports plan on the website: go straight to checkout.
  const p = qsPlan(plan);
  if (p && p.product === "reports" && !p.retired) redirect(`/dashboard/usage?plan=${p.key}#plans`);
  redirect("/dashboard/reports");
}
