import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {auditLeadWebsite} from '@/lib/website-audit';
export const runtime='nodejs';export const maxDuration=180;
export async function POST(req:Request){const denied=await guard(req);if(denied)return denied;const body=await req.json().catch(()=>null);if(!/^[1-9][0-9]{0,18}$/.test(String(body?.id||'')))return NextResponse.json({error:'Ungültige Firma.'},{status:400});try{return NextResponse.json({audit:await auditLeadWebsite(String(body.id))})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Websiteprüfung fehlgeschlagen.'},{status:400})}}
