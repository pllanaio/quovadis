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
    CREATE INDEX IF NOT EXISTS opportunities_research_queue ON opportunities(research_status,detected_at);
    CREATE TABLE IF NOT EXISTS app_settings(id INTEGER PRIMARY KEY CHECK(id=1),config JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_user(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT NOT NULL,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,expires_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS mail_dispatches(day DATE PRIMARY KEY,sent_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS research_runs(id BIGSERIAL PRIMARY KEY,started_at TIMESTAMPTZ DEFAULT now(),finished_at TIMESTAMPTZ,imported INTEGER DEFAULT 0,error TEXT);
    ALTER TABLE research_runs ADD COLUMN IF NOT EXISTS researched INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS assistant_messages(id BIGSERIAL PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,proposal JSONB,evaluation JSONB,applied_at TIMESTAMPTZ,code_draft_id BIGINT,created_at TIMESTAMPTZ DEFAULT now());
    ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS evaluation JSONB;
    ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS code_draft_id BIGINT;
    CREATE TABLE IF NOT EXISTS code_drafts(id BIGSERIAL PRIMARY KEY,assistant_message_id BIGINT UNIQUE NOT NULL,instruction TEXT NOT NULL,owner TEXT NOT NULL,repo TEXT NOT NULL,base_branch TEXT NOT NULL,base_sha TEXT NOT NULL,summary TEXT NOT NULL,files JSONB NOT NULL,diff_preview TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',pr_url TEXT,created_at TIMESTAMPTZ DEFAULT now());
  `).then(() => undefined).catch(error => {initializing = undefined; throw error});
  await initializing;
}
