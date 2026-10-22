import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

// Browser fixtures stay in intercepted HTTP responses and never enter the DB.
const baseURL=process.env.UI_TEST_URL||'http://127.0.0.1:3001';
const output=process.env.UI_TEST_OUTPUT||'/tmp/quovadis-qa';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chromium'});
const page=await browser.newPage({viewport:{width:1536,height:1080},reducedMotion:'reduce',locale:'de-DE'});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const now=new Date().toISOString();
const daysAgo=days=>new Date(Date.now()-days*86400000).toISOString();
let config={dailyAt:'07:00',timezone:'Europe/Berlin',dailyEnabled:true,cities:['München','Augsburg','Landsberg am Lech'],radiusKm:40,serviceOffer:'Externe IT-Betreuung, Microsoft 365, IT-Security und Automatisierung für KMU.',searchPrompt:'Suche belegte aktuelle Bedarfssignale im konfigurierten Suchgebiet.',skills:['jobs','tenders','migration','providers','growth','social','news'],intervalMinutes:1440,reminderDays:7,provider:'openai',model:'gpt-4.1-mini',openaiKey:'',openaiKeySet:true,anthropicKey:'',firecrawlKey:'',agenticSearch:true,searchLimit:60,sources:[],github:{owner:'pllanaio',repo:'quovadis',baseBranch:'main',token:''},smtp:{host:'',port:587,secure:false,user:'',password:'',from:'',to:''}};
const items=[
 {id:1,name:'Beispielfirma Industrie GmbH',city:'München',signal:'Erstmaliger Aufbau einer internen IT',summary:'Die Firma sucht eine erste IT-Ansprechperson für Infrastruktur und Microsoft 365.',score:88,email:'kontakt@example.org',phone:'+49 89 123456',company_url:'https://example.org',source_url:'https://example.org/karriere',evidence_quote:'Sie bauen unsere interne IT auf und entwickeln unsere Microsoft-365-Umgebung weiter.',research_status:'complete',created_at:daysAgo(2),last_checked_at:now,stale_at:daysAgo(-8),is_stale:false,chart_eligible:true,need_status:'proven',external_readiness:'unknown',assessment:{matchForecast:'Die belegte Aufbauaufgabe passt zu einer laufenden externen Betreuung.',serviceFit:'Microsoft 365 und Infrastruktur passen zum hinterlegten Angebot.',scoreReason:'Konkreter Aufbauauftrag mit veröffentlichten Geschäftskontakten.',scoreBreakdown:{need:32,fit:22,recency:14,economics:12,contact:8},conversationOpener:'Welche Unterstützung wünschen Sie sich beim veröffentlichten Aufbau Ihrer IT?',pricing:{hourlyRateMin:100,hourlyRateMax:125,estimated:true},monthlyPotential:'high',monthlyReason:'Aufbau und Betrieb erzeugen voraussichtlich laufenden Betreuungsbedarf.',contacts:[{kind:'linkedin',value:'https://www.linkedin.com/company/example',sourceUrl:'https://example.org/impressum',quote:'Unser Unternehmensprofil',checkedAt:now}],facts:[{field:'Umsatz 2025',value:'Öffentlich belegte Kennzahl – Testdatensatz',group:'financial',sourceUrl:'https://example.org/bericht',quote:'Kennzahl aus einem Testbeleg.',checkedAt:now,sourceReliability:'first_party'}]}},
 {id:2,name:'Beispiel Logistik GmbH',city:'Augsburg',signal:'Modernisierung der IT-Infrastruktur',summary:'Projekt für Netzwerk und Backup.',score:72,source_url:'https://example.net/jobs',research_status:'pending',created_at:daysAgo(1),stale_at:daysAgo(-9),is_stale:false,chart_eligible:true},
 {id:3,name:'Ruhende Beispiel GmbH',city:'Starnberg',signal:'Cloud-Migration ausgeschrieben',summary:'Älterer dokumentierter Bedarf.',score:95,source_url:'https://example.com/projekt',research_status:'complete',created_at:daysAgo(15),stale_at:daysAgo(5),is_stale:true,chart_eligible:false},
];
const activities=[];
function overview(){const active=items.filter(item=>!item.is_stale);return {demo:false,items,stats:{total:3,active:active.length,stale:3-active.length,highMatch:active.filter(item=>item.score>=80).length,researched:2,pending:1,contactable:1,newToday:0,averageScore:80},charts:{scoreBands:[{label:'Hohe Passung',color:'green',count:active.filter(item=>item.score>=80).length},{label:'Mittlere Passung',color:'amber',count:1},{label:'Geringe Passung',color:'red',count:0}],cities:[{city:'München',count:1},{city:'Augsburg',count:1}]},latestRun:{id:1,status:'completed',stage:'Recherche abgeschlossen',started_at:now,finished_at:now,searched:31,discovered:214,verified:60,imported:12,rejected:35},limit:500}}
await page.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname;
 let json={};
 if(path==='/api/auth')json={authenticated:true,setup:false};
 else if(path==='/api/settings'){if(req.method()==='PUT')config={...config,...req.postDataJSON()};json=config}
 else if(path==='/api/opportunities')json=overview();
 else if(path==='/api/research')json=req.method()==='POST'?{queued:true,run:{id:2,status:'queued'}}:{runs:[overview().latestRun]};
 else if(path==='/api/activities'){if(req.method()==='POST'){const entry=req.postDataJSON();activities.push({...entry,id:1,created_at:now});const lead=items.find(item=>item.id===Number(entry.id));if(entry.note.trim()){lead.is_stale=false;lead.chart_eligible=true;lead.stale_at=daysAgo(-10)}json={ok:true,refreshesRanking:!!entry.note.trim()}}else json={items:activities}}
 else if(path==='/api/opportunities/signals')json={signals:[{id:1,source_url:'https://example.org/karriere',evidence_quote:items[0].evidence_quote,signal:items[0].signal,category:'jobs',priority:'A',source_reliability:'first_party',published_at:null,last_checked_at:now,status:'active'}],events:[]};
 else if(path==='/api/assistant')json={messages:[]};
 await route.fulfill({json});
});
try{
 await page.goto(baseURL);
 await page.getByRole('heading',{name:'Dein Opportunity Radar'}).waitFor();
 await page.getByRole('button',{name:'Dossier öffnen: Beispielfirma Industrie GmbH'}).waitFor();
 assert.equal(await page.getByText('Ruhende Beispiel GmbH',{exact:true}).count(),0,'Stale lead excluded from dashboard');
 await page.screenshot({path:output+'/dashboard.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Dossier öffnen: Beispielfirma Industrie GmbH'}).click();
 await page.getByRole('dialog').waitFor();
 await page.getByRole('heading',{name:'Beispielfirma Industrie GmbH',exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Anrufen',exact:true}).getAttribute('href'),'tel:+4989123456');
 await page.screenshot({path:output+'/dossier.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Mit KI besprechen',exact:true}).click();
 await page.getByRole('heading',{name:'Dein KI-Begleiter',exact:true}).waitFor();
 await page.keyboard.press('Escape');
 await page.getByRole('tab',{name:'Kontakte & Firma'}).click();
 await page.getByText('Umsatz 2025',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Belege',exact:true}).click();
 await page.getByText('Priorität A',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Firmendossier schließen'}).click();
 await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('button',{name:/Zurückgestellt/}).click();
 await page.getByRole('button',{name:'Dossier öffnen: Ruhende Beispiel GmbH'}).click();
 await page.getByRole('textbox',{name:'Notiz zum Lead'}).fill('Telefonat geführt. Nächster Termin ist vereinbart.');
 await page.getByRole('button',{name:'Eintrag speichern'}).click();
 await page.getByText('Gespeichert. Der Lead bleibt wieder zehn Tage in den aktiven Charts.').waitFor();
 assert.equal(items[2].is_stale,false,'Text note reactivates stale lead');
 await page.getByRole('button',{name:'Firmendossier schließen'}).click();
 await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('button',{name:'Einstellungen',exact:true}).click();
 await page.getByRole('tab',{name:'Recherche',exact:true}).waitFor();
 await page.getByLabel('Startzeit',{exact:true}).fill('08:30');
 await page.getByRole('button',{name:'Einstellungen speichern'}).click();
 await page.getByText('Alle Einstellungen wurden gespeichert.').waitFor();
 assert.equal(config.dailyAt,'08:30');assert.equal(config.agenticSearch,true);
 await page.screenshot({path:output+'/settings.png',fullPage:true,animations:'disabled'});
 for(const name of ['KI & Quellen','Verbindungen','Konto'])await page.getByRole('tab',{name,exact:true}).click();
 await page.getByRole('button',{name:'KI-Begleiter',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.screenshot({path:output+'/assistant.png',fullPage:true,animations:'disabled'});
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Navigation öffnen'}).click();
 await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('button',{name:'Übersicht',exact:true}).click();
 await page.getByRole('heading',{name:'Dein Opportunity Radar'}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile dashboard must not overflow horizontally');
 await page.screenshot({path:output+'/mobile.png',fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Dossier öffnen: Beispielfirma Industrie GmbH'}).click();
 await page.getByRole('tab',{name:'Kontakte & Firma'}).click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile dossier must not overflow horizontally');
 await page.screenshot({path:output+'/mobile-dossier.png',animations:'disabled'});
 assert.deepEqual(errors,[],'No browser runtime errors');
 const login=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',locale:'de-DE'});
 await login.route('**/api/auth',route=>route.fulfill(route.request().method()==='POST'?{status:401,json:{error:'Benutzername oder Passwort stimmt nicht.'}}:{json:{authenticated:false,setup:false}}));
 await login.goto(baseURL);
 await login.getByRole('heading',{name:'Willkommen zurück.'}).waitFor();
 await login.screenshot({path:output+'/login.png',animations:'disabled'});
 await login.getByLabel('Benutzername',{exact:true}).fill('browser-test');
 await login.getByLabel('Passwort',{exact:true}).fill('TemporaryBrowserTestOnly');
 await login.getByRole('button',{name:'Anmelden',exact:true}).click();
 await login.getByText('Benutzername oder Passwort stimmt nicht.').waitFor();
 await login.setViewportSize({width:390,height:844});
 assert.ok(await login.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile login must not overflow');
 console.log('PASS: dashboard, stale lead reactivation, dossier sources/contacts, settings save, assistant, mobile layout, login errors');
}finally{await browser.close()}
