import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { appendAudit } from '@/lib/tradesRepo';
import { computeTrade, type Direction } from '@/lib/domain/trades';

export const runtime = 'nodejs';

// POST /api/trades/[id]/correct — Correction-by-supersede.
// Creates a NEW trade row with corrected execution values, marks the
// ORIGINAL as 'superseded' so it stays visible in history but excludes
// from stats. This is the only way to change Tier 1 fields on a
// closed/locked trade. A reason is required.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reason = body.reason?.trim();
  if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 });

  // Load original with instrument symbol for pip math.
  const { data: original } = await supabase
    .from('trades')
    .select('*, instruments(symbol)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (original.status === 'superseded') {
    return NextResponse.json({ error: 'already superseded' }, { status: 400 });
  }

  const symbol = (original as any).instruments?.symbol;
  const newEntry = body.entry != null ? Number(body.entry) : original.entry_price;
  const newStop = body.stop != null ? Number(body.stop) : original.stop_loss;
  const newTP = body.takeProfit != null ? Number(body.takeProfit) : original.take_profit;
  const newExit = body.exit != null ? Number(body.exit) : original.exit_price;

  const calc = computeTrade({
    symbol,
    direction: (body.direction || original.direction) as Direction,
    entry: newEntry, stop: newStop, takeProfit: newTP, exit: newExit,
    balance: 0,
    size: original.position_size,
    riskPct: null,
  });

  const now = new Date().toISOString();

  // Build the corrected row by cloning the original and overlaying changes.
  const correctedRow = {
    user_id: user.id,
    edge_version_id: original.edge_version_id,
    trade_date: original.trade_date,
    instrument_id: original.instrument_id,
    direction: body.direction || original.direction,
    session_id: original.session_id,
    pattern_id: original.pattern_id,
    confluence_score: original.confluence_score,
    entry_price: newEntry,
    stop_loss: newStop,
    take_profit: newTP,
    exit_price: newExit,
    position_size: calc.size || original.position_size,
    risk_amount_usd: calc.riskAmount || original.risk_amount_usd,
    result: calc.result ?? original.result,
    pnl_pips: calc.pnlPips ?? original.pnl_pips,
    pnl_usd: calc.pnlUsd ?? original.pnl_usd,
    rr_achieved: calc.rr || original.rr_achieved,
    rule_compliant: original.rule_compliant,
    emotion: original.emotion,
    notes_right: original.notes_right,
    notes_wrong: original.notes_wrong,
    status: original.status === 'open' ? 'open' : 'closed',
    closed_at: original.status === 'open' ? null : now,
    correction_of_id: original.id,
    audit_log: appendAudit([], { action: 'created as correction', reason, note: `supersedes ${original.id}` }),
  };

  const { data: created, error: insErr } = await supabase
    .from('trades')
    .insert(correctedRow)
    .select('id')
    .single();
  if (insErr || !created) return NextResponse.json({ error: insErr?.message || 'insert failed' }, { status: 500 });

  // Mark the original as superseded and link it to the correction.
  await supabase
    .from('trades')
    .update({
      status: 'superseded',
      superseded_by_id: created.id,
      audit_log: appendAudit(original.audit_log ?? [], {
        action: 'superseded',
        reason,
        note: `replaced by ${created.id}`,
      }),
    })
    .eq('id', original.id)
    .eq('user_id', user.id);

  return NextResponse.json({ ok: true, newId: created.id });
}
