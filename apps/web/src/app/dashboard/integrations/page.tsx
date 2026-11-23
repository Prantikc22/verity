import Link from "next/link";
import type { Metadata } from "next";
import { getPrimaryOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AgentStatus } from "@/lib/catalog";
import { Card, PageHeader, StatusPill } from "@/components/shell/ui";

export const metadata: Metadata = { title: "Integrations", robots: { index: false } };

export default async function IntegrationsPage() {
  const orgCtx = await getPrimaryOrg();
  const orgId = orgCtx?.org.id;
  const supabase = await createClient();
  const [{ count: installs }, { data: project }] = orgId
    ? await Promise.all([
        supabase.from("github_installations").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("suspended", false),
        supabase.from("projects").select("id").eq("org_id", orgId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
      ])
    : [{ count: 0 }, { data: null }];
  const ci = project ? `/dashboard/projects/${project.id}/ci` : "/dashboard/projects";
  const mcp = project ? `/dashboard/projects/${project.id}/mcp` : "/dashboard/projects";

  const items: { name: string; desc: string; status: AgentStatus; href?: string; external?: boolean; state?: string }[] = [
    { name: "GitHub App", desc: "PR checks, plans from diffs, and test PRs.", status: "live", href: "/dashboard/github", state: installs ? `${installs} connected` : "Not connected" },
    { name: "GitHub Actions", desc: "Generated workflow runs tests in your CI. Unmetered.", status: "live", href: ci },
    { name: "GitLab CI", desc: "Generated pipeline config posting to the same endpoint.", status: "live", href: ci },
    { name: "Jenkins", desc: "Generated Jenkinsfile stage.", status: "live", href: ci },
    { name: "CLI and MCP", desc: "Run from your terminal, Claude, Cursor or VS Code.", status: "live", href: mcp },
    { name: "Accessibility in CI", desc: "Lumen scans each deploy and posts regressions to the pull request.", status: "live", href: project ? `/dashboard/projects/${project.id}/accessibility` : "/dashboard/projects" },
    { name: "Slack", desc: "Release summaries in a channel.", status: "roadmap" },
    { name: "Jira", desc: "File real failures as issues.", status: "roadmap" },
    { name: "Linear", desc: "File real failures as issues.", status: "roadmap" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Integrations" lead="Connect your code host and CI. Statuses reflect what is shipped today." />
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => {
          const body = (
            <Card className={`h-full ${i.href ? "transition hover:border-[#D6D1C2]" : "opacity-75"}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{i.name}</span><StatusPill status={i.status} /></div>
              <p className="mt-1 text-sm text-neutral-500">{i.desc}</p>
              {i.state && <p className="mt-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">{i.state}</p>}
            </Card>
          );
          if (!i.href) return <div key={i.name}>{body}</div>;
          return i.external ? <a key={i.name} href={i.href}>{body}</a> : <Link key={i.name} href={i.href}>{body}</Link>;
        })}
      </div>
    </div>
  );
}
