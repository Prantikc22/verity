import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { RunTests } from "../RunTests";

export const metadata: Metadata = { title: "Cloud run", robots: { index: false } };

export default async function CloudPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: tests } = await supabase
    .from("tests")
    .select("id, name, source_url, suite")
    .eq("project_id", projectId)
    .eq("kind", "ui")
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Cloud run · UI tests</h2>
        <p className="text-xs text-neutral-500">
          Run your saved <strong>UI tests</strong> with real assertions in a real browser on our infra and get a report — or just open a page live to preview it.
          Capped per plan. For unlimited execution use your <Link href={`/dashboard/projects/${projectId}/settings`} className="text-indigo-600 underline">CI</Link>;
          for <strong>localhost</strong>, the Verity MCP runs tests on your machine.
        </p>
      </div>

      <RunTests projectId={projectId} kind="ui" tests={(tests ?? []).map((t) => ({ id: t.id, name: t.name, suite: t.suite ?? null }))} />
    </div>
  );
}
