import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(process.cwd(),'.visual-audit-'));
const reports=resolve('../../test-results/audit');
mkdirSync(reports,{recursive:true});
try {
  writeFileSync(join(dir,'playwright.config.ts'),`export default {testDir:'.',workers:1,outputDir:${JSON.stringify(join(reports,'visual-artifacts'))},use:{viewport:{width:800,height:600}}};`);
  writeFileSync(join(dir,'visual.spec.ts'),`import {test,expect} from '@playwright/test'; test('baseline comparison',async({page})=>{
    await page.setContent('<h1>'+ (process.env.AUDIT_CHANGED ? 'Regression' : 'Stable baseline') + '</h1>');
    await expect(page).toHaveScreenshot('audit.png');
  });`);
  for(const phase of ['baseline','stable','changed']){
    const args=['playwright','test','--config',join(dir,'playwright.config.ts'),'--reporter=junit',...(phase==='baseline'?['--update-snapshots']:[])];
    const result=await promisify(execFile)('npx',args,{env:{...process.env,AUDIT_CHANGED:phase==='changed'?'1':'',PLAYWRIGHT_JUNIT_OUTPUT_NAME:join(reports,`visual-${phase}.xml`)},timeout:30000}).catch(e=>e);
    const code=result.code??0;
    console.log(JSON.stringify({phase,exitCode:code}));
    assert.equal(code,phase==='changed'?1:0);
  }
} finally {rmSync(dir,{recursive:true,force:true});}
