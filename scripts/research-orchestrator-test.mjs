import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Exercise the real orchestrator in memory. HTTP providers, PostgreSQL and the
// model are isolated; fixtures never reach a live service or the application DB.
const nativeRequire=createRequire(import.meta.url);
const compile=(name,require,globals={})=>{
 const module={exports:{}};
 const source=readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 runInNewContext(code,{module,exports:module.exports,require,AbortSignal,URL,Date,Error,...globals});
 return module.exports;
};
const queries=compile('research-queries',nativeRequire),grounding=compile('research-grounding',nativeRequire),diagnostics=compile('research-diagnostics',nativeRequire);
class WebSearchUnavailableError extends Error{
 code='WEB_SEARCH_UNAVAILABLE';
 constructor(diagnostics){super('Websuche derzeit nicht verfügbar.');this.diagnostics=diagnostics}
}
const unavailable={backend:'searxng',status:'unavailable',message:'Suchdienst nicht erreichbar.',engines:[{name:'bing',reason:'Timeout'}]};
const empty={backend:'searxng',status:'empty',message:'Suchdienst hat keine Treffer gefunden.'};
const hit={url:'https://example.org/karriere/it',title:'IT Aufbau',description:'Veröffentlichtes IT-Projekt'};

async function scenario(search){
 const settings={cities:['München','Augsburg','Landsberg am Lech'],radiusKm:40,skills:['jobs','tenders','migration','providers','growth','social','news'],serviceOffer:'Externe IT Administration',searchPrompt:'Suche belegte IT-Bedarfssignale',provider:'openai',openaiKey:'test-secret-placeholder',anthropicKey:'',model:'test',searchLimit:60,firecrawlKey:'',agenticSearch:true,sources:[]};
 const requested=[],updates=[];let plans=0,scraped=0,terminal;
 const connection={query:async sql=>sql.includes('pg_try_advisory_lock')?{rows:[{ok:true}],rowCount:1}:{rows:[{id:7}],rowCount:1},release(){}};
 const database={connect:async()=>connection,query:async(sql,values)=>{
  if(sql.startsWith('UPDATE research_runs')){
   if(sql.includes('finished_at=now()'))terminal={status:values[1],stage:values[2],errors:values[8]};
   else updates.push({searched:values[2],stage:values[6]});
  }
  return {rows:[{count:0}],rowCount:1};
 }};
 const subject=compile('research',id=>{
  if(id.startsWith('node:'))return nativeRequire(id);
  if(id==='./research-queries')return queries;
  if(id==='./research-grounding')return grounding;
  if(id==='./research-diagnostics')return diagnostics;
  if(id==='./db')return {db:()=>database,init:async()=>{}};
  if(id==='./settings')return {getSettings:async()=>settings};
  if(id==='./web-search')return {WebSearchUnavailableError,searchWeb:async(key,query,limit,options)=>{
   assert.equal(options.ai,settings,'Discovery must pass existing AI configuration to the search fallback');
   requested.push(query);return search(requested.length,options);
  },scrapePage:async()=>{scraped++;return {...hit,text:'Muster GmbH plant den Aufbau der IT in München. '.repeat(8),checkedAt:new Date().toISOString(),links:[]}}};
  return {};
 },{fetch:async(url,options)=>{
  const body=JSON.parse(options.body),system=body.messages[0].content;
  if(system.startsWith('Du planst')||system.startsWith('Du steuerst')){plans++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({queries:['Dachau IT Aufbau','München IT Administrator Aufbau']})}}]})}}
  return {ok:true,json:async()=>({choices:[{message:{content:'[]'}}]})};
 }});
 const result=await subject.runResearch(7);
 return {result,requested,plans,scraped,updates,terminal};
}

