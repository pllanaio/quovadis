import {guard} from '@/lib/auth';
import {NextResponse} from 'next/server';import {runResearch} from '@/lib/research';
export const runtime='nodejs';export const maxDuration=300;
export async function POST(req:Request){const denied=await guard(req,true);if(denied)return denied;try{return NextResponse.json(await runResearch())}catch(e){return NextResponse.json({error:String(e)},{status:400})}}
