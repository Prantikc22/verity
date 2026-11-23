/**
 * Verity cloud runner (Fly.io). Runs a REAL Playwright browser on demand and
 * streams screenshots back to Verity so the dashboard can show a run happening.
 * Scales to zero between runs (Fly auto-stop), so it costs ~nothing idle.
 *
 * Auth: every request must carry `Authorization: Bearer $RUNNER_SERVICE_TOKEN`.
 * Frames are streamed to Verity via a signed callback as each step completes.
 */
import { createServer } from "node:http";
import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TOKEN = process.env.RUNNER_SERVICE_TOKEN;
const PORT = Number(process.env.PORT ?? 8080);
const APP_DIR = process.cwd();

/**
 * Multi-tenant safety. Customer spec code runs in a child process, so it must
 * never see this service's secrets: the child gets ONLY what Playwright needs.
 */
const CHILD_ENV = Object.fromEntries(
  ["PATH", "HOME", "NODE_ENV", "PLAYWRIGHT_BROWSERS_PATH", "TMPDIR", "LANG"]
    .filter((k) => process.env[k] !== undefined)
    .map((k) => [k, process.env[k]]),
);

/** One job per machine (Fly's hard_limit routes the next request to another machine). */
const MAX_JOBS = Math.max(1, Number(process.env.RUNNER_MAX_JOBS ?? 1));
let activeJobs = 0;

/**
 * Refuse private, loopback, link-local and metadata targets so a tenant cannot
 * use our runner to reach internal networks. Set RUNNER_ALLOW_PRIVATE_TARGETS=1
 * only for local development.
 */
export function isPrivateAddress(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? isPrivateAddress(m[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertPublicTarget(raw) {
  if (raw === undefined || raw === null || raw === "") return;
  if (process.env.RUNNER_ALLOW_PRIVATE_TARGETS === "1") return;
  let u;
  try { u = new URL(raw); } catch { throw new Error("Target must be a valid URL."); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Target must be http(s).");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!addrs.length || addrs.some(isPrivateAddress)) throw new Error("Target resolves to a private or internal address.");
}

/**
 * Execute real Playwright specs (with their assertions) and return per-test
 * results + failure screenshots. Reruns failures to classify flaky vs broken.
 */
export async function runTests({ tests, baseURL, reruns = 2, updateSnapshots = false }) {
  const paths = tests.map(t => t.spec_path);
  if (paths.some(p => typeof p !== "string" || !/^[\w./-]+\.spec\.[cm]?[jt]s$/.test(p) || p.startsWith("/") || p.split("/").includes("..")) || new Set(paths).size !== paths.length) {
    throw new Error("Test paths must be unique, relative .spec.ts/.spec.js paths without traversal.");
  }
  if (updateSnapshots) throw new Error("Cloud visual runs require approved, persistent baselines; snapshot updates are not verification.");
  // Keep the run dir UNDER the app dir so `@playwright/test` resolves from
  // /app/node_modules (module resolution walks up from the spec/config file).
  const dir = join(APP_DIR, ".vrun", `run-${randomUUID()}`);
  const testsDir = join(dir, "tests");
  mkdirSync(testsDir, { recursive: true });
  for (const t of tests) {
    const file = join(testsDir, t.spec_path);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, t.spec_content, "utf8");
  }
  writeFileSync(join(dir, "playwright.config.ts"),
    `import { defineConfig } from '@playwright/test';\nexport default defineConfig({\n` +
    `  testDir: ${JSON.stringify(testsDir)}, retries: ${Math.max(0, Math.min(2, Number(reruns) - 1 || 0))}, workers: 1, reporter: 'json', globalTimeout: 180000,\n` +
    `  outputDir: '${join(dir, "out")}',\n` +
    `  use: { screenshot: 'only-on-failure'${baseURL ? `, baseURL: ${JSON.stringify(baseURL)}` : ""} },\n});\n`, "utf8");

  let lastStderr = "";
  const runOnce = async (grep) => {
    const args = [
      "playwright", "test", "--config", join(dir, "playwright.config.ts"),
      ...(updateSnapshots ? ["--update-snapshots"] : []),
      ...(grep ? ["--grep", grep] : []),
    ];
    const res = await promisify(execFile)("npx", args, { cwd: APP_DIR, env: CHILD_ENV, encoding: "utf8", timeout: 200000, maxBuffer: 64 * 1024 * 1024 }).catch(e => e);
    lastStderr = res.stderr ?? "";
    // The json reporter writes the report to stdout; isolate the JSON object.
    const out = res.stdout ?? "";
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try { return JSON.parse(out.slice(start, end + 1)); } catch { return null; }
  };
  const collect = (report) => {
    const out = [];
    const walk = (s, f) => {
      const file = s.file ?? f;
      for (const spec of s.specs ?? []) {
        const r = spec.tests?.[0]?.results?.[0];
        const attempts = (spec.tests ?? []).flatMap(t => (t.results ?? []).map(x => x.status === "passed"));
        const ok = attempts.length > 0 && attempts.every(Boolean);
        const shot = (r?.attachments ?? []).find((a) => a.name === "screenshot" && a.path);
        out.push({
          file, title: spec.title, ok: !!ok, attempts,
          durationMs: r?.duration ?? 0,
          error: ok ? null : (r?.error?.message ?? r?.errors?.[0]?.message ?? "failed").replace(/\[[0-9;]*m/g, "").slice(0, 600),
          screenshot: shot?.path && existsSync(shot.path) ? readFileSync(shot.path).toString("base64") : null,
        });
      }
      for (const c of s.suites ?? []) walk(c, file);
    };
    for (const s of report?.suites ?? []) walk(s, s.file);
    return out;
  };

  try {
  const first = await runOnce();
  if (!first) throw new Error("playwright did not produce output: " + lastStderr.slice(0, 400));
  const specs = collect(first);

  const results = [];
  for (const s of specs) {
    const attempts = s.attempts.length ? s.attempts : [false];
    const passed = attempts.filter(Boolean).length;
    const status = passed === attempts.length ? "passed" : passed === 0 ? "failed" : "flaky";
    results.push({ name: s.title, spec_path: s.file, status, attempts, durationMs: s.durationMs, error: s.error, screenshotBase64: s.screenshot });
  }
  // Return ONE result per submitted file. A passing sibling must never hide a
  // failing/skipped case, a collection error, or an empty test file.
  const grouped = tests.map(t => {
    const rows = results.filter(r => r.spec_path === t.spec_path);
    const allPassed = rows.length > 0 && rows.every(r => r.status === "passed") && !(first.errors?.length);
    const status = allPassed ? "passed" : rows.length && rows.every(r => r.status !== "failed") && !first.errors?.length ? "flaky" : "failed";
    const failure = rows.find(r => r.status !== "passed");
    return { name: t.name, spec_path: t.spec_path, status,
      attempts: status === "passed" ? [true] : status === "flaky" ? [false, true] : [false],
      durationMs: rows.reduce((sum, r) => sum + r.durationMs, 0),
      error: allPassed ? null : failure?.error || first.errors?.[0]?.message || "No passing executable tests were collected.",
      screenshotBase64: failure?.screenshotBase64 ?? null, cases: rows };
  });
  return grouped;
  } finally {
    // Always remove this tenant's specs, traces and screenshots from disk.
    rmSync(dir, { recursive: true, force: true });
  }
}

function readJson(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
  });
}

async function callback(url, token, payload) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("callback failed", e?.message);
  }
}

