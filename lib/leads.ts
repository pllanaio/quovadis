export const STALE_AFTER_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

type LeadFreshnessInput = {
  score?: number | null;
  created_at?: string | Date | null;
  detected_at?: string | Date | null;
  last_note_at?: string | Date | null;
};

function timestamp(value: string | Date | null | undefined) {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/** Research timestamps deliberately do not renew a lead's position in the charts. */
export function leadLifecycle(lead: LeadFreshnessInput, now = Date.now()) {
  const created = timestamp(lead.created_at) ?? timestamp(lead.detected_at) ?? now;
  const freshness = timestamp(lead.last_note_at) ?? created;
  const staleAt = freshness + STALE_AFTER_DAYS * DAY_MS;
  const isStale = now >= staleAt;
  const score = Math.min(100, Math.max(0, Number(lead.score) || 0));
  return {
    freshness_at: new Date(freshness).toISOString(),
    stale_at: new Date(staleAt).toISOString(),
    is_stale: isStale,
    chart_eligible: !isStale,
    ranking_score: Math.round(score * (isStale ? 0.25 : 1)),
    score_color: score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red',
  };
}

// Every API count uses the same note-based freshness rule as the list ordering.
export const LEADS_CTE = `
  WITH activity_summary AS (
    SELECT opportunity_id,
      max(created_at) FILTER (WHERE length(btrim(COALESCE(note, ''))) > 0) AS last_note_at,
      max(created_at) AS last_activity_at,
      count(*)::int AS activity_count
    FROM activities
    GROUP BY opportunity_id
  ), lead_freshness AS (
    SELECT o.*, a.last_note_at, a.last_activity_at,
      COALESCE(a.activity_count, 0) AS activity_count,
      COALESCE(a.last_note_at, o.created_at, o.detected_at, now()) AS freshness_at
    FROM opportunities o
    LEFT JOIN activity_summary a ON a.opportunity_id = o.id
  ), ranked_leads AS (
    SELECT *, freshness_at > now() - interval '10 days' AS chart_eligible
    FROM lead_freshness
  )
`;
