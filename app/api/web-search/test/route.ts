import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {getSettings} from '@/lib/settings';
import {searchWebDetailed,scrapePage,WebSearchUnavailableError,WebSearchQueryError} from '@/lib/web-search';

export const runtime='nodejs';
export async function POST(req:Request){
 const denied=await guard(req,true);if(denied)return denied;
 let mode:'local'|'configured'='local';
 try{
  const body=await req.text();const input:unknown=body.trim()?JSON.parse(body):{};
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Ungültiger Testauftrag');
  const requestedMode=(input as Record<string,unknown>).mode;
  if(requestedMode!==undefined&&requestedMode!=='local'&&requestedMode!=='configured')throw Error('Unbekannter Suchtest');
  if(requestedMode==='configured')mode='configured';
 }catch(error){return NextResponse.json({error:error instanceof SyntaxError?'Ungültiger Testauftrag':error instanceof Error?error.message:'Ungültiger Testauftrag'},{status:400})}
 try{
  const settings=mode==='configured'?await getSettings():null;
  const result=await searchWebDetailed(settings?.firecrawlKey||'','München IT Administrator',6,settings?{ai:settings,forceRetry:true}:{forceRetry:true});
  const checks=await Promise.allSettled(result.hits.slice(0,5).map(hit=>scrapePage(settings?.firecrawlKey||'',hit.url)));
  const pages=checks.flatMap(item=>item.status==='fulfilled'&&item.value?[item.value]:[]);
  const restricted=result.diagnostics.some(item=>item.status==='degraded'||item.status==='unavailable');
  const status=restricted||result.hits.length>0&&!pages.length?'degraded':result.hits.length?'ok':'empty';
  const message=!result.hits.length?(restricted?'Keine Treffer; mindestens ein Suchanbieter war eingeschränkt.':'Die Suche hat geantwortet, aber für die Testabfrage keine Treffer geliefert.'):!pages.length?'Suchtreffer gefunden; deren Originalseiten konnten nicht gelesen werden.':restricted?'Suchtreffer und Originalseiten geprüft; mindestens ein Suchanbieter war eingeschränkt.':'Suchtreffer und Originalseiten erfolgreich geprüft.';
  return NextResponse.json({hits:result.hits.length,verified:pages.length,examples:pages.slice(0,2).map(page=>page.url),backend:result.backend,diagnostics:result.diagnostics,status,message});
 }catch(error){
  const queryFailure=error instanceof WebSearchQueryError;
  const diagnostics=error instanceof WebSearchUnavailableError||queryFailure?error.diagnostics:[];
  const message=error instanceof Error?error.message:'Die Websuche konnte nicht geprüft werden.';
  return NextResponse.json({error:message.slice(0,600),hits:0,verified:0,examples:[],backend:diagnostics.at(-1)?.backend||'searxng',diagnostics,status:queryFailure?'degraded':'unavailable'},{status:502});
 }
}
