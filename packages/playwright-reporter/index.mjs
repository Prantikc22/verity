/**
 * QAShift Reports — native Playwright reporter.
 *
 *   // playwright.config.ts
 *   reporter: [['list'], ['@qashifthq/playwright-reporter']]
 *
 * Reads the project token from QASHIFT_TOKEN (or the `token` option). Every
 * test is reported with all of its attempts, so a test that fails and then
 * passes on retry is recorded as flaky, not green. Never fails your build:
 * if the upload fails it prints a warning and moves on.
 */
import { execSync } from "node:child_process";

const env = process.env;
const git = (args) => { try { return execSync(`git ${args}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");

export default class QAShiftReporter {
  constructor(options = {}) {
    this.token = options.token ?? env.QASHIFT_TOKEN ?? env.VERITY_INGEST_TOKEN;
    this.apiUrl = (options.apiUrl ?? env.QASHIFT_API_URL ?? env.VERITY_API_URL ?? "https://verity.qashifthq.com").replace(/\/$/, "");
    this.tier = options.tier ?? "full";
    this.silent = Boolean(options.silent);
    this.tests = new Map();
  }

  printsToStdio() { return false; }

  onBegin(_config, suite) {
    this.total = suite.allTests().length;
  }

  onTestEnd(test, result) {
    if (result.status === "skipped") return;
    const file = test.location?.file ?? "unknown";
    const rel = env.GITHUB_WORKSPACE && file.startsWith(env.GITHUB_WORKSPACE) ? file.slice(env.GITHUB_WORKSPACE.length + 1) : file.replace(process.cwd() + "/", "");
    // titlePath() = ["", project, file, ...describe blocks, test title]
    const project = test.parent?.project?.()?.name;
    const name = [project, ...test.titlePath().slice(3)].filter(Boolean).join(" › ") || test.title;
    const key = test.id;
    const passed = result.status === "passed";
    const entry = this.tests.get(key) ?? { spec_path: rel, name, attempts: [], duration_ms: 0, error_message: null };
    entry.attempts.push(passed);
    entry.duration_ms += result.duration ?? 0;
    if (!passed && result.error?.message) entry.error_message = stripAnsi(result.error.message).split("\n")[0].slice(0, 500);
    this.tests.set(key, entry);
  }

  async onEnd() {
    const results = [...this.tests.values()];
    const log = (m) => { if (!this.silent) console.log(m); };
    if (!this.token) { log("[qashift] No QASHIFT_TOKEN set, skipping upload."); return; }
    if (!results.length) { log("[qashift] No tests ran, nothing to upload."); return; }
    const pr = env.GITHUB_REF?.match(/refs\/pull\/(\d+)/)?.[1] ?? env.CI_MERGE_REQUEST_IID ?? env.CHANGE_ID;
    const payload = {
      tier: this.tier,
      trigger: pr || env.GITHUB_EVENT_NAME === "pull_request" ? "pr" : env.CI ? "merge" : "manual",
      commit_sha: env.GITHUB_SHA || env.CI_COMMIT_SHA || env.GIT_COMMIT || env.CIRCLE_SHA1 || git("rev-parse HEAD") || "unknown",
      branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || env.CI_COMMIT_REF_NAME || env.BRANCH_NAME || env.GIT_BRANCH || env.CIRCLE_BRANCH || git("rev-parse --abbrev-ref HEAD") || "unknown",
      pr_number: pr ? Number(pr) : null,
      results,
    };
    try {
      const res = await fetch(`${this.apiUrl}/api/ingest`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { console.warn(`[qashift] Upload failed (${res.status}): ${data.error ?? "unknown error"}`); return; }
      const s = data.summary ?? {};
      log(`[qashift] ${results.length} results uploaded: ${s.passed ?? 0} passed, ${s.failed ?? 0} failed, ${s.flaky ?? 0} flaky.`);
      if (data.run_url) log(`[qashift] ${data.run_url}`);
    } catch (err) {
      console.warn(`[qashift] Upload failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}
