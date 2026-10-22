import {NextResponse} from 'next/server';import {guard} from '@/lib/auth';import {createCodePr} from '@/lib/code-agent';
export const runtime='nodejs';export const maxDuration=300;
export async function POST(req:Request){const denied=await guard(req);if(denied)return denied;try{const {draftId}=await req.json();const id=Number(draftId);if(!Number.isSafeInteger(id)||id<1)throw Error('Ungültiger Entwurf');return NextResponse.json(await createCodePr(id))}catch(error){return NextResponse.json({error:String(error)},{status:400})}}
