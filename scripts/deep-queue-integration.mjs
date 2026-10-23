import assert from 'node:assert/strict';
import {testLoader} from './ts-test-loader.mjs';
if(!process.env.DATABASE_URL?.endsWith('/quovadis_business_test'))throw Error('Use the disposable quovadis_business_test database only.');
const schema=testLoader()('lib/db.ts');await schema.init();const database=schema.db();
let failModel=false,models=0;
const settings={model:'fixture-main',analysisModel:'',screeningModel:'',hourlyRate:100,serviceOffer:'IT-Administration',provider:'openai',openaiKey:'fixture-secret',anthropicKey:'',firecrawlKey:'',firecrawlEnabled:false,sources:[]};
const subject=testLoader({'./db':schema,'./settings':{getSettings:async()=>settings},'./research-model':{logUsage:async()=>{},researchModel:async()=>{models++;if(failModel)throw Error('Fixture model unavailable');return JSON.stringify({summary:'Der belegte IT-Anlass wurde bewertet. Weitere Daten sind unbekannt.',scoreReason:'Der belegte Anlass begründet eine vorsichtige Einschätzung.',matchForecast:'Weitere Qualifizierung im Gespräch notwendig.',findings:[],facts:[],contacts:[],scoreBreakdown:{need:20,fit:10,recency:5,economics:0,contact:10},monthlyPotential:'unknown'})}},'./web-search':{searchWeb:async()=>[],socialKind:()=>null,scrapePage:async(_key,url)=>{const index=new URL(url).pathname.split('/').pop();const name='Queue Fixture '+index+' GmbH';return {url,title:name,text:name+' in München plant den Aufbau der IT-Infrastruktur. ',checkedAt:new Date().toISOString(),publishedAt:null,links:[],contacts:[]}}}})('lib/research.ts');
const ids=[];
try{
 for(let i=1;i<=3;i++){const name='Queue Fixture '+i+' GmbH',quote=name+' in München plant den Aufbau der IT-Infrastruktur.';const result=await database.query("INSERT INTO opportunities(name,city,signal,source_url,evidence_quote,research_status,detected_at) VALUES($1,'München','IT-Aufbau geplant',$2,$3,'pending',NULL) RETURNING id",[name,'https://www.stepstone.de/'+i,quote]);ids.push(result.rows[0].id)}
 let result=await subject.processDeepQueue();assert.equal(result.researched,2);assert.equal(result.ready,1,'Backlog is immediately eligible for the next worker call');
 result=await subject.processDeepQueue();assert.equal(result.researched,1);assert.equal(result.ready,0);
 const completed=await database.query('SELECT * FROM opportunities WHERE id=ANY($1::bigint[])',[ids]);
 for(const row of completed.rows){assert.equal(row.research_status,'complete');assert.equal(row.assessment.scoreBreakdown.contact,0,'No contact points without verified contacts');assert.equal(row.assessment.scoreBreakdown.need,20,'Contact gaps do not reduce need');assert.equal(row.assessment.scoreBreakdown.fit,10);assert.equal(row.score,35,'Company remains classified without phone, email or website');assert.ok(row.assessment.researchCoverage.limitations.length,'Original-only dossiers disclose their limits');assert.equal(row.research_attempts,1)}
 const api=testLoader({'@/lib/db':schema,'@/lib/auth':{guard:async()=>null}})('app/api/opportunities/route.ts');const overview=await api.GET(new Request('http://localhost/api/opportunities'));assert.equal(overview.status,200);assert.equal((await overview.json()).stats.deepRunning,0);
 assert.equal(models,3,'Every queued company receives an AI dossier');
 await database.query("UPDATE opportunities SET research_status='researching' WHERE id=$1",[ids[0]]);
 assert.equal((await subject.processDeepQueue()).researched,1,'Interrupted work is recovered after acquiring the processor lock');
 await database.query("UPDATE opportunities SET research_status='failed',research_attempts=0,researched_at=NULL,research_next_attempt_at=NULL WHERE id=$1",[ids[1]]);
 failModel=true;result=await subject.processDeepQueue();assert.equal(result.researched,0);assert.equal(result.errors.length,1);
 const failed=(await database.query('SELECT * FROM opportunities WHERE id=$1',[ids[1]])).rows[0];assert.equal(failed.research_status,'failed');assert.ok(new Date(failed.research_next_attempt_at)>new Date());
 assert.equal((await subject.processDeepQueue()).processed,0,'Retry delay is respected');
 await database.query("UPDATE opportunities SET research_attempts=5,research_next_attempt_at=NULL WHERE id=$1",[ids[1]]);
 assert.equal((await subject.processDeepQueue()).processed,0,'Five unsuccessful attempts do not loop indefinitely');
 failModel=false;await database.query("UPDATE opportunities SET research_next_attempt_at=now()-interval '1 minute' WHERE id=$1",[ids[1]]);assert.equal((await subject.processDeepQueue()).researched,1,'Paused work resumes when the next daily retry is due');
 await database.query("UPDATE opportunities SET research_status='failed',research_attempts=5,research_next_attempt_at=now()+interval '1 day' WHERE id=$1",[ids[1]]);assert.equal((await subject.processDeepQueue(undefined,true)).researched,1,'Manual resume resets failed work and delivers a dossier');
 console.log('Deep queue: every company classified, NULL timestamps, drain scheduling, limited-but-grounded reports, interrupted recovery, retries, retry cap and manual resume passed');
}finally{await database.query('DELETE FROM opportunities WHERE id=ANY($1::bigint[])',[ids]);await database.end()}
