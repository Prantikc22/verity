import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name, repo, default_branch, rerun_count")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-neutral-950 dark:text-white">{project.name}</h1>
        <span className="font-mono text-[12px] text-neutral-500">{project.repo ?? "no repo linked"} · {project.default_branch} · retries ×{project.rerun_count}</span>
        <Link href="/dashboard/projects" className="ml-auto text-[12.5px] text-neutral-500 hover:text-neutral-900">All projects</Link>
      </div>
      {children}
    </div>
  );
}
