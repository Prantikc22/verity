import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

for(const engine of ['visual','agent','contract','k6','perf','lighthouse','security-sast','security-dast']) {
  test(`${engine}: empty report is rejected before ingestion`,()=>{
    const dir = mkdtempSync(join(tmpdir(),'verity-evidence-'));
    try {
      const path = join(dir,'report');
      writeFileSync(path,['visual','agent','contract'].includes(engine)?'<testsuite tests="0"></testsuite>':'{}');
      const result = spawnSync(process.execPath,[resolve('packages/action/verity-engines.mjs'),engine,'--report',path],{
        env:{...process.env,VERITY_INGEST_TOKEN:'test-only',VERITY_API_URL:'http://127.0.0.1:1'},encoding:'utf8',timeout:5000,
      });
      assert.notEqual(result.status,0);
      assert.doesNotMatch(result.stderr,/fetch failed/);
      assert.match(result.stderr,/No executed|No requests|did not complete|scan failed|inspected no sites/);
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
}

test('agent: an eval suite where the endpoint never replied is rejected before ingestion',()=>{
  const dir = mkdtempSync(join(tmpdir(),'verity-evidence-'));
  try {
    const path = join(dir,'suite.json');
    const row = {success:false,failureReason:2,error:'HTTP call failed with status 401 Unauthorized',testCase:{description:'case'},response:null};
    writeFileSync(path,JSON.stringify({results:{results:[row,{...row,testCase:{description:'other'}}]}}));
    const result = spawnSync(process.execPath,[resolve('packages/action/verity-engines.mjs'),'agent','--report',path],{
      env:{...process.env,VERITY_INGEST_TOKEN:'test-only',VERITY_API_URL:'http://127.0.0.1:1'},encoding:'utf8',timeout:5000,
    });
    assert.notEqual(result.status,0);
    assert.doesNotMatch(result.stderr,/fetch failed/);
    assert.match(result.stderr,/no usable reply/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

/** Run an engine against a canned report, posting to a local capture server. */
async function runCaptured(engine, reportName, report, extraArgs = []) {
  const {createServer} = await import('node:http');
  const {spawn} = await import('node:child_process');
  const bodies = [];
  const server = createServer((req, res) => {
    let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
      bodies.push(JSON.parse(b));
      res.writeHead(200, {'content-type': 'application/json'}); res.end('{"run_id":"t"}');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const dir = mkdtempSync(join(tmpdir(), 'verity-evidence-'));
  try {
    const path = join(dir, reportName);
    writeFileSync(path, report);
    const child = spawn(process.execPath, [resolve('packages/action/verity-engines.mjs'), engine, '--report', path, ...extraArgs], {
      env: {...process.env, VERITY_INGEST_TOKEN: 'test-only', VERITY_API_URL: `http://127.0.0.1:${server.address().port}`},
    });
    let stderr = '', stdout = '';
    child.stderr.on('data', (d) => (stderr += d)); child.stdout.on('data', (d) => (stdout += d));
    const status = await new Promise((r) => child.on('close', r));
    return {status, stderr, stdout, body: bodies[0]};
  } finally { server.close(); rmSync(dir, {recursive: true, force: true}); }
}

test('security-sast: partial-parse warnings are not a failed scan', async () => {
  const report = {results: [{check_id: 'a.b.rule', path: 'x.js', start: {line: 1}, extra: {severity: 'WARNING', message: 'm'}}],
    errors: [{level: 'warn', type: ['PartialParsing', []], message: 'Syntax error at line action.yml:98'}], paths: {scanned: ['x.js', 'action.yml']}};
  const r = await runCaptured('security-sast', 'sast.json', JSON.stringify(report));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.body.discipline, 'security');
  assert.equal(r.body.findings.length, 1);
});

test('security-sast: a fatal scanner error is still rejected', async () => {
  const report = {results: [], errors: [{level: 'error', type: 'InvalidRuleSchemaError', message: 'bad config'}], paths: {scanned: ['x.js']}};
  const r = await runCaptured('security-sast', 'sast.json', JSON.stringify(report));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Static scan failed.*bad config/);
  assert.equal(r.body, undefined);
});

test('visual: a missing baseline is a first run, not a regression', async () => {
  const xml = `<testsuites><testsuite tests="2"><testcase name="home looks right" classname="visual/home.visual.spec.ts" time="1.2"><failure message="x"><![CDATA[Error: A snapshot doesn't exist at /w/tests/verity/visual/home.visual.spec.ts-snapshots/home-linux.png, writing actual.]]></failure></testcase><testcase name="cart looks right" classname="visual/cart.visual.spec.ts" time="1.0"><failure message="x"><![CDATA[Error: Screenshot comparison failed: 1200 pixels (ratio 0.02 of all image pixels) are different.]]></failure></testcase></testsuite></testsuites>`;
  const r = await runCaptured('visual', 'visual.xml', xml);
  assert.equal(r.status, 0, r.stderr);
  const [home, cart] = r.body.results;
  assert.deepEqual(home.attempts, [true]);
  assert.equal(home.error_message, null);
  assert.deepEqual(cart.attempts, [false]);
  assert.match(cart.error_message, /pixels/);
  assert.match(r.stdout, /1 new visual baseline/);
});

test('contract: the case-id preamble is dropped from the failure headline', async () => {
  const xml = `<testsuites><testsuite tests="1"><testcase name="GET /api/items/{id}" time="0.5"><failure>1. Test Case ID: THyp7C

- Undocumented HTTP status code

    Received: 400</failure></testcase></testsuite></testsuites>`;
  const r = await runCaptured('contract', 'contract.xml', xml);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.body.results[0].error_message, /^- Undocumented HTTP status code/);
  assert.equal(r.body.results[0].endpoint, 'GET /api/items/{id}');
});
