import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {dirname} from 'node:path';
const keyPath=process.env.WORKER_KEY_FILE||'/app/data/worker.key';mkdirSync(dirname(keyPath),{recursive:true});try{writeFileSync(keyPath,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600})}catch(error){if(error.code!=='EEXIST')throw error}const key=readFileSync(keyPath,'utf8');
const headers={'x-worker-key':key};
async function request(path,method='GET'){const response=await fetch(`http://app:3000${path}`,{method,headers,signal:AbortSignal.timeout(300000)});const json=await response.json();if(!response.ok)throw Error(json.error||`HTTP ${response.status}`);return json}
async function researchLoop(){let minutes=5;try{const config=await request('/api/worker-config');minutes=Math.max(5,config.intervalMinutes);const result=await request('/api/research','POST');console.log(new Date().toISOString(),'Signalerkennung:',result.imported,'Treffer;',result.researched,'vertieft;',result.pending,'offen;',result.errors?.length||0,'Fehler')}catch(error){console.error('Recherchefehler:',String(error))}setTimeout(researchLoop,minutes*60000)}
async function deepLoop(){try{const result=await request('/api/research/deep','POST');if(result.researched||result.errors?.length)console.log(new Date().toISOString(),'Deep Research:',result.researched,'abgeschlossen;',result.pending,'offen;',result.errors?.length||0,'Fehler');const monitor=await request('/api/research/monitor','POST');if(monitor.errors?.length)console.error('Signal-Monitoring:',monitor.errors.join('; '))}catch(error){console.error('Deep-Research-/Monitoring-Fehler:',String(error))}setTimeout(deepLoop,120000)}
async function mailLoop(){try{const result=await request('/api/reminders/send','POST');if(result.sent)console.log('Wiedervorlagen-Mail gesendet:',result.count)}catch(error){console.error('Mailfehler:',String(error))}setTimeout(mailLoop,24*60*60000)}
setTimeout(researchLoop,60000);
setTimeout(deepLoop,120000);
setTimeout(mailLoop,60000);
