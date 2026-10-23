import {NextResponse} from 'next/server';
import {guard} from '@/lib/auth';
import {processCompanyReviews} from '@/lib/company-review';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(req:Request){
 const denied=await guard(req,true);if(denied)return denied;
 try{return NextResponse.json(await processCompanyReviews())}
 catch{return NextResponse.json({error:'Firmenprüfung konnte nicht gestartet werden.'},{status:500})}
}
