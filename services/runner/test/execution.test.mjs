import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { renderContext, runTests } from '../src/index.mjs';

const spec = (path, code) => ({name:path, spec_path:path, spec_content:`import {test,expect} from '@playwright/test'; ${code}`});

test('real execution: mixed outcomes, duplicate basenames, skip, empty and browser interaction', async () => {
  const results = await runTests({reruns:1, tests:[
    spec('tests/ui/same.spec.ts', "test('bad',()=>expect(1).toBe(2)); test('good',()=>expect(1).toBe(1));"),
    spec('tests/api/same.spec.ts', "test('good',()=>expect(1).toBe(1));"),
    spec('tests/skip.spec.ts', "test.skip('skipped',()=>expect(1).toBe(1));"),
    spec('tests/empty.spec.ts', ''),
    spec('tests/browser.spec.ts', `test('click changes real DOM',async({page})=>{
      await page.setContent(${JSON.stringify('<button onclick="this.textContent=\'Done\'">Run</button>')});
      await page.getByRole('button',{name:'Run',exact:true}).click();
      await expect(page.getByRole('button',{name:'Done',exact:true})).toBeVisible();
    });`),
  ]});
  assert.deepEqual(results.map(r=>[r.spec_path,r.status]), [
    ['tests/ui/same.spec.ts','failed'], ['tests/api/same.spec.ts','passed'],
    ['tests/skip.spec.ts','failed'], ['tests/empty.spec.ts','failed'], ['tests/browser.spec.ts','passed'],
  ]);
  assert.equal(results[0].cases.length,2);
});

test('collection errors and invalid paths cannot produce passes', async () => {
  const results = await runTests({reruns:1,tests:[spec('tests/broken.spec.ts','throw new Error("collection failure");')]});
  assert.equal(results[0].status,'failed');
  await assert.rejects(runTests({tests:[spec('../escape.spec.ts','')]}),/relative/);
  await assert.rejects(runTests({tests:[spec('same.spec.ts',''),spec('same.spec.ts','')]}),/unique/);
});

test('new snapshot creation is not accepted as cloud verification', async()=> {
  await assert.rejects(runTests({tests:[spec('visual.spec.ts','')],updateSnapshots:true}),/baselines/);
});

test('context auth submits the form, not a same-named tab toggle', async () => {
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(`<!doctype html><form>
      <button type="button">Sign in</button>
      <input type="email" aria-label="Email">
      <input type="password" aria-label="Password">
      <button type="submit" onclick="event.preventDefault(); this.form.querySelector('input[type=password]').remove(); history.pushState({}, '', '/dashboard')">Sign in</button>
    </form>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const out = await renderContext({
      url: `http://127.0.0.1:${port}/login`,
      credentials: { username: 'user@example.com', password: 'secret' },
    });
    assert.equal(out.authAttempted, true);
    assert.equal(out.authSucceeded, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
