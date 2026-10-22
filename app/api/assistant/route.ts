import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {chat,history} from '@/lib/assistant';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(req:Request){const denied=await guard(req);if(denied)return denied;try{return NextResponse.json({items:await history()})}catch(error){return NextResponse.json({error:String(error)},{status:500})}}
export async function POST(req:Request){const denied=await guard(req);if(denied)return denied;try{const input=await req.json();const message=String(input.message||'').trim();if(!message||message.length>4000)return NextResponse.json({error:'Nachricht muss 1 bis 4000 Zeichen haben'},{status:400});const leadId=Number(input.leadId)||undefined;return NextResponse.json(await chat(message,leadId))}catch(error){return NextResponse.json({error:String(error)},{status:400})}}
