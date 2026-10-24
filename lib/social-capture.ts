import {readFileSync} from 'node:fs';
import {scrapePage} from './web-search';

type PublicPage={url:string;text:string;publishedAt?:string|null;links?:{url:string}[]};
export const REACH_STOP_CODES=['NEED_LOGIN','PLATFORM_BLOCKED','RATE_LIMITED','BUSY'];
export async function reachAction(action:'read'|'status',url?:string,timeoutMs=40000){
 const response=await fetch('http://agent-reach:3012',{method:'POST',signal:AbortSignal.timeout(timeoutMs),headers:{'content-type':'application/json','x-worker-key':readFileSync(process.env.WORKER_KEY_FILE||'/app/data/worker.key','utf8')},body:JSON.stringify({action,url})});
 const result=await response.json();if(!response.ok)throw Error(typeof result.error==='string'?result.error:'Agent-Reach nicht erreichbar.');return result;
}
export function accessWall(text:string){
 return /^\s*(?:log in|sign in|anmelden|just a moment|access denied|security verification|captcha|challenge required)(?:\s*[-|:.!]|\s*$)/i.test(text)||/^(?:.*\n){0,3}(?:log in to (?:continue|see)|sign in to continue|please log in|requiring captcha|performing security verification)/i.test(text);
}
/** Only an actual permalink can be counted as a post; a profile is not a post. */
export function socialPostUrl(value:string,profileUrl:string){
 try{const url=new URL(value),profile=new URL(profileUrl),host=url.hostname.replace(/^www\./,''),profileHost=profile.hostname.replace(/^www\./,'');
 if(url.protocol!=='https:'||url.username||url.password||url.port||host!==profileHost)return null;
 if(!/\/(?:p|reel|reels|posts|status|videos?|pin|shorts)\/[^/?#]+|\/watch\?v=[^&]+/i.test(url.pathname+url.search))return null;
 url.hash='';if(url.pathname!=='/watch')url.search='';return url.href;
 }catch{return null}
}
function reachError(result:any){const code=String(result.error?.code||'UPSTREAM_BROKEN');return Object.assign(Error('Öffentlicher Social-Media-Zugriff: '+code+'. '+String(result.error?.message||'Keine verwertbaren Inhalte.').slice(0,500)),{code:REACH_STOP_CODES.includes(code)?'SOCIAL_ACCESS':code,reachCode:code})}
/** Public-first access, with no credentials or browser session passed to Agent Reach. */
export async function capturePublicSocial(profileUrl:string){
 const notices:string[]=[],providers=new Set<string>(),deadline=Date.now()+95000;
 async function read(url:string):Promise<PublicPage|null>{
  if(deadline-Date.now()<1000)throw Error('Zeitbudget für öffentliche Social-Media-Recherche erreicht.');
  const page=await scrapePage('',url,AbortSignal.timeout(Math.min(12000,deadline-Date.now())),{singleAttempt:true}).catch(error=>{if(error instanceof Error&&'code' in error&&['http_401','http_403','http_429'].includes(String(error.code)))throw Object.assign(Error(error.message),{code:'SOCIAL_ACCESS'});return null});
  if(page&&accessWall(page.text))throw Object.assign(Error('Die Plattform zeigt eine Anmeldung oder Sicherheitsprüfung. Öffentlicher Zugriff gestoppt.'),{code:'SOCIAL_ACCESS'});
  if(page&&page.text.trim().length>=120){providers.add('QuoVadis · öffentliche Originalseite');return page}
  const result=await reachAction('read',url,Math.max(1,Math.min(40000,deadline-Date.now())));if(!result.ok)throw reachError(result);
  if(result.items?.some((item:any)=>accessWall(String(item.text||''))))throw Object.assign(Error('Die Plattform zeigt eine Anmeldung oder Sicherheitsprüfung. Öffentlicher Zugriff gestoppt.'),{code:'SOCIAL_ACCESS'});
  const item=result.items?.find((item:any)=>item.url===url&&typeof item.text==='string'&&item.text.trim().length>=120&&!accessWall(item.text));
  if(!item){notices.push('Für '+url+' wurde keine lesbare Originalseite geliefert.');return null}
  providers.add('Agent-Reach · '+String(result.backend||'öffentlicher Leser'));
  return {url,text:item.text,publishedAt:item.published_at,links:[...item.text.matchAll(/https?:\/\/[^\s<>"'\])]+/g)].map((match:RegExpMatchArray)=>({url:match[0]}))};
 }
 const profile=await read(profileUrl);if(!profile)throw Error('Keine öffentlich lesbaren Profilinformationen.');
 const links=[...new Set((profile.links||[]).map(link=>socialPostUrl(link.url,profileUrl)).filter((url):url is string=>!!url))].slice(0,4),posts:PublicPage[]=[];
 // A pasted permalink is itself evidence; profile pages are stored separately.
 if(socialPostUrl(profileUrl,profileUrl))posts.push(profile);
 else for(const url of links){if(deadline-Date.now()<1000){notices.push('Zeitbudget erreicht; weitere Beiträge nicht gelesen.');break}try{const post=await read(url);if(post)posts.push(post)}catch(error){if(error instanceof Error&&'code' in error&&error.code==='SOCIAL_ACCESS'){notices.push(error.message);break}notices.push('Beitrag nicht lesbar: '+url)}}
 return {profileUrl,profileText:profile.text.slice(0,10000),profileObservations:socialPostUrl(profileUrl,profileUrl)?[]:[{sourceUrl:profileUrl,text:profile.text.slice(0,10000)}],posts:posts.map(post=>({url:post.url,text:post.text.slice(0,7000),publishedAt:post.publishedAt||null})),checkedAt:new Date().toISOString(),provider:[...providers].join('; '),coverage:'Öffentlicher Ausschnitt ohne Login. Profiltext ist kein Beitrag; nur gelesene Beitrags-URLs werden gezählt. Vollständigkeit und Urheberschaft nicht garantiert. '+notices.join(' ')};
}
