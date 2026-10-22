import {NextResponse} from 'next/server';import {guard} from '@/lib/auth';import {checkGithub} from '@/lib/code-agent';
export const runtime='nodejs';
export async function POST(req:Request){const denied=await guard(req);if(denied)return denied;try{return NextResponse.json(await checkGithub())}catch(error){return NextResponse.json({error:String(error)},{status:400})}}
