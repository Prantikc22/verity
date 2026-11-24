import { App } from "@octokit/app";
import { createAdminClient } from "@/lib/supabase/admin";

let appInstance: App | null = null;

function getPrivateKey(): string | null {
  const b64 = process.env.GITHUB_APP_PRIVATE_KEY_B64;
  if (b64) return Buffer.from(b64, "base64").toString("utf8");
  const raw = process.env.GITHUB_APP_PRIVATE_KEY;
  // Support both real newlines and escaped \n in the env value.
  return raw ? raw.replace(/\\n/g, "\n") : null;
}

/** The GitHub App, or null if not configured (so the rest of the app degrades gracefully). */
export function getApp(): App | null {
  if (appInstance) return appInstance;
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = getPrivateKey();
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!appId || !privateKey) return null;

  appInstance = new App({
    appId,
    privateKey,
    ...(webhookSecret ? { webhooks: { secret: webhookSecret } } : {}),
  });
  return appInstance;
}

/** An Octokit authenticated as a specific installation, or null if unconfigured. */
export async function installationOctokit(installationId: number) {
  const app = getApp();
  if (!app) return null;
  return app.getInstallationOctokit(installationId);
}

/**
 * Which installation of our GitHub App can reach owner/repo? Asks GitHub
 * directly (authoritative), so a stale id saved on a project (app removed and
 * reinstalled) can't break pushes. Fixes the saved id when it has drifted.
 */
export async function repoInstallationId(owner: string, repo: string, opts: { projectId?: string; saved?: number | null } = {}): Promise<number | null> {
  const app = getApp();
  if (!app) return opts.saved ?? null;
  try {
    const { data } = await app.octokit.request("GET /repos/{owner}/{repo}/installation", { owner, repo });
    const id = (data as { id: number }).id;
    if (opts.projectId && opts.saved !== id) {
      await createAdminClient().from("projects").update({ github_installation_id: id }).eq("id", opts.projectId);
    }
    return id;
  } catch {
    return null; // not installed on this repo (or no access)
  }
}

let installUrlCache: string | null = null;
/** Link that installs the GitHub App on more repos. */
export async function appInstallUrl(): Promise<string> {
  if (installUrlCache) return installUrlCache;
  const app = getApp();
  try {
    const { data } = await app!.octokit.request("GET /app");
    installUrlCache = `https://github.com/apps/${(data as { slug: string }).slug}/installations/new`;
  } catch {
    installUrlCache = "https://github.com/settings/installations";
  }
  return installUrlCache;
}

/** Plain message when the app can't reach a repo. */
export async function notInstalledMessage(owner: string, repo: string): Promise<{ error: string; install_url: string }> {
  const url = await appInstallUrl();
  return { error: `QAShift's GitHub App doesn't have access to ${owner}/${repo} yet. Install it on that repository, then try again.`, install_url: url };
}
