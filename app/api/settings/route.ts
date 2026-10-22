import {guard} from '@/lib/auth';
import {NextResponse} from 'next/server';import {getSettings,publicSettings,saveSettings} from '@/lib/settings';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=await guard(req);if(denied)return denied;try{return NextResponse.json(publicSettings(await getSettings()))}catch(e){return NextResponse.json({error:String(e)},{status:503})}}
export async function PUT(req:Request){const denied=await guard(req);if(denied)return denied;try{return NextResponse.json(await saveSettings(await req.json()))}catch(e){return NextResponse.json({error:String(e)},{status:400})}}
