import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {dirname} from 'node:path';
import {requestJson} from './worker-request.mjs';

const keyPath=process.env.WORKER_KEY_FILE||'/app/data/worker.key';
mkdirSync(dirname(keyPath),{recursive:true});
try{writeFileSync(keyPath,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600})}
catch(error){if(error.code!=='EEXIST')throw error}
const key=readFileSync(keyPath,'utf8');

async function request(path,method='GET',body,timeout=60000){
 return requestJson(`http://app:3000${path}`,{method,headers:{'x-worker-key':key},body,timeout});
}

// The API claims the local calendar date in PostgreSQL. Restarts and concurrent
// workers therefore cannot enqueue the same scheduled day twice.
async function scheduleLoop(){
 try{
  const config=await request('/api/worker-config');
  if(config.scheduledDue){
   const result=await request('/api/research','POST',{trigger:'scheduled',scheduleDate:config.scheduleDate});
   console.log(new Date().toISOString(),'Tagesrecherche eingeplant:',config.scheduleDate,config.dailyAt,config.timezone,'Lauf',result.runId||result.run?.id||'');
  }
 }catch(error){console.error('Zeitplanfehler:',String(error))}
 setTimeout(scheduleLoop,60000-Date.now()%60000+1000);
}

// Processing is independent from the clock, so a long search does not postpone
// tomorrow's scheduled enqueue. Manual searches use the same persisted queue.
async function researchLoop(){
 try{
  const result=await request('/api/research/process','POST',undefined,30*60*1000);
  if(result.processed){const log=result.status==='failed'?console.error:console.log;log(new Date().toISOString(),'Recherche',result.runId||'',result.stage||result.status||'abgeschlossen',':',result.imported||0,'neue Signale;',result.searched||0,'Suchanfragen;',result.verified||0,'Originalseiten;',result.pending||0,'Vertiefungen offen;',result.errors?.length||0,'Hinweise.',result.errors?.[0]||'')}
 }catch(error){console.error('Recherchefehler:',String(error))}
 setTimeout(researchLoop,60000);
}

async function deepLoop(){
 let nextDelay=15000;
 try{
  const result=await request('/api/research/deep','POST',undefined,15*60*1000);
  if(result.researched||result.errors?.length)console.log(new Date().toISOString(),'Deep Research:',result.researched,'abgeschlossen;',result.pending,'offen;',result.errors?.length||0,'Fehler');
  nextDelay=result.ready>0?250:result.busy?15000:30000;
 }catch(error){console.error('Deep-Research-Fehler:',String(error))}
 setTimeout(deepLoop,nextDelay);
}

// Source monitoring has its own loop; slow sites cannot stall the dossier queue.
async function monitorLoop(){
 try{
  const monitor=await request('/api/research/monitor','POST',undefined,5*60*1000);
  if(monitor.errors?.length)console.error('Signal-Monitoring:',monitor.errors.join('; '));
 }catch(error){console.error('Monitoring-Fehler:',String(error))}
 setTimeout(monitorLoop,120000);
}

async function mailLoop(){
 try{const result=await request('/api/reminders/send','POST');if(result.sent)console.log('Wiedervorlagen-Mail gesendet:',result.count)}
 catch(error){console.error('Mailfehler:',String(error))}
 setTimeout(mailLoop,24*60*60000);
}

setTimeout(scheduleLoop,5000);
setTimeout(researchLoop,10000);
setTimeout(deepLoop,15000);
setTimeout(monitorLoop,20000);
setTimeout(mailLoop,60000);
