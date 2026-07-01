import { installationOctokit } from "./app";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import type { IngestResult } from "@/lib/ingest";

const COMMENT_MARKER = "<!-- verity-test-report -->";
/** Distinct marker so the Performance/Security comment never clobbers the UI/API one. */
const DISCIPLINE_MARKER = "<!-- verity-discipline-report -->";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://verity.qashift.com";

function parseRepo(repo: string | null): { owner: string; repo: string } | null {
  if (!repo) return null;
  const cleaned = repo
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "")
    .trim()
    .replace(/\s+/g, "/");
  const [owner, name] = cleaned.split("/");
  return owner && name ? { owner, repo: name } : null;
}

async function resolveInstallationId(project: Tables<"projects">): Promise<number | null> {
  if (project.github_installation_id) return project.github_installation_id;
  const owner = parseRepo(project.repo)?.owner;
  if (!owner) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("github_installations")
    .select("installation_id")
    .eq("account_login", owner)
    .eq("suspended", false)
    .maybeSingle();
  return data?.installation_id ?? null;
}

/**
 * The fast tier is a diff-aware subset and is labeled "Quick check" — never
 * implied to be full regression coverage. The full tier is "Full regression"
 * and is the only tier allowed to block a merge.
 */
function tierLabel(tier: IngestResult["tier"]): string {
  return tier === "fast" ? "Quick check" : "Full regression";
}

export function buildSummary(
  project: Tables<"projects">,
  result: IngestResult,
  commitSha: string,
  gatingAllowed: boolean,
): string {
  const isFast = result.tier === "fast";

  // Build the body as blocks separated by BLANK LINES. GitHub-flavored markdown
  // needs a blank line before a table/blockquote or it renders as raw text — so
  // we join blocks with "\n\n" and never strip the separators.
  const blocks: string[] = [COMMENT_MARKER];

  blocks.push(
    isFast
      ? "## 🔎 Verity · Quick check"
      : "## 🛡️ Verity · Full regression",
  );
  blocks.push(
    isFast
      ? "> A fast, **diff-aware** subset — a sanity check, **not** full regression coverage. The Full regression suite runs on merge."
      : "> The entire suite ran. This is the regression safety net.",
  );

  blocks.push(
    result.failed > 0
      ? `### ❌ ${result.failed} real failure${result.failed === 1 ? "" : "s"}${result.flaky > 0 ? ` · ${result.flaky} flaky (quarantined)` : ""}`
      : result.flaky > 0
        ? `### ✅ No real failures · ${result.flaky} flaky test${result.flaky === 1 ? "" : "s"} quarantined`
        : `### ✅ All ${result.passed} test${result.passed === 1 ? "" : "s"} passed`,
  );

  // A compact vertical table renders reliably.
  blocks.push(
    [
      "| Result | Count |",
      "| :-- | --: |",
      `| ✅ Passed | ${result.passed} |`,
      `| ❌ Failed (real) | ${result.failed} |`,
      `| ⚠️ Flaky (quarantined) | ${result.flaky} |`,
      `| ⏭️ Skipped | ${result.skipped} |`,
    ].join("\n"),
  );

  // Prediction — flake-vs-real disambiguation, inline next to each failure.
  if (result.realFailures.length) {
    blocks.push(
      [
        "**Failures — with historical flake context:**",
        ...result.realFailures.map((f) => {
          const ctx = f.runsTotal >= 5
            ? `${Math.round(f.flakeRate * 100)}% historical flake rate over ${f.runsTotal} runs`
            : `not enough history (${f.runsTotal} runs) — treat as real`;
          return `- \`${f.spec_path}\` — ${ctx}`;
        }),
      ].join("\n"),
    );
  }

  // Prediction — regression-prone module flagging.
  const flagged = result.regressionFlags.filter((f) => f.flagged);
  if (flagged.length) {
    blocks.push(
      [
        "**⚠️ Regression-prone files in this change:**",
        ...flagged.map((f) => `- \`${f.filePath}\` — ${Math.round(f.rate * 100)}% historical regression rate`),
      ].join("\n"),
    );
  }

  if (!gatingAllowed && result.failed > 0 && result.tier === "full") {
    blocks.push("> ℹ️ Merge-blocking is available on Growth+ — this check is informational on your current plan.");
  }

  blocks.push(`<sub>Commit \`${commitSha.slice(0, 7)}\` · [View run →](${APP_URL}/dashboard/projects/${project.id})</sub>`);
  blocks.push("<sub>Posted by <b>Verity</b> — AI-augmented Playwright testing · a QAShift product</sub>");

  return blocks.join("\n\n");
}

