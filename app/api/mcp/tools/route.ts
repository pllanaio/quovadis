import {guard} from '@/lib/auth';
import {NextResponse} from 'next/server';import {listMcpTools} from '@/lib/research';import {getSettings} from '@/lib/settings';
export const runtime='nodejs';
export async function POST(req:Request){const denied=await guard(req);if(denied)return denied;try{const {url,token}=await req.json();const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('MCP-Server muss HTTPS verwenden');const saved=(await getSettings()).sources.find(s=>s.kind==='mcp'&&s.url===url)?.token;return NextResponse.json({tools:await listMcpTools(url,String(token||saved||''))})}catch(e){return NextResponse.json({error:String(e)},{status:400})}}
