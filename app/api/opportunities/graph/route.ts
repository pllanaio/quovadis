import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {db,init} from '@/lib/db';
import {companyGraph} from '@/lib/company-graph';
export const dynamic='force-dynamic';
export async function GET(req:Request){const denied=await guard(req);if(denied)return denied;try{await init();const result=await db().query('SELECT id,name,city,assessment FROM opportunities ORDER BY id DESC LIMIT 2000');return NextResponse.json({...companyGraph(result.rows),limit:2000})}catch{return NextResponse.json({error:'Verbindungen konnten nicht geladen werden.'},{status:503})}}
