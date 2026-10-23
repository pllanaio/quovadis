import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {processSocialQueue} from '@/lib/social-research';
export const runtime='nodejs';export const maxDuration=300;
export async function POST(req:Request){const denied=await guard(req,true);if(denied)return denied;try{return NextResponse.json(await processSocialQueue())}catch{return NextResponse.json({error:'Social-Media-Hintergrunddienst nicht verfügbar.'},{status:503})}}
