import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {db,init} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=await guard(req);if(denied)return denied;await init();const summary=await db().query("SELECT count(*)::int AS calls,COALESCE(sum(input_tokens),0)::bigint AS input_tokens,COALESCE(sum(output_tokens),0)::bigint AS output_tokens,sum(estimated_cost_usd) AS estimated_cost_usd,count(*) FILTER(WHERE estimated_cost_usd IS NULL)::int AS unpriced_calls,count(*) FILTER(WHERE NOT succeeded)::int AS failed_calls FROM ai_usage WHERE created_at>now()-interval '30 days'");const rows=await db().query('SELECT provider,model,operation,input_tokens,output_tokens,estimated_cost_usd,succeeded,duration_ms,created_at FROM ai_usage ORDER BY id DESC LIMIT 50');return NextResponse.json({summary:summary.rows[0],items:rows.rows})}