const outage=await scenario(async(index,options)=>{options.onDiagnostic(unavailable);throw new WebSearchUnavailableError([unavailable])});
assert.equal(outage.result.status,'failed');
assert.equal(outage.terminal.stage,'Fehlgeschlagen');
assert.ok(outage.requested.length<=2,'A provider outage must stop new work after the two in-flight searches');
assert.equal(outage.plans,1,'Do not pay for a second query plan while all search backends are unavailable');
assert.equal(outage.result.searched,outage.requested.length);
assert.ok(outage.updates.some(update=>update.searched===outage.requested.length),'Failures must publish their counters and heartbeat');
assert.match(outage.result.errors[0],/Keine Suchanfrage/);
assert.ok(outage.result.errors.length<=4,'Identical failures must be grouped');
assert.match(outage.terminal.errors,/Keine Suchanfrage/);

const partial=await scenario(async(index,options)=>{if(index===1){options.onDiagnostic({...empty,status:'ok'});return [hit]}options.onDiagnostic(unavailable);throw new WebSearchUnavailableError([unavailable])});
assert.equal(partial.result.status,'failed');
assert.equal(partial.terminal.stage,'Unvollständig');
assert.equal(partial.plans,1);
assert.equal(partial.scraped,1,'Already discovered originals are still checked after the search circuit opens');
assert.equal(partial.result.verified,1);
assert.match(partial.result.errors[0],/unvollständig/);

const healthy=await scenario(async(index,options)=>{options.onDiagnostic(empty);return []});
assert.equal(healthy.result.status,'completed','Healthy empty searches are valid zero-result runs');
assert.equal(healthy.result.imported,0);
assert.equal(healthy.result.errors.length,0);
assert.equal(healthy.plans,2);
assert.equal(healthy.requested.length,25,'24 focused baselines and one novel generated query; second-round duplicates are skipped');
assert.equal(new Set(healthy.requested).size,healthy.requested.length);

const mixed=await scenario(async(index,options)=>{if(index===1){options.onDiagnostic(empty);return []}throw Error('Temporary upstream failure')});
assert.equal(mixed.result.status,'failed','One empty success must not hide failures from every other query');
assert.equal(mixed.terminal.stage,'Unvollständig');
assert.match(mixed.result.errors[0],/1 von 25/);

const degraded=await scenario(async(index,options)=>{options.onDiagnostic({...unavailable,status:'degraded',message:'Eine Suchmaschine ist nicht verfügbar; andere haben geantwortet.'});return []});
assert.equal(degraded.result.status,'completed','Partial engine availability is not a total provider outage');
assert.equal(degraded.requested.length,25);
assert.match(degraded.result.errors[0],/eingeschränkter Suchmaschinen-Abdeckung/);
assert.ok(degraded.result.errors.length<=3);

const fallback=await scenario(async(index,options)=>{options.onDiagnostic(unavailable);options.onDiagnostic({backend:'openai',status:'empty',message:'Alternative Websuche hat geantwortet.'});return []});
assert.equal(fallback.result.status,'completed','A successful alternative backend keeps the run functional');
assert.ok(fallback.result.errors.some(message=>message.includes('OpenAI-Websuche')));

const report=diagnostics.researchDiagnostics(['test-secret-placeholder']);
for(let i=0;i<40;i++)report.error('Websuche',Error('Request failed with test-secret-placeholder'),'München IT Aufbau '+i);
const compact=report.messages(['Die Websuche ist vorübergehend nicht verfügbar.']);
assert.equal(compact.length,2);
assert.match(compact[1],/40×/);
assert.ok(!compact.join('\n').includes('test-secret-placeholder'),'Configured credentials must be redacted');
const bounded=diagnostics.boundedResearchErrors(['Wichtige Fehlerzusammenfassung',...Array.from({length:40},(_,i)=>`${i}: ${'Details '.repeat(150)}`)]);
assert.equal(bounded[0],'Wichtige Fehlerzusammenfassung');
assert.ok(bounded.join('\n').length<=7600,'Stored diagnostics stay bounded without cutting off the important summary');
console.log('Research orchestrator: outage circuit, partial results, honest failure states, progress, healthy empty results, fallback options, cross-round deduplication and bounded redacted diagnostics passed');
