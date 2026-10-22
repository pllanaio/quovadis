import {NextResponse} from 'next/server';import {guard} from '@/lib/auth';import {getCodeDraft} from '@/lib/code-agent';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=await guard(req);if(denied)return denied;try{const id=Number(new URL(req.url).searchParams.get('id'));if(!Number.isSafeInteger(id)||id<1)throw Error('Ungültiger Entwurf');return NextResponse.json(await getCodeDraft(id))}catch(error){return NextResponse.json({error:String(error)},{status:400})}}
