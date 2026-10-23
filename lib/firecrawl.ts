import {isIP} from 'node:net';

export type SearchHit={url:string;title:string;description:string;scout?:string};
export type PageLink={url:string;label:string};
export type PublicContact={kind:string;label:string;value:string;url:string;sourceUrl:string;quote:string;checkedAt:string};
export type VerifiedPage={url:string;title:string;text:string;publishedAt:string|null;sourceReliability:'other_web'|'public_portal'|'secondary';checkedAt:string;links?:PageLink[];contacts?:PublicContact[]};

export function publicWebUrl(value:string){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&url.hostname.includes('.')&&!url.hostname.endsWith('.local')&&!url.hostname.endsWith('.internal')&&!isIP(url.hostname)?url:null}catch{return null}}
export function reliability(url:URL):VerifiedPage['sourceReliability']{const host=url.hostname.toLowerCase();if(/(^|\.)(arbeitsagentur\.de|ted\.europa\.eu|bund\.de|service\.bund\.de|evergabe[^.]*\.de|vergabe[^.]*\.de)$/.test(host))return 'public_portal';if(/(^|\.)(linkedin\.com|xing\.com|indeed\.com|stepstone\.de|northdata\.de)$/.test(host))return 'secondary';return 'other_web'}
export class FirecrawlError extends Error{
 constructor(readonly code:'authentication'|'quota'|'rate_limited'|'upstream'|'timeout'|'network'|'source'|'invalid_response',readonly status?:number,readonly retryAfterMs?:number){
  const reason={authentication:'API-Key wurde nicht akzeptiert.',quota:'Guthaben oder Nutzungslimit ist ausgeschöpft.',rate_limited:'Der Anbieter begrenzt derzeit die Anfragen.',upstream:'Der Anbieter ist vorübergehend nicht erreichbar.',timeout:'Das Zeitlimit wurde überschritten.',network:'Verbindung zum Anbieter fehlgeschlagen.',source:'Die angefragte Originalseite konnte nicht verarbeitet werden.',invalid_response:'Die Antwort enthält keine gültigen Suchdaten.'}[code];
  super('Firecrawl'+(status?' HTTP '+status:'')+': '+reason);this.name='FirecrawlError';
 }
}
async function call(key:string,path:string,body:Record<string,unknown>,signal?:AbortSignal){
 if(!key)throw new FirecrawlError('authentication');
 let response:Response;
 try{response=await fetch('https://api.firecrawl.dev/v2/'+path,{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([AbortSignal.timeout(35000),...(signal?[signal]:[])])})}
 catch(error){throw new FirecrawlError(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'timeout':'network')}
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.success===false){
  const raw=typeof data?.error==='string'?data.error:typeof data?.error?.message==='string'?data.error.message:'';
  const code=response.status===401||response.status===403?'authentication':response.status===402||/insufficient.{0,30}credits|credits.{0,30}(?:exhaust|insufficient)|quota|credit balance/i.test(raw)?'quota':response.status===429?'rate_limited':path==='scrape'&&response.status>=400&&response.status<500?'source':'upstream';
  const after=response.headers.get('retry-after');let delay=after?Number(after)*1000:NaN;if(after&&!Number.isFinite(delay))delay=Date.parse(after)-Date.now();
  throw new FirecrawlError(code,response.status,Number.isFinite(delay)?Math.max(1000,Math.min(86400000,delay)):undefined);
 }
 if(!data||!data.data||typeof data.data!=='object')throw new FirecrawlError('invalid_response',response.status);
 return data.data as Record<string,unknown>;
}
export async function searchWeb(key:string,query:string,limit=8,signal?:AbortSignal):Promise<SearchHit[]>{const data=await call(key,'search',{query,limit:Math.min(20,limit),country:'DE',sources:[{type:'web'}]},signal);if(!Array.isArray(data?.web))throw new FirecrawlError('invalid_response');const items=data.web;return items.flatMap((value:unknown)=>{if(!value||typeof value!=='object')return [];const hit=value as Record<string,unknown>;const url=String(hit.url||'');return publicWebUrl(url)?[{url,title:String(hit.title||'').slice(0,200),description:String(hit.description||'').slice(0,1000)}]:[]})}
export async function scrapePage(key:string,value:string,signal?:AbortSignal):Promise<VerifiedPage|null>{const url=publicWebUrl(value);if(!url)return null;const data=await call(key,'scrape',{url:url.href,formats:['markdown','links'],onlyMainContent:false,timeout:30000},signal);const meta=(data?.metadata&&typeof data.metadata==='object'?data.metadata:{}) as Record<string,unknown>;const final=publicWebUrl(String(meta.url||meta.sourceURL||url.href));if(!final||Number(meta.statusCode||200)>=400)return null;const text=String(data?.markdown||'').slice(0,60000);if(text.length<100)return null;const published=String(meta.publishedTime||meta.articlePublishedTime||meta.date||'').trim();const links=Array.isArray(data?.links)?data.links.flatMap(value=>{const link=publicWebUrl(String(value));return link?[{url:link.href,label:''}]:[]}).slice(0,100):[];return {url:final.href,title:String(meta.title||'').slice(0,200),text,publishedAt:published&&Number.isFinite(Date.parse(published))?new Date(published).toISOString():null,sourceReliability:reliability(final),checkedAt:new Date().toISOString(),links}}
