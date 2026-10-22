import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {searchWeb,scrapePage} from '@/lib/web-search';

export const runtime='nodejs';
export async function POST(req:Request){
 const denied=await guard(req,true);if(denied)return denied;
 try{
  const hits=await searchWeb('','München IT Administrator Aufbau IT Unternehmen',6);
  const checks=await Promise.allSettled(hits.slice(0,5).map(hit=>scrapePage('',hit.url)));
  const pages=checks.flatMap(item=>item.status==='fulfilled'&&item.value?[item.value]:[]);
  return NextResponse.json({hits:hits.length,verified:pages.length,examples:pages.slice(0,2).map(page=>page.url)});
 }catch(error){return NextResponse.json({error:String(error)},{status:502})}
}
