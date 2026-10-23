import {publicWebUrl,type SearchHit} from './firecrawl';

export type NativeSearchSettings={
 provider:'openai'|'anthropic';
 model:string;
 openaiKey?:string;
 anthropicKey?:string;
 nativeWebSearch?:boolean;
 searchBackend?:'auto'|'native';
 reasoningLevel?:'default'|'low'|'medium'|'high';
 onUsage?:(usage:Record<string,unknown>|undefined,succeeded:boolean,durationMs:number)=>Promise<void>;
};

type SearchErrorCode='disabled'|'missing_api_key'|'invalid_model'|'invalid_query'|'authentication_error'|'permission_denied'|'model_unavailable'|'quota_exceeded'|'rate_limited'|'upstream_error'|'invalid_request'|'timeout'|'network_error'|'invalid_response'|'incomplete_response'|'tool_failed'|'no_search_tool'|'sources_missing';

const explanations:Record<SearchErrorCode,string>={
 disabled:'Native Websuche ist in den Einstellungen deaktiviert.',
 missing_api_key:'API-Key des ausgewählten Anbieters fehlt.',
 invalid_model:'Bitte einen gültigen Modellnamen in den Einstellungen speichern.',
 invalid_query:'Die Suchanfrage ist leer oder zu lang.',
 authentication_error:'API-Key wurde nicht akzeptiert. Zugangsdaten in den Einstellungen prüfen.',
 permission_denied:'Der Anbieter erlaubt diesen API- oder Websuchzugriff nicht.',
 model_unavailable:'Das ausgewählte Modell oder die Websuche ist für diesen API-Zugang nicht verfügbar.',
 quota_exceeded:'Guthaben oder Ausgabenlimit des Anbieters ist ausgeschöpft.',
 rate_limited:'Der Anbieter begrenzt derzeit die Suchanfragen.',
 upstream_error:'Der Suchdienst des Anbieters ist vorübergehend nicht verfügbar.',
 invalid_request:'Der Anbieter unterstützt diese Websuchanfrage mit dem ausgewählten Modell nicht.',
 timeout:'Die Websuche hat das Zeitlimit überschritten.',
 network_error:'Der Anbieter konnte nicht erreicht werden.',
 invalid_response:'Der Anbieter lieferte keine gültige Suchantwort.',
 incomplete_response:'Die Websuche wurde nicht vollständig abgeschlossen.',
 tool_failed:'Das Websuchwerkzeug meldete einen Fehler.',
 no_search_tool:'Die Antwort enthält keinen ausgeführten Websuchaufruf.',
 sources_missing:'Der Websuchaufruf enthält keine auswertbare Quellenliste.',
};

/** Only stable local codes and the HTTP status leave this adapter, never API error bodies. */
export class NativeSearchError extends Error{
 readonly provider:NativeSearchSettings['provider'];
 get querySpecific(){return ['sources_missing','no_search_tool','incomplete_response','invalid_response','tool_failed'].includes(this.code)}
 constructor(settings:NativeSearchSettings,readonly code:SearchErrorCode,readonly status?:number,readonly retryAfterMs?:number){
  const provider=settings.provider==='anthropic'?'Claude':'OpenAI';
  const name=/^(?:gpt-|chatgpt-|o\d|claude-)[\w.:-]{1,90}$/.test(settings.model)&&![settings.openaiKey,settings.anthropicKey].some(key=>key&&settings.model.includes(key))?settings.model:'konfiguriertes Modell';
  super(`${provider}-Websuche (${name}; ${code}${status?`; HTTP ${status}`:''}): ${explanations[code]}`);
  this.name='NativeSearchError';this.provider=settings.provider;
 }
}