async function explore({ url, explorationId, callbackUrl, callbackToken }) {
  let browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    if (!response || !response.ok()) throw new Error(`Target returned HTTP ${response?.status() ?? "no response"}`);
    await callback(callbackUrl, callbackToken, {
      explorationId, label: `Opened ${url}`, status: "passed",
      screenshotBase64: (await page.screenshot()).toString("base64"),
    });

    const title = await page.title();
    await callback(callbackUrl, callbackToken, { explorationId, label: `Page loaded — “${title}”`, status: "passed" });

    const btn = page.getByRole("button").first();
    if (await btn.count().catch(() => 0)) {
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await callback(callbackUrl, callbackToken, {
        explorationId, label: "Found a primary action on the page", status: "passed",
        screenshotBase64: (await page.screenshot()).toString("base64"),
      });
    }

    await callback(callbackUrl, callbackToken, {
      explorationId, label: "Captured full page", status: "passed",
      screenshotBase64: (await page.screenshot({ fullPage: true })).toString("base64"),
    });

    await callback(callbackUrl, callbackToken, { explorationId, final: true, status: "passed" });
  } catch (err) {
    await callback(callbackUrl, callbackToken, { explorationId, final: true, status: "error", error: err?.message ?? "run failed" });
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Load a URL in a REAL browser and return the fully-rendered HTML (post-JS), so
 * generation grounds on the actual DOM — including client-rendered (SPA) content
 * that a static HTTP fetch never sees. The web app runs its own extractor on this.
 */
export async function renderContext({ url, credentials }) {
  let browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    if (!response || !response.ok()) throw new Error(`Target returned HTTP ${response?.status() ?? "no response"}`);
    // Let client-rendered content settle so SPA elements are in the DOM.
    await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => {});
    await page.waitForTimeout(600);

    // page.content() includes hidden login/app shells and modal templates. Remove
    // elements that are not currently rendered so generation sees the same DOM
    // a user can actually interact with, not dormant markup.
    const visibleHtml = () => page.evaluate(() => {
      const clone = document.documentElement.cloneNode(true);
      const source = [...document.querySelectorAll("body *")];
      const copied = [...clone.querySelectorAll("body *")];
      for (let i = source.length - 1; i >= 0; i--) {
        const el = source[i];
        const style = getComputedStyle(el);
        const hidden = el.hasAttribute("hidden") || style.display === "none" || style.visibility === "hidden" || el.getClientRects().length === 0;
        if (hidden) copied[i]?.remove();
      }
      return clone.outerHTML;
    });
    const entryHtml = await visibleHtml();

    let authAttempted = false;
    let authSucceeded = false;
    if (credentials?.username || credentials?.password) {
      const password = page.locator('input[type="password"]').first();
      if (await password.isVisible().catch(() => false)) {
        authAttempted = true;
        const matchingForm = page.locator("form").filter({ has: password }).first();
        const container = await matchingForm.count() ? matchingForm : page.locator("body");
        const username = page.locator([
          'input[type="email"]',
          'input[autocomplete="username"]',
          'input[autocomplete="email"]',
          'input[name*="email" i]',
          'input[name*="user" i]',
        ].join(", ")).first();
        const fallbackUsername = container.locator(
          'input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])',
        ).first();
        const userField = await username.isVisible().catch(() => false) ? username : fallbackUsername;
        if (credentials.username && await userField.isVisible().catch(() => false)) {
          await userField.fill(credentials.username);
        }
        if (credentials.password) await password.fill(credentials.password);

        // Prefer the form's explicit submit control. Login forms often expose a
        // second, non-submit "Sign in" tab toggle before the actual submit
        // button; choosing the first matching button can leave the password
        // field visible and falsely report an authentication failure.
        const formSubmit = container.locator('button[type="submit"], input[type="submit"]').first();
        const namedSubmit = container.getByRole("button", { name: /sign in|log in|login|submit|continue/i }).last();
        const genericSubmit = container.locator("button").last();
        const submit = await formSubmit.isVisible().catch(() => false)
          ? formSubmit
          : await namedSubmit.isVisible().catch(() => false)
            ? namedSubmit
            : genericSubmit;
        if (await submit.isVisible().catch(() => false)) await submit.click();
        else await password.press("Enter");
        await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
        await page.waitForTimeout(700);

        const passwordStillVisible = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
        authSucceeded = !passwordStillVisible && !/\/(login|signin|sign-in)(?:[/?#]|$)/i.test(page.url());
      }
    }

    const html = await visibleHtml();
    const title = await page.title().catch(() => "");
    return {
      ok: true,
      html: html.slice(0, 800_000),
      entryHtml: entryHtml.slice(0, 800_000),
      title,
      finalUrl: page.url(),
      authAttempted,
      authSucceeded,
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}

const server = createServer(async (req, res) => {
  if (req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true}'); return; }
  if (req.method !== "POST" || !["/explore", "/run", "/context"].includes(req.url)) { res.writeHead(404).end(); return; }

  if (!TOKEN || req.headers["authorization"] !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "content-type": "application/json" }); res.end('{"error":"unauthorized"}'); return;
  }
  const body = await readJson(req);
  try {
    await assertPublicTarget(body?.url);
    await assertPublicTarget(body?.baseURL);
  } catch (err) {
    res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: err.message })); return;
  }
  if (activeJobs >= MAX_JOBS) {
    res.writeHead(503, { "content-type": "application/json", "retry-after": "5" }); res.end('{"error":"busy"}'); return;
  }
  activeJobs++;
  let released = false;
  const release = () => { if (!released) { released = true; activeJobs--; } };
  res.on("close", () => { if (req.url !== "/explore") release(); });

  if (req.url === "/explore") {
    if (!body?.url || !body?.explorationId || !body?.callbackUrl || !body?.callbackToken) {
      res.writeHead(400, { "content-type": "application/json" }); res.end('{"error":"bad request"}'); return;
    }
    res.writeHead(202, { "content-type": "application/json" });
    res.end('{"accepted":true}');
    explore(body).finally(release);
    return;
  }

  // /context — render the page in a real browser, return the post-JS HTML.
  if (req.url === "/context") {
    if (!body?.url) { res.writeHead(400, { "content-type": "application/json" }); res.end('{"error":"url required"}'); return; }
    try {
      const out = await renderContext({ url: body.url, credentials: body.credentials });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err?.message ?? "render failed" }));
    }
    return;
  }

  // /run — execute real specs synchronously and return results.
  if (!Array.isArray(body?.tests) || body.tests.length === 0) {
    res.writeHead(400, { "content-type": "application/json" }); res.end('{"error":"tests[] required"}'); return;
  }
  try {
    const results = await runTests({
      tests: body.tests,
      baseURL: body.baseURL,
      reruns: body.reruns ?? 2,
      updateSnapshots: body.updateSnapshots === true,
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, results }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: err?.message ?? "run failed" }));
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, () => console.log(`verity runner on :${PORT}`));
}
