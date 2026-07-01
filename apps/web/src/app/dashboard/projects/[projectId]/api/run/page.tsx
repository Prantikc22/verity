import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { RunTests } from "../../RunTests";

export const metadata: Metadata = { title: "API · Cloud run", robots: { index: false } };

export default async function ApiRunPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: tests } = await supabase
    .from("tests")
    .select("id, name, suite")
    .eq("project_id", projectId)
    .eq("kind", "api")
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Cloud run · API tests</h2>
        <p className="text-xs text-neutral-500">
          Execute your saved <strong>API tests</strong> (Playwright request specs) on our infra with real assertions.
          Failures are auto-healed and re-run. Capped per plan; for unlimited execution use your <Link href={`/dashboard/projects/${projectId}/settings`} className="text-indigo-600 underline">CI</Link>.
        </p>
      </div>

      {(!tests || tests.length === 0) ? (
        <p className="text-sm text-neutral-500">No API tests yet. <Link href={`/dashboard/projects/${projectId}/api/generate`} className="text-indigo-600 underline">Generate some first →</Link></p>
      ) : (
        <RunTests projectId={projectId} kind="api" tests={(tests ?? []).map((t) => ({ id: t.id, name: t.name, suite: t.suite ?? null }))} />
      )}
    </div>
  );
}