function object(value:unknown):Record<string,unknown>|null{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null}
function retryDelay(value:string|null){
 if(!value)return undefined;
 const seconds=Number(value),milliseconds=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-Date.now();
 return Number.isFinite(milliseconds)?Math.min(86400000,Math.max(0,milliseconds)):undefined;
}
function apiError(settings:NativeSearchSettings,response:Response,data:Record<string,unknown>|null){
 const error=object(data?.error),remoteCode=String(error?.code||''),remoteType=String(error?.type||'');
 // Some providers report exhausted credits as a generic 400 invalid_request_error.
 // The message is inspected only for classification and is never retained or displayed.
 const message=typeof error?.message==='string'?error.message:'';
 let code:SearchErrorCode='invalid_request';
 if(remoteType==='insufficient_quota'||['insufficient_quota','credit_balance_exhausted','credit_balance_too_low','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded','billing_hard_limit_reached','billing_error'].includes(remoteCode)||remoteType==='billing_error'||response.status===402||/credit[_\s-]+balance.{0,60}(?:low|exhaust|insufficient)|insufficient[_\s-]+(?:credits|quota)|(?:spend|monthly[_\s-]+usage)[_\s-]+limit.{0,40}(?:reach|exceed)/i.test(message))code='quota_exceeded';
 else if(response.status===401||remoteType==='authentication_error'||remoteCode==='invalid_api_key')code='authentication_error';
 else if(response.status===403||remoteType==='permission_error')code='permission_denied';
 else if(response.status===404||['model_not_found','model_not_supported','unsupported_model','model_access_denied'].includes(remoteCode)||/model.{0,100}(?:not found|does not exist|not available|not support.{0,30}web.?search)|web.?search.{0,100}(?:not supported|unsupported)/i.test(message))code='model_unavailable';
 else if(response.status===429||remoteType==='rate_limit_error'||remoteCode==='rate_limit_exceeded')code='rate_limited';
 else if(response.status>=500||remoteType==='overloaded_error'||remoteType==='api_error')code='upstream_error';
 return new NativeSearchError(settings,code,response.status,retryDelay(response.headers.get('retry-after')));
}

async function request(settings:NativeSearchSettings,url:string,headers:Record<string,string>,body:Record<string,unknown>){
 const started=Date.now();let response:Response;
 try{
  response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(55000)});
 }catch(error){throw new NativeSearchError(settings,error instanceof Error&&['AbortError','TimeoutError'].includes(error.name)?'timeout':'network_error')}
 let data:Record<string,unknown>|null;
 try{data=object(await response.json())}
 catch(error){
  if(error instanceof Error&&['AbortError','TimeoutError'].includes(error.name))throw new NativeSearchError(settings,'timeout',response.status);
  if(!response.ok)throw apiError(settings,response,null);
  throw new NativeSearchError(settings,'invalid_response',response.status);
 }
 await settings.onUsage?.(object(data?.usage)||undefined,response.ok&&!data?.error,Date.now()-started);
 if(!response.ok||data?.error||data?.type==='error')throw apiError(settings,response,data);
 if(!data)throw new NativeSearchError(settings,'invalid_response',response.status);
 return data;
}

function hit(value:unknown,title?:unknown):SearchHit|null{
 const url=typeof value==='string'?publicWebUrl(value):null;if(!url)return null;
 return {url:url.href,title:typeof title==='string'?title.slice(0,200):url.hostname,description:''};
}
function unique(hits:SearchHit[],limit:number){const seen=new Set<string>();return hits.filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true}).slice(0,limit)}

async function openaiSearch(settings:NativeSearchSettings,query:string,limit:number){
 const data=await request(settings,'https://api.openai.com/v1/responses',{authorization:'Bearer '+settings.openaiKey},{
  // Reasoning tokens share this budget; a tiny cap can interrupt an otherwise successful search.
  model:settings.model,store:false,max_output_tokens:4096,max_tool_calls:1,
 ...(/^(o\d|gpt-[5-9])/.test(settings.model)&&settings.reasoningLevel&&settings.reasoningLevel!=='default'?{reasoning:{effort:settings.reasoningLevel}}:{}),
  tools:[{type:'web_search',search_context_size:'low',external_web_access:true,user_location:{type:'approximate',country:'DE'}}],
  tool_choice:'required',include:['web_search_call.action.sources'],
  instructions:'Führe genau eine Websuche zur Suchanfrage aus. Suche öffentlich zugängliche Originalseiten in Deutschland. Antworte anschließend kurz. Nutze keine weiteren Werkzeuge und erfinde keine Quellen.',
  input:query,
 });
 if(data.status!=='completed')throw new NativeSearchError(settings,'incomplete_response');
 if(!Array.isArray(data.output))throw new NativeSearchError(settings,'invalid_response');
 const calls=data.output.map(object).filter(call=>call?.type==='web_search_call');
 if(!calls.length)throw new NativeSearchError(settings,'no_search_tool');
 if(calls.some(call=>call?.status!=='completed'))throw new NativeSearchError(settings,'tool_failed');
 const searches=calls.map(call=>object(call?.action)).filter(action=>action?.type==='search');
 if(!searches.length)throw new NativeSearchError(settings,'no_search_tool');
 const hits:SearchHit[]=[];let hasSourceList=false;
 for(const action of searches){
  if(!Array.isArray(action?.sources))continue;
  hasSourceList=true;
  for(const entry of action.sources){const source=object(entry);if(source&&(source.type==='url'||source.type===undefined)){const result=hit(source.url,source.title);if(result)hits.push(result)}}
 }
 // Responses may omit action.sources even with include. In that case use only
 // API-provided citation annotations following a completed search, never prose URLs.
 if(!hasSourceList){
  for(const item of data.output){
   const message=object(item);if(message?.type!=='message'||message.role!=='assistant'||!Array.isArray(message.content))continue;
   for(const entry of message.content){
    const part=object(entry);if(part?.type!=='output_text'||!Array.isArray(part.annotations))continue;
    for(const value of part.annotations){const citation=object(value);if(citation?.type==='url_citation'){const result=hit(citation.url,citation.title);if(result)hits.push(result)}}
   }
  }
  if(!hits.length)throw new NativeSearchError(settings,'sources_missing');
 }
 return unique(hits,limit);
}

