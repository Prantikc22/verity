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
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const TOKEN = process.env.RUNNER_SERVICE_TOKEN;
const PORT = Number(process.env.PORT ?? 8080);
const APP_DIR = process.cwd();

/**
 * Execute real Playwright specs (with their assertions) and return per-test
 * results + failure screenshots. Reruns failures to classify flaky vs broken.
 */
async function runTests({ tests, baseURL, reruns = 2 }) {
  // Keep the run dir UNDER the app dir so `@playwright/test` resolves from
  // /app/node_modules (module resolution walks up from the spec/config file).
  const dir = join(APP_DIR, ".vrun", `run-${Date.now().toString(36)}`);
  const testsDir = join(dir, "tests");
  mkdirSync(testsDir, { recursive: true });
  for (const t of tests) {
    const file = t.spec_path.split("/").pop() || `${Math.random().toString(36).slice(2)}.spec.ts`;
    writeFileSync(join(testsDir, file), t.spec_content, "utf8");
  }
  writeFileSync(join(dir, "playwright.config.ts"),
    `import { defineConfig } from '@playwright/test';\nexport default defineConfig({\n` +
    `  testDir: '${testsDir}', retries: 0, reporter: 'json',\n` +
    `  outputDir: '${join(dir, "out")}',\n` +
    `  use: { screenshot: 'only-on-failure'${baseURL ? `, baseURL: '${baseURL}'` : ""} },\n});\n`, "utf8");

  let lastStderr = "";
  const runOnce = (grep) => {
    const args = ["playwright", "test", "--config", join(dir, "playwright.config.ts"), ...(grep ? ["--grep", grep] : [])];
    const res = spawnSync("npx", args, { cwd: APP_DIR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
        const ok = spec.tests?.every((t) => t.results?.every((x) => x.status === "passed" || x.status === "expected"));
        const shot = (r?.attachments ?? []).find((a) => a.name === "screenshot" && a.path);
        out.push({
          file, title: spec.title, ok: !!ok,
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

  const first = runOnce();
  if (!first) { rmSync(dir, { recursive: true, force: true }); throw new Error("playwright did not produce output: " + lastStderr.slice(0, 400)); }
  const specs = collect(first);

  const results = [];
  for (const s of specs) {
    const attempts = [s.ok];
    if (!s.ok) for (let i = 1; i < reruns; i++) {
      const r = collect(runOnce(s.title)).find((x) => x.title === s.title);
      attempts.push(r ? r.ok : false);
    }
    const passed = attempts.filter(Boolean).length;
    const status = passed === attempts.length ? "passed" : passed === 0 ? "failed" : "flaky";
    results.push({ name: s.title, spec_path: s.file?.split("/").pop() ? `tests/${s.file.split("/").pop()}` : s.file, status, attempts, durationMs: s.durationMs, error: s.error, screenshotBase64: s.screenshot });
  }
  rmSync(dir, { recursive: true, force: true });
  return results;
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

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
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

const server = createServer(async (req, res) => {
  if (req.url === "/health") { res.writeHead(200, { "content-type": "application/json" }); res.end('{"ok":true}'); return; }
  if (req.method !== "POST" || !["/explore", "/run"].includes(req.url)) { res.writeHead(404).end(); return; }

  if (!TOKEN || req.headers["authorization"] !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "content-type": "application/json" }); res.end('{"error":"unauthorized"}'); return;
  }
  const body = await readJson(req);

  if (req.url === "/explore") {
    if (!body?.url || !body?.explorationId || !body?.callbackUrl || !body?.callbackToken) {
      res.writeHead(400, { "content-type": "application/json" }); res.end('{"error":"bad request"}'); return;
    }
    res.writeHead(202, { "content-type": "application/json" });
    res.end('{"accepted":true}');
    explore(body);
    return;
  }

  // /run — execute real specs synchronously and return results.
  if (!Array.isArray(body?.tests) || body.tests.length === 0) {
    res.writeHead(400, { "content-type": "application/json" }); res.end('{"error":"tests[] required"}'); return;
  }
  try {
    const results = await runTests({ tests: body.tests, baseURL: body.baseURL, reruns: body.reruns ?? 2 });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, results }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: err?.message ?? "run failed" }));
  }
});

server.listen(PORT, () => console.log(`verity runner on :${PORT}`));
