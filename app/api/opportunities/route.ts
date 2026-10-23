import {guard} from '@/lib/auth';
import {NextResponse} from 'next/server';
import {db, init} from '@/lib/db';
import {LEADS_CTE, leadLifecycle, companyIdentity} from '@/lib/leads';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const denied = await guard(req);
    if (denied) return denied;
    await init();
    const [leads, overview, latest] = await Promise.all([
      db().query(`${LEADS_CTE}
        SELECT * FROM ranked_leads
        ORDER BY chart_eligible DESC, score DESC NULLS LAST, freshness_at DESC, id DESC
        LIMIT 500`),
      db().query(`${LEADS_CTE}
        SELECT jsonb_build_object(
          'total', count(*),
          'active', count(*) FILTER (WHERE chart_eligible),
          'stale', count(*) FILTER (WHERE NOT chart_eligible),
          'highMatch', count(*) FILTER (WHERE chart_eligible AND score >= 80),
          'researched', count(*) FILTER (WHERE research_status = 'complete'),
          'pending', count(*) FILTER (WHERE research_status IN ('pending', 'needs_source', 'failed')),
          'contactable', count(*) FILTER (WHERE chart_eligible AND (NULLIF(email, '') IS NOT NULL OR NULLIF(phone, '') IS NOT NULL)),
          'newToday', count(*) FILTER (WHERE chart_eligible AND created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'),
          'averageScore', COALESCE(round(avg(score) FILTER (WHERE chart_eligible)), 0)
        ) AS stats,
        jsonb_build_object(
          'scoreBands', jsonb_build_array(
            jsonb_build_object('label', 'Hohe Passung', 'color', 'green', 'count', count(*) FILTER (WHERE chart_eligible AND score >= 80)),
            jsonb_build_object('label', 'Mittlere Passung', 'color', 'amber', 'count', count(*) FILTER (WHERE chart_eligible AND score >= 60 AND score < 80)),
            jsonb_build_object('label', 'Geringe Passung', 'color', 'red', 'count', count(*) FILTER (WHERE chart_eligible AND score < 60))
          ),
          'cities', COALESCE((SELECT jsonb_agg(city_count ORDER BY city_count.count DESC, city_count.city)
            FROM (SELECT city, count(*)::int AS count FROM ranked_leads WHERE chart_eligible GROUP BY city) city_count), '[]'::jsonb)
        ) AS charts
        FROM ranked_leads`),
      db().query('SELECT * FROM research_runs ORDER BY id DESC LIMIT 1'),
    ]);
    const now = Date.now();
    return NextResponse.json({
      demo: false,
      items: leads.rows.map(lead => ({...lead, ...leadLifecycle(lead, now)})),
      stats: overview.rows[0].stats,
      charts: overview.rows[0].charts,
      latestRun: latest.rows[0] || null,
      limit: 500,
    });
  } catch {
    return NextResponse.json({error: 'Die Leads konnten nicht aus der Datenbank geladen werden.'}, {status: 503});
  }
}

// PostgreSQL BIGSERIAL values arrive as strings. Keep them lossless, including
// IDs above JavaScript's safe integer range, and reject non-decimal input.
function deletionId(value: unknown): string | null {
 if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
 if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value)) return null;
 return BigInt(value) <= BigInt('9223372036854775807') ? value : null;
}
export async function DELETE(req: Request) {
 const denied = await guard(req); if (denied) return denied;
 const input = await req.json().catch(() => null);
 const requested = input?.ids ?? (input?.id === undefined ? null : [input.id]);
 if (!Array.isArray(requested) || !requested.length || requested.length > 500 || requested.some(id => deletionId(id) === null)) {
  return NextResponse.json({error: 'Bitte wähle 1 bis 500 Firmen zum Löschen aus.'}, {status: 400});
 }
 const ids = [...new Set<string>(requested.map(id => deletionId(id)!))].sort((a,b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
 await init(); const client = await db().connect();
 try {
  await client.query('BEGIN');
  const snapshot = await client.query('SELECT id,name,city,company_key FROM opportunities WHERE id=ANY($1::bigint[]) ORDER BY id', [ids]);
  if (!snapshot.rowCount) { await client.query('ROLLBACK'); return NextResponse.json({error: 'Die ausgewählten Firmen wurden nicht gefunden.'}, {status: 404}); }
  const keys = [...new Set<string>(snapshot.rows.map(company => (company.company_key || companyIdentity(company.name,company.city)).split('|')[0]))].sort();
  for (const key of keys) await client.query('SELECT pg_advisory_xact_lock($1,hashtext($2))', [4747303,key]);
  await client.query('SELECT id FROM opportunities WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [ids]);
  await client.query('DELETE FROM research_page_analysis WHERE source_url IN (SELECT source_url FROM opportunity_signals WHERE opportunity_id=ANY($1::bigint[]) UNION SELECT source_url FROM company_events WHERE company_id=ANY($1::bigint[]) UNION SELECT source_url FROM opportunities WHERE id=ANY($1::bigint[]))', [ids]);
  await client.query('DELETE FROM activities WHERE opportunity_id=ANY($1::bigint[])', [ids]);
  const deleted = await client.query('DELETE FROM opportunities WHERE id=ANY($1::bigint[]) RETURNING id', [ids]);
  await client.query('COMMIT');
  return NextResponse.json({ok: true, deleted: deleted.rowCount});
 } catch {
  await client.query('ROLLBACK');
  return NextResponse.json({error: 'Die Firmen konnten nicht gelöscht werden.'}, {status: 503});
 } finally { client.release(); }
}