/* ------------------------------------------------------------------ *
 * Performance / Security — additive comment + Check Run. This NEVER     *
 * touches the existing UI/API comment (different marker) and NEVER      *
 * blocks a merge: security findings are "issues", perf is informational.*
 * ------------------------------------------------------------------ */

function fmtMs(v: number | null | undefined): string {
  return v == null ? "—" : `${Math.round(v)} ms`;
}

export function buildDisciplineSummary(
  project: Tables<"projects">,
  result: IngestResult,
  commitSha: string,
): string {
  const blocks: string[] = [DISCIPLINE_MARKER];

  if (result.discipline === "performance" && result.perf) {
    const a = result.perf.aggregate;
    const isSmoke = result.perf.tier === "fast";
    blocks.push("## ⚡ Verity · " + (isSmoke ? "Perf smoke check" : "Full load test"));
    blocks.push(
      isSmoke
        ? "> A lightweight smoke check (few endpoints, short duration, small VU count) — **not** a full load test. The full load test runs on merge/schedule."
        : "> Full load test result.",
    );
    if (result.perf.webVitals) {
      const w = result.perf.webVitals;
      blocks.push(
        [
          "| Core Web Vital | Value |",
          "| :-- | --: |",
          `| Performance score | ${w.performanceScore ?? "—"} |`,
          `| LCP | ${fmtMs(w.lcp)} |`,
          `| CLS | ${w.cls ?? "—"} |`,
          `| TBT | ${fmtMs(w.tbt)} |`,
        ].join("\n"),
      );
    } else {
      blocks.push(
        [
          "| Metric | Value |",
          "| :-- | --: |",
          `| Requests | ${a.requests} |`,
          `| Error rate | ${(a.errorRate * 100).toFixed(1)}% |`,
          `| p50 latency | ${fmtMs(a.p50)} |`,
          `| p95 latency | ${fmtMs(a.p95)} |`,
          `| p99 latency | ${fmtMs(a.p99)} |`,
        ].join("\n"),
      );
    }
  } else if (result.discipline === "security") {
    const f = result.findings;
    const crit = f.filter((x) => x.severity === "critical").length;
    const high = f.filter((x) => x.severity === "high").length;
    const med = f.filter((x) => x.severity === "medium").length;
    const low = f.filter((x) => x.severity === "low").length;
    blocks.push("## 🔐 Verity · Security scan");
    blocks.push(
      f.length === 0
        ? "> No security findings in this scan."
        : "> Security findings are surfaced as issues ranked by severity — not pass/fail tests.",
    );
    blocks.push(
      [
        "| Severity | Count |",
        "| :-- | --: |",
        `| 🔴 Critical | ${crit} |`,
        `| 🟠 High | ${high} |`,
        `| 🟡 Medium | ${med} |`,
        `| ⚪ Low | ${low} |`,
      ].join("\n"),
    );
    const top = f.filter((x) => x.severity === "critical" || x.severity === "high").slice(0, 10);
    if (top.length) {
      blocks.push(
        [
          "**Top findings:**",
          ...top.map((x) => {
            const where = x.filePath ? `\`${x.filePath}${x.line ? `:${x.line}` : ""}\`` : x.url ? `\`${x.url}\`` : "";
            return `- **${x.severity.toUpperCase()}** — ${x.title} ${where}`.trim();
          }),
        ].join("\n"),
      );
    }
  }

  blocks.push(`<sub>Commit \`${commitSha.slice(0, 7)}\` · [View run →](${APP_URL}/dashboard/projects/${project.id}/runs/${result.runId})</sub>`);
  blocks.push("<sub>Posted by <b>Verity</b> — a QAShift product</sub>");
  return blocks.join("\n\n");
}

/**
 * Post the Performance/Security Check Run + (for PRs) an upserted comment, using
 * a distinct marker so it coexists with the UI/API comment. Conclusion is
 * "neutral" when there are high/critical findings, else "success" — it NEVER
 * fails the build (findings are advisory, perf is informational).
 */
