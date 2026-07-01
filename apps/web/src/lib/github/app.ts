import { App } from "@octokit/app";

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
