import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {db,init} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const denied=await guard(req);if(denied)return denied;const id=Number(new URL(req.url).searchParams.get('id'));if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Ungültige Firma.'},{status:400});
 await init();const rows=await db().query(`SELECT e.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'hypothesis',o.hypothesis,'intelligence',o.intelligence,'model_version',o.model_version,'researched_at',o.researched_at) ORDER BY o.entry_opportunity_score DESC) FROM event_opportunities o WHERE o.event_id=e.id),'[]'::jsonb) AS opportunities FROM company_events e WHERE company_id=$1 ORDER BY last_seen_at DESC LIMIT 100`,[id]);return NextResponse.json({events:rows.rows});
}