export async function postDisciplineResults(
  project: Tables<"projects">,
  result: IngestResult,
  commitSha: string,
  prNumber: number | null,
  _opts: { gatingAllowed: boolean },
): Promise<string | null> {
  const repo = parseRepo(project.repo);
  if (!repo) return null;
  const installationId = await resolveInstallationId(project);
  if (!installationId) return null;
  const octokit = await installationOctokit(installationId);
  if (!octokit) return null;

  const summary = buildDisciplineSummary(project, result, commitSha);
  const isPerf = result.discipline === "performance";
  const seriousFindings = result.findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
  const conclusion = !isPerf && seriousFindings > 0 ? "neutral" : "success";
  const name = isPerf
    ? `Verity — ${result.perf?.tier === "fast" ? "Perf smoke check" : "Full load test"}`
    : "Verity — Security scan";
  const title = isPerf
    ? "Performance report"
    : result.findings.length
      ? `${result.findings.length} finding(s)`
      : "No findings";

  const check = await octokit.request("POST /repos/{owner}/{repo}/check-runs", {
    owner: repo.owner,
    repo: repo.repo,
    name,
    head_sha: commitSha,
    status: "completed",
    conclusion,
    output: { title, summary },
  });

  if (prNumber) {
    const { data: comments } = await octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      { owner: repo.owner, repo: repo.repo, issue_number: prNumber, per_page: 100 },
    );
    const existing = (comments as { id: number; body?: string }[]).find((c) => c.body?.includes(DISCIPLINE_MARKER));
    if (existing) {
      await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
        owner: repo.owner,
        repo: repo.repo,
        comment_id: existing.id,
        body: summary,
      });
    } else {
      await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner: repo.owner,
        repo: repo.repo,
        issue_number: prNumber,
        body: summary,
      });
    }
  }
  return (check.data as { html_url?: string }).html_url ?? null;
}

/**
 * Post a Check Run on the commit and (for PRs) an upserted PR comment.
 * Only a Full-regression run with real failures may block a merge (failure
 * conclusion). A Quick check never blocks — at most a neutral conclusion.
 */
export async function postRunResults(
  project: Tables<"projects">,
  result: IngestResult,
  commitSha: string,
  prNumber: number | null,
  opts: { gatingAllowed: boolean; mergeBlocking: boolean },
): Promise<string | null> {
  const repo = parseRepo(project.repo);
  if (!repo) return null;

  const installationId = await resolveInstallationId(project);
  if (!installationId) return null;

  const octokit = await installationOctokit(installationId);
  if (!octokit) return null;

  const summary = buildSummary(project, result, commitSha, opts.gatingAllowed);
  const hasRealFailure = result.failed > 0;

  // Only Full regression with real failures + merge-blocking entitlement fails.
  const canBlock = result.tier === "full" && opts.gatingAllowed && opts.mergeBlocking;
  const conclusion = hasRealFailure && canBlock ? "failure" : hasRealFailure ? "neutral" : "success";

  const check = await octokit.request("POST /repos/{owner}/{repo}/check-runs", {
    owner: repo.owner,
    repo: repo.repo,
    name: `Verity — ${tierLabel(result.tier)}`,
    head_sha: commitSha,
    status: "completed",
    conclusion,
    output: {
      title: hasRealFailure
        ? `${result.failed} real failure(s)`
        : result.flaky > 0
          ? `Passed (${result.flaky} flaky quarantined)`
          : "All passed",
      summary,
    },
  });

  if (prNumber) {
    const { data: comments } = await octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      { owner: repo.owner, repo: repo.repo, issue_number: prNumber, per_page: 100 },
    );
    const existing = (comments as { id: number; body?: string }[]).find((c) =>
      c.body?.includes(COMMENT_MARKER),
    );
    if (existing) {
      await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
        owner: repo.owner,
        repo: repo.repo,
        comment_id: existing.id,
        body: summary,
      });
    } else {
      await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner: repo.owner,
        repo: repo.repo,
        issue_number: prNumber,
        body: summary,
      });
    }
  }

  return (check.data as { html_url?: string }).html_url ?? null;
}
