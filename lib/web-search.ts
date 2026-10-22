import {lookup} from 'node:dns/promises';
import {load} from 'cheerio';
import {publicWebUrl,reliability,searchWeb as firecrawlSearch,scrapePage as firecrawlScrape,type SearchHit,type VerifiedPage,type PageLink,type PublicContact} from './firecrawl';

const SEARCH_SERVICE='http://searxng:8080/search';
const firecrawlBackoff=new Map<string,number>();
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
async function localSearch(query:string,limit:number):Promise<SearchHit[]>{
 const url=new URL(SEARCH_SERVICE);url.searchParams.set('q',query);url.searchParams.set('format','json');url.searchParams.set('language','de-DE');url.searchParams.set('categories','general');
 const response=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{accept:'application/json'}});
 if(!response.ok)throw Error('Lokale Websuche HTTP '+response.status);
 const data=await response.json() as {results?:Array<{url?:string;title?:string;content?:string}>;unresponsive_engines?:unknown[]};
 if(!Array.isArray(data.results))throw Error('Lokale Websuche lieferte kein Ergebnisformat');
 const hits=data.results.flatMap(item=>{const url=publicWebUrl(String(item.url||''));return url?[{url:url.href,title:String(item.title||'').slice(0,200),description:load(String(item.content||'')).text().slice(0,1000)}]:[]});
 if(!hits.length&&data.unresponsive_engines?.length)throw Error('Lokale Suchmaschinen antworten derzeit nicht');
 return hits.slice(0,Math.max(1,Math.min(30,limit)));
}
export async function searchWeb(firecrawlKey:string,query:string,limit=8):Promise<SearchHit[]>{
 if(firecrawlKey&&(firecrawlBackoff.get(firecrawlKey)||0)<Date.now()){
  try{const hits=await firecrawlSearch(firecrawlKey,query,limit);if(hits.length)return hits}catch{firecrawlBackoff.set(firecrawlKey,Date.now()+120000)}
 }
 return localSearch(query,limit);
}
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
async function localScrape(value:string):Promise<VerifiedPage|null>{
 let url=publicWebUrl(value);if(!url)return null;
 for(let redirects=0;redirects<4;redirects++){
  await safeDestination(url);
  const response:Response=await fetch(url.href,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'user-agent':'QuoVadis Research/1.0 (+internal business research)','accept':'text/html,application/pdf,text/plain;q=0.9'}});
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();url=location?publicWebUrl(new URL(location,url).href):null;if(!url)return null;continue}
  if(!response.ok)return null;
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
export async function scrapePage(firecrawlKey:string,value:string):Promise<VerifiedPage|null>{
 if(firecrawlKey&&(firecrawlBackoff.get(firecrawlKey)||0)<Date.now()){
  try{const page=await firecrawlScrape(firecrawlKey,value);if(page)return decoratePage(page)}catch{firecrawlBackoff.set(firecrawlKey,Date.now()+120000)}
 }
 return localScrape(value);
}
export type {SearchHit,VerifiedPage,PageLink,PublicContact};
