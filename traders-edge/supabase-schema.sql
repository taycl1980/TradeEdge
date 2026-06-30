-- ============================================================
--  Trader's Edge — Database Schema v2
--  Run this in Supabase → SQL Editor → New query → Run.
--  Adds: analyses, edge_versions, lookup tables, subscriptions,
--  stripe_events, audit_log, soft delete, RLS-coverage check.
--
--  Safe to run on a fresh project. If migrating from v1, see the
--  MIGRATING FROM V1 notes near the bottom before running.
-- ============================================================

create extension if not exists pgcrypto;

-- 1) PROFILES ------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free' check (plan in ('free','pro')),
  stripe_customer_id text,
  analysis_count integer not null default 0,
  onboarding_completed_at timestamptz,        -- null = route to edge builder
  welcome_email_sent_at timestamptz,          -- null = welcome email not yet dispatched
  cap_warning_sent_at timestamptz,            -- null = no cap-warning email this cycle
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 2) LOOKUP TABLES --------------------------------------------
create table if not exists public.instruments (
  id serial primary key,
  symbol text unique not null,
  display_name text,
  category text,                              -- 'forex'|'commodity'|'index'|'crypto'
  pip_size numeric(10,8) default 0.0001,
  is_active boolean not null default true
);

create table if not exists public.sessions (
  id serial primary key,
  name text unique not null
);

create table if not exists public.patterns (
  id serial primary key,
  name text unique not null,
  category text
);

insert into public.instruments (symbol, display_name, category, pip_size) values
  ('EURUSD','Euro / US Dollar','forex',0.0001),
  ('GBPUSD','British Pound / US Dollar','forex',0.0001),
  ('USDJPY','US Dollar / Japanese Yen','forex',0.01),
  ('USDCAD','US Dollar / Canadian Dollar','forex',0.0001),
  ('NZDUSD','New Zealand Dollar / US Dollar','forex',0.0001),
  ('AUDUSD','Australian Dollar / US Dollar','forex',0.0001),
  ('XAUUSD','Gold','commodity',0.1),
  ('USOIL','WTI Crude Oil','commodity',0.1)
on conflict (symbol) do nothing;

insert into public.sessions (name) values
  ('Asian'),('London'),('New York'),('London-NY overlap')
on conflict (name) do nothing;

insert into public.patterns (name, category) values
  ('BOS continuation','SMC'),('CHoCH reversal','SMC'),
  ('Liquidity sweep + FVG','SMC'),('Order block rejection','SMC'),
  ('False breakout','SMC'),('FVG fill','SMC'),
  ('Killzone liquidity raid','ICT'),('Supply/Demand reversal','S&D'),
  ('Trend pullback continuation','Trend')
on conflict (name) do nothing;

-- 3) EDGES + EDGE_VERSIONS (snapshot pattern) -----------------
create table if not exists public.edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.edge_versions (
  id uuid primary key default gen_random_uuid(),
  edge_id uuid not null references public.edges(id) on delete cascade,
  version int not null,
  config jsonb not null,                      -- { name, cf:[...], cl:[...], min, full, risk, rr, instr:[...] }
  created_at timestamptz not null default now(),
  unique (edge_id, version)
);

-- 4) ANALYSES (new — the moat) --------------------------------
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  edge_version_id uuid references public.edge_versions(id),

  instrument_id int references public.instruments(id),
  timeframe text,
  detected_bias text,

  verdict text not null check (verdict in ('trade-full','trade-reduced','skip')),
  score int not null,
  max_score int not null,
  result jsonb not null,                       -- full AI response, for replay/debug

  image_hash text,                             -- dedupe / abuse signal
  source text not null default 'web',          -- 'web'|'extension'|'mobile-share'
  cost_usd numeric(10,5),

  linked_trade_id uuid,                        -- set once the user logs the outcome
  created_at timestamptz not null default now()
);

create index if not exists idx_analyses_user_created on public.analyses (user_id, created_at desc);
create index if not exists idx_analyses_linked_trade on public.analyses (linked_trade_id) where linked_trade_id is not null;

