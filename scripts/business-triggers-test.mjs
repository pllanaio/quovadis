import assert from 'node:assert/strict';
import {testLoader} from './ts-test-loader.mjs';
const load=testLoader(),{buildEventIntelligence:build,classifyBusinessEvent:classify,allocateScoutBudget,DEFAULT_SCOUT_WEIGHTS}=load('lib/business-triggers.ts');
const settings={hourlyRate:125,serviceOffer:'Microsoft 365 und IT-Konzeption',model:'chosen-model'};
const raw={hypotheses:['Eine Standortvernetzung könnte sinnvoll sein.','Die veraltete IT hat Sicherheitslücken.'],offer:{title:'IT-Konzeption für den Standort',description:'Microsoft 365 und Arbeitsplätze gemeinsam planen.',benefit:'Transparente Planung',scope:'Bestandsaufnahme und Konzept',hoursMin:5,hoursMax:12,priceMin:99999,monthlyPotential:'high'},unknowns:['Ist bereits ein Partner eingeplant?']};
const cases=[
 ['Die Muster GmbH eröffnet einen neuen Standort in München.','news','BUSINESS_TRIGGER',20,'plausible'],
 ['Die Muster GmbH sucht ihren ersten IT-Administrator in München.','jobs','INTERNAL_HIRING_ONLY',80,'unknown'],
 ['Ausschreibung der Muster GmbH: externe IT-Betreuung und Support in München.','tenders','EXPLICIT_EXTERNAL_DEMAND',95,'confirmed'],
 ['Die Muster GmbH plant die ERP-Einführung in München.','news','OPEN_IT_PROJECT',85,'plausible'],
 ['Die Muster GmbH wächst und erweitert ihr Team in München.','growth','GROWTH_TRIGGER',20,'plausible'],
 ['Die Muster GmbH plant eine ERP-Einführung. Der Implementierungspartner wurde bereits beauftragt.','news','OPEN_IT_PROJECT',65,'unknown'],
];
for(const [quote,type,category,need,engagement]of cases){
 const result=build(quote,type,raw,settings,{publishedAt:new Date().toISOString(),contactable:true});
 assert.equal(result.category,category,quote);assert.equal(result.itNeedConfidence,need,quote);assert.equal(result.externalEngagement,engagement,quote);
 assert.equal(result.modelVersion,settings.model);assert.equal(result.verifiedEvent,quote);assert.ok(result.entryOpportunityScore<=100);
 assert.equal(result.hypotheses.length,1,'Invented weaknesses rejected');
 if(category==='INTERNAL_HIRING_ONLY')assert.ok(result.entryOpportunityScore<=55);
 if(result.partnerAlreadySelected){assert.equal(result.offer,null);assert.ok(result.entryOpportunityScore<=35)}else{assert.equal(result.offer.priceMin,625);assert.equal(result.offer.priceMax,1500);assert.equal(result.offer.estimated,true)}
}
assert.equal(classify('Die Muster GmbH gewinnt den regionalen Sportpreis.'),null);
assert.equal(classify('Die Muster GmbH veröffentlicht eine Software-Jubiläumsnachricht.'),null);
assert.equal(classify('Die Muster GmbH sucht einen Implementierungspartner für ERP.').category,'EXPLICIT_EXTERNAL_DEMAND');
assert.deepEqual(allocateScoutBudget(100),DEFAULT_SCOUT_WEIGHTS);
assert.equal(Object.values(allocateScoutBudget(17)).reduce((a,b)=>a+b),17);
assert.equal(allocateScoutBudget(17,{external:100,business:0,projects:0,growth:0,hiring:0}).hiring,0);
const {validateEvidenceCandidate}=load('lib/research-evidence.ts');
const quote=cases[0][0],source={kind:'website',url:'https://muster.de/news'};
const candidate={name:'Muster GmbH',city:'München',signal:'Neuer Standort eröffnet',signalType:'business',sourceUrl:source.url,evidenceQuote:quote};
assert.equal(validateEvidenceCandidate(candidate,source,quote,['business']).length,1);
assert.equal(validateEvidenceCandidate({...candidate,evidenceQuote:'Muster GmbH eröffnet einen neuen Standort in Augsburg.'},source,quote,['business']).length,0);
const irrelevant='Die Muster GmbH veröffentlicht eine Software-Jubiläumsnachricht in München.';
assert.equal(validateEvidenceCandidate({...candidate,signalType:'news',evidenceQuote:irrelevant},source,irrelevant,['news']).length,0);
console.log('Business triggers: seven required cases, conservative external readiness, computed estimates, hypothesis grounding and scout budgets passed');
