import {generateK6Script} from '../../apps/web/src/lib/llm/generate';
import {writeFileSync,mkdirSync} from 'node:fs';
async function main(){
  const schema = await (await fetch('http://127.0.0.1:18082/schema')).text();
  const generated = await generateK6Script({baseUrl:'http://127.0.0.1:18082',spec:schema,instructions:'Only GET /api/count. Assert HTTP 200 and JSON count is 0. Sleep one second between iterations.',defaults:{vus:1,duration:'2s'}});
  mkdirSync('test-results/audit',{recursive:true});
  writeFileSync('test-results/audit/generated.k6.js',generated.specContent);
  console.log(JSON.stringify({plan:generated.plan,path:'test-results/audit/generated.k6.js'}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
