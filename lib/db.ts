import {Pool} from 'pg';

let pool: Pool | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw Error('Database not configured');
  pool ??= new Pool({connectionString: process.env.DATABASE_URL});
  return pool;
}

let initializing: Promise<void> | undefined;
export async function init() {
  initializing ??= db().query(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL,
      signal TEXT NOT NULL, summary TEXT DEFAULT '', source_url TEXT NOT NULL,
      score INTEGER DEFAULT 0, phone TEXT, email TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS activities (
      id BIGSERIAL PRIMARY KEY, opportunity_id BIGINT REFERENCES opportunities(id),
      kind TEXT NOT NULL, note TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS activities_lead_timeline ON activities(opportunity_id,created_at DESC);
    ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_source_url_key;
    CREATE UNIQUE INDEX IF NOT EXISTS opportunities_source_name_unique ON opportunities(source_url,name);
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS evidence_quote TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS company_url TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS research_status TEXT NOT NULL DEFAULT 'legacy';
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS research_summary TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS research_sources JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS contact_source_url TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS research_error TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS researched_at TIMESTAMPTZ;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS company_key TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS need_status TEXT NOT NULL DEFAULT 'unclassified';
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS external_readiness TEXT NOT NULL DEFAULT 'unknown';
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS assessment JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
    CREATE UNIQUE INDEX IF NOT EXISTS opportunities_company_key_unique ON opportunities(company_key) WHERE company_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS opportunities_research_queue ON opportunities(research_status,detected_at);
    CREATE TABLE IF NOT EXISTS opportunity_signals (
      id BIGSERIAL PRIMARY KEY,
      opportunity_id BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL,
      evidence_quote TEXT NOT NULL,
      signal TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      source_reliability TEXT NOT NULL,
      published_at TIMESTAMPTZ,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status TEXT NOT NULL DEFAULT 'active',
      content_hash TEXT,
      UNIQUE(opportunity_id,source_url,evidence_quote)
    );
    CREATE INDEX IF NOT EXISTS opportunity_signals_check_queue ON opportunity_signals(status,last_checked_at);
    CREATE TABLE IF NOT EXISTS opportunity_signal_events (
      id BIGSERIAL PRIMARY KEY,
      signal_id BIGINT NOT NULL REFERENCES opportunity_signals(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS opportunity_category TEXT;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS it_need_confidence INTEGER;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS entry_opportunity_score INTEGER;
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS external_engagement TEXT NOT NULL DEFAULT 'unknown';
    ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS event_intelligence JSONB;
    CREATE TABLE IF NOT EXISTS company_events (
      id BIGSERIAL PRIMARY KEY, company_id BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      event_category TEXT NOT NULL, event_description TEXT NOT NULL, source_url TEXT NOT NULL,
      evidence_quote TEXT NOT NULL, published_at TIMESTAMPTZ, checked_at TIMESTAMPTZ NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'verified', content_hash TEXT NOT NULL,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(company_id,source_url,evidence_quote)
    );
    CREATE TABLE IF NOT EXISTS event_opportunities (
      id BIGSERIAL PRIMARY KEY, event_id BIGINT NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
      category TEXT NOT NULL, hypothesis TEXT NOT NULL, evidence_status TEXT NOT NULL DEFAULT 'hypothesis',
      entry_offer JSONB, it_need_confidence INTEGER NOT NULL, entry_opportunity_score INTEGER NOT NULL,
      external_engagement TEXT NOT NULL, intelligence JSONB NOT NULL, model_version TEXT NOT NULL,
      researched_at TIMESTAMPTZ NOT NULL, UNIQUE(event_id,hypothesis)
    );
    CREATE TABLE IF NOT EXISTS event_analysis_history (
      id BIGSERIAL PRIMARY KEY, event_id BIGINT NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
      revision_hash TEXT NOT NULL, intelligence JSONB NOT NULL, model_version TEXT NOT NULL,
      researched_at TIMESTAMPTZ NOT NULL, UNIQUE(event_id,revision_hash)
    );
    CREATE INDEX IF NOT EXISTS company_events_company ON company_events(company_id,last_seen_at DESC);
    CREATE TABLE IF NOT EXISTS excluded_companies (
      company_key TEXT PRIMARY KEY, website_host TEXT, excluded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS research_page_analysis (
      cache_key TEXT PRIMARY KEY, source_url TEXT NOT NULL, content_hash TEXT NOT NULL,
      analysis JSONB NOT NULL, model_version TEXT NOT NULL, analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS research_page_analysis_age ON research_page_analysis(analyzed_at);
    CREATE TABLE IF NOT EXISTS ai_usage (
      id BIGSERIAL PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL, operation TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd NUMERIC, succeeded BOOLEAN NOT NULL, duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS app_settings(id INTEGER PRIMARY KEY CHECK(id=1),config JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_user(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT NOT NULL,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,expires_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS mail_dispatches(day DATE PRIMARY KEY,sent_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS research_runs(id BIGSERIAL PRIMARY KEY,started_at TIMESTAMPTZ DEFAULT now(),finished_at TIMESTAMPTZ,imported INTEGER DEFAULT 0,error TEXT);
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS researched INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS searched INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS verified INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS status TEXT;
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS stage TEXT;
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS scheduled_date DATE;
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS discovered INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS rejected INTEGER NOT NULL DEFAULT 0;
    UPDATE research_runs SET
      status = CASE WHEN finished_at IS NULL THEN 'running' WHEN error IS NULL THEN 'completed' ELSE 'failed' END,
      updated_at = COALESCE(finished_at,started_at,now())
      WHERE status IS NULL;
    ALTER TABLE research_runs ALTER COLUMN status SET DEFAULT 'queued';
    ALTER TABLE research_runs ALTER COLUMN status SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS research_runs_scheduled_day_unique ON research_runs(scheduled_date) WHERE scheduled_date IS NOT NULL;
    CREATE INDEX IF NOT EXISTS research_runs_queue ON research_runs(status,started_at);
    CREATE TABLE IF NOT EXISTS assistant_messages(id BIGSERIAL PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,proposal JSONB,evaluation JSONB,applied_at TIMESTAMPTZ,code_draft_id BIGINT,created_at TIMESTAMPTZ DEFAULT now());
    ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS evaluation JSONB;
    ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS code_draft_id BIGINT;
    CREATE TABLE IF NOT EXISTS code_drafts(id BIGSERIAL PRIMARY KEY,assistant_message_id BIGINT UNIQUE NOT NULL,instruction TEXT NOT NULL,owner TEXT NOT NULL,repo TEXT NOT NULL,base_branch TEXT NOT NULL,base_sha TEXT NOT NULL,summary TEXT NOT NULL,files JSONB NOT NULL,diff_preview TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',pr_url TEXT,created_at TIMESTAMPTZ DEFAULT now());
  `).then(() => undefined).catch(error => {initializing = undefined; throw error});
  await initializing;
}
