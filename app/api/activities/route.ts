import {guard} from '@/lib/auth';
import {NextResponse} from 'next/server';
import {db, init} from '@/lib/db';

export const dynamic = 'force-dynamic';

function leadId(value: unknown) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(req: Request) {
  try {
    const denied = await guard(req);
    if (denied) return denied;
    const id = leadId(new URL(req.url).searchParams.get('id'));
    if (!id) return NextResponse.json({error: 'Ungültige Lead-ID.'}, {status: 400});
    await init();
    const result = await db().query('SELECT * FROM activities WHERE opportunity_id=$1 ORDER BY created_at DESC, id DESC LIMIT 500', [id]);
    return NextResponse.json({items: result.rows});
  } catch {
    return NextResponse.json({error: 'Der Kontaktverlauf konnte nicht geladen werden.'}, {status: 503});
  }
}

export async function POST(req: Request) {
  try {
    const denied = await guard(req);
    if (denied) return denied;
    const input = await req.json().catch(() => null);
    if (!input || typeof input !== 'object') return NextResponse.json({error: 'Ungültige Aktivität.'}, {status: 400});
    const id = leadId(input.id);
    const kind = input.kind;
    if (!id || !['call', 'email', 'note'].includes(kind)) return NextResponse.json({error: 'Lead und Aktivität prüfen.'}, {status: 400});
    if (input.note != null && typeof input.note !== 'string') return NextResponse.json({error: 'Die Notiz muss Text enthalten.'}, {status: 400});
    const origin=input.origin==='link'?'link':'manual';const target=typeof input.target==='string'?input.target.trim().slice(0,300):null;
    if(origin==='link'&&(kind==='note'||!target||kind==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)||kind==='call'&&target.replace(/\D/g,'').length<7))return NextResponse.json({error:'Kontaktziel prüfen.'},{status:400});
    const note = String(input.note || '').trim();
    if (kind === 'note' && !note) return NextResponse.json({error: 'Bitte eine Notiz eingeben.'}, {status: 400});
    if (note.length > 4000) return NextResponse.json({error: 'Eine Notiz darf höchstens 4000 Zeichen enthalten.'}, {status: 400});
    await init();
    const connection=await db().connect();
    try{
      await connection.query('BEGIN');
      await connection.query('SELECT pg_advisory_xact_lock($1,hashtext($2))',[4747305,String(id)]);
      const previous=origin==='link'?await connection.query("SELECT * FROM activities WHERE opportunity_id=$1 AND kind=$2 AND origin='link' AND target=$3 AND created_at>now()-interval '10 seconds' ORDER BY id DESC LIMIT 1",[id,kind,target]):{rows:[],rowCount:0};
      const result=previous.rowCount?previous:await connection.query('INSERT INTO activities(opportunity_id,kind,note,origin,target) SELECT id,$2,$3,$4,$5 FROM opportunities WHERE id=$1 RETURNING *',[id,kind,origin==='link'?'':note,origin,target]);
      await connection.query('COMMIT');
      if(!result.rowCount)return NextResponse.json({error:'Lead nicht gefunden.'},{status:404});
      return NextResponse.json({ok:true,item:result.rows[0],refreshesRanking:origin!=='link'&&note.length>0},{status:201});
    }catch(error){await connection.query('ROLLBACK');throw error}finally{connection.release()}

  } catch {
    return NextResponse.json({error: 'Die Aktivität konnte nicht gespeichert werden.'}, {status: 503});
  }
}
