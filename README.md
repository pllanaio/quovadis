# quovadis

Mobile-first IT opportunity radar for Munich, Augsburg and Landsberg am Lech. Next.js / React, PostgreSQL, Docker.

## Features
- Evidence-linked opportunity dashboard and scoring
- Click-to-call and click-to-email with explicit activity logging (opening apps does not count as contact)
- Seven-day follow-up reminders, notification bell and optional mail webhook
- n8n-compatible authenticated ingestion endpoint; only evidence-backed leads
- Server-side OpenAI API analysis hook (model configurable, availability must be verified)
- Fictional demo opportunities are marked DEMO

## Setup
`cp .env.example .env && docker compose up --build -d`

On Vercel configure `DATABASE_URL`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `INGEST_API_KEY` and a real database. Do not expose a public preview without access protection. Schema is initialized by the API when the database is connected.

`POST /api/opportunities` with `x-api-key: INGEST_API_KEY` accepts `{name,city,signal,summary,sourceUrl,score,email,phone,website}`. n8n should collect source URLs and deduplicate by signal URL. Sources are stored as evidence, not as inferred facts.

## Limitations
No live research or third-party paid datasets are bundled. Configure Firecrawl, LinkedIn and company data connectors separately under their permitted API terms. Outreach requires an appropriate legal basis; publicly visible contact details are not permission for cold marketing. A mailto/tel click does not prove a call/email occurred. Model `gpt-6-sol` is a requested configuration, not verified as an available OpenAI API model.
