import {testLoader} from './ts-test-loader.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {validTime,validTimezone} from '../lib/schedule.mjs';

const require=createRequire(import.meta.url);
function load(path,dependencies){
 const source=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const module={exports:{}};new Function('require','module','exports',source)(name=>dependencies[name]??require(name),module,module.exports);return module.exports;
}
let stored={};
const settings=load('../lib/settings.ts',{
 './business-triggers':testLoader()('lib/business-triggers.ts'),
 './db':{init:async()=>{},db:()=>({query:async(sql,values)=>{if(sql.startsWith('SELECT'))return {rows:[{config:structuredClone(stored)}]};stored=structuredClone(values[0]);return {rows:[]}}})},
 './discovery-prompt':{DEFAULT_DISCOVERY_PROMPT:'Find verified IT opportunities with original evidence sources.'},
 './schedule.mjs':{validTime,validTimezone},
});
assert.equal((await settings.getSettings()).nativeWebSearch,true,'old settings enable native search by default');
let saved=await settings.saveSettings({...await settings.getSettings(),nativeWebSearch:false});assert.equal(saved.nativeWebSearch,false);assert.equal(stored.nativeWebSearch,false);
const oldClient={...await settings.getSettings()};delete oldClient.nativeWebSearch;saved=await settings.saveSettings(oldClient);assert.equal(saved.nativeWebSearch,false,'an older client preserves the saved preference');
await assert.rejects(()=>settings.saveSettings({...oldClient,nativeWebSearch:'false'}),/Wahrheitswert/);
await assert.rejects(()=>settings.saveSettings({...oldClient,nativeWebSearch:null}),/Wahrheitswert/);
saved=await settings.saveSettings({...oldClient,nativeWebSearch:true});assert.equal(saved.nativeWebSearch,true);
saved=await settings.saveSettings({...await settings.getSettings(),searchBackend:'native'});assert.equal(saved.searchBackend,'native');
const legacyBackend={...await settings.getSettings()};delete legacyBackend.searchBackend;assert.equal((await settings.saveSettings(legacyBackend)).searchBackend,'native');
await assert.rejects(()=>settings.saveSettings({...legacyBackend,searchBackend:'other'}),/Suchzugang/);
await assert.rejects(()=>settings.saveSettings({...legacyBackend,nativeWebSearch:false}),/aktiviert/);
stored={nativeWebSearch:'false'};assert.equal((await settings.getSettings()).nativeWebSearch,true,'invalid stored strings do not become truthy/falsey preferences');

class WebSearchUnavailableError extends Error{constructor(message,diagnostics){super(message);this.diagnostics=diagnostics}}
class WebSearchQueryError extends WebSearchUnavailableError{}
const configured={...await settings.getSettings(),firecrawlKey:'fixture-key',nativeWebSearch:true};let settingsReads=0,calls=[],failure=null;
let result={hits:[{url:'https://example.org/company',title:'Company',description:'Verified fixture'}],backend:'searxng',diagnostics:[{backend:'searxng',status:'ok',message:'Antwort erhalten'}]};
const route=load('../app/api/web-search/test/route.ts',{
 'next/server':{NextResponse:{json:(value,init)=>new Response(JSON.stringify(value),{status:init?.status||200,headers:{'content-type':'application/json'}})}},
 '@/lib/auth':{guard:async()=>null},
 '@/lib/settings':{getSettings:async()=>{settingsReads++;return configured}},
 '@/lib/web-search':{WebSearchUnavailableError,WebSearchQueryError,searchWebDetailed:async(...args)=>{calls.push(args);if(failure)throw failure;return result},scrapePage:async(_key,url)=>({url,text:'Verified original page fixture'})},
});
const request=body=>new Request('http://localhost/api/web-search/test',{method:'POST',...(body===undefined?{}:{body:JSON.stringify(body)})});
let response=await route.POST(request());let body=await response.json();assert.equal(body.status,'ok');assert.equal(settingsReads,0,'default test never loads AI credentials');assert.equal(calls.at(-1)[0],'');assert.deepEqual(calls.at(-1)[3],{forceRetry:true});
response=await route.POST(request({mode:'configured'}));body=await response.json();assert.equal(settingsReads,1);assert.equal(calls.at(-1)[0],'fixture-key');assert.equal(calls.at(-1)[3].ai,configured);assert.equal(calls.at(-1)[3].forceRetry,true);
result={hits:[],backend:'searxng',diagnostics:[{backend:'searxng',status:'degraded',message:'Teilweise eingeschränkt',engines:[{name:'duckduckgo',reason:'CAPTCHA'}]}]};
response=await route.POST(request());body=await response.json();assert.equal(body.status,'degraded');assert.equal(body.hits,0);assert.match(body.message,/eingeschränkt/);assert.equal(body.diagnostics[0].engines[0].reason,'CAPTCHA');
result={hits:[],backend:'searxng',diagnostics:[{backend:'searxng',status:'empty',message:'Keine Treffer'}]};body=await (await route.POST(request())).json();assert.equal(body.status,'empty');
failure=new WebSearchUnavailableError('Suchanbieter sind derzeit nicht verfügbar.',[{backend:'searxng',status:'unavailable',message:'Verbindung fehlgeschlagen'}]);response=await route.POST(request());body=await response.json();assert.equal(response.status,502);assert.equal(body.status,'unavailable');assert.equal(body.error.startsWith('Error:'),false);assert.equal(body.diagnostics.length,1);
failure=new WebSearchQueryError('Einzelne Anfrage ohne Quellen.',[{backend:'openai',status:'degraded',message:'Unvollständige Quellenliste'}]);body=await(await route.POST(request({mode:'configured'}))).json();assert.equal(body.status,'degraded');assert.equal(body.backend,'openai');
assert.equal((await route.POST(request({mode:'unknown'}))).status,400);
console.log('Settings/search API: default, opt-out persistence, boolean validation, local/configured isolation and honest diagnostics passed');
