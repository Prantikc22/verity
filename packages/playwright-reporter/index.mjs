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

/**
 * The innermost *named* step that failed (test.step), e.g. "Click Pay". Assertion
 * and API-call steps are skipped so the name reads like the test author wrote it.
 */
function failingStep(steps) {
  for (const st of steps ?? []) {
    if (st.error) {
      const inner = failingStep(st.steps);
      if (inner) return inner;
      return st.category === "test.step" ? st.title : null;
    }
  }
  return null;
}

export default class QAShiftReporter {
  constructor(options = {}) {
    this.token = options.token ?? env.QASHIFT_TOKEN ?? env.VERITY_INGEST_TOKEN;
    this.apiUrl = (options.apiUrl ?? env.QASHIFT_API_URL ?? env.VERITY_API_URL ?? "https://verity.qashifthq.com").replace(/\/$/, "");
    this.tier = options.tier ?? "full";
    this.silent = Boolean(options.silent);
    this.tests = new Map();
  }

  printsToStdio() { return false; }

  onBegin(config, suite) {
    this.total = suite.allTests().length;
    this.config = config;
    this.started = Date.now();
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
    const line = test.location?.line;
    const entry = this.tests.get(key) ?? {
      spec_path: rel, name, attempts: [], duration_ms: 0, error_message: null,
      location: line ? `${rel}:${line}` : rel,
      details: { attempts: [], stack: null, step: null, tags: test.tags ?? [], project: project ?? null },
    };
    const full = result.error?.message ? stripAnsi(result.error.message).slice(0, 4000) : null;
    const step = failingStep(result.steps);
    entry.attempts.push(passed);
    entry.duration_ms += result.duration ?? 0;
    entry.details.attempts.push({ ok: passed, ms: result.duration ?? 0, error: passed ? null : full, step: passed ? null : step });
    if (!passed && full) {
      entry.error_message = full.split("\n")[0].slice(0, 500);
      entry.details.stack = result.error?.stack ? stripAnsi(result.error.stack).slice(0, 6000) : null;
      entry.details.step = step;
    }
    this.tests.set(key, entry);
  }

  async onEnd(fullResult) {
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
      meta: {
        ci_url: env.GITHUB_RUN_ID && env.GITHUB_REPOSITORY ? `${env.GITHUB_SERVER_URL || "https://github.com"}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : env.CI_JOB_URL || env.BUILD_URL || env.CIRCLE_BUILD_URL || null,
        commit_message: git("log -1 --pretty=%s") || null,
        author: git("log -1 --pretty=%an") || env.GITHUB_ACTOR || null,
        repo: env.GITHUB_REPOSITORY || env.CI_PROJECT_PATH || null,
        playwright: this.config?.version ?? null,
        workers: this.config?.workers ?? null,
        os: `${process.platform}-${process.arch}`,
        wall_ms: fullResult?.duration ?? (this.started ? Date.now() - this.started : null),
        shard: this.config?.shard ? `${this.config.shard.current}/${this.config.shard.total}` : null,
      },
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
