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
    <div className="mx-auto max-w-5xl">
      <div className="border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <Link href="/dashboard" className="text-xs text-neutral-400 hover:text-neutral-600">← All projects</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-neutral-500">
          {project.repo ?? "no repo linked"} · {project.default_branch} · reruns ×{project.rerun_count}
        </p>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
