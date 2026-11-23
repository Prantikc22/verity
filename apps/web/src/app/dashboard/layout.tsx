import { redirect } from "next/navigation";
import { getUser, getPrimaryOrg, ensureOrgForCurrentUser, resolvePendingInvites } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { captureServer } from "@/lib/analytics/posthog-server";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
import { DashboardShell } from "@/components/DashboardShell";
import { QAShiftShell } from "@/components/shell/QAShiftShell";
import { qashiftShellEnabled } from "@/lib/flags";
import { creditsUsed, UNLIMITED_CREDITS } from "@/lib/credits";
import { workspaceModeOf } from "@/lib/workspace";
import { REPORTS, isReportsKey } from "@/lib/catalog";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login?next=/dashboard");

  // Accept any pending team invites for this email before resolving the org.
  await resolvePendingInvites();
  const provisioned = await ensureOrgForCurrentUser();
  if (provisioned?.created) {
    await captureServer(user.id, FUNNEL_EVENTS.signup, { org_id: provisioned.orgId });
  }
  const orgCtx = await getPrimaryOrg();
  const plan = entitlementsFor(orgCtx?.org);

  if (await qashiftShellEnabled()) {
    // Credits left this month for the sidebar meter. Never block the page on it.
    let used: number | undefined;
    if (orgCtx?.org.id) { try { used = await creditsUsed(orgCtx.org.id); } catch { used = undefined; } }
    const credits = { limit: plan.creditsPerMonth, used, unlimited: plan.creditsPerMonth >= UNLIMITED_CREDITS };
    const mode = workspaceModeOf(orgCtx?.org);
    const reportsKey = orgCtx?.org.reports_plan;
    // Reports-only teams see their Reports plan; anyone on a paid plan keeps seeing it.
    const label = mode === "reports" ? (isReportsKey(reportsKey) ? REPORTS[reportsKey].name : plan.label === "Free" ? "Reports Free" : plan.label) : plan.label;
    return (
      <QAShiftShell org={orgCtx?.org.name ?? "Your org"} plan={label} email={user.email ?? ""} credits={credits} mode={mode}>
        {children}
      </QAShiftShell>
    );
  }

  return (
    <DashboardShell org={orgCtx?.org.name ?? "Your org"} plan={plan.name} email={user.email ?? ""}>
      {children}
    </DashboardShell>
  );
}
