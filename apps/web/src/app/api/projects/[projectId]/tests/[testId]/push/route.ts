import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { installationOctokit } from "@/lib/github/app";

export const runtime = "nodejs";

function parseRepo(repo: string | null): { owner: string; repo: string } | null {
  if (!repo) return null;
  const c = repo.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "").trim().replace(/\s+/g, "/");
  const [owner, name] = c.split("/");
  return owner && name ? { owner, repo: name } : null;
}

async function resolveInstallationId(repoOwner: string, explicit: number | null): Promise<number | null> {
  if (explicit) return explicit;
  const admin = createAdminClient();
  const { data } = await admin
    .from("github_installations")
    .select("installation_id")
    .eq("account_login", repoOwner)
    .eq("suspended", false)
    .maybeSingle();
  return data?.installation_id ?? null;
}

/**
 * Push a generated test into the project's GitHub repo as a branch + PR. This is
 * how a test created in the dashboard becomes a file in your repo so CI runs it
 * (unlimited runs). Verity opens a PR rather than committing to your default
 * branch — a human always reviews. Requires the GitHub App to have Contents:write.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ projectId: string; testId: string }> }) {
  const { projectId, testId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, repo, default_branch, github_installation_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const repo = parseRepo(project.repo);
  if (!repo) return NextResponse.json({ error: "Link a GitHub repo to this project first (owner/name)." }, { status: 400 });

  const { data: test } = await supabase
    .from("tests")
    .select("spec_path, spec_content, name")
    .eq("id", testId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

  const installationId = await resolveInstallationId(repo.owner, project.github_installation_id);
  if (!installationId) {
    return NextResponse.json({ error: "Install the Verity GitHub App on this repo first." }, { status: 400 });
  }
  const octokit = await installationOctokit(installationId);
  if (!octokit) return NextResponse.json({ error: "GitHub App is not configured." }, { status: 503 });

  try {
    const base = project.default_branch || "main";
    // Resolve base branch head SHA.
    const baseRef = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
      owner: repo.owner, repo: repo.repo, ref: `heads/${base}`,
    });
    const baseSha = (baseRef.data as { object: { sha: string } }).object.sha;

    const branch = `verity/${test.spec_path.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${Date.now().toString(36)}`;

    // Create the branch.
    await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
      owner: repo.owner, repo: repo.repo, ref: `refs/heads/${branch}`, sha: baseSha,
    });

    // Does the file already exist on base (so we can update vs create)?
    let existingSha: string | undefined;
    try {
      const existing = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
        owner: repo.owner, repo: repo.repo, path: test.spec_path, ref: branch,
      });
      existingSha = (existing.data as { sha?: string }).sha;
    } catch {
      /* new file */
    }

    await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner: repo.owner, repo: repo.repo, path: test.spec_path,
      message: `Add Verity test: ${test.name}`,
      content: Buffer.from(test.spec_content, "utf8").toString("base64"),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    const pr = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
      owner: repo.owner, repo: repo.repo, title: `Verity: ${test.name}`, head: branch, base,
      body: `This Playwright test was generated in [Verity](https://verity-kappa-ebon.vercel.app) and pushed here so your CI can run it.\n\n\`${test.spec_path}\`\n\nMerge to start running it on every PR (Quick check) and on merge (Full regression).`,
    });

    return NextResponse.json({ ok: true, pr_url: (pr.data as { html_url: string }).html_url, branch });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const msg = err instanceof Error ? err.message : "push failed";

    // A 403 here almost always means the App now HAS Contents:write, but the
    // existing installation hasn't accepted the new permission yet — GitHub
    // doesn't auto-apply permission changes to existing installs.
    if (status === 403 || /Resource not accessible/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "GitHub returned 403. If you just enabled 'Contents: write', the installation must re-accept it: " +
            "go to GitHub → Settings → Applications → Verity by QAShift → the repo → and approve the updated permissions. " +
            "Then try again.",
          github_status: 403,
        },
        { status: 403 },
      );
    }
    // Surface the real GitHub error instead of guessing.
    return NextResponse.json({ error: `GitHub: ${msg}`, github_status: status ?? null }, { status: 500 });
  }
}
