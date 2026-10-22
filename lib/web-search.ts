import {lookup} from 'node:dns/promises';
import {load} from 'cheerio';
import {publicWebUrl,reliability,searchWeb as firecrawlSearch,scrapePage as firecrawlScrape,type SearchHit,type VerifiedPage} from './firecrawl';

const SEARCH_SERVICE='http://searxng:8080/search';

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
 const hits=data.results.flatMap(item=>{const url=publicWebUrl(String(item.url||''));return url?[{url:url.href,title:String(item.title||'').slice(0,200),description:String(item.content||'').slice(0,800)}]:[]});
 if(!hits.length&&data.unresponsive_engines?.length)throw Error('Lokale Suchmaschinen antworten derzeit nicht');
 return hits.slice(0,limit);
}
export async function searchWeb(firecrawlKey:string,query:string,limit=5):Promise<SearchHit[]>{
 if(firecrawlKey){try{const hits=await firecrawlSearch(firecrawlKey,query,limit);if(hits.length)return hits}catch{}}
 return localSearch(query,limit);
}
async function readLimited(response:Response){
 const reader=response.body?.getReader();if(!reader)return '';
 const chunks:Uint8Array[]=[];let size=0;
 try{while(size<500000){const next=await reader.read();if(next.done)break;chunks.push(next.value);size+=next.value.length}}
 finally{await reader.cancel().catch(()=>{})}
 return new TextDecoder().decode(Buffer.concat(chunks).subarray(0,500000));
}
async function localScrape(value:string):Promise<VerifiedPage|null>{
 let url=publicWebUrl(value);if(!url)return null;
 for(let redirects=0;redirects<4;redirects++){
  await safeDestination(url);
  const response:Response=await fetch(url.href,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'user-agent':'QuoVadis Research/1.0 (+internal business research)','accept':'text/html,text/plain;q=0.9'}});
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');url=location?publicWebUrl(new URL(location,url).href):null;if(!url)return null;continue}
  if(!response.ok)return null;
  const type=response.headers.get('content-type')||'';if(!/text\/html|text\/plain/i.test(type))return null;
  const raw=await readLimited(response);if(raw.length<100)return null;
  if(type.includes('text/plain'))return {url:url.href,title:'',text:raw.slice(0,35000),publishedAt:null,sourceReliability:reliability(url),checkedAt:new Date().toISOString()};
  const $=load(raw);const title=$('title').first().text().trim().slice(0,200);
  const published=$('meta[property="article:published_time"]').attr('content')||$('meta[name="date"]').attr('content')||$('time[datetime]').first().attr('datetime')||'';
  $('script,style,noscript,svg,nav,footer,header').remove();
  const main=$('main').first().text().replace(/\s+/g,' ').trim();
  const body=$('body').text().replace(/\s+/g,' ').trim();
  const text=(main.length>=200?main:body).slice(0,35000);
  if(text.length<100)return null;
  return {url:url.href,title,text,publishedAt:published&&Number.isFinite(Date.parse(published))?new Date(published).toISOString():null,sourceReliability:reliability(url),checkedAt:new Date().toISOString()};
 }
 return null;
}
export async function scrapePage(firecrawlKey:string,value:string):Promise<VerifiedPage|null>{
 if(firecrawlKey){try{const page=await firecrawlScrape(firecrawlKey,value);if(page)return page}catch{}}
 return localScrape(value);
}
export type {SearchHit,VerifiedPage};
