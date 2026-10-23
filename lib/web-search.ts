import {lookup} from 'node:dns/promises';
import {load} from 'cheerio';
import {nativeSearch,NativeSearchError,type NativeSearchSettings} from './native-web-search';
import {publicWebUrl,reliability,FirecrawlError,searchWeb as firecrawlSearch,scrapePage as firecrawlScrape,type SearchHit,type VerifiedPage,type PageLink,type PublicContact} from './firecrawl';

const SEARCH_SERVICE='http://searxng:8080';
export type SearchDiagnostic={backend:'searxng'|'firecrawl'|'openai'|'anthropic';status:'ok'|'empty'|'degraded'|'unavailable';message:string;engines?:Array<{name:string;reason:string}>;retryAfterSeconds?:number};
export type SearchOptions={ai?:NativeSearchSettings;onDiagnostic?:(diagnostic:SearchDiagnostic)=>void;forceRetry?:boolean};
export type SearchResult={hits:SearchHit[];backend:SearchDiagnostic['backend'];diagnostics:SearchDiagnostic[]};
export class WebSearchUnavailableError extends Error{
 readonly code='WEB_SEARCH_UNAVAILABLE';
 constructor(readonly diagnostics:SearchDiagnostic[]){super('Websuche derzeit nicht verfügbar. '+diagnostics.filter(item=>item.status==='unavailable').map(item=>item.message).join(' '));this.name='WebSearchUnavailableError'}
}
export class WebSearchQueryError extends Error{
 readonly code='WEB_SEARCH_QUERY_FAILED';
 constructor(readonly diagnostics:SearchDiagnostic[]){super('Einzelne Suchanfrage ohne verwertbare Suchquellen; weitere Anfragen werden fortgesetzt.');this.name='WebSearchQueryError'}
}
class LocalSearchFailure extends Error{constructor(readonly diagnostic:SearchDiagnostic){super(diagnostic.message)}}
const firecrawlBackoff=new Map<string,{until:number;diagnostic:SearchDiagnostic}>();
const firecrawlScrapeBackoff=new Map<string,number>();
const nativeBackoff=new Map<string,{until:number;message:string}>();
let engineCache:{until:number;names:string[]}|undefined;
let engineLoading:Promise<string[]>|undefined;
let localBackoff:{until:number;diagnostic:SearchDiagnostic}|undefined;
let searchQueue:Promise<unknown>=Promise.resolve(),lastLocalRequest=0;

