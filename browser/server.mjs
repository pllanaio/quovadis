import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {createCipheriv,createDecipheriv,randomBytes,timingSafeEqual} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {chromium} from 'playwright';

const platforms={instagram:{host:'instagram.com',login:'https://www.instagram.com/accounts/login/'},facebook:{host:'facebook.com',login:'https://www.facebook.com/login/'},tiktok:{host:'tiktok.com',login:'https://www.tiktok.com/login/phone-or-email/email'},linkedin:{host:'linkedin.com',login:'https://www.linkedin.com/login'},xing:{host:'xing.com',login:'https://login.xing.com/'},x:{host:'x.com',login:'https://x.com/i/flow/login'},youtube:{host:'youtube.com',login:'https://accounts.google.com/ServiceLogin?service=youtube'},pinterest:{host:'pinterest.com',login:'https://www.pinterest.com/login/'}};
const directory=process.env.BROWSER_DATA_DIR||'/browser-data',dataPath=process.env.APP_DATA_DIR||'/app/data';mkdirSync(directory,{recursive:true,mode:0o700});
const sessions=new Map(),chains=new Map();let browser;
function encryptionKey(){return readFileSync(dataPath+'/settings.key')}
function saveState(platform,state){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv),body=Buffer.concat([cipher.update(JSON.stringify(state),'utf8'),cipher.final()]);writeFileSync(directory+'/'+platform+'.enc',Buffer.concat([iv,cipher.getAuthTag(),body]),{mode:0o600})}
function loadState(platform){const path=directory+'/'+platform+'.enc';if(!existsSync(path))return;const value=readFileSync(path),decipher=createDecipheriv('aes-256-gcm',encryptionKey(),value.subarray(0,12));decipher.setAuthTag(value.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(value.subarray(28)),decipher.final()]).toString())}
const publicAddress=address=>address.includes(':')?/^[23][0-9a-f]*:/i.test(address):(()=>{const [a,b]=address.split('.').map(Number);return a>0&&a<224&&a!==10&&a!==127&&!(a===100&&b>=64&&b<=127)&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&(b===0||b===168))&&!(a===198&&(b===18||b===19))})();
async function publicUrl(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.'))throw Error('Öffentliche HTTPS-URL erforderlich.');const addresses=await lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(item=>!publicAddress(item.address)))throw Error('Nicht öffentliche Zieladresse.');return url}
function profileUrl(platform,value){const url=new URL(value);if(platform==='x'&&(url.hostname==='twitter.com'||url.hostname.endsWith('.twitter.com')))url.hostname='x.com';if(url.protocol!=='https:'||url.username||url.password||url.port||!(url.hostname===platforms[platform].host||url.hostname.endsWith('.'+platforms[platform].host)))throw Error('Profil gehört nicht zur gewählten Plattform.');return url.href}
async function contextFor(platform){
 if(sessions.has(platform))return sessions.get(platform);
 browser??=await chromium.launch({headless:true,...(process.env.HTTPS_PROXY||process.env.HTTP_PROXY?{proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY}}:{})});
 const context=await browser.newContext({viewport:{width:1100,height:800},locale:'de-DE',serviceWorkers:'block',storageState:loadState(platform)});
 await context.route('**/*',async route=>{try{await publicUrl(route.request().url());await route.continue()}catch{await route.abort()}});
 const page=await context.newPage();page.setDefaultTimeout(12000);const session={context,page};sessions.set(platform,session);return session;
}
async function state(platform,session){
 const fields=await session.page.locator('input:not([type=hidden]),textarea').evaluateAll(elements=>elements.filter(element=>element.getBoundingClientRect().height>0).slice(0,16).map((element,index)=>({index,type:element.type||'text',label:element.getAttribute('aria-label')||element.getAttribute('placeholder')||element.getAttribute('name')||'Eingabe'}))).catch(()=>[]);
 const url=session.page.url(),needsAttention=/login|checkpoint|challenge|accounts\/login/i.test(url)||fields.some(field=>field.type==='password');
 await saveState(platform,await session.context.storageState({indexedDB:true}));
 return {platform,url,status:needsAttention?'needs_attention':'session_saved',fields,width:1100,height:800,screenshot:'data:image/png;base64,'+(await session.page.screenshot()).toString('base64')};
}
async function execute(platform,input){
 if(!platforms[platform])throw Error('Unbekannte Plattform.');
 if(input.action==='logout'){const old=sessions.get(platform);if(old)await old.context.close();sessions.delete(platform);rmSync(directory+'/'+platform+'.enc',{force:true});return {status:'disconnected'}}
 const session=await contextFor(platform),page=session.page;
 if(input.action==='connect'){
  await page.goto(platforms[platform].login,{waitUntil:'domcontentloaded',timeout:45000});
  const current=new URL(page.url()),credentialHost=platform==='youtube'?'accounts.google.com':platforms[platform].host;
  const mayFill=current.protocol==='https:'&&(current.hostname===credentialHost||current.hostname.endsWith('.'+credentialHost));
  if(mayFill&&input.username){const field=page.locator('input[name=username],input[name=email],input[name=login],input[type=email],input[name=text]').first();if(await field.isVisible().catch(()=>false))await field.fill(input.username)}
  if(mayFill&&input.password){const field=page.locator('input[type=password]').first();if(await field.isVisible().catch(()=>false)){await field.fill(input.password);await field.press('Enter').catch(()=>{});await page.waitForTimeout(1500)}}
 }
 if(input.action==='interact'){
  if(Number.isFinite(input.scrollY))await page.mouse.wheel(0,Math.max(-1000,Math.min(1000,input.scrollY)));
  if(input.field!==undefined){const visible=page.locator('input:not([type=hidden]),textarea').filter({visible:true});await visible.nth(Number(input.field)).fill(String(input.value||'').slice(0,2000));if(input.enter)await visible.nth(Number(input.field)).press('Enter')}
  if(Number.isFinite(input.x)&&Number.isFinite(input.y)){await page.mouse.click(Math.max(0,Math.min(1099,input.x)),Math.max(0,Math.min(799,input.y)))}
  await page.waitForTimeout(1000);
 }
 if(input.action==='scrape'){
  const deadline=Date.now()+90000,url=profileUrl(platform,input.url);await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  if(/login|checkpoint|challenge/i.test(page.url())||await page.locator('input[type=password]').isVisible().catch(()=>false))return {status:'needs_attention',profileUrl:url,posts:[],notice:'Anmeldung oder Sicherheitsabfrage erfordert deine Aktion in Einstellungen → Social Media.'};
  const found=new Map();
  for(let step=0;step<5;step++){
   const posts=await page.evaluate(()=>Array.from(document.querySelectorAll('a[href]')).filter(anchor=>/\/(?:p|reel|posts|status|video|pin|shorts)\/|\/watch\?v=/.test(anchor.href)).map(anchor=>{const parent=anchor.closest('article')||anchor.closest('[role=article]')||anchor.parentElement?.parentElement;const source=new URL(anchor.href),video=source.searchParams.get('v');source.hash='';source.search='';if(video&&source.pathname==='/watch')source.searchParams.set('v',video);return {url:source.href,text:(parent?.innerText||anchor.querySelector('img')?.alt||'').slice(0,7000),publishedAt:parent?.querySelector('time[datetime]')?.getAttribute('datetime')||null}}).slice(0,40));
   for(const post of posts){try{profileUrl(platform,post.url);if(!found.has(post.url))found.set(post.url,post)}catch{}}
   if(found.size>=30)break;await page.mouse.wheel(0,900);await page.waitForTimeout(900);
  }
  const detail=await session.context.newPage();
  try{for(const post of [...found.values()].slice(0,8)){
   if(Date.now()>=deadline)break;try{await detail.goto(post.url,{waitUntil:'domcontentloaded',timeout:Math.max(1000,Math.min(8000,deadline-Date.now()))});await detail.waitForTimeout(500);if(/login|checkpoint|challenge/i.test(detail.url()))continue;
    const observed=await detail.evaluate(()=>{const content=document.querySelector('[data-e2e=video-desc]')||document.querySelector('article h1')||document.querySelector('[data-testid=tweetText]')||document.querySelector('article')||document.querySelector('main');const description=document.querySelector('meta[property="og:description"]')?.getAttribute('content')||'';return {text:((content?.innerText||description)||'').slice(0,7000),publishedAt:document.querySelector('time[datetime]')?.getAttribute('datetime')||null}});if(observed.text.length>30){post.text=observed.text;post.publishedAt=observed.publishedAt}
   }catch{/* An inaccessible post remains an explicitly partial observation. */}
  }}finally{await detail.close()}
  await saveState(platform,await session.context.storageState({indexedDB:true}));
  return {status:'captured',profileUrl:url,checkedAt:new Date().toISOString(),posts:[...found.values()].filter(post=>post.text.length>30).slice(0,30),profileText:(await page.locator('body').innerText()).slice(0,18000),coverage:'Sichtbare Beiträge nach höchstens fünf Scrollschritten und acht zusätzlich gelesenen Beitragsseiten. Keine vollständige Historie; Veröffentlichungsdaten können fehlen.'};
 }
 return state(platform,session);
}
createServer(async(req,res)=>{
 res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');
 try{
  const key=readFileSync(dataPath+'/worker.key','utf8'),received=String(req.headers['x-worker-key']||'');if(received.length!==key.length||!timingSafeEqual(Buffer.from(received),Buffer.from(key))){res.statusCode=401;res.end(JSON.stringify({error:'Nicht autorisiert.'}));return}
  if(req.method!=='POST'){res.statusCode=405;res.end('{}');return}
  let body='';for await(const chunk of req){body+=chunk;if(body.length>20000)throw Error('Anfrage zu groß.')}
  const input=JSON.parse(body),platform=input.platform;if(!platforms[platform])throw Error('Unbekannte Plattform.');
  const previous=chains.get(platform)||Promise.resolve(),operation=previous.catch(()=>{}).then(()=>execute(platform,input));chains.set(platform,operation);
  const result=await operation;res.end(JSON.stringify(result));
 }catch{res.statusCode=400;res.end(JSON.stringify({error:'Browseraktion fehlgeschlagen. Verbindung, Plattform und Sitzung in QuoVadis prüfen.'}))}
}).listen(3010,'0.0.0.0');
