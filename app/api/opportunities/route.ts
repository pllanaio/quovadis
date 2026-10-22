import {guard} from '@/lib/auth';
import {NextResponse} from 'next/server';
import {db, init} from '@/lib/db';
import {LEADS_CTE, leadLifecycle} from '@/lib/leads';

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