function publicAddress(address:string){
 if(address.includes(':'))return /^[23][0-9a-f]*:/i.test(address);
 const bytes=address.split('.').map(Number),[a,b]=bytes;
 return bytes.length===4&&bytes.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&a>0&&a<224&&a!==10&&a!==127&&!(a===100&&b>=64&&b<=127)&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&(b===0||b===168))&&!(a===198&&(b===18||b===19));
}
async function safeDestination(url:URL){
 if(process.env.NODE_USE_ENV_PROXY==='1'&&(process.env.HTTPS_PROXY||process.env.HTTP_PROXY))return;
 const records=await lookup(url.hostname,{all:true});
 if(!records.length||records.some(record=>!publicAddress(record.address)))throw Error('Nicht öffentliche Zieladresse');
}
const localFailure=(message:string,engines?:SearchDiagnostic['engines'])=>new LocalSearchFailure({backend:'searxng',status:'unavailable',message,engines});
function engineIssues(value:unknown):NonNullable<SearchDiagnostic['engines']>{
 if(!Array.isArray(value))return [];
 return value.flatMap(item=>Array.isArray(item)&&typeof item[0]==='string'?[{name:item[0].replace(/[^\p{L}\p{N} ._-]/gu,'').slice(0,60),reason:typeof item[1]==='string'?item[1].replace(/https?:\/\/\S+/g,'[URL]').replace(/[\r\n]/g,' ').slice(0,160):'Unbekannter Anbieterfehler'}]:[]).slice(0,20);
}
async function searchEngines(){
 if(engineCache&&engineCache.until>Date.now())return engineCache.names;
 if(!engineLoading)engineLoading=(async()=>{
  let response:Response;
  try{response=await fetch(SEARCH_SERVICE+'/config',{signal:AbortSignal.timeout(8000),headers:{accept:'application/json'}})}catch{throw localFailure('Der Suchdienst SearXNG ist nicht erreichbar. Containerstatus, DNS und Netzwerkverbindung prüfen.')}
  if(!response.ok)throw localFailure('SearXNG-Konfiguration ist nicht lesbar (HTTP '+response.status+').');
  let data:{engines?:Array<{name?:string;enabled?:boolean;categories?:string[]}>};
  try{data=await response.json()}catch{throw localFailure('SearXNG-Konfiguration liefert kein gültiges JSON.')}
  if(!Array.isArray(data.engines))throw localFailure('SearXNG liefert keine Enginekonfiguration.');
  const names=data.engines.filter(engine=>engine.enabled&&engine.categories?.includes('general')&&engine.categories.includes('web')&&typeof engine.name==='string').map(engine=>engine.name!);
  if(!names.length)throw localFailure('In SearXNG ist keine allgemeine Websuchmaschine aktiviert.');
  engineCache={until:Date.now()+10*60*1000,names};return names;
 })().finally(()=>{engineLoading=undefined});
 return engineLoading;
}
async function performLocalSearch(query:string,limit:number,signal?:AbortSignal):Promise<{hits:SearchHit[];diagnostic:SearchDiagnostic}>{
 if(localBackoff&&localBackoff.until>Date.now())throw new LocalSearchFailure({...localBackoff.diagnostic,retryAfterSeconds:Math.ceil((localBackoff.until-Date.now())/1000)});
 try{
  const engines=await searchEngines();
  const delay=750-(Date.now()-lastLocalRequest);if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));lastLocalRequest=Date.now();
  const url=new URL('/search',SEARCH_SERVICE);url.searchParams.set('q',query);url.searchParams.set('format','json');url.searchParams.set('language','de-DE');url.searchParams.set('categories','general');url.searchParams.set('engines',engines.join(','));
  let response:Response;
  try{response=await fetch(url,{signal:AbortSignal.any([AbortSignal.timeout(25000),...(signal?[signal]:[])]),headers:{accept:'application/json'}})}catch(error){throw localFailure(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'SearXNG hat innerhalb von 25 Sekunden nicht geantwortet.':'SearXNG ist beim Suchen nicht erreichbar. Containerstatus und Netzwerkverbindung prüfen.')}
  if(!response.ok)throw localFailure('SearXNG-Websuche meldet HTTP '+response.status+(response.status===403?'. JSON-Suchzugang und SearXNG-Konfiguration prüfen.':'.'));
  let data:{results?:Array<{url?:string;title?:string;content?:string}>;unresponsive_engines?:unknown};
  try{data=await response.json()}catch{throw localFailure('SearXNG-Websuche liefert kein gültiges JSON.')}
  if(!Array.isArray(data.results))throw localFailure('SearXNG-Websuche liefert kein gültiges Ergebnisformat.');
  const seen=new Set<string>();
  const hits=data.results.flatMap(item=>{if(!item||typeof item!=='object')return [];const url=publicWebUrl(String(item.url||''));if(!url||seen.has(url.href))return [];seen.add(url.href);return [{url:url.href,title:load(String(item.title||'')).text().slice(0,200),description:load(String(item.content||'')).text().slice(0,1000)}]}).slice(0,limit);
  const issues=engineIssues(data.unresponsive_engines).filter(issue=>engines.includes(issue.name));
  if(!hits.length&&engines.every(name=>issues.some(issue=>issue.name===name)))throw localFailure('Alle angefragten SearXNG-Suchmaschinen sind ausgefallen: '+issues.map(issue=>issue.name+' ('+issue.reason+')').join(', ')+'.',issues);
  const status=issues.length?'degraded':hits.length?'ok':'empty';
  return {hits,diagnostic:{backend:'searxng',status,message:issues.length?'SearXNG ist teilweise verfügbar: '+issues.map(issue=>issue.name+' ('+issue.reason+')').join(', ')+'. Andere angefragte Suchmaschinen haben keinen Fehler gemeldet.':hits.length?'Integrierte Websuche hat Treffer geliefert.':'Integrierte Websuche hat korrekt geantwortet, aber keine Treffer für diese Anfrage gefunden.',engines:issues}};
 }catch(error){
  signal?.throwIfAborted();
  const failure=error instanceof LocalSearchFailure?error:localFailure('SearXNG konnte die Suche nicht verarbeiten.');
  localBackoff={until:Date.now()+60000,diagnostic:failure.diagnostic};throw failure;
 }
}
function localSearch(query:string,limit:number,forceRetry=false,signal?:AbortSignal){
 // Serialize metasearch without letting a cancelled dossier block its caller.
 const request=searchQueue.then(()=>{signal?.throwIfAborted();if(forceRetry){localBackoff=undefined;engineCache=undefined}return performLocalSearch(query,limit,signal)});searchQueue=request.catch(()=>{});
 if(!signal)return request;
 return new Promise<Awaited<typeof request>>((resolve,reject)=>{
  const abort=()=>reject(signal.reason);if(signal.aborted){abort();return}
  signal.addEventListener('abort',abort,{once:true});request.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}

export async function searchWebDetailed(firecrawlKey:string,query:string,limit=8,options:SearchOptions={}):Promise<SearchResult>{
 const diagnostics:SearchDiagnostic[]=[];
 const report=(diagnostic:SearchDiagnostic)=>{diagnostics.push(diagnostic);options.onDiagnostic?.(diagnostic)};
 let successfulEmpty:SearchDiagnostic['backend']|undefined;
 const count=Math.max(1,Math.min(30,Math.trunc(limit)||8));
 const cleanQuery=query.replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim();
 if(!cleanQuery)throw Error('Suchanfrage ist leer.');
 if(options.forceRetry&&firecrawlKey)firecrawlBackoff.delete(firecrawlKey)
 let queryFailure=false,nativeAttempted=false;
 async function attemptNative():Promise<SearchResult|null>{
  nativeAttempted=true;
  const ai=options.ai,key=ai?.provider==='anthropic'?ai.anthropicKey:ai?.openaiKey;
 if(ai&&ai.nativeWebSearch!==false&&key){
  const identity=ai.provider+':'+ai.model+':'+key;
  if(options.forceRetry)nativeBackoff.delete(identity);
  const prior=nativeBackoff.get(identity);
  if(prior&&prior.until>Date.now())report({backend:ai.provider,status:'unavailable',message:prior.message,retryAfterSeconds:Math.ceil((prior.until-Date.now())/1000)});
  else try{
   const hits=await nativeSearch(ai,cleanQuery,count);report({backend:ai.provider,status:hits.length?'ok':'empty',message:(ai.provider==='openai'?'OpenAI':'Claude')+(ai.searchBackend==='native'?'-Websuche wurde direkt verwendet':'-Websuche wurde als Ersatz verwendet')+(hits.length?'.':', hat aber keine Treffer geliefert.')});return {hits,backend:ai.provider,diagnostics};
  }catch(error){
   ai.researchSignal?.throwIfAborted();
   const message=error instanceof Error?error.message:'Native KI-Websuche ist nicht verfügbar.';
   queryFailure=error instanceof NativeSearchError&&error.querySpecific;
   if(!queryFailure){if(nativeBackoff.size>20)nativeBackoff.clear();nativeBackoff.set(identity,{until:Date.now()+Math.max(120000,error instanceof NativeSearchError?error.retryAfterMs||0:0),message})}
   report({backend:ai.provider,status:queryFailure?'degraded':'unavailable',message});
  }
 }else if(ai&&ai.nativeWebSearch!==false){report({backend:ai.provider,status:'unavailable',message:'Für die KI-Ersatzsuche fehlt der API-Key des ausgewählten Anbieters. Unter Einstellungen → KI & Quellen speichern.'})}
  return null;
 }
 if(options.ai?.searchBackend==='native'){const primary=await attemptNative();if(primary)return primary}
 if(firecrawlKey&&options.ai?.firecrawlEnabled!==false){
  const prior=firecrawlBackoff.get(firecrawlKey);
  if(prior&&prior.until>Date.now())report({...prior.diagnostic,retryAfterSeconds:Math.ceil((prior.until-Date.now())/1000)});
  else try{
   const hits=await firecrawlSearch(firecrawlKey,cleanQuery,count,options.ai?.researchSignal);report({backend:'firecrawl',status:hits.length?'ok':'empty',message:hits.length?'Firecrawl hat Suchtreffer geliefert.':'Firecrawl hat keine Treffer für diese Anfrage gefunden.'});if(hits.length)return {hits,backend:'firecrawl',diagnostics};successfulEmpty='firecrawl';
  }catch(error){
   options.ai?.researchSignal?.throwIfAborted();
   const diagnostic:SearchDiagnostic={backend:'firecrawl',status:'unavailable',message:error instanceof FirecrawlError?error.message:'Firecrawl konnte die Suche nicht ausführen.'};
   const delay=error instanceof FirecrawlError?error.retryAfterMs??(error.code==='rate_limited'?30000:120000):120000;
   firecrawlBackoff.set(firecrawlKey,{until:Date.now()+delay,diagnostic});report(diagnostic);
  }
 }
 let partial:{hits:SearchHit[];diagnostic:SearchDiagnostic}|undefined;
 if(options.ai?.localWebSearch!==false)try{
  partial=await localSearch(cleanQuery,count,options.forceRetry,options.ai?.researchSignal);report(partial.diagnostic);
  if(partial.hits.length||partial.diagnostic.status==='empty')return {hits:partial.hits,backend:'searxng',diagnostics};
 }catch(error){options.ai?.researchSignal?.throwIfAborted();report(error instanceof LocalSearchFailure?error.diagnostic:{backend:'searxng',status:'unavailable',message:'Die integrierte Websuche ist nicht erreichbar.'})}
 if(!nativeAttempted){const fallback=await attemptNative();if(fallback)return fallback}
 // A partial engine failure is not evidence that the remaining engines failed.
 if(partial)return {hits:partial.hits,backend:'searxng',diagnostics};
 if(successfulEmpty)return {hits:[],backend:successfulEmpty,diagnostics};
 if(queryFailure)throw new WebSearchQueryError(diagnostics);
 throw new WebSearchUnavailableError(diagnostics);
}
export async function searchWeb(firecrawlKey:string,query:string,limit=8,options:SearchOptions={}):Promise<SearchHit[]>{return (await searchWebDetailed(firecrawlKey,query,limit,options)).hits}
async function readLimited(response:Response,limit=600000,strict=false){
 if(strict&&Number(response.headers.get('content-length')||0)>limit){await response.body?.cancel();throw Error('Quelldokument überschreitet das Größenlimit')}
 const reader=response.body?.getReader();if(!reader)return new Uint8Array();
 const chunks:Uint8Array[]=[];let size=0;
 try{while(size<=limit){const next=await reader.read();if(next.done)break;chunks.push(next.value);size+=next.value.length;if(strict&&size>limit)throw Error('Quelldokument überschreitet das Größenlimit')}}
 finally{await reader.cancel().catch(()=>{})}
 return new Uint8Array(Buffer.concat(chunks).subarray(0,limit));
}
async function pdfPage(response:Response,url:URL):Promise<VerifiedPage|null>{
 const bytes=await readLimited(response,8*1024*1024,true);
 const {getDocumentProxy}=await import('unpdf');
 const document=await getDocumentProxy(bytes,{verbosity:0,useSystemFonts:false,disableFontFace:true,disableAutoFetch:true,disableStream:true});
 try{
  const parts:string[]=[],links:PageLink[]=[];let size=0;
  for(let index=1;index<=Math.min(document.numPages,80)&&size<60000;index++){
   const page=await document.getPage(index),content=await page.getTextContent();
   const text=content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('').trim();parts.push(`Seite ${index}\n${text}`);size+=text.length;
   for(const annotation of await page.getAnnotations()){const target=typeof annotation.url==='string'?publicWebUrl(annotation.url):null;if(target)links.push({url:target.href,label:typeof annotation.title==='string'?annotation.title:'PDF-Link'})}
   page.cleanup();
  }
  const text=parts.join('\n\n').slice(0,60000);if(text.length<100)return null;
  return decoratePage({url:url.href,title:url.pathname.split('/').pop()||'PDF-Dokument',text,publishedAt:null,sourceReliability:reliability(url),checkedAt:new Date().toISOString(),links});
 }finally{await document.loadingTask.destroy()}
}
export function socialKind(value:string){
 try{const host=new URL(value).hostname.replace(/^www\./,'');if(/(^|\.)(linkedin\.com|xing\.com)$/.test(host))return host.endsWith('linkedin.com')?'linkedin':'xing';if(/(^|\.)instagram\.com$/.test(host))return 'instagram';if(/(^|\.)(facebook\.com|fb\.com)$/.test(host))return 'facebook';if(/(^|\.)(youtube\.com|youtu\.be)$/.test(host))return 'youtube';if(/(^|\.)(twitter\.com|x\.com)$/.test(host))return 'social';return null}catch{return null}
}
function contact(kind:string,value:string,url:string,page:VerifiedPage,quote:string,label=kind):PublicContact{return {kind,label,value,url,sourceUrl:page.url,quote:quote.slice(0,500),checkedAt:page.checkedAt}}
function decoratePage(page:VerifiedPage):VerifiedPage{
 const links:PageLink[]=[...(page.links||[])];const contacts:PublicContact[]=[...(page.contacts||[])];
 for(const match of page.text.matchAll(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g)){const url=publicWebUrl(match[2]);if(url)links.push({url:url.href,label:match[1].slice(0,120)})}
 for(const link of links){const kind=socialKind(link.url);if(kind&&!/\/shar(e|er)|\/intent\/|\/login|[?&](share|url|u)=/i.test(link.url))contacts.push(contact(kind,link.url,link.url,page,link.url,link.label||kind))}
 for(const match of page.text.matchAll(/[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi)){
  const email=match[0].replace(/[.,;]+$/,'');if(email.length<=254&&!/\.(png|jpe?g|gif|svg|webp)$/i.test(email))contacts.push(contact('email',email,'mailto:'+email,page,email,'E-Mail'));
 }
 for(const match of page.text.matchAll(/(?:Telefon|Tel\.?|Phone|Mobil)\s*[:.]?\s*(\+?\d[\d ()/.-]{6,24}\d)/gi)){
  const value=match[1].trim(),digits=value.replace(/\D/g,'');if(digits.length>=8&&digits.length<=16)contacts.push(contact('phone',value,'tel:'+value.replace(/[^+\d]/g,''),page,match[0],'Telefon'));
 }
 const seen=new Set<string>(),seenContacts=new Set<string>();
 return {...page,links:links.filter(link=>{if(seen.has(link.url))return false;seen.add(link.url);return true}).slice(0,100),contacts:contacts.filter(item=>{const key=item.kind+':'+item.value.toLowerCase();if(seenContacts.has(key))return false;seenContacts.add(key);return true}).slice(0,35)};
}
export class SourceReadError extends Error {
 constructor(readonly code:string,message:string){super(message)}
}
function sourceFailure(error:unknown):SourceReadError {
 if(error instanceof SourceReadError)return error;
 const item=error as {name?:string;code?:string;cause?:{code?:string}};
 const code=item?.cause?.code||item?.code||'';
 if(/CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code))return new SourceReadError('tls','TLS-Zertifikat der Originalseite konnte nicht geprüft werden.');
 if(code==='ENOTFOUND')return new SourceReadError('dns','Domain der Originalseite wurde nicht gefunden (DNS).');
 if(code==='EAI_AGAIN')return new SourceReadError('transient','DNS der Originalseite antwortet vorübergehend nicht.');
 if(/TIMEOUT|ETIMEDOUT/.test(code)||['AbortError','TimeoutError'].includes(item?.name||''))return new SourceReadError('timeout','Originalseite hat nicht innerhalb des Zeitlimits geantwortet.');
 if(code==='ECONNREFUSED')return new SourceReadError('network','Originalseite hat die Verbindung abgelehnt.');
 return new SourceReadError('transient','Verbindung zur Originalseite ist fehlgeschlagen oder wurde unterbrochen.');
}
async function fetchOriginal(url:URL,signal?:AbortSignal):Promise<Response>{
 for(let attempt=0;attempt<2;attempt++){
  signal?.throwIfAborted();
  // Revalidate every destination, including redirects and retries.
  await safeDestination(url);
  try{
   const response=await fetch(url.href,{redirect:'manual',signal:AbortSignal.any([AbortSignal.timeout(20000),...(signal?[signal]:[])]),headers:{'user-agent':'QuoVadis Research/1.0 (+internal business research)','accept':'text/html,application/pdf,text/plain;q=0.9'}});
   if(![429,502,503,504].includes(response.status)||attempt)return response;
   const retryAfter=response.headers.get('retry-after');
   if(retryAfter&&(!/^\d+$/.test(retryAfter)||Number(retryAfter)>2))return response;
   await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,retryAfter?Number(retryAfter)*1000:300));
  }catch(error){
   const failure=sourceFailure(error);
   if(attempt||!['transient','timeout'].includes(failure.code))throw failure;
   await new Promise(resolve=>setTimeout(resolve,300));
  }
 }
 throw new SourceReadError('network','Originalseite konnte nicht gelesen werden.');
}
async function localScrape(value:string,signal?:AbortSignal):Promise<VerifiedPage|null>{
 let url=publicWebUrl(value);if(!url)return null;
 for(let redirects=0;redirects<4;redirects++){
  const response=await fetchOriginal(url,signal);
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();url=location?publicWebUrl(new URL(location,url).href):null;if(!url)return null;continue}
  if(!response.ok){await response.body?.cancel();if([404,410].includes(response.status))return null;throw new SourceReadError('http_'+response.status,'Originalseite antwortet mit HTTP '+response.status+([401,403].includes(response.status)?' (Zugriff nicht öffentlich verfügbar).':response.status===429?' (zu viele Anfragen).':'.'))}
  const type=response.headers.get('content-type')||'';if(/application\/pdf/i.test(type))return pdfPage(response,url);if(!/text\/html|text\/plain/i.test(type)){await response.body?.cancel();return null}
  const raw=new TextDecoder().decode(await readLimited(response));if(raw.length<100)return null;
  if(type.includes('text/plain'))return decoratePage({url:url.href,title:'',text:raw.slice(0,60000),publishedAt:null,sourceReliability:reliability(url),checkedAt:new Date().toISOString()});
  const $=load(raw);const title=$('title').first().text().trim().slice(0,200);
  const published=$('meta[property="article:published_time"]').attr('content')||$('meta[name="date"]').attr('content')||$('time[datetime]').first().attr('datetime')||'';
  const page:VerifiedPage={url:url.href,title,text:'',publishedAt:published&&Number.isFinite(Date.parse(published))?new Date(published).toISOString():null,sourceReliability:reliability(url),checkedAt:new Date().toISOString(),links:[],contacts:[]};
  $('a[href]').each((_,element)=>{
   const href=$(element).attr('href')||'',label=$(element).text().replace(/\s+/g,' ').trim().slice(0,120);
   if(/^mailto:/i.test(href)){let value='';try{value=decodeURIComponent(href.slice(7).split('?')[0])}catch{}if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))page.contacts!.push(contact('email',value,'mailto:'+value,page,href,label||'E-Mail'));return}
   if(/^tel:/i.test(href)){let value='';try{value=decodeURIComponent(href.slice(4))}catch{}if(value.replace(/\D/g,'').length>=7)page.contacts!.push(contact('phone',value,'tel:'+value.replace(/[^+\d]/g,''),page,href,label||'Telefon'));return}
   try{const target=publicWebUrl(new URL(href,url!).href);if(target)page.links!.push({url:target.href,label})}catch{}
  });
  const structured:string[]=[];
  $('script[type="application/ld+json"]').each((_,element)=>{try{const value=JSON.parse($(element).text());const blocks=Array.isArray(value)?value:[value];for(const block of blocks){if(block&&typeof block==='object'&&/JobPosting|Organization|LocalBusiness/.test(String(block['@type'])))structured.push(load(JSON.stringify(block)).text().slice(0,12000))}}catch{}});
  $('script,style,noscript,svg,nav,[role="navigation"],iframe').remove();
  const body=$('body').text().replace(/\s+/g,' ').trim();
  page.text=([title,body,...structured].join('\n')).slice(0,60000);
  if(page.text.length<100)return null;
  return decoratePage(page);
 }
 return null;
}
export async function scrapePage(firecrawlKey:string,value:string,signal?:AbortSignal):Promise<VerifiedPage|null>{
 if(firecrawlKey&&(firecrawlScrapeBackoff.get(firecrawlKey)||0)<Date.now()){
  try{const page=await firecrawlScrape(firecrawlKey,value,signal);if(page)return decoratePage(page)}catch(error){signal?.throwIfAborted();if(error instanceof FirecrawlError&&error.code!=='source'&&error.code!=='invalid_response')firecrawlScrapeBackoff.set(firecrawlKey,Date.now()+(error.retryAfterMs??120000))}
 }
 try{return await localScrape(value,signal)}catch(error){if(error instanceof TypeError||error instanceof DOMException)throw sourceFailure(error);throw error}
}
export type {SearchHit,VerifiedPage,PageLink,PublicContact};
