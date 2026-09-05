import {createServerClient} from '@supabase/ssr';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin='https://verity.qashifthq.com';
const project='c6030324-6fd9-4fa9-b274-f5fd2cc3507b';
async function main(){
  const cookies=new Map<string,string>();
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>cookies.set(c.name,c.value))}});
  const {error}=await client.auth.signInWithPassword({email:process.env.VERITY_AUDIT_EMAIL!,password:process.env.VERITY_AUDIT_PASSWORD!});
  if(error)throw error;
  const evidence:unknown[]=[];
  async function post(path:string,body:unknown){
    const response=await fetch(`${origin}/api/projects/${project}/${path}`,{method:'POST',headers:{'content-type':'application/json',cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')},body:JSON.stringify(body),signal:AbortSignal.timeout(290000)});
    const text=await response.text();
    const result=response.headers.get('content-type')?.includes('ndjson')?text.trim().split('\n').map(s=>JSON.parse(s)):JSON.parse(text);
    if(!response.ok)throw new Error(`${path}: ${response.status} ${result.error}`);
    return result;
  }
  const generated=await post('tests',{url:`${origin}/login`,description:'Sign in with the supplied credentials. Verify the Overview heading is visible on the dashboard.',username:process.env.VERITY_AUDIT_EMAIL,password:process.env.VERITY_AUDIT_PASSWORD,needsAuth:true,name:`Audit authenticated UI ${Date.now()}`,suite:'Final audit'});
  console.log(JSON.stringify({phase:'ui-generated',id:generated.test?.id,usedLiveContext:generated.used_live_context}));
  const uiRun=await post('run-tests',{testIds:[generated.test.id],kind:'ui',heal:false});
  evidence.push({type:'ui',testId:generated.test.id,usedLiveContext:generated.used_live_context,run:uiRun});
  console.log(JSON.stringify(uiRun));
  const api=await post('api-tests',{baseUrl:origin,description:'GET /api/status returns HTTP 200. JSON contains an array named systems, with entries containing string key and status properties. Assert the runner key is present. Do not assert overall health is always operational.',name:`Audit status API ${Date.now()}`,suite:'Final audit'});
  const apiRun=await post('run-tests',{testIds:[api.test.id],kind:'api',heal:false});
  evidence.push({type:'api',testId:api.test.id,run:apiRun});
  console.log(JSON.stringify(apiRun));
  mkdirSync('test-results/audit',{recursive:true});
  writeFileSync('test-results/audit/production.json',JSON.stringify(evidence,null,2));
  const failed=evidence.some((e:any)=>!e.run.some((event:any)=>event.type==='done'&&event.summary.failed===0&&event.summary.passed>0));
  if(failed)throw new Error('A production execution failed; inspect audit evidence.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
