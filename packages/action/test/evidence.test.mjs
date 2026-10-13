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
