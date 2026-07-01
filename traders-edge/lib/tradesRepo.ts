import { SupabaseClient } from '@supabase/supabase-js';
import { LOCK_WINDOW_MS } from '@/lib/domain/trades';

export type TradeRow = {
  id: string;
  user_id: string;
  edge_version_id: string | null;
  trade_date: string;
  instrument_id: number | null;
  direction: 'Buy' | 'Sell' | null;
  session_id: number | null;
  pattern_id: number | null;
  confluence_score: number | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price: number | null;
  position_size: number | null;
  risk_amount_usd: number | null;
  result: 'Win' | 'Loss' | 'Breakeven' | null;
  pnl_pips: number | null;
  pnl_usd: number | null;
  rr_achieved: number | null;
  rule_compliant: boolean;
  emotion: string | null;
  notes_right: string | null;
  notes_wrong: string | null;
  status: 'open' | 'closed' | 'locked' | 'superseded';
  closed_at: string | null;
  locked_at: string | null;
  correction_of_id: string | null;
  superseded_by_id: string | null;
  hidden: boolean;
  hidden_reason: string | null;
  audit_log: Array<{ at: string; action: string; reason?: string; note?: string }>;
  created_at: string;
  source_analysis_id: string | null;
};

// Fetch all of a user's trades, newest first. Caller filters for stats.
// Returns everything including hidden/superseded so the log can render
// the "All" and "Hidden" filter tabs from the same data.
export async function getTrades(
  supabase: SupabaseClient,
  userId: string
): Promise<TradeRow[]> {
  const { data } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return (data as TradeRow[]) ?? [];
}

// Apply the 7-day auto-lock as a side effect of fetching. Cheaper than
// a separate cron, runs only when the user is actually looking. The
// update is idempotent — closed trades older than the window flip to
// locked, others unchanged.
export async function applyAutoLocks(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const cutoff = new Date(Date.now() - LOCK_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from('trades')
    .update({ status: 'locked', locked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'closed')
    .lt('closed_at', cutoff)
    .select('id');
  if (error) return 0;
  return data?.length ?? 0;
}

// Append an entry to a trade's audit log. Returns the updated log.
export function appendAudit(
  current: TradeRow['audit_log'],
  entry: { action: string; reason?: string; note?: string }
): TradeRow['audit_log'] {
  return [...(current ?? []), { at: new Date().toISOString(), ...entry }];
}
