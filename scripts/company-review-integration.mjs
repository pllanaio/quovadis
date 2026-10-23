import assert from 'node:assert/strict';
import {testLoader} from './ts-test-loader.mjs';
if(!process.env.DATABASE_URL?.endsWith('/quovadis_business_test'))throw Error('Use the disposable quovadis_business_test database only.');
const schema=testLoader()('lib/db.ts');await schema.init();const database=schema.db();
const settings={model:'fixture-main',analysisModel:'',screeningModel:'',hourlyRate:100,serviceOffer:'IT-Administration',provider:'openai',openaiKey:'fixture-secret',anthropicKey:'',firecrawlKey:'',firecrawlEnabled:false,sources:[],skills:['business','jobs'],cities:['München'],radiusKm:40,searchPrompt:'Belegte Unternehmensanlässe'};
let signals=false,badIdentity=false;
const base='https://review-fixture.example.org/',name='Review Fixture GmbH',identity=name+' in München entwickelt technische Produkte.',signal=name+' in München: Wir suchen einen externen IT-Dienstleister für die IT-Betreuung.';
const mocks={'./db':schema,'./settings':{getSettings:async()=>settings},'./research-model':{logUsage:async()=>{},researchModel:async(_settings,system)=>{
 if(system.startsWith('Ermittle die Identität'))return JSON.stringify({name,city:'München',sourceUrl:base,quote:badIdentity?'Erfundener Firmenname in Hamburg.':identity});
 if(system.includes('Antworte nur als JSON-Objekt {"opportunities"'))return JSON.stringify({opportunities:signals?[{name,city:'München',signal:'Externe IT-Betreuung gesucht',signalType:'providers',sourceUrl:base,evidenceQuote:signal,companyUrl:base}]:[]});
 return JSON.stringify({summary:'Die Firmenwebsite wurde geprüft. Ein konkreter IT-Bedarf ist bisher nicht belegt.',scoreReason:'Die Firma ist belegt, ein IT-Anlass bleibt offen.',findings:[],facts:[],contacts:[],scoreBreakdown:{need:35,fit:10,recency:5,economics:0,contact:0},monthlyPotential:'unknown'});
}},'./web-search':{searchWeb:async()=>[],socialKind:()=>null,scrapePage:async(_key,url)=>({url,title:name,text:identity+(signals?' '+signal:''),checkedAt:new Date().toISOString(),publishedAt:null,links:[],contacts:[]})}};
const research=testLoader(mocks)('lib/research.ts');
const reviews=testLoader({...mocks,'./research':research})('lib/company-review.ts');
const assistant=testLoader({...mocks,'./research':research,'./company-review':reviews})('lib/assistant.ts');
let opportunityId;const originalFetch=globalThis.fetch;
try{
 for(const url of ['http://localhost/','http://127.0.0.1/','https://192.168.0.1/','file:///etc/passwd','https://example.org:3000/','https://user:pass@example.org/'])assert.throws(()=>reviews.companyReviewUrl(url));
 assert.equal(reviews.requestedCompanyUrl('Prüfe bitte '+base),base);
 assert.equal(reviews.requestedCompanyUrl(base),base);
 assert.equal(reviews.requestedCompanyUrl('Erkläre mir die URL '+base),null,'Mention alone is not permission to import');
 assert.equal(reviews.requestedCompanyUrl(base+' https://other.example.org',base),null,'Multiple companies are not silently narrowed');
 assert.equal(reviews.requestedCompanyUrl('Prüfe '+base,'https://unrequested.example.org/'),null,'Model cannot import a URL absent from the current message');
 let reply=await assistant.chat(base);assert.equal(reply.company_review.status,'queued');
 assert.equal((await assistant.history()).at(-1).company_review.status,'queued','Chat history exposes persisted jobs');
 assert.equal((await database.query('SELECT count(*)::int AS count FROM opportunities')).rows[0].count,0,'URL submission does not claim a completed dossier');
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({reply:'Firmenprüfung',companyReviewUrl:base})}}]});
 const flexible=await assistant.chat('Hier ist noch eine Firma: '+base);assert.equal(flexible.company_review.id,reply.company_review.id,'Conversational URL input uses the actual assistant action');
 globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({reply:'Keine Prüfung gestartet.',companyReviewUrl:'https://unrequested.example.org/'})}}]});
 assert.equal((await assistant.chat('Erkläre mir die bisherigen Daten.')).company_review,undefined,'Model cannot queue an unrequested URL from history');globalThis.fetch=originalFetch;
 const deniedApi=testLoader({'@/lib/auth':{guard:async()=>new Response('',{status:401})},'@/lib/company-review':{processCompanyReviews:async()=>{throw Error('Unauthorized processing')}}})('app/api/research/companies/route.ts');assert.equal((await deniedApi.POST(new Request('http://localhost/api/research/companies',{method:'POST'}))).status,401);
 const duplicate=await reviews.enqueueCompanyReview(base,'Prüfe '+base);assert.equal(duplicate.company_review.id,reply.company_review.id,'Concurrent duplicate submissions share the pending job');
 assert.equal((await reviews.processCompanyReviews()).processed,1);
 let row=(await database.query('SELECT * FROM opportunities WHERE company_url=$1',[new URL(base).origin])).rows[0];opportunityId=row.id;
 assert.equal(row.research_status,'pending');assert.equal(row.need_status,'not_found');
 assert.equal((await database.query('SELECT count(*)::int AS count FROM opportunity_signals')).rows[0].count,0,'Company identity is not a verified IT signal');
 assert.equal((await research.processDeepQueue()).researched,1);
 row=(await database.query('SELECT * FROM opportunities WHERE id=$1',[opportunityId])).rows[0];assert.equal(row.research_status,'complete');assert.equal(row.assessment.scoreBreakdown.need,12,'No need proof means no maximum need score');
 const history=(await assistant.history()).at(-1).company_review;assert.equal(history.status,'complete','Chat tracks completion of the actual deep dive');assert.equal(typeof history.opportunityId,'string','PostgreSQL IDs stay lossless and match dossier navigation');
 await database.query("INSERT INTO activities(opportunity_id,kind,note) VALUES($1,'note','Fixture note')",[opportunityId]);
 signals=true;await reviews.enqueueCompanyReview(base,'Bitte erneut prüfen: '+base);await reviews.processCompanyReviews();
 assert.equal((await database.query('SELECT count(*)::int AS count FROM opportunities')).rows[0].count,1,'Rechecking an existing company never duplicates it');
 row=(await database.query('SELECT * FROM opportunities WHERE id=$1',[opportunityId])).rows[0];assert.equal(row.need_status,'proven');assert.equal(row.external_readiness,'proven');assert.match(row.signal,/IT-Betreuung/);
 assert.equal((await database.query('SELECT count(*)::int AS count FROM activities WHERE opportunity_id=$1',[opportunityId])).rows[0].count,1,'Existing notes survive enrichment');
 // A newly found project during the deep dive also enters the normal signal lifecycle.
 await database.query("DELETE FROM opportunity_signals WHERE opportunity_id=$1",[opportunityId]);await database.query("UPDATE opportunities SET need_status='not_found',research_status='pending' WHERE id=$1",[opportunityId]);
 let result=await research.processDeepQueue();assert.equal(result.ready,1,'Newly verified signal queues the normal dossier with its updated evidence');
 result=await research.processDeepQueue();assert.equal(result.researched,1);
 // Failed identity checks are not stored as invented companies and retry after restart.
 badIdentity=true;reply=await reviews.enqueueCompanyReview(base,'Prüfe '+base);await reviews.processCompanyReviews();
 let job=(await database.query('SELECT * FROM company_reviews WHERE id=$1',[reply.company_review.id])).rows[0];assert.equal(job.status,'queued');assert.ok(job.error);assert.equal(job.opportunity_id,null);
 badIdentity=false;await database.query("UPDATE company_reviews SET status='running' WHERE id=$1",[job.id]);assert.equal((await reviews.processCompanyReviews()).processed,1,'Interrupted intake is recovered under its processor lock');
 // Deletion must not resurrect the company through its old completed chat request.
 await database.query('DELETE FROM activities WHERE opportunity_id=$1',[opportunityId]);await database.query('DELETE FROM opportunities WHERE id=$1',[opportunityId]);
 assert.equal((await reviews.processCompanyReviews()).processed,0);
 assert.equal((await assistant.history()).at(-1).company_review.status,'deleted');
 console.log('Company URL review: explicit chat intake, URL validation, persisted queue/history, deduplication, grounded identity, no-signal dossier, newly discovered IT signal, notes, restart recovery and deletion passed');
}finally{
 globalThis.fetch=originalFetch;
 await database.query("DELETE FROM assistant_messages WHERE company_review_id IN (SELECT id FROM company_reviews WHERE url=$1) OR content LIKE $2 OR content IN ('Erkläre mir die bisherigen Daten.','Keine Prüfung gestartet.')",[base,'%review-fixture.example.org%']);
 await database.query('DELETE FROM company_reviews WHERE url=$1',[base]);
 if(opportunityId){await database.query('DELETE FROM activities WHERE opportunity_id=$1',[opportunityId]);await database.query('DELETE FROM opportunities WHERE id=$1',[opportunityId])}
 await database.end();
}
