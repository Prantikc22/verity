import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter for the public AI test-generation try-it endpoint. Calling the
 * LLM is a cost center, so the anonymous entry point is bounded per client IP.
 * No-op (always allow) if Upstash isn't configured, so local dev doesn't break.
 */
let limiter: Ratelimit | null = null;

function getLimiter(): Ratelimit | null {
  if (limiter) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "verity:test-gen:v1",
    analytics: true,
  });
  return limiter;
}

export interface RateResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export async function checkTestGenRate(ip: string): Promise<RateResult> {
  const l = getLimiter();
  if (!l) return { success: true, remaining: 999, reset: 0 };
  try {
    const { success, remaining, reset } = await l.limit(ip);
    return { success, remaining, reset };
  } catch {
    // FAIL CLOSED: this guards the anonymous LLM entry point (a pure cost
    // center). If the limiter store dies (e.g. an idle Upstash DB gets
    // auto-deleted — it happened to Clearpath), unlimited free generation is
    // worse than the endpoint pausing. Authed, capped generation is unaffected.
    return { success: false, remaining: 0, reset: Date.now() + 600_000 };
  }
}

/**
 * Generic per-name sliding-window limiter, reused by the public status endpoint
 * and the org-member mutation routes. No-op when Upstash isn't configured (dev).
 */
const limiters = new Map<string, Ratelimit>();
function namedLimiter(name: string, max: number, window: `${number} ${"s" | "m" | "h"}`): Ratelimit | null {
  const cached = limiters.get(name);
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const l = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: `verity:${name}:v1`,
    analytics: true,
  });
  limiters.set(name, l);
  return l;
}

export async function checkRate(
  name: string,
  ip: string,
  opts: { max: number; window: `${number} ${"s" | "m" | "h"}` },
): Promise<RateResult> {
  const l = namedLimiter(name, opts.max, opts.window);
  if (!l) return { success: true, remaining: 999, reset: 0 };
  try {
    const { success, remaining, reset } = await l.limit(ip);
    return { success, remaining, reset };
  } catch {
    // Fail open: these guard cheap endpoints (status, member mutations) — a
    // limiter outage must not take them down.
    return { success: true, remaining: 1, reset: 0 };
  }
}

/** Pull a best-effort client IP from a Next request's headers. */
export function clientIp(req: { headers: Headers }): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "0.0.0.0").trim();
}
