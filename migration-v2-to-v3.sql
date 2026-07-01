-- ============================================================
--  Migration v2 → v3: Trade integrity model
--  Adds the columns needed to implement the audit-friendly trade
--  log from the prototype. Safe to re-run.
-- ============================================================

-- 1) Trade lifecycle status. 'closed' is the legacy state, so the
--    default keeps existing rows valid until they're examined.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='trades' and column_name='status'
  ) then
    alter table public.trades
      add column status text not null default 'closed'
      check (status in ('open','closed','locked','superseded'));
  end if;
end$$;

-- 2) Lifecycle timestamps. closed_at/locked_at are nullable because
--    a row may be open or never locked.
alter table public.trades
  add column if not exists closed_at timestamptz,
  add column if not exists locked_at timestamptz;

-- 3) Correction chain — self-references on trades.id.
--    correction_of: the original this row replaces
--    superseded_by: the correction that replaced this row
alter table public.trades
  add column if not exists correction_of_id uuid references public.trades(id),
  add column if not exists superseded_by_id uuid references public.trades(id);

-- 4) Soft delete. hidden=true excludes from stats but keeps the row
--    visible in audit history. We never hard-delete trades.
alter table public.trades
  add column if not exists hidden boolean not null default false,
  add column if not exists hidden_reason text;

-- 5) Audit log: append-only JSON array of edit events.
--    Each entry: { at: timestamptz, action: text, reason?: text, note?: text }
alter table public.trades
  add column if not exists audit_log jsonb not null default '[]'::jsonb;

-- 6) Sticky user preferences — used by the quick logger to remember
--    last instrument / risk % / balance. Lives on profiles as a single
--    JSONB column so we don't need a new table for it.
alter table public.profiles
  add column if not exists trade_prefs jsonb not null default '{}'::jsonb;

-- 7) Indexes for the new query patterns.
create index if not exists idx_trades_status on public.trades (user_id, status)
  where hidden = false;
create index if not exists idx_trades_open on public.trades (user_id, status)
  where status = 'open';
create index if not exists idx_trades_active_for_stats on public.trades
  (user_id, created_at desc)
  where hidden = false and status <> 'superseded' and status <> 'open';

-- 8) Sanity check — confirm the new columns landed.
select column_name from information_schema.columns
where table_schema='public' and table_name='trades'
  and column_name in ('status','closed_at','locked_at','correction_of_id',
                     'superseded_by_id','hidden','hidden_reason','audit_log')
order by column_name;
