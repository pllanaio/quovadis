import {explicitExternalDemand} from './research-grounding';
const normalizeEvidenceText=(value:string)=>value.normalize('NFKC').replace(/\u00ad/g,'').replace(/\s+/gu,' ').trim().toLocaleLowerCase('de-DE');

export const OPPORTUNITY_CATEGORIES=['EXPLICIT_EXTERNAL_DEMAND','OPEN_IT_PROJECT','BUSINESS_TRIGGER','GROWTH_TRIGGER','MODERNIZATION_TRIGGER','INFERRED_IT_OPPORTUNITY','INTERNAL_HIRING_ONLY'] as const;
export type OpportunityCategory=typeof OPPORTUNITY_CATEGORIES[number];
export type Scout='external'|'business'|'projects'|'growth'|'hiring';
export const SCOUTS:[Scout,string][]=[['external','Externer IT-Bedarf'],['business','Geschäftliche Ereignisse'],['projects','IT-Projekte'],['growth','Unternehmenswachstum'],['hiring','IT-Stellenanzeigen']];
export const DEFAULT_SCOUT_WEIGHTS:Record<Scout,number>={external:25,business:30,projects:20,growth:15,hiring:10};
export const CATEGORY_LABELS:Record<OpportunityCategory,string>={EXPLICIT_EXTERNAL_DEMAND:'Externer IT-Bedarf',OPEN_IT_PROJECT:'Konkretes IT-Projekt',BUSINESS_TRIGGER:'Business Trigger',GROWTH_TRIGGER:'Wachstum',MODERNIZATION_TRIGGER:'Modernisierung',INFERRED_IT_OPPORTUNITY:'Abgeleitete IT-Chance',INTERNAL_HIRING_ONLY:'Interne IT-Stelle'};
export type EntryOffer={title:string;description:string;benefit:string;scope:string;hoursMin:number;hoursMax:number;priceMin:number;priceMax:number;hourlyRate:number;estimated:true;assumptions:string[];openQuestions:string[];followUps:string[];monthlyPotential:'high'|'medium'|'low'|'unknown'};
export type EventIntelligence={category:OpportunityCategory;eventCategory:string;verifiedEvent:string;hypotheses:{statement:string;status:'hypothesis'}[];offer:EntryOffer|null;timing:string;unknowns:string[];conversationOpener:string;itNeedConfidence:number;entryOpportunityScore:number;externalEngagement:'confirmed'|'plausible'|'unknown';scoreReason:string;partnerAlreadySelected:boolean;modelVersion:string;researchedAt:string};
const IT=/\b(?:it|edv|erp|crm|dms|cloud|microsoft|software|digitalisier\w*|automatisier\w*|netzwerk\w*|backup|cyber\w*|security|infrastruktur|implementierungspartner|outsourcing|managed services|schnittstelle\w*)\b/i;
const CHANGE=/eröffn|neue[nrs]?\s+(?:standort|niederlassung|betrieb|büro|geschaeftsbereich|geschäftsbereich|tochter|produktions)|expandier|expansion|übernahm|uebernahm|fusion|gründ|gruend|umstrukturier|vergr[öo]ßer|vergroesser|wachst|wächst|waechst|ausbau|erweiter|neue\s+(?:teams|mitarbeiter)|onlineshop|online-shop|digitale[nr]?\s+vertrieb|mobile[nr]?\s+arbeit|hybride[nr]?\s+arbeit|produktionsanlage|compliance/i;
const PROJECT=/einführ|einfuehr|implementier|migration|migrier|modernisier|erneuer|rollout|planung|planen|ausschreib|automatisier|digitalisier|optimier/i;
const HIRING=/stellenanzeig|stellenangebot|karriere|wir suchen.{0,60}(?:administrator|generalist|allrounder)|IT[- ]?administrator|systemadministrator|IT[- ]?generalist|IT[- ]?allrounder/i;
const PARTNER=/(?:partner|dienstleister|systemhaus|implementierungspartner).{0,80}(?:bereits\s+)?(?:beauftragt|ausgewählt|ausgewaehlt|vergeben)|(?:bereits\s+)?(?:beauftragt|vergeben).{0,70}(?:partner|dienstleister|systemhaus)|gemeinsam mit.{0,100}(?:eingeführt|implementiert)|(?:projekt|auftrag).{0,50}(?:bereits vergeben|abgeschlossen)|IT[- ]?(?:betreuung|support).{0,40}(?:bereits beauftragt|bereits vergeben)/i;
const clean=(value:unknown,max=1400)=>typeof value==='string'?value.trim().slice(0,max):'';
const list=(value:unknown)=>Array.isArray(value)?value.filter(v=>typeof v==='string'&&v.trim()).map(v=>clean(v,500)).slice(0,8):[];
export function classifyBusinessEvent(quote:string,signalType='news'):{category:OpportunityCategory;eventCategory:string;needConfidence:number;partnerSelected:boolean}|null{
 const q=normalizeEvidenceText(quote),it=IT.test(q),partnerSelected=PARTNER.test(q);
 if(/(?:kein[enr]?|nicht|abgesagt|verworfen).{0,35}(?:neuer? standort|eröffn|erp.einführung|migration)/i.test(q))return null;
 if(!it&&!CHANGE.test(q))return null;
 if((explicitExternalDemand(q)||/implementierungspartner.{0,25}gesucht|such(?:en|t).{0,40}implementierungspartner/i.test(q))&&!partnerSelected)return {category:'EXPLICIT_EXTERNAL_DEMAND',eventCategory:'external_demand',needConfidence:95,partnerSelected};
 if(it&&(signalType==='jobs'||HIRING.test(q)))return {category:'INTERNAL_HIRING_ONLY',eventCategory:'hiring',needConfidence:/erste|erstmal|aufbau|generalist|allrounder/i.test(q)?80:65,partnerSelected};
 if(it&&PROJECT.test(q))return {category:/modernisier|erneuer|optimier|migration|migrier/i.test(q)?'MODERNIZATION_TRIGGER':'OPEN_IT_PROJECT',eventCategory:'it_project',needConfidence:partnerSelected?65:85,partnerSelected};
 if(CHANGE.test(q)){
  const growth=/wachs|wächst|waechst|expand|vergr[öo]ßer|vergroesser|neue\s+(?:teams|mitarbeiter)/i.test(q)&&!/übernahm|fusion|gründ|gruend|umstrukturier/i.test(q);
  return {category:growth?'GROWTH_TRIGGER':/onlineshop|online-shop|produktionsanlage|mobile.{0,20}arbeit|compliance/i.test(q)?'INFERRED_IT_OPPORTUNITY':'BUSINESS_TRIGGER',eventCategory:/standort|niederlassung|büro|betrieb|eröffn/i.test(q)?'location':/übernahm|fusion/i.test(q)?'merger':/gründ|gruend|tochter/i.test(q)?'founding':it?'technology_change':growth?'growth':'business_change',needConfidence:it?55:20,partnerSelected};
 }
 return null;
}
export function buildEventIntelligence(quote:string,signalType:string,raw:unknown,settings:{hourlyRate?:number;serviceOffer:string;model:string},meta:{publishedAt?:string|null;contactable?:boolean}={}):EventIntelligence|null{
 const classification=classifyBusinessEvent(quote,signalType);if(!classification)return null;
 const x=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const offerRaw=x.offer&&typeof x.offer==='object'?x.offer as Record<string,unknown>:{};
 const rate=Math.max(20,Math.min(1000,settings.hourlyRate||100));
 const hoursMin=Math.max(1,Math.min(80,Math.round(Number(offerRaw.hoursMin)||5))),hoursMax=Math.max(hoursMin,Math.min(120,Math.round(Number(offerRaw.hoursMax)||15)));
 const isHiring=classification.category==='INTERNAL_HIRING_ONLY',confirmed=classification.category==='EXPLICIT_EXTERNAL_DEMAND';
 const hypotheses=list(x.hypotheses).filter(value=>!/(?:kein(?:e|en)? backup|sicherheitslücke|sicherheitsluecke|ungesicherte|veraltete|unsichere)\b/i.test(value)||normalizeEvidenceText(quote).includes(normalizeEvidenceText(value)));
 const current=meta.publishedAt?Math.max(0,(Date.now()-Date.parse(meta.publishedAt))/86400000):null;
 const dimensions={event:confirmed?20:classification.category==='BUSINESS_TRIGGER'?17:isHiring?10:15,recency:current===null?5:current<90?15:current<365?10:3,fit:settings.serviceOffer.toLocaleLowerCase('de-DE').split(/[^a-zäöüß0-9]+/).some(word=>word.length>3&&(clean(offerRaw.title)+' '+clean(offerRaw.description)).toLocaleLowerCase('de-DE').includes(word))?15:5,feasibility:hoursMax<=20?15:hoursMax<=40?10:4,scope:hoursMin*rate<=2000&&hoursMax*rate>=500?15:7,retainer:offerRaw.monthlyPotential==='high'?10:offerRaw.monthlyPotential==='medium'?6:2,contact:meta.contactable?10:0};
 let score=Object.values(dimensions).reduce((a,b)=>a+b,0);if(isHiring)score=Math.min(score,55);if(classification.partnerSelected)score=Math.min(score,35);
 const questions=list(x.unknowns);if(!questions.length)questions.push('Besteht für diesen Anlass tatsächlich Unterstützungsbedarf?','Sind interne Ressourcen oder ein externer Partner bereits eingeplant?','Welcher Zeitrahmen und welches Budget sind vorgesehen?');
 const title=clean(offerRaw.title,160),description=clean(offerRaw.description);
 const offer:EntryOffer|null=title&&description&&!classification.partnerSelected?{title,description,benefit:clean(offerRaw.benefit),scope:clean(offerRaw.scope),hoursMin,hoursMax,priceMin:hoursMin*rate,priceMax:hoursMax*rate,hourlyRate:rate,estimated:true,assumptions:list(offerRaw.assumptions),openQuestions:list(offerRaw.openQuestions).length?list(offerRaw.openQuestions):questions,followUps:list(offerRaw.followUps),monthlyPotential:['high','medium','low'].includes(String(offerRaw.monthlyPotential))?offerRaw.monthlyPotential as EntryOffer['monthlyPotential']:'unknown'}:null;
 if(!offer)score=Math.min(score,45);
 return {category:classification.category,eventCategory:classification.eventCategory,verifiedEvent:quote,hypotheses:hypotheses.map(statement=>({statement,status:'hypothesis'})),offer,timing:clean(x.timing),unknowns:questions,conversationOpener:clean(x.conversationOpener),itNeedConfidence:classification.needConfidence,entryOpportunityScore:Math.min(100,score),externalEngagement:confirmed?'confirmed':classification.partnerSelected||isHiring?'unknown':offer?'plausible':'unknown',scoreReason:clean(x.scoreReason)||'Bewertung aus belegtem Anlass, Aktualität, begrenztem Projektumfang und verfügbaren Kontaktwegen. Keine Kaufwahrscheinlichkeit.',partnerAlreadySelected:classification.partnerSelected,modelVersion:settings.model,researchedAt:new Date().toISOString()};
}
/** Largest remainder allocation: budget shares, never an artificial result quota. */
export function allocateScoutBudget(total:number,weights:Record<Scout,number>=DEFAULT_SCOUT_WEIGHTS):Record<Scout,number>{
 const keys=SCOUTS.map(([key])=>key),sum=keys.reduce((n,k)=>n+Math.max(0,weights[k]||0),0);const budget=Math.max(0,Math.floor(total));
 const result=Object.fromEntries(keys.map(k=>[k,sum?Math.floor(budget*Math.max(0,weights[k]||0)/sum):0])) as Record<Scout,number>;
 const order=keys.filter(k=>weights[k]>0).sort((a,b)=>(budget*weights[b]/sum%1)-(budget*weights[a]/sum%1));let left=budget-Object.values(result).reduce((a,b)=>a+b,0);for(let i=0;left>0&&order.length;i++,left--)result[order[i%order.length]]++;
 return result;
}
