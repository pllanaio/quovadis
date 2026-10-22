import {guard} from '@/lib/auth';
import {db,init} from '@/lib/db';
import {NextResponse} from 'next/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:Request){
 const denied=await guard(req);if(denied)return denied;
 const id=Number(new URL(req.url).searchParams.get('id'));
 if(!Number.isSafeInteger(id)||id<1)return NextResponse.json({error:'Ungültige Opportunity-ID'},{status:400});
 await init();
 const signals=await db().query('SELECT id,source_url,evidence_quote,signal,category,priority,source_reliability,published_at,first_seen_at,last_checked_at,status FROM opportunity_signals WHERE opportunity_id=$1 ORDER BY first_seen_at DESC',[id]);
 const events=await db().query('SELECT e.signal_id,e.kind,e.detail,e.created_at FROM opportunity_signal_events e JOIN opportunity_signals s ON s.id=e.signal_id WHERE s.opportunity_id=$1 ORDER BY e.created_at DESC LIMIT 50',[id]);
 return NextResponse.json({signals:signals.rows,events:events.rows});
}
