import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublicHttpUrl, runPerfTrial, runSecurityTrial } from "../src/lib/cloud-trial";

test("cloud-trial URL guard rejects private, credential-bearing and non-http targets", () => {
  assert.equal(isPublicHttpUrl("http://127.0.0.1"), false);
  assert.equal(isPublicHttpUrl("http://localhost:3000"), false);
  assert.equal(isPublicHttpUrl("http://user:pass@example.com"), false);
  assert.equal(isPublicHttpUrl("ftp://example.com/file"), false);
  assert.equal(isPublicHttpUrl("https://example.com/path"), true);
});

test("cloud trials do not follow an unvalidated redirect to a private host", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response("", { status: 302, headers: { location: "http://127.0.0.1/internal" } });
  }) as typeof fetch;
  try {
    await assert.rejects(runSecurityTrial("https://example.com/redirect"));
    const perf = await runPerfTrial("https://example.com/redirect", { total: 1, concurrency: 1 });
    assert.equal(perf.aggregate.requests, 1);
    assert.equal(perf.aggregate.errors, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls, ["https://example.com/redirect", "https://example.com/redirect"]);
});