async function anthropicSearch(settings:NativeSearchSettings,query:string,limit:number){
 const data=await request(settings,'https://api.anthropic.com/v1/messages',{'x-api-key':settings.anthropicKey!,'anthropic-version':'2023-06-01'},{
  model:settings.model,max_tokens:4096,
  tools:[{type:'web_search_20250305',name:'web_search',max_uses:1,allowed_callers:['direct'],user_location:{type:'approximate',country:'DE'}}],
  // Auto also works with models that do not support forced tool_choice. Results are required below.
  tool_choice:{type:'auto'},
  system:'Benutze genau einmal das Websuchwerkzeug für die Suchanfrage. Suche öffentlich zugängliche Originalseiten in Deutschland. Ohne ausgeführte Websuche kannst du die Aufgabe nicht erfüllen. Antworte anschließend kurz; erfinde keine Quellen.',
  messages:[{role:'user',content:query}],
 });
 if(!Array.isArray(data.content))throw new NativeSearchError(settings,'invalid_response');
 const blocks=data.content.map(object),results=blocks.filter(block=>block?.type==='web_search_tool_result');
 for(const block of results){
  const error=object(block?.content);
  if(error?.type==='web_search_tool_result_error'){
   const code=error.error_code==='too_many_requests'?'rate_limited':error.error_code==='unavailable'?'upstream_error':'tool_failed';
   throw new NativeSearchError(settings,code);
  }
 }
 if(data.stop_reason!=='end_turn')throw new NativeSearchError(settings,'incomplete_response');
 if(!results.length)throw new NativeSearchError(settings,'no_search_tool');
 const calls=new Set(blocks.filter(block=>block?.type==='server_tool_use'&&block.name==='web_search'&&typeof block.id==='string').map(block=>block!.id));
 const hits:SearchHit[]=[];
 for(const block of results){
  if(!calls.has(block?.tool_use_id))throw new NativeSearchError(settings,'invalid_response');
  if(!Array.isArray(block?.content))throw new NativeSearchError(settings,'invalid_response');
  for(const entry of block.content){const source=object(entry);if(source?.type==='web_search_result'){const result=hit(source.url,source.title);if(result)hits.push(result)}}
 }
 // encrypted_content is opaque provider data; neither it nor final model prose is used as evidence.
 return unique(hits,limit);
}

/** Native tools provide discovery URLs only. Callers must still load and verify each original page. */
export async function nativeSearch(settings:NativeSearchSettings,query:string,limit=8):Promise<SearchHit[]>{
 if(settings.nativeWebSearch===false)throw new NativeSearchError(settings,'disabled');
 const key=settings.provider==='anthropic'?settings.anthropicKey:settings.openaiKey;
 if(!key?.trim())throw new NativeSearchError(settings,'missing_api_key');
 if(!/^[\w.:-]{1,100}$/.test(settings.model))throw new NativeSearchError(settings,'invalid_model');
 if(typeof query!=='string'||!query.trim()||query.length>4000)throw new NativeSearchError(settings,'invalid_query');
 const count=Math.max(1,Math.min(30,Math.trunc(Number(limit)||8)));
 for(let attempt=0;;attempt++){
  try{return await (settings.provider==='anthropic'?anthropicSearch(settings,query.trim(),count):openaiSearch(settings,query.trim(),count))}
  catch(error){
   if(attempt||!(error instanceof NativeSearchError)||!error.querySpecific)throw error;
   await new Promise(resolve=>setTimeout(resolve,800));
  }
 }
}
