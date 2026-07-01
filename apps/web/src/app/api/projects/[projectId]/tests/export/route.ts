import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Export a project's tests as a portable bundle the user/FDE can drop into a
 * repo. Returns a JSON manifest of { path, content } files plus a Playwright
 * config and a suggested Page Object Model scaffold, so an engineer can take the
 * AI-generated specs out, restructure them into POM, and own them in git.
 *
 * RLS scopes reads to the caller's org; we also confirm the project resolves.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, repo, default_branch")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: tests } = await supabase
    .from("tests")
    .select("name, spec_path, spec_content, is_pom, source_files, critical_path")
    .eq("project_id", projectId)
    .neq("status", "archived")
    .order("created_at", { ascending: true });

  const files = (tests ?? []).map((t) => ({
    path: t.spec_path,
    content: t.spec_content,
    pom: t.is_pom,
    critical: t.critical_path,
    exercises: t.source_files,
  }));

  // A starter POM page object + config, so the FDE has a structure to grow into.
  const scaffold = [
    {
      path: "pages/BasePage.ts",
      content:
        "import { type Page, type Locator } from '@playwright/test';\n\n" +
        "/** Base Page Object — extend this per page. The FDE layer restructures\n" +
        " *  flat AI specs into page objects like this and owns them in your repo. */\n" +
        "export class BasePage {\n  constructor(protected readonly page: Page) {}\n" +
        "  async goto(path = '/') { await this.page.goto(path); }\n}\n",
    },
    {
      path: "playwright.config.ts",
      content:
        "import { defineConfig } from '@playwright/test';\n\n" +
        "export default defineConfig({\n  testDir: './tests',\n  retries: process.env.CI ? 2 : 0,\n" +
        "  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000' },\n});\n",
    },
    {
      path: "VERITY.md",
      content:
        `# ${project.name} — exported from Verity\n\n` +
        "These specs were AI-generated and kept alive by Verity (self-healing + flake triage).\n" +
        "To make them an owned asset, a forward-deployed engineer:\n\n" +
        "1. Restructures flat specs into the Page Object Model under `pages/`.\n" +
        "2. Commits them to your repo and wires the Verity GitHub Action.\n" +
        "3. Maintains them as the product changes; Verity keeps predicting risk.\n\n" +
        `Repo: ${project.repo ?? "(not linked)"} · default branch: ${project.default_branch}\n`,
    },
  ];

  const bundle = {
    project: { id: project.id, name: project.name, repo: project.repo },
    generatedAt: new Date().toISOString(),
    files: [...files.map((f) => ({ path: f.path, content: f.content })), ...scaffold],
    meta: files.map((f) => ({ path: f.path, pom: f.pom, critical: f.critical, exercises: f.exercises })),
  };

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="verity-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-tests.json"`,
    },
  });
}
