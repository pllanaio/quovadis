import {guard} from '@/lib/auth';
import {NextResponse} from 'next/server';
import {db,init} from '@/lib/db';
import {runResearch} from '@/lib/research';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(req:Request){
 const denied=await guard(req,true);if(denied)return denied;
 await init();
 const next=await db().query("SELECT id FROM research_runs WHERE status='queued' OR (status='running' AND updated_at<now()-interval '20 minutes') ORDER BY id LIMIT 1");
 if(!next.rowCount)return NextResponse.json({processed:false});
 try{return NextResponse.json({processed:true,...await runResearch(Number(next.rows[0].id))})}
 catch(error){return NextResponse.json({error:String(error)},{status:500})}
}
