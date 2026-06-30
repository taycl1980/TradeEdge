-- ============================================================
--  Migration: bring an existing v1 database up to v2 shape
--  Run this in Supabase → SQL Editor → New query → Run.
--  Safe to run multiple times — every statement uses
--  "if not exists" or "add column if not exists".
-- ============================================================

-- The big one: edges table missing the current_version column.
-- This is what causes the "could not find current_version" error.
alter table public.edges
  add column if not exists current_version int not null default 1;

-- While we're here: every other column the v2 schema added to
-- existing tables. Each is idempotent. None of these will affect
-- data — they only add new optional columns.

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists cap_warning_sent_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists display_name text;

alter table public.edges
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- Confirm the fix worked. After running, this should return one row
-- with current_version = 1. If empty, the alter didn't apply.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'edges'
  and column_name = 'current_version';
