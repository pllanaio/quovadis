import {NextResponse} from 'next/server';import {guard} from '@/lib/auth';import {sendDueReminders} from '@/lib/mail';
export const runtime='nodejs';
export async function POST(req:Request){const denied=await guard(req,true);if(denied)return denied;try{return NextResponse.json(await sendDueReminders())}catch(e){return NextResponse.json({error:String(e)},{status:400})}}
