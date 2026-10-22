import type {SearchDiagnostic} from './web-search';

const backendNames:Record<SearchDiagnostic['backend'],string>={searxng:'Lokale Websuche',firecrawl:'Firecrawl',openai:'OpenAI-Websuche',anthropic:'Claude-Websuche'};
const statusNames:Record<SearchDiagnostic['status'],string>={ok:'erfolgreich',empty:'ohne Treffer',degraded:'eingeschränkt',unavailable:'nicht verfügbar'};

/** Keep a complete, readable summary before optional details; never cut a line. */
export function boundedResearchErrors(messages:string[],secrets:string[]=[],limit=7600){
 const clean=(message:string)=>{
  let value=message.replace(/\s+/g,' ').trim();
  for(const secret of secrets.filter(Boolean).sort((a,b)=>b.length-a.length))value=value.split(secret).join('[geschützt]');
  return value.slice(0,1500);
 };
 const unique=[...new Set(messages.map(clean).filter(Boolean))],result:string[]=[];
 let length=0;
 for(let i=0;i<unique.length;i++){
  const message=unique[i];
  if(length+message.length>limit-90){result.push(`${unique.length-i} weitere Diagnosemeldungen wurden zusammengefasst.`);break}
  result.push(message);length+=message.length+1;
 }
 return result;
}

/** Query text is context, so identical backend errors are grouped together. */
export function researchDiagnostics(secrets:string[]=[]){
 const clean=(value:unknown,max=420)=>{
  let message=value instanceof Error?value.message:String(value);
  for(const secret of secrets.filter(Boolean).sort((a,b)=>b.length-a.length))message=message.split(secret).join('[geschützt]');
  return message.replace(/\s+/g,' ').trim().slice(0,max);
 };
 const failures=new Map<string,{phase:string;message:string;count:number;samples:string[]}>();
 const backends=new Map<string,{backend:SearchDiagnostic['backend'];status:SearchDiagnostic['status'];count:number;messages:Set<string>;engines:Set<string>}>();
 let omitted=0;
 return {
  error(phase:string,error:unknown,context?:string){
   const message=clean(error),key=phase+'|'+message;
   let entry=failures.get(key);
   if(!entry){if(failures.size>=12){omitted++;return}entry={phase,message,count:0,samples:[]};failures.set(key,entry)}
   entry.count++;
   if(context&&entry.samples.length<2){const sample=clean(context,110);if(!entry.samples.includes(sample))entry.samples.push(sample)}
  },
  diagnostic(value:SearchDiagnostic){
   const key=value.backend+'|'+value.status;
   let entry=backends.get(key);
   if(!entry){entry={backend:value.backend,status:value.status,count:0,messages:new Set(),engines:new Set()};backends.set(key,entry)}
   entry.count++;
   if(entry.messages.size<2)entry.messages.add(clean(value.message,200));
   for(const engine of (value.engines||[]).slice(0,4))if(entry.engines.size<4)entry.engines.add(clean(engine.name,40)+': '+clean(engine.reason,80));
  },
  messages(summary:string[]=[]){
   const warning=[...backends.values()].some(entry=>entry.status==='degraded'||entry.status==='unavailable');
   const diagnostics=warning?[...backends.values()].map(entry=>`${backendNames[entry.backend]}: ${entry.count}× ${statusNames[entry.status]}.${entry.status==='ok'||entry.status==='empty'?'':' '+[...entry.messages].join(' ')}${entry.engines.size?' Betroffene Suchmaschinen: '+[...entry.engines].join('; ')+'.':''}`):[];
   const details=[...failures.values()].map(entry=>`${entry.phase}: ${entry.message}${entry.count>1?` (${entry.count}×)`:''}${entry.samples.length?' Beispiele: '+entry.samples.join(' | '):''}`);
   return boundedResearchErrors([...summary,...diagnostics,...details,...(omitted?[`${omitted} weitere Fehler wurden zusammengefasst.`]:[])],secrets);
  }
 };
}
