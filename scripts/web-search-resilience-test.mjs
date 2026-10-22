import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const scratch=mkdtempSync(join(process.cwd(),'.search-test-'));
const originalFetch=globalThis.fetch;
try{
 for(const name of ['firecrawl','native-web-search','web-search'])writeFileSync(join(scratch,name+'.cjs'),ts.transpileModule(readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8').replaceAll("from './firecrawl'","from './firecrawl.cjs'").replaceAll("from './native-web-search'","from './native-web-search.cjs'"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText);
 const {searchWebDetailed,WebSearchUnavailableError}=createRequire(import.meta.url)(join(scratch,'web-search.cjs'));
 const engines=['brave','google cse','duckduckgo'];
 let localCalls=0,nativeCalls=0,inFlight=0,maxInFlight=0,mode='partial';
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname==='/config')return Response.json({engines:[...engines.map(name=>({name,enabled:true,categories:['general','web']})),{name:'wikipedia',enabled:true,categories:['general']},{name:'disabled',enabled:false,categories:['general','web']}]});
  if(url.hostname==='api.openai.com'){
   nativeCalls++;assert.equal(JSON.parse(init.body).model,'gpt-4.1-mini');
   if(mode==='native-quota')return Response.json({error:{code:'insufficient_quota',message:'fake-secret-must-not-leak'}},{status:429});
   return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search',sources:[{type:'url',url:'https://company.example/it-job'}]}}]});
  }
  if(url.hostname==='api.firecrawl.dev')return mode==='firecrawl-empty'?Response.json({success:true,data:{web:[]}}):Response.json({error:'unavailable'},{status:503});
  assert.equal(url.hostname,'searxng');assert.equal(url.searchParams.get('engines'),engines.join(','),'explicit engine list excludes non-web and disabled engines');
  localCalls++;inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);await new Promise(resolve=>setTimeout(resolve,15));inFlight--;
  if(mode==='http')return new Response('forbidden',{status:403});
  if(mode==='bad-json')return new Response('not json');
  if(mode==='down'||mode==='native-quota'||mode==='firecrawl-empty')return Response.json({results:[],unresponsive_engines:engines.map(name=>[name,'CAPTCHA'])});
  if(mode==='empty')return Response.json({results:[],unresponsive_engines:[]});
  if(mode==='partial')return Response.json({results:[],unresponsive_engines:[['duckduckgo','CAPTCHA']]});
  return Response.json({results:[{url:'https://company.example/it-job',title:'IT job',content:'<b>Original</b> page'},{url:'https://company.example/it-job'},{url:'http://127.0.0.1/private'}],unresponsive_engines:[['duckduckgo','CAPTCHA']]});
 };
 const ai={provider:'openai',model:'gpt-4.1-mini',openaiKey:'test-key-only',nativeWebSearch:true};
 let result=await searchWebDetailed('','München IT Aufbau',8,{forceRetry:true});
 assert.equal(result.hits.length,0);assert.equal(result.diagnostics.at(-1).status,'degraded','one engine CAPTCHA and no hits is not a total outage');
 mode='empty';result=await searchWebDetailed('','Augsburg IT Aufbau',8,{ai,forceRetry:true});assert.equal(result.diagnostics.at(-1).status,'empty');assert.equal(nativeCalls,0,'healthy empty search must not trigger paid fallback');
 mode='hits';result=await searchWebDetailed('','München IT Aufbau',8,{forceRetry:true});assert.equal(result.hits.length,1,'deduplicate and discard private URLs');assert.equal(result.hits[0].description,'Original page');assert.equal(result.diagnostics.at(-1).status,'degraded');
 mode='down';await assert.rejects(()=>searchWebDetailed('','München IT Aufbau',8,{forceRetry:true}),error=>error instanceof WebSearchUnavailableError&&error.code==='WEB_SEARCH_UNAVAILABLE'&&error.diagnostics[0].engines.length===3&&/CAPTCHA/.test(error.message));
 const before=localCalls;await assert.rejects(()=>searchWebDetailed('','Augsburg IT Aufbau'),WebSearchUnavailableError);assert.equal(localCalls,before,'all-provider outage pauses requests');
 result=await searchWebDetailed('','München IT Aufbau',8,{ai});assert.equal(result.backend,'openai');assert.equal(result.hits[0].url,'https://company.example/it-job');assert.equal(localCalls,before,'native fallback works while local search cools down');
 mode='hits';result=await searchWebDetailed('','Augsburg IT Aufbau',8,{forceRetry:true});assert.equal(result.backend,'searxng');assert.equal(localCalls,before+1,'manual retry bypasses cooldown after repair');
 await Promise.all([searchWebDetailed('','München Cloud Projekt'),searchWebDetailed('','Augsburg Cloud Projekt'),searchWebDetailed('','Landsberg IT Ausschreibung')]);assert.equal(maxInFlight,1,'metasearches are serialized');
 mode='down';const nativeBefore=nativeCalls;await assert.rejects(()=>searchWebDetailed('','München IT Aufbau',8,{forceRetry:true,ai:{...ai,nativeWebSearch:false}}),WebSearchUnavailableError);assert.equal(nativeCalls,nativeBefore,'opt-out prevents paid native fallback');
 mode='native-quota';await assert.rejects(()=>searchWebDetailed('','München IT Aufbau',8,{forceRetry:true,ai}),error=>error.diagnostics.length===2&&/quota_exceeded/.test(error.message)&&!error.message.includes('fake-secret'));
 const failedNative=nativeCalls;await assert.rejects(()=>searchWebDetailed('','Augsburg IT Aufbau',8,{ai}),WebSearchUnavailableError);assert.equal(nativeCalls,failedNative,'native quota errors also cool down');
 mode='firecrawl-empty';result=await searchWebDetailed('empty-firecrawl-test','München IT Aufbau',8,{forceRetry:true});assert.equal(result.backend,'firecrawl');assert.equal(result.hits.length,0);assert.equal(result.diagnostics[0].status,'empty','valid Firecrawl empty survives a subsequent SearXNG outage');
 mode='http';await assert.rejects(()=>searchWebDetailed('','München IT Aufbau',8,{forceRetry:true}),/HTTP 403/);
 mode='bad-json';await assert.rejects(()=>searchWebDetailed('','München IT Aufbau',8,{forceRetry:true}),/gültiges JSON/);
 mode='hits';result=await searchWebDetailed('invalid-firecrawl-test-key','München IT Aufbau',8,{forceRetry:true});assert.equal(result.backend,'searxng');assert.equal(result.diagnostics[0].backend,'firecrawl');assert.equal(result.diagnostics[0].status,'unavailable');
 const regularFetch=globalThis.fetch;let release,started;const startedPromise=new Promise(resolve=>{started=resolve}),gate=new Promise(resolve=>{release=resolve});
 globalThis.fetch=async(input,init)=>{const url=new URL(String(input));if(url.pathname==='/search'&&url.searchParams.get('q')==='Erste Anfrage blockieren'){started();await gate;return Response.json({results:[],unresponsive_engines:engines.map(name=>[name,'CAPTCHA'])})}return regularFetch(input,init)};
 const blocked=assert.rejects(()=>searchWebDetailed('','Erste Anfrage blockieren',8,{forceRetry:true}),WebSearchUnavailableError);await startedPromise;
 const manual=searchWebDetailed('','Manueller erneuter Test',8,{forceRetry:true});mode='hits';release();await blocked;assert.equal((await manual).hits.length,1,'queued manual retry resets backoff after an older in-flight search fails');
 console.log('PASS: partial/empty/full failures, explicit engines, safe results, sequential requests, cooldown/manual recovery, native fallback, opt-out, quota, HTTP/JSON and Firecrawl diagnostics');
}finally{globalThis.fetch=originalFetch;rmSync(scratch,{recursive:true,force:true})}
