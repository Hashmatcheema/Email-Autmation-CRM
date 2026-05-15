-- Recommended indexes for EITACIES CRM — leads table
-- Review and test each index before applying in production.
-- Apply with: psql -U postgres -d <your-db> -f recommended-indexes.sql
-- DO NOT apply without DBA review; some indexes may conflict with RLS policies or
-- cause write overhead on high-insert tables.

-- ─── Filtering ──────────────────────────────────────────────────────────────

-- Lead list filters: stage, category, owner, source, relationship, company_type
create index if not exists idx_leads_stage
  on leads (stage);

create index if not exists idx_leads_category
  on leads (category);

create index if not exists idx_leads_lead_owner_email
  on leads (lead_owner_email);

create index if not exists idx_leads_lead_source
  on leads (lead_source);

create index if not exists idx_leads_client_relationship
  on leads (client_relationship);

create index if not exists idx_leads_company_type
  on leads (company_type);

create index if not exists idx_leads_hiring_signal
  on leads (hiring_signal);

-- ─── Sorting ────────────────────────────────────────────────────────────────

-- Default sort (newest first) — most queried
create index if not exists idx_leads_created_at_desc
  on leads (created_at desc);

-- Score sort
create index if not exists idx_leads_score_desc
  on leads (score desc nulls last);

-- Next follow-up sort (soonest first)
create index if not exists idx_leads_next_followup_date_asc
  on leads (next_followup_date asc nulls last);

-- Last updated sort
create index if not exists idx_leads_last_updated_desc
  on leads (last_updated desc nulls last);

-- ─── Search (ilike) ─────────────────────────────────────────────────────────
-- PostgreSQL trigram indexes speed up ILIKE queries.
-- Requires pg_trgm extension: CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- create extension if not exists pg_trgm;

-- create index if not exists idx_leads_contact_name_trgm
--   on leads using gin (lower(contact_name) gin_trgm_ops);

-- create index if not exists idx_leads_account_trgm
--   on leads using gin (lower(account) gin_trgm_ops);

-- create index if not exists idx_leads_email_trgm
--   on leads using gin (lower(email) gin_trgm_ops);

-- ─── Dashboard / stats queries ───────────────────────────────────────────────

-- Recommended leads dashboard widget
create index if not exists idx_leads_is_daily_recommended
  on leads (is_daily_recommended)
  where is_daily_recommended = true;

-- Follow-ups due today filter
create index if not exists idx_leads_next_followup_owner
  on leads (next_followup_date, lead_owner_email);

-- ─── Notes ───────────────────────────────────────────────────────────────────
-- No index on notes (text column, not filtered/sorted in queries).
