/**
 * Capped cloud "trials" for the heavier disciplines, so a prospect can get the
 * feel against a PUBLIC URL before wiring CI. These are intentionally tiny and
 * self-contained (plain fetch — no external tool, no Fly) so they cost us almost
 * nothing and stay inside the serverless time budget. The real, full-power runs
 * happen unlimited in the customer's own CI.
 */
import type { Finding, PerfMetrics, PerfReport, Severity } from "@qashift/verity-core";

/** Only allow public http(s) targets — never localhost/private ranges (SSRF guard). */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  // IPv6 targets require full address classification; fail closed for this
  // lightweight trial rather than accepting loopback/mapped-private addresses.
  if (host.includes(":")) return false;
  if (host === "localhost" || host.endsWith(".local")) return false;
  // Block obvious private / loopback / metadata hosts.
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === "::1" || host === "metadata.google.internal") return false;
  return true;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

/**
 * Fetch without allowing an unvalidated redirect to become an SSRF hop. Every
 * Location target is checked before the next request; non-public redirects are
 * rejected and a redirect loop cannot consume the serverless budget.
 */
async function fetchPublic(raw: string, timeoutMs: number): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop < 5; hop++) {
    if (!isPublicHttpUrl(current)) throw new Error("Target or redirect is not a public http(s) URL.");
    const res = await fetch(current, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(res.status)) return res;
    const location = res.headers.get("location");
    if (!location) return res;
    current = new URL(location, current).toString();
  }
  throw new Error("Target redirected too many times; no scan was completed.");
}

/**
 * Lightweight performance smoke: fire a small number of requests at the target
 * with limited concurrency and compute latency percentiles + error rate. This is
 * a *taste* of the load test — never represented as a full load test.
 */
export async function runPerfTrial(url: string, opts?: { total?: number; concurrency?: number }): Promise<PerfReport> {
  const total = Math.max(1, Math.min(Math.trunc(opts?.total ?? 30), 40));
  const concurrency = Math.max(1, Math.min(Math.trunc(opts?.concurrency ?? 5), 8));
  const latencies: number[] = [];
  let errors = 0;

  let i = 0;
  async function worker() {
    while (i < total) {
      i++;
      const start = performance.now();
      try {
        const res = await fetchPublic(url, 8000);
        await res.arrayBuffer();
        const ms = performance.now() - start;
        if (res.status >= 400) errors++; else latencies.push(ms);
      } catch {
        errors++;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const sorted = [...latencies].sort((a, b) => a - b);
  const aggregate: PerfMetrics = {
    requests: total,
    errors,
    errorRate: total > 0 ? errors / total : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted.length ? Math.round(sorted[0]) : null,
    max: sorted.length ? Math.round(sorted[sorted.length - 1]) : null,
  };
  return { engine: "http-smoke", tier: "fast", profile: "smoke", aggregate };
}

interface HeaderCheck { header: string; title: string; severity: Severity; advice: string }
const HEADER_CHECKS: HeaderCheck[] = [
  { header: "content-security-policy", title: "Content Security Policy not set", severity: "medium", advice: "Add a Content-Security-Policy header to mitigate XSS and injection." },
  { header: "strict-transport-security", title: "HSTS not set", severity: "medium", advice: "Add Strict-Transport-Security so browsers force HTTPS." },
  { header: "x-frame-options", title: "Anti-clickjacking header missing", severity: "low", advice: "Set X-Frame-Options (or CSP frame-ancestors) to prevent clickjacking." },
  { header: "x-content-type-options", title: "MIME-sniffing protection missing", severity: "low", advice: "Set X-Content-Type-Options: nosniff." },
  { header: "referrer-policy", title: "Referrer-Policy not set", severity: "info", advice: "Set Referrer-Policy to control referrer leakage." },
];

/**
 * Lightweight security smoke: fetch the target and report missing security
 * headers + plaintext-HTTP exposure as severity-ranked findings. A taste of the
 * dynamic scan — the full active scan runs in CI.
 */
export async function runSecurityTrial(url: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let res: Response;
  try {
    res = await fetchPublic(url, 10000);
  } catch {
    throw new Error("Security header check could not reach the target. No scan was completed.");
  }
  if (!res.ok) throw new Error(`Security header check received HTTP ${res.status}; target inspection did not complete.`);
  const finalUrl = res.url || url;
  if (finalUrl.startsWith("http://")) {
    findings.push({ engine: "header-check", ruleId: "no-https", title: "Served over plaintext HTTP", severity: "high", message: "Traffic is not encrypted; serve over HTTPS.", url: finalUrl, cwe: "CWE-319" });
  }
  for (const c of HEADER_CHECKS) {
    if (c.header === "x-frame-options" && /(?:^|;)\s*frame-ancestors\s/i.test(res.headers.get("content-security-policy") ?? "")) continue;
    if (!res.headers.get(c.header)) {
      findings.push({ engine: "header-check", ruleId: c.header, title: c.title, severity: c.severity, message: c.advice, url: finalUrl });
    }
  }
  const server = res.headers.get("server");
  if (server && /\d/.test(server)) {
    findings.push({ engine: "header-check", ruleId: "server-banner", title: "Server version disclosed", severity: "low", message: `The Server header reveals "${server}" — consider hiding the version.`, url: finalUrl, cwe: "CWE-200" });
  }
  return findings;
}
