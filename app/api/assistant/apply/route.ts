import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {applyProposal} from '@/lib/assistant';
export const runtime='nodejs';export const maxDuration=300;
export async function POST(req:Request){const denied=await guard(req);if(denied)return denied;try{const {messageId}=await req.json();if(!Number.isSafeInteger(Number(messageId)))throw Error('Ungültige Nachricht');return NextResponse.json(await applyProposal(Number(messageId)))}catch(error){return NextResponse.json({error:String(error)},{status:400})}}
