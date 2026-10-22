import {guard} from '@/lib/auth';
import {NextResponse} from 'next/server';
import {db,init} from '@/lib/db';
import {enqueueResearch} from '@/lib/research-jobs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const denied=await guard(req);if(denied)return denied;
 await init();const runs=await db().query('SELECT * FROM research_runs ORDER BY id DESC LIMIT 15');
 return NextResponse.json({runs:runs.rows});
}
export async function POST(req:Request){
 const denied=await guard(req,true);if(denied)return denied;
 try{const body=await req.json().catch(()=>({}));return NextResponse.json(await enqueueResearch(body.trigger==='scheduled'?'scheduled':'manual',body.scheduleDate),{status:202})}
 catch(error){return NextResponse.json({error:String(error)},{status:400})}
}
