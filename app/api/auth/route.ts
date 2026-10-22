import {NextResponse} from 'next/server';import {authCookie,changePassword,guard,login,logout,setup,status} from '@/lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){try{return NextResponse.json(await status(req))}catch(e){return NextResponse.json({error:String(e)},{status:503})}}
export async function POST(req:Request){try{const {username,password,mode}=await req.json();const token=mode==='setup'?await setup(String(username||''),String(password||'')):await login(String(username||''),String(password||''));if(!token)return NextResponse.json({error:'Anmeldung fehlgeschlagen'},{status:401});return authCookie(NextResponse.json({ok:true}),token,req)}catch(e){return NextResponse.json({error:String(e)},{status:400})}}
export async function DELETE(req:Request){await logout(req);const response=NextResponse.json({ok:true});response.cookies.delete('quovadis_session');return response}

export async function PUT(req:Request){const denied=await guard(req);if(denied)return denied;try{const {current,next}=await req.json();await changePassword(String(current||''),String(next||''));const response=NextResponse.json({ok:true});response.cookies.delete('quovadis_session');return response}catch(e){return NextResponse.json({error:String(e)},{status:400})}}
