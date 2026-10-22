import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {requestJson} from './worker-request.mjs';

async function withServer(handler,run){
 const server=createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await run(`http://127.0.0.1:${server.address().port}`)}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}

test('research can wait for delayed headers and send authenticated JSON',async()=>{
 await withServer((request,response)=>{
  let content='';request.setEncoding('utf8');request.on('data',chunk=>content+=chunk);
  request.on('end',()=>setTimeout(()=>{
   response.setHeader('content-type','application/json');
   response.end(JSON.stringify({authenticated:request.headers['x-worker-key']==='test-key',body:JSON.parse(content)}));
  },75));
 },async url=>{
  const result=await requestJson(url,{method:'POST',headers:{'x-worker-key':'test-key'},body:{trigger:'scheduled'},timeout:1000});
  assert.deepEqual(result,{authenticated:true,body:{trigger:'scheduled'}});
 });
});

test('a stalled worker request respects its explicit wall-clock timeout',async()=>{
 await withServer(()=>{},async url=>{
  await assert.rejects(requestJson(url,{timeout:30}),error=>error.name==='AbortError');
 });
});

test('API errors remain visible in worker logs',async()=>{
 await withServer((request,response)=>{response.writeHead(409,{'content-type':'application/json'});response.end(JSON.stringify({error:'Recherche läuft bereits'}))},async url=>{
  await assert.rejects(requestJson(url),/Recherche läuft bereits/);
 });
});