-- 5) TRADES (normalized) ---------------------------------------
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  edge_version_id uuid references public.edge_versions(id),

  trade_date date not null,
  instrument_id int references public.instruments(id),
  direction text check (direction in ('Buy','Sell')),
  session_id int references public.sessions(id),
  pattern_id int references public.patterns(id),
  confluence_score int check (confluence_score >= 0),

  entry_price numeric(14,5),
  stop_loss numeric(14,5),
  take_profit numeric(14,5),
  exit_price numeric(14,5),
  position_size numeric(12,2),
  risk_amount_usd numeric(10,2),

  result text check (result in ('Win','Loss','Breakeven')),
  pnl_pips numeric(10,2),
  pnl_usd numeric(10,2),
  rr_achieved numeric(6,2),

  rule_compliant boolean not null,
  emotion text,
  notes_right text,
  notes_wrong text,

  source_analysis_id uuid references public.analyses(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_trades_user_date on public.trades (user_id, trade_date desc);
create index if not exists idx_trades_streak on public.trades (user_id, rule_compliant, created_at desc);
create index if not exists idx_trades_edge_validation on public.trades (user_id, confluence_score, result);

alter table public.analyses
  add constraint fk_analyses_linked_trade
  foreign key (linked_trade_id) references public.trades(id) on delete set null;

-- 6) SUBSCRIPTIONS + STRIPE_EVENTS (webhook idempotency) -------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text unique,
  status text,
  plan_interval text,                          -- 'monthly'|'annual'
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_events (
  id text primary key,                          -- Stripe event id, naturally unique
  type text,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 7) AUDIT LOG --------------------------------------------------
create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid,                                -- null for system/webhook events
  event text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
--  ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.edges         enable row level security;
alter table public.edge_versions enable row level security;
alter table public.analyses      enable row level security;
alter table public.trades        enable row level security;
alter table public.subscriptions enable row level security;
-- instruments/sessions/patterns: public read-only lookups, no user data
alter table public.instruments   enable row level security;
alter table public.sessions      enable row level security;
alter table public.patterns      enable row level security;
-- audit_log + stripe_events: service-role only, RLS enabled with NO policies
-- (enabling RLS with zero policies = nobody can read via the anon/authenticated role)
alter table public.audit_log     enable row level security;
alter table public.stripe_events enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

drop policy if exists "own edges all" on public.edges;
create policy "own edges all" on public.edges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own edge_versions read" on public.edge_versions;
create policy "own edge_versions read" on public.edge_versions for select
  using (edge_id in (select id from public.edges where user_id = auth.uid()));
drop policy if exists "own edge_versions insert" on public.edge_versions;
create policy "own edge_versions insert" on public.edge_versions for insert
  with check (edge_id in (select id from public.edges where user_id = auth.uid()));

drop policy if exists "own analyses all" on public.analyses;
create policy "own analyses all" on public.analyses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own trades all" on public.trades;
create policy "own trades all" on public.trades for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own subscriptions read" on public.subscriptions;
create policy "own subscriptions read" on public.subscriptions for select using (auth.uid() = user_id);

drop policy if exists "lookup read instruments" on public.instruments;
create policy "lookup read instruments" on public.instruments for select using (true);
drop policy if exists "lookup read sessions" on public.sessions;
create policy "lookup read sessions" on public.sessions for select using (true);
drop policy if exists "lookup read patterns" on public.patterns;
create policy "lookup read patterns" on public.patterns for select using (true);

-- ------------------------------------------------------------
--  AUTO-CREATE a profile row when a new user signs up
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
--  USAGE CAP: atomic increment, returns new value
-- ------------------------------------------------------------
create or replace function public.increment_analysis(uid uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_count integer;
begin
  update public.profiles
    set analysis_count = analysis_count + 1
    where id = uid
    returning analysis_count into new_count;
  return new_count;
end;
$$;

-- ------------------------------------------------------------
--  SECURITY CHECK: list any public table WITHOUT RLS enabled.
--  Run this manually before every deploy that adds a table.
--  Empty result = pass. Any row returned = fix before shipping.
-- ------------------------------------------------------------
create or replace view public.rls_coverage_check as
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false;
-- Usage:  select * from public.rls_coverage_check;

-- ============================================================
--  MIGRATING FROM V1 (skip this section on a fresh project)
--  If you already have v1's profiles/edges/trades tables with data:
--  1. This script is additive — it won't drop your existing tables.
--  2. The old `edges.config` jsonb column and the new edge_versions
--     table can coexist temporarily. Backfill with:
--       insert into edge_versions (edge_id, version, config)
--       select id, 1, config from edges;
--  3. Old trades had a single `data` jsonb column. Write a one-time
--     script to map data->>'field' into the new typed columns, then
--     verify row counts match before dropping the old column.
--  4. Do this migration BEFORE onboarding paying customers — it is
--     far cheaper now than against live data later.
-- ============================================================
