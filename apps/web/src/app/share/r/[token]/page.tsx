import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReport } from "@/lib/reports/build";
import { ReportView } from "@/components/reports/ReportView";

export const metadata: Metadata = { title: "Shared test report", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public, read-only report behind an unguessable, expiring token. */
export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: share } = token.length >= 20
    ? await admin.from("report_shares").select("org_id, project_id, days, expires_at, revoked_at").eq("token", token).maybeSingle()
    : { data: null };
  const live = share && !share.revoked_at && new Date(share.expires_at).getTime() > Date.now();

  if (!share || !live) {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">This report link has expired</h1>
          <p className="mt-2 text-sm text-neutral-500">Shared reports last 7 days. Ask the person who sent it for a new link.</p>
        </div>
      </main>
    );
  }

  let q = admin.from("projects").select("id, name").eq("org_id", share.org_id);
  if (share.project_id) q = q.eq("id", share.project_id);
  const { data: projects } = await q;
  const { data: org } = await admin.from("orgs").select("name").eq("id", share.org_id).maybeSingle();
  const ids = (projects ?? []).map((p) => p.id);
  const data = await buildReport(admin, ids, new Map((projects ?? []).map((p) => [p.id, p.name])), share.days);
  const scope = share.project_id ? projects?.[0]?.name : org?.name ?? "All projects";

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">Shared test report · read-only</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{scope}</h1>
          <p className="mt-1 text-sm text-neutral-500">Last {share.days} days · link expires {new Date(share.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
        </div>
        <a href="https://qashifthq.com/reports" className="text-[13px] font-medium text-neutral-700 underline underline-offset-4">Made with QAShift Reports</a>
      </header>
      <ReportView data={data} days={share.days} />
    </main>
  );
}
