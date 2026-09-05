/** Opt-in integration audit: uses the configured LLM and a real local browser. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { generateTest, generateApiTest, generateAgentEval } from '../src/lib/llm/generate';

async function main() {
  const root = process.cwd();
  let broken = false;
  const fixture = createServer((req,res)=> {
    if (req.url === '/api/count') { res.setHeader('content-type','application/json'); res.end(JSON.stringify({count:broken?99:0})); return; }
    if (req.url === '/agent') { res.setHeader('content-type','application/json'); res.end(JSON.stringify({reply:broken?'The answer is 9.':'The answer is 4.'})); return; }
    res.setHeader('content-type','text/html');
    res.end(`<title>Verity audit fixture</title><h1>Counter</h1><p role="status">Count: 0</p><button onclick="document.querySelector('[role=status]').textContent='Count: ${broken?99:1}'">Increment</button>`);
  });
  fixture.listen(0,'127.0.0.1'); await once(fixture,'listening');
  const target = `http://127.0.0.1:${(fixture.address() as {port:number}).port}`;
  process.env.RUNNER_SERVICE_URL = 'http://127.0.0.1:18081';
  process.env.RUNNER_SERVICE_TOKEN = 'local-audit-only';
  const runner = spawn(process.execPath,['src/index.mjs'], {cwd:resolve(root,'services/runner'),env:{...process.env,PORT:'18081'},stdio:['ignore','pipe','inherit']});
  await once(runner.stdout!,'data');
  try {
    const ui = await generateTest({input:'Click Increment and assert the status reads Count: 1.',isUrl:false,baseUrl:target});
    assert.equal(ui.usedLiveContext,true);
    const schema = {type:'object',required:['count'],properties:{count:{type:'integer',enum:[0]}}};
    const operation = {responses:{'200':{description:'Count',content:{'application/json':{schema}}}}};
    const api = await generateApiTest({description:'GET /api/count returns status 200 and JSON count equal to 0.',baseUrl:target,spec:JSON.stringify({openapi:'3.0.0',info:{title:'Counter',version:'1'},paths:{'/api/count':{get:operation}}})});
    const agent = await generateAgentEval({description:'POST JSON {prompt:"What is 2+2?"}. The endpoint returns JSON with a reply string. Assert HTTP 200 and reply exactly "The answer is 4.". No authentication.',endpoint:`${target}/agent`});
    for(const [name,generated] of [['ui',ui],['api',api],['agent',agent]] as const) {
      for (const fault of [false,true]) {
      broken = fault;
      const response: Response = await fetch(`${process.env.RUNNER_SERVICE_URL}/run`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer local-audit-only'},body:JSON.stringify({tests:[{name,spec_path:`tests/${name}.spec.ts`,spec_content:generated.specContent}],reruns:1})});
      const result: {results?: {status:string;error?:string}[]} = await response.json();
      console.log(JSON.stringify({type:name,brokenTarget:fault,usedLiveContext:generated.usedLiveContext,plan:generated.plan,status:result.results?.[0]?.status,error:result.results?.[0]?.error},null,2));
      assert.equal(result.results?.[0]?.status,fault?'failed':'passed');
      }
    }
  } finally { runner.kill(); fixture.close(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
