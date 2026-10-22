import {NextResponse} from 'next/server';import {guard} from '@/lib/auth';import {getSettings} from '@/lib/settings';
import {db} from '@/lib/db';
import {scheduleState} from '@/lib/schedule.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 const denied=await guard(req,true);if(denied)return denied;
 const settings=await getSettings();
 const result=await db().query('SELECT max(scheduled_date)::text AS last_scheduled_date FROM research_runs');
 return NextResponse.json({intervalMinutes:1440,dailyAt:settings.dailyAt,timezone:settings.timezone,dailyEnabled:settings.dailyEnabled,cities:settings.cities,radiusKm:settings.radiusKm,...scheduleState(settings,result.rows[0]?.last_scheduled_date)});
}
