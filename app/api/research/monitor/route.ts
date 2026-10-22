import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {monitorKnownSignals} from '@/lib/research';

export const runtime='nodejs';
export async function POST(req:Request){
 const denied=await guard(req,true);if(denied)return denied;
 try{return NextResponse.json(await monitorKnownSignals())}catch(error){return NextResponse.json({error:String(error)},{status:400})}
}
