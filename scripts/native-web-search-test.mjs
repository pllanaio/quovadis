import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

const scratch=mkdtempSync(join(process.cwd(),'.native-search-test-'));
const previousFetch=globalThis.fetch;
let checks=0;
try{
 for(const name of ['firecrawl','native-web-search']){
  const source=readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),'utf8').replace("from './firecrawl'","from './firecrawl.cjs'");
  writeFileSync(join(scratch,name+'.cjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
 }
 const {nativeSearch,NativeSearchError}=createRequire(import.meta.url)(join(scratch,'native-web-search.cjs'));
 const openai={provider:'openai',model:'gpt-4.1-mini',openaiKey:'fake-secret-do-not-echo'};
 const anthropic={provider:'anthropic',model:'claude-sonnet-4-5',anthropicKey:'fake-anthropic-do-not-echo'};
 const query='München IT Aufbau Originalstellenanzeige';
 let requests=[];
 const mock=(data,status=200,headers={})=>{
  requests=[];
  globalThis.fetch=async(url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});return Response.json(data,{status,headers})};
 };
 const openaiResult=(sources=[])=>({status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search',sources}}]});
 const anthropicResult=(content=[])=>({type:'message',stop_reason:'end_turn',content:[{type:'server_tool_use',id:'search1',name:'web_search',input:{query}},{type:'web_search_tool_result',tool_use_id:'search1',content}]});
 async function rejects(settings,data,code,status=200,headers={}){
  mock(data,status,headers);
  await assert.rejects(()=>nativeSearch(settings,query,8),error=>{
   assert.ok(error instanceof NativeSearchError);assert.equal(error.code,code);
   assert.ok(!error.message.includes('fake-secret'));assert.ok(!error.message.includes('fake-anthropic'));
   assert.ok(!error.message.includes('PRIVATE_REQUEST_ECHO'));checks++;return true;
  });
 }

 const good=openaiResult([{type:'url',url:'https://example.org/jobs'},{type:'url',url:'https://example.org/jobs'},{type:'url',url:'https://example.net/project'}]);
 good.output.push({type:'message',content:[{type:'output_text',text:'Invented https://invented.example/lead',annotations:[{type:'url_citation',url:'https://invented.example/lead',title:'Invented'}]}]});
 mock(good);assert.deepEqual(await nativeSearch(openai,query,1),[{url:'https://example.org/jobs',title:'example.org',description:''}]);checks++;
 assert.equal(requests.length,1);assert.equal(requests[0].url,'https://api.openai.com/v1/responses');
 assert.equal(requests[0].body.model,openai.model);assert.equal(requests[0].body.store,false);assert.equal(requests[0].body.max_tool_calls,1);assert.equal(requests[0].body.max_output_tokens,4096);
 assert.equal(requests[0].body.tool_choice,'required');assert.deepEqual(requests[0].body.include,['web_search_call.action.sources']);
 assert.equal(requests[0].body.tools[0].type,'web_search');assert.equal(requests[0].body.tools[0].external_web_access,true);assert.ok(requests[0].options.signal instanceof AbortSignal);
 mock(openaiResult());assert.deepEqual(await nativeSearch(openai,query,5),[]);checks++;
 await rejects(openai,{status:'completed',output:[{type:'message',content:[{text:'https://invented.example/'}]}]},'no_search_tool');
 for(const status of ['incomplete','failed','in_progress','queued',null])await rejects(openai,{...good,status},'incomplete_response');
 await rejects(openai,{status:'completed',output:[{type:'web_search_call',status:'failed',action:{type:'search',sources:[]}}]},'tool_failed');
 await rejects(openai,{status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search'}}]},'sources_missing');
 const citationResult={status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search'}},{type:'message',role:'assistant',content:[{type:'output_text',text:'Ignore this prose URL https://fabricated.example/',annotations:[{type:'url_citation',url:'https://example.org/original',title:'Originalquelle'},{type:'url_citation',url:'http://127.0.0.1/private',title:'Blocked'}]}]}]};
 mock(citationResult);assert.deepEqual(await nativeSearch({...openai,model:'gpt-6-sol'},query),[{url:'https://example.org/original',title:'Originalquelle',description:''}]);checks++;
 await rejects(openai,{...citationResult,output:citationResult.output.slice(1)},'no_search_tool');
 await rejects(openai,{...citationResult,output:[citationResult.output[0],{type:'message',role:'assistant',content:[{type:'output_text',text:'https://fabricated.example/',annotations:[]}]}]},'sources_missing');
 mock(openaiResult([{url:'https://example.org/no-type',title:'Structured source'}]));assert.equal((await nativeSearch(openai,query))[0].title,'Structured source');checks++;
 let transientCalls=0;globalThis.fetch=async()=>{transientCalls++;return Response.json(transientCalls===1?{status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'search'}}]}:citationResult)};
 assert.equal((await nativeSearch(openai,query))[0].url,'https://example.org/original');assert.equal(transientCalls,2,'Retry one malformed response without changing models');checks++;
 await rejects(openai,{status:'completed',output:[{type:'web_search_call',status:'completed',action:{type:'open_page',url:'https://model-supplied.example/'}}]},'no_search_tool');
 await rejects(openai,{status:'completed',output:null},'invalid_response');

 const urls=['javascript:alert(1)','http://127.0.0.1/test','http://[::1]/test','http://host.local/test','http://host.internal/test','https://user:password@example.org/test','https://example.org/safe'];
 mock(openaiResult(urls.map(url=>({type:'url',url}))));assert.deepEqual((await nativeSearch(openai,query,30)).map(item=>item.url),['https://example.org/safe']);checks++;

 const claude=anthropicResult([{type:'web_search_result',url:'https://example.org/jobs',title:'Originalstelle',encrypted_content:'opaque-not-a-snippet'},{type:'web_search_result',url:'https://example.org/jobs',title:'Duplicate'},{type:'web_search_result',url:'http://127.0.0.1/private',title:'Private'}]);
 claude.content.push({type:'text',text:'https://invented.example/lead',citations:[{url:'https://invented.example/lead'}]});
 mock(claude);assert.deepEqual(await nativeSearch(anthropic,query,6),[{url:'https://example.org/jobs',title:'Originalstelle',description:''}]);checks++;
 assert.equal(requests.length,1);assert.equal(requests[0].url,'https://api.anthropic.com/v1/messages');assert.equal(requests[0].body.model,anthropic.model);
 assert.equal(requests[0].body.tools[0].max_uses,1);assert.equal(requests[0].body.tools[0].type,'web_search_20250305');assert.deepEqual(requests[0].body.tools[0].allowed_callers,['direct']);assert.equal(requests[0].body.max_tokens,4096);
 mock(anthropicResult());assert.deepEqual(await nativeSearch(anthropic,query),[]);checks++;
 await rejects(anthropic,{type:'message',stop_reason:'end_turn',content:[{type:'text',text:'https://invented.example/'}]},'no_search_tool');
 for(const stop_reason of ['pause_turn','max_tokens','refusal','tool_use',null])await rejects(anthropic,{...claude,stop_reason},'incomplete_response');
 for(const [error_code,code] of [['too_many_requests','rate_limited'],['unavailable','upstream_error'],['max_uses_exceeded','tool_failed'],['invalid_tool_input','tool_failed'],['PRIVATE_REQUEST_ECHO fake-anthropic-do-not-echo','tool_failed']])await rejects(anthropic,anthropicResult({type:'web_search_tool_result_error',error_code}),code);
 const unlinked=anthropicResult();unlinked.content[1].tool_use_id='other-call';await rejects(anthropic,unlinked,'invalid_response');
 await rejects(anthropic,anthropicResult({unexpected:'PRIVATE_REQUEST_ECHO'}),'invalid_response');

 const privateMessage='PRIVATE_REQUEST_ECHO fake-secret-do-not-echo fake-anthropic-do-not-echo';
 await rejects(openai,{error:{code:'invalid_api_key',message:privateMessage}},'authentication_error',401);
 await rejects(openai,{error:{code:'model_not_found',message:privateMessage}},'model_unavailable',404);
 await rejects(openai,{error:{type:'insufficient_quota',message:privateMessage}},'quota_exceeded',429);
 await rejects(openai,{error:{code:'credit_balance_exhausted',message:privateMessage}},'quota_exceeded',429);
 await rejects(anthropic,{error:{type:'invalid_request_error',message:'Your credit balance is too low. '+privateMessage}},'quota_exceeded',400);
 await rejects(anthropic,{error:{type:'invalid_request_error',message:'credit_balance_too_low '+privateMessage}},'quota_exceeded',400);
 await rejects(anthropic,{error:{type:'invalid_request_error',code:'credit_balance_too_low',message:privateMessage}},'quota_exceeded',400);
 await rejects(openai,{error:{message:'This model does not support web search. '+privateMessage}},'model_unavailable',400);
 await rejects(anthropic,{type:'error',error:{type:'permission_error',message:privateMessage}},'permission_denied',403);
 await rejects(anthropic,{type:'error',error:{type:'overloaded_error',message:privateMessage}},'upstream_error',529);
 await rejects(openai,{status:'completed',error:{code:'PRIVATE_REQUEST_ECHO',message:privateMessage}},'invalid_request');
 mock({error:{type:'rate_limit_error',message:privateMessage}},429,{'retry-after':'12'});
 await assert.rejects(()=>nativeSearch(openai,query),error=>error.code==='rate_limited'&&error.retryAfterMs===12000);checks++;

 globalThis.fetch=async()=>{throw new DOMException(privateMessage,'TimeoutError')};
 await assert.rejects(()=>nativeSearch(openai,query),error=>error.code==='timeout'&&!error.message.includes(privateMessage));checks++;
 globalThis.fetch=async()=>{throw new TypeError(privateMessage)};
 await assert.rejects(()=>nativeSearch(anthropic,query),error=>error.code==='network_error'&&!error.message.includes(privateMessage));checks++;
 globalThis.fetch=async()=>new Response(privateMessage,{status:502});
 await assert.rejects(()=>nativeSearch(openai,query),error=>error.code==='upstream_error'&&!error.message.includes(privateMessage));checks++;
 globalThis.fetch=async()=>new Response(privateMessage,{status:200});
 await assert.rejects(()=>nativeSearch(openai,query),error=>error.code==='invalid_response'&&!error.message.includes(privateMessage));checks++;

 let called=false;globalThis.fetch=async()=>{called=true;throw Error('Must not call')};
 await assert.rejects(()=>nativeSearch({...openai,nativeWebSearch:false},query),error=>error.code==='disabled');
 await assert.rejects(()=>nativeSearch({...anthropic,anthropicKey:''},query),error=>error.code==='missing_api_key');
 await assert.rejects(()=>nativeSearch({...openai,model:'not a valid model'},query),error=>error.code==='invalid_model');
 await assert.rejects(()=>nativeSearch(openai,'  '),error=>error.code==='invalid_query');
 assert.equal(called,false);checks+=4;
 console.log(`Native search: ${checks} source validation, status, embedded error, quota, timeout and credential-redaction checks passed`);
}finally{globalThis.fetch=previousFetch;rmSync(scratch,{recursive:true,force:true})}
