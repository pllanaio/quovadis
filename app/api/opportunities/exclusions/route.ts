import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {db,init} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=await guard(req);if(denied)return denied;await init();const result=await db().query('SELECT company_key,website_host,excluded_at FROM excluded_companies ORDER BY excluded_at DESC LIMIT 500');return NextResponse.json({items:result.rows})}
export async function DELETE(req:Request){const denied=await guard(req);if(denied)return denied;const input=await req.json().catch(()=>null);if(typeof input?.companyKey!=='string'||input.companyKey.length>500)return NextResponse.json({error:'Ungültiger Ausschluss.'},{status:400});await init();await db().query('DELETE FROM excluded_companies WHERE company_key=$1',[input.companyKey]);return NextResponse.json({ok:true})}
