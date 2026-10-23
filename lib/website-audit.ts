import {db,init} from './db';
import {getSettings} from './settings';
import {websiteResponse} from './web-search';
import {fetchPageSpeed} from './website-check/pagespeed-client';
import {parsePageSpeedResponse} from './website-check/pagespeed-parser';
import {scanSiteIntelligence} from './website-check/site-intelligence';
import type {WebsiteCheckResult} from './website-check/types';
import {publicWebUrl} from './firecrawl';

export type WebsiteAudit={sourceResult?:WebsiteCheckResult;intelligence?:WebsiteCheckResult['intelligence'];url:string;checkedAt:string;strategy:string;performance:number|null;accessibility:number|null;seo:number|null;bestPractices:number|null;issues:{id:string;title:string;description:string;score:number|null;displayValue?:string}[];reportUrl:string;dns:Record<string,string[]>;http?:Awaited<ReturnType<typeof websiteResponse>>;limitations:string[]};
const percent=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.round(Math.min(1,Math.max(0,value))*100):null;
export function lighthouseResult(data:Record<string,any>){
 const report=data.lighthouseResult;if(!report||report.runtimeError)throw Error('Lighthouse lieferte keinen verwertbaren Bericht.');
 return {performance:percent(report.categories?.performance?.score),accessibility:percent(report.categories?.accessibility?.score),seo:percent(report.categories?.seo?.score),bestPractices:percent(report.categories?.['best-practices']?.score),issues:Object.entries(report.audits||{}).flatMap(([id,raw])=>{const item=raw as Record<string,any>;return typeof item.score==='number'&&item.score<0.9&&!['manual','notApplicable','informative'].includes(item.scoreDisplayMode)?[{id,title:String(item.title||id).slice(0,250),description:String(item.description||'').slice(0,1500),score:percent(item.score),displayValue:String(item.displayValue||'').slice(0,250)}]:[]}).slice(0,25)};
}
export async function auditWebsite(value:string,signal=AbortSignal.timeout(120000)):Promise<WebsiteAudit>{
 const url=publicWebUrl(value);if(!url)throw Error('Öffentliche Firmenwebsite erforderlich.');
 const settings=await getSettings(),limitations:string[]=[];
 const response=await websiteResponse(url.href,signal); // Validate public DNS/redirects before asking external services.
 const final=publicWebUrl(response.url);if(!final)throw Error('Ungültiges Weiterleitungsziel.');
 const [lighthouse,intelligence,...dnsResults]=await Promise.allSettled([fetchPageSpeed(final.href,'mobile',fetch,60000,settings.googlePagespeedKey,signal).then(data=>({scores:lighthouseResult(data as Record<string,any>),sourceResult:parsePageSpeedResponse(data,final.href,final.hostname,'mobile')})),scanSiteIntelligence(final.href,signal),...['A','AAAA','MX','NS','TXT'].map(async type=>{const query=new URL('https://dns.google/resolve');query.searchParams.set('name',final.hostname);query.searchParams.set('type',type);const res=await fetch(query,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});if(!res.ok)throw Error('DNS nicht verfügbar');const data=await res.json();if(data.Status!==0)throw Error('DNS-Status '+data.Status);return (data.Answer||[]).map((item:{data:unknown})=>String(item.data).slice(0,500)).slice(0,12)})]);
 if(lighthouse.status==='rejected')limitations.push(lighthouse.reason instanceof Error?lighthouse.reason.message:'Lighthouse nicht verfügbar.');
 const dns:Record<string,string[]>={};['A','AAAA','MX','NS','TXT'].forEach((type,index)=>{const result=dnsResults[index];if(result.status==='fulfilled')dns[type]=result.value;else limitations.push('DNS '+type+' nicht auswertbar.')});
 if(intelligence.status==='rejected')limitations.push('Erweiterter Website-Check derzeit nicht vollständig verfügbar.');
 const scores=lighthouse.status==='fulfilled'?lighthouse.value.scores:{performance:null,accessibility:null,seo:null,bestPractices:null,issues:[]};
 if(!response.https)scores.issues.push({id:'https',title:'Website endet auf HTTP',description:'Die geprüfte Weiterleitung endet ohne HTTPS. Keine Aussage über andere URLs.',score:0,displayValue:''});
 for(const name of ['strict-transport-security','content-security-policy','x-content-type-options'])if(!response.headers[name])scores.issues.push({id:'header-'+name,title:'Header nicht beobachtet: '+name,description:'Bei dieser Antwort nicht vorhanden. Dies allein belegt keine ausnutzbare Sicherheitslücke.',score:null,displayValue:''});
 return {...(lighthouse.status==='fulfilled'?{sourceResult:lighthouse.value.sourceResult}:{}),...(intelligence.status==='fulfilled'?{intelligence:intelligence.value}:{}),url:final.href,checkedAt:new Date().toISOString(),strategy:'mobile',...scores,dns,http:response,limitations,reportUrl:'https://pagespeed.web.dev/analysis?url='+encodeURIComponent(final.href)+'&form_factor=mobile'};
}
export async function auditLeadWebsite(id:string){
 await init();const row=(await db().query('SELECT company_url FROM opportunities WHERE id=$1',[id])).rows[0];if(!row?.company_url)throw Error('Noch keine verifizierte Firmenwebsite vorhanden.');
 const audit=await auditWebsite(row.company_url);await db().query('UPDATE opportunities SET website_audit=$2 WHERE id=$1 AND company_url=$3',[id,JSON.stringify(audit),row.company_url]);
 // Refresh the dossier so verified website findings enter its normal assessment and opener.
 await db().query("UPDATE opportunities SET research_status='pending',research_attempts=0,research_next_attempt_at=NULL,research_stage='Websiteanalyse in Dossier übernehmen',detected_at=now() WHERE id=$1 AND company_url=$2",[id,row.company_url]);return audit;
}
