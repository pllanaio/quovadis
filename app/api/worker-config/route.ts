import {NextResponse} from 'next/server';import {guard} from '@/lib/auth';import {getSettings} from '@/lib/settings';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=await guard(req,true);if(denied)return denied;return NextResponse.json({intervalMinutes:(await getSettings()).intervalMinutes})}
