import {isIP} from 'node:net';
import {classifyBusinessEvent} from './business-triggers';

export type EvidenceSource={kind:'website'|'mcp';url:string};
export type EvidenceCandidate={name:string;city:string;signal:string;signalType:string;priority:'A'|'B'|'C';summary:string;sourceUrl:string;evidenceQuote:string;companyUrl?:string;score:number;eventAnalysis?:unknown};

/** Only layout and Unicode representation are normalized for literal quotes. */
export function normalizeEvidenceText(value:string){
 return value.normalize('NFKC').replace(/\u00ad/g,'').replace(/\s+/gu,' ').trim().toLocaleLowerCase('de-DE');
}
export function hasEvidenceQuote(text:string,quote:string){
 const needle=normalizeEvidenceText(quote);
 return needle.length>=12&&normalizeEvidenceText(text).includes(needle);
}
function nameTokens(value:string){
 return normalizeEvidenceText(value).replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' und ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function coreCompanyName(value:string){
 const tokens=nameTokens(value);
 return tokens.replace(/\s+(?:gmbh(?: und co(?: kg| ohg)?)?|ug(?: haftungsbeschraenkt)?|ag|kg|ohg|gbr|mbh|se|e g|eg|e v|ev|ltd|inc)$/, '').trim();
}
function containsPhrase(haystack:string,needle:string){return !!needle&&(' '+haystack+' ').includes(' '+needle+' ')}
export function companyNameMentioned(text:string,name:string){
 const core=coreCompanyName(name);
 return core.length>=2&&containsPhrase(nameTokens(text),core);
}
function canonicalLocation(value:string){
 return nameTokens(value).replace(/\bmunich\b/g,'muenchen').replace(/\blandsberg (?:a|am) lech\b/g,'landsberg lech');
}
export function locationMentioned(text:string,city:string){
 const location=city.replace(/,\s*(?:deutschland|germany)$/i,'').trim();
 return location.length>=2&&containsPhrase(canonicalLocation(text),canonicalLocation(location));
}
const IT_TERMS=/\b(?:it|edv|cloud\w*|azure|microsoft\s*365|m365|erp|crm|digitalisier\w*|automatisier\w*|cyber\w*|netzwerk\w*|software\w*|systemadministr\w*|infrastruktur\w*|backup\w*|schnittstelle\w*|informationssicherheit|informationstechnologie|information technology|digital transformation)\b/i;
const FIRST_IT=/(?:\berst(?:e|en|er|es|malig\w*|mals)?\b.{0,50}\b(?:it|edv)\b|\b(?:aufbau|aufbauen|aufzubauen|gruendung|gründen)\b.{0,50}\b(?:unser(?:e|er|en)?\s+(?:internen?\s+)?it|(?:internen?\s+)?it[- ]abteilung|eigene[nr]?\s+it)\b|\b(?:it|edv)\b.{0,50}\b(?:erstmals|bisher nebenbei|allrounder\w*|generalist\w*)\b|\b(?:keine|ohne)\b.{0,25}\b(?:eigene\s+)?it[- ]abteilung\b|\b(?:it|edv)\b.{0,35}\bnebenbei\b)/i;
const EXTERNAL_DEMAND=/(?:\b(?:suchen|gesucht|beauftragen|beauftragung|ausschreibung|wechseln)\b.{0,70}\b(?:externe[nr]?\s+(?:it[- ]?)?(?:dienstleister|betreuung|partner)|it[- ]dienstleister|it[- ]betreuung)\b|\b(?:externe[nr]?\s+(?:it[- ]?)?(?:dienstleister|betreuung|partner)|it[- ]dienstleister|it[- ]betreuung)\b.{0,50}\b(?:gesucht|suchen|benötig\w*|wechseln)\b|\bdienstleisterwechsel\b)/i;
const PROJECT_CHANGE=/\b(?:modernisier\w*|erneuer\w*|erweiter\w*|planung|planen|geplant\w*|migration\w*|migrier\w*|einfuehr\w*|einführ\w*|einfuehren|einführen|aufbau\w*|aufbauen|ausbau\w*|ausbauen|rollout\w*|digitalisier\w*|automatisier\w*|optimier\w*|transformation\w*|umstellung\w*|outsourcing|ausschreibung\w*|vergab\w*)\b/i;
export function classifyEvidencePriority(quote:string,signalType:string):'A'|'B'|'C'{
 const text=normalizeEvidenceText(quote);
 if(signalType==='growth')return 'C';
 if(FIRST_IT.test(text)||EXTERNAL_DEMAND.test(text))return 'A';
 return PROJECT_CHANGE.test(text)?'B':'C';
}
function webUrl(value:string){
 try{
  const url=new URL(value);
  return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&url.hostname.includes('.')&&!isIP(url.hostname)&&!url.hostname.endsWith('.local')&&!url.hostname.endsWith('.internal')?url:null;
 }catch{return null}
}
function sameOriginal(source:EvidenceSource,text:string,value:string){
 const url=webUrl(value);if(!url)return false;
 if(source.kind==='mcp')return text.includes(value);
 try{return url.href===new URL(source.url).href}catch{return false}
}
const SECONDARY_HOST=/(^|\.)(?:linkedin\.com|xing\.com|indeed\.[a-z.]+|stepstone\.[a-z.]+|monster\.[a-z.]+|jobware\.de|stellenanzeigen\.de|jobs\.heise\.de|arbeitsagentur\.de|joblift\.de|kimeta\.de|meinestadt\.de|talent\.com|northdata\.[a-z.]+|creditreform\.[a-z.]+|facebook\.com|instagram\.com|youtube\.com)$/i;
function companyHostMatchesName(hostname:string,name:string){
 const host=nameTokens(hostname.replace(/^www\./,'').split('.').slice(0,-1).join(' ')).replace(/\s+/g,'');
 const core=coreCompanyName(name),compact=core.replace(/\bund\b/g,'').replace(/\s+/g,'');
 if(compact.length>=3&&host===compact)return true;
 return core.split(' ').some(token=>token.length>=4&&host.includes(token));
}
function publishedUrlMentioned(text:string,url:URL){
 return [...text.matchAll(/https?:\/\/[^\s"'<>\\)\]]+/g)].some(match=>{
  try{return new URL(match[0].replace(/[.,;]+$/,'')).origin===url.origin}catch{return false}
 });
}
function companyWebsite(source:EvidenceSource,text:string,value:unknown,name:string){
 if(typeof value!=='string')return undefined;
 const url=webUrl(value);if(!url||SECONDARY_HOST.test(url.hostname)||url.hostname.startsWith('jobs.'))return undefined;
 let sameSite=false;try{sameSite=source.kind==='website'&&url.hostname.replace(/^www\./,'')===new URL(source.url).hostname.replace(/^www\./,'')}catch{}
 // An article mentioning a company does not make the publisher its official website.
 if(sameSite)return companyHostMatchesName(url.hostname,name)?url.origin:undefined;
 return publishedUrlMentioned(text,url)?url.origin:undefined;
}
function evidenceContexts(text:string,quote:string){
 const normalized=normalizeEvidenceText(text),needle=normalizeEvidenceText(quote),contexts:string[]=[];
 for(let at=normalized.indexOf(needle);at>=0&&contexts.length<8;at=normalized.indexOf(needle,at+needle.length))contexts.push(normalized.slice(Math.max(0,at-1800),at+needle.length+1800));
 return contexts;
}

/** Ground identity and signal in the same local section, including job result lists. */
export function validateEvidenceCandidate(raw:Record<string,unknown>,source:EvidenceSource,text:string,skills:string[]):EvidenceCandidate[]{
 const field=(key:string)=>typeof raw[key]==='string'?raw[key].trim():'';
 const name=field('name'),city=field('city'),signal=field('signal'),summary=field('summary'),sourceUrl=field('sourceUrl'),evidenceQuote=field('evidenceQuote'),signalType=field('signalType');
 if(name.length<2||name.length>255||city.length<2||city.length>100||signal.length<8||evidenceQuote.length<12||evidenceQuote.length>1000||!skills.includes(signalType)||!sameOriginal(source,text,sourceUrl)||!hasEvidenceQuote(text,evidenceQuote)||!classifyBusinessEvent(evidenceQuote,signalType))return [];
 const contexts=evidenceContexts(text,evidenceQuote);
 if(!contexts.some(context=>companyNameMentioned(context,name))||!locationMentioned(text,city))return [];
 let secondary=false;try{secondary=SECONDARY_HOST.test(new URL(sourceUrl).hostname)}catch{}
 if(secondary&&!contexts.some(context=>companyNameMentioned(context,name)&&locationMentioned(context,city)))return [];
 const score=Number(raw.score);
 return [{name,city,signal:signal.slice(0,500),summary:summary.slice(0,2000),sourceUrl:new URL(sourceUrl).href,evidenceQuote,companyUrl:companyWebsite(source,text,raw.companyUrl,name),signalType,priority:classifyEvidencePriority(evidenceQuote,signalType),score:Number.isFinite(score)?Math.min(100,Math.max(0,score)):0,eventAnalysis:raw.intelligence}];
}
