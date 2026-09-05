import {createServer} from 'node:http';
export const fixture = createServer((req,res)=>{
  const url = new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/schema') {
    res.setHeader('content-type','application/json');
    const schema = {type:'object',required:['count'],properties:{count:{type:'integer',enum:[0]}}};
    const operation = {responses:{'200':{description:'Counter',content:{'application/json':{schema}}}}};
    res.end(JSON.stringify({openapi:'3.0.3',info:{title:'Verity audit API',version:'1.0'},paths:{'/api/count':{get:operation}}})); return;
  }
  if(url.pathname.endsWith('/api/count')) {
    res.setHeader('content-type','application/json');
    if(req.method!=='GET') {res.statusCode=405;res.setHeader('Allow','GET');res.end('{}');return;}
    res.end(JSON.stringify({count:url.pathname.startsWith('/broken')?'invalid':0})); return;
  }
  if(url.pathname==='/agent') {res.setHeader('content-type','application/json');res.end('{"reply":"The answer is 4."}');return;}
  res.setHeader('content-type','text/html');
  res.end('<!doctype html><html lang="en"><title>Audit counter</title><main><h1>Counter</h1><p role="status">Count: 0</p><button onclick="document.querySelector(\'[role=status]\').textContent=\'Count: 1\'">Increment</button></main></html>');
});
fixture.listen(18082,'127.0.0.1',()=>console.log('Audit fixture ready on 127.0.0.1:18082'));
