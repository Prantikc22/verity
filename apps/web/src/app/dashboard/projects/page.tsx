import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { entitlementsFor } from "@/lib/entitlements";
import { CreateProjectForm } from "../CreateProjectForm";
import { Card, PageHeader, timeAgo } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Projects", robots: { index: false } };

export default async function ProjectsPage() {
  const orgCtx = await getPrimaryOrg();
  const orgId = orgCtx?.org.id;
  const ent = entitlementsFor(orgCtx?.org);
  const supabase = await createClient();

  const { data: projects } = orgId
    ? await supabase.from("projects").select("id, name, repo, default_branch, created_at").eq("org_id", orgId).order("created_at", { ascending: false })
    : { data: [] };
  const list = projects ?? [];
  const cap = ent.maxProjects > 9999 ? "unlimited" : ent.maxProjects;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Projects" lead={`${list.length} of ${cap} projects on your plan. A project is one app or service: its environments, tests, runs and reports.`} />
      <CreateProjectForm />
      <div className="mt-8 grid gap-3">
        {list.length === 0 && <p className="text-sm text-neutral-500">No projects yet. Create one above, then start from a staging URL, an OpenAPI spec, a repository or your existing Playwright tests.</p>}
        {list.map((p) => (
          <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
            <Card className="flex items-center justify-between gap-4 transition hover:border-[#D6D1C2]">
              <div className="min-w-0">
                <div className="font-medium">{p.name}</div>
                <div className="truncate text-xs text-neutral-500">{p.repo ?? "No repository linked"} · {p.default_branch}</div>
              </div>
              <span className="shrink-0 text-xs text-neutral-500">created {timeAgo(p.created_at)}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
