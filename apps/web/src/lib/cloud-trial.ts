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
  const host = u.hostname.toLowerCase();
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
 * Lightweight performance smoke: fire a small number of requests at the target
 * with limited concurrency and compute latency percentiles + error rate. This is
 * a *taste* of the load test — never represented as a full load test.
 */
export async function runPerfTrial(url: string, opts?: { total?: number; concurrency?: number }): Promise<PerfReport> {
  const total = Math.min(opts?.total ?? 30, 40);
  const concurrency = Math.min(opts?.concurrency ?? 5, 8);
  const latencies: number[] = [];
  let errors = 0;

  let i = 0;
  async function worker() {
    while (i < total) {
      i++;
      const start = performance.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "follow" });
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
  return { engine: "k6", tier: "fast", profile: "smoke", aggregate };
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
    res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
  } catch {
    return [{ engine: "zap", ruleId: "unreachable", title: "Target unreachable", severity: "info", message: "Could not connect to the URL within 10s.", url }];
  }
  const finalUrl = res.url || url;
  if (finalUrl.startsWith("http://")) {
    findings.push({ engine: "zap", ruleId: "no-https", title: "Served over plaintext HTTP", severity: "high", message: "Traffic is not encrypted; serve over HTTPS.", url: finalUrl, cwe: "CWE-319" });
  }
  for (const c of HEADER_CHECKS) {
    if (!res.headers.get(c.header)) {
      findings.push({ engine: "zap", ruleId: c.header, title: c.title, severity: c.severity, message: c.advice, url: finalUrl });
    }
  }
  const server = res.headers.get("server");
  if (server && /\d/.test(server)) {
    findings.push({ engine: "zap", ruleId: "server-banner", title: "Server version disclosed", severity: "low", message: `The Server header reveals "${server}" — consider hiding the version.`, url: finalUrl, cwe: "CWE-200" });
  }
  if (findings.length === 0) {
    findings.push({ engine: "zap", ruleId: "clean", title: "No baseline header issues found", severity: "info", message: "Common security headers are present. Run the full scan in CI for deeper coverage.", url: finalUrl });
  }
  return findings;
}
