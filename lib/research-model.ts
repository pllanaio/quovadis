import {db} from './db';
import type {Settings} from './settings';
export async function logUsage(s:Settings,model:string,operation:string,usage:Record<string,unknown>|undefined,succeeded:boolean,durationMs:number){
 const input=Math.max(0,Math.round(Number(usage?.prompt_tokens??usage?.input_tokens)||0)),output=Math.max(0,Math.round(Number(usage?.completion_tokens??usage?.output_tokens)||0));
 const cost=succeeded&&usage!==undefined&&model===s.model&&(s.inputTokenPrice>0||s.outputTokenPrice>0)?(input*s.inputTokenPrice+output*s.outputTokenPrice)/1000000:null;
 try{await db().query('INSERT INTO ai_usage(provider,model,operation,input_tokens,output_tokens,estimated_cost_usd,succeeded,duration_ms) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[s.provider,model,operation,input,output,cost,succeeded,Math.max(0,Math.round(durationMs))])}catch{/* Metrics must not interrupt research. */}
}
export async function researchModel(s:Settings&{researchSignal?:AbortSignal},system:string,prompt:string,maxTokens=2200,timeoutMs=60000,operation='research',modelOverride?:string){
 const model=modelOverride||s.model,started=Date.now(),anthropic=s.provider==='anthropic',key=anthropic?s.anthropicKey:s.openaiKey;
 if(!key)throw Error((anthropic?'Claude':'OpenAI')+' API-Key fehlt');
 try{
  const reasoning=/^(o\d|gpt-[5-9])/.test(model)&&s.reasoningLevel!=='default'?{reasoning_effort:s.reasoningLevel}:{};
  const response=await fetch(anthropic?'https://api.anthropic.com/v1/messages':'https://api.openai.com/v1/chat/completions',{method:'POST',signal:AbortSignal.any([AbortSignal.timeout(timeoutMs),...(s.researchSignal?[s.researchSignal]:[])]),headers:anthropic?{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'}:{'content-type':'application/json',authorization:'Bearer '+key},body:JSON.stringify(anthropic?{model,max_tokens:maxTokens,system,messages:[{role:'user',content:prompt}]}:{model,...(/^(o\d|gpt-[5-9])/.test(model)?{max_completion_tokens:maxTokens}:{max_tokens:maxTokens}),...reasoning,...(['discovery','company_research'].includes(operation)?{response_format:{type:'json_object'}}:{}),messages:[{role:'system',content:system},{role:'user',content:prompt}]})});
  const data=await response.json();if(!response.ok)throw Error((anthropic?'Claude':'OpenAI')+' API HTTP '+response.status);
  await logUsage(s,model,operation,data.usage,true,Date.now()-started);
  const truncated=anthropic?data.stop_reason==='max_tokens':data.choices?.[0]?.finish_reason==='length';
  const refused=anthropic?data.stop_reason==='refusal':!!data.choices?.[0]?.message?.refusal;
  if(truncated||refused){const error=new Error(truncated?'KI-Ausgabe wurde am Tokenlimit abgeschnitten.':'KI-Anbieter hat die Auswertung abgelehnt.');Object.assign(error,{code:truncated?'MODEL_OUTPUT_INCOMPLETE':'MODEL_REFUSAL'});throw error}
  return anthropic?data.content?.filter((part:{type:string})=>part.type==='text').map((part:{text:string})=>part.text).join('\n')||'':data.choices?.[0]?.message?.content||'';
 }catch(error){if(!(error instanceof Error&&'code' in error&&['MODEL_OUTPUT_INCOMPLETE','MODEL_REFUSAL'].includes(String(error.code))))await logUsage(s,model,operation,undefined,false,Date.now()-started);throw error}
}
