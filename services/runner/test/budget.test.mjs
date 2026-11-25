import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

test('tests cut off by the run budget are reported as not run, not failed', async () => {
  process.env.RUNNER_SUITE_BUDGET_MS = '30000';
  process.env.RUNNER_WORKERS = '1';
  process.env.RUNNER_ALLOW_PRIVATE_TARGETS = '1';
  const { runTests } = await import('../src/index.mjs?budget');
  const srv = createServer((_, r) => r.end('<h1>hi</h1>')).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const slow = (p) => ({ name: p, spec_path: p, spec_content: `import {test} from '@playwright/test'; test('slow', async ({page}) => { await page.goto('/'); await page.waitForTimeout(20000); });` });
  try {
    const res = await runTests({ baseURL: base, reruns: 1, tests: [slow('tests/a.spec.ts'), slow('tests/b.spec.ts'), slow('tests/c.spec.ts')] });
    const statuses = res.map((r) => r.status);
    assert.ok(statuses.includes('notrun'), `expected a not-run test, got ${statuses}`);
    for (const r of res.filter((x) => x.status === 'notrun')) assert.match(r.error, /time limit/);
  } finally { srv.close(); }
});
