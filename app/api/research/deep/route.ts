import {guard} from '@/lib/auth';
import {processDeepQueue} from '@/lib/research';
import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const maxDuration=300;

export async function POST(req:Request){
 const denied=await guard(req,true);if(denied)return denied;
 try{
  const body=await req.json().catch(()=>({}));
  const id=body?.id===undefined?undefined:Number(body.id);
  if(id!==undefined&&(!Number.isSafeInteger(id)||id<1))throw Error('Ungültige Opportunity-ID');
  return NextResponse.json(await processDeepQueue(id));
 }catch(error){return NextResponse.json({error:String(error)},{status:400})}
}
