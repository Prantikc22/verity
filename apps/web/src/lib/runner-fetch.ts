/**
 * fetch() for the browser runner, with queueing. Each runner machine takes a
 * fixed number of jobs (RUNNER_MAX_JOBS) and answers 503 + Retry-After when
 * full. Instead of failing the user, wait our turn: honour Retry-After (with
 * jitter so waiting requests don't stampede) until `maxWaitMs`, then give up
 * and return the last 503 so the caller can show a clear "busy" message.
 */
export async function runnerFetch(
  url: string,
  init: RequestInit & { attemptTimeoutMs?: number },
  { maxWaitMs = 90_000 }: { maxWaitMs?: number } = {},
): Promise<Response> {
  const { attemptTimeoutMs, ...rest } = init;
  const started = Date.now();
  for (;;) {
    const res = await fetch(url, { ...rest, signal: attemptTimeoutMs ? AbortSignal.timeout(attemptTimeoutMs) : rest.signal });
    if (res.status !== 503) return res;
    const retryAfter = Math.min(15, Math.max(1, Number(res.headers.get("retry-after")) || 5));
    const wait = retryAfter * 1000 * (0.75 + Math.random() * 0.5);
    if (Date.now() - started + wait > maxWaitMs) return res;
    await res.body?.cancel().catch(() => {});
    await new Promise((r) => setTimeout(r, wait));
  }
}

/** Plain-English message when the runner stayed busy for the whole wait. */
export const RUNNER_BUSY = "Our test browsers are all busy right now. Try again in a minute; runs in your own CI aren't affected.";
