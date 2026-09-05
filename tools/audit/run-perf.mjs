import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync} from 'node:fs';
const binary='/tmp/verity-audit-tools/k6-v0.54.0-macos-arm64/k6';
await Promise.all(['smoke','load','stress','spike','soak','breakpoint'].map(async profile=>{
  const path=`test-results/audit/k6-${profile}.json`;
  const result=await promisify(execFile)(binary,['run','--quiet','--address','127.0.0.1:0','-e',`PROFILE=${profile}`,'-e',`K6_SUMMARY=${path}`,'-e','SOAK_DURATION=3s','test-results/audit/generated.k6.js'],{timeout:360000,maxBuffer:16*1024*1024}).catch(e=>e);
  const report=JSON.parse(readFileSync(path,'utf8'));
  console.log(JSON.stringify({profile,exitCode:result.code??0,requests:report.metrics.http_reqs?.values.count,checks:report.metrics.checks?.values,thresholds:Object.fromEntries(Object.entries(report.metrics).filter(([,m])=>m.thresholds).map(([k,m])=>[k,m.thresholds]))}));
}));
