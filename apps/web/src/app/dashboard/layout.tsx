import { redirect } from "next/navigation";
import { getUser, getPrimaryOrg, ensureOrgForCurrentUser, resolvePendingInvites } from "@/lib/auth";
import { planFor } from "@/lib/plans";
import { captureServer } from "@/lib/analytics/posthog-server";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
import { DashboardShell } from "@/components/DashboardShell";

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
  const plan = planFor(orgCtx?.org.plan);

  return (
    <DashboardShell org={orgCtx?.org.name ?? "Your org"} plan={plan.name} email={user.email ?? ""}>
      {children}
    </DashboardShell>
  );
}
