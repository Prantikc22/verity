import { redirect } from "next/navigation";
import { getUser, getPrimaryOrg, ensureOrgForCurrentUser, resolvePendingInvites } from "@/lib/auth";
import { entitlementsFor } from "@/lib/entitlements";
import { captureServer } from "@/lib/analytics/posthog-server";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
import { DashboardShell } from "@/components/DashboardShell";
import { QAShiftShell } from "@/components/shell/QAShiftShell";
import { qashiftShellEnabled } from "@/lib/flags";

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
    return (
      <QAShiftShell org={orgCtx?.org.name ?? "Your org"} plan={plan.label} email={user.email ?? ""} credits={plan.creditsPerMonth}>
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
