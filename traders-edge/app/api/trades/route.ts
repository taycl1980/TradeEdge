import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getTrades, applyAutoLocks, appendAudit } from '@/lib/tradesRepo';
import { getActiveEdge } from '@/lib/edgeRepo';
import { computeTrade, detectSession, type Direction } from '@/lib/domain/trades';

export const runtime = 'nodejs';

// GET /api/trades — list every trade for the logged-in user. Auto-applies
// the 7-day lock as a side effect so the list always reflects current
// integrity state. Includes hidden + superseded so client filters work.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Apply auto-locks before returning. Cheap, idempotent.
  await applyAutoLocks(supabase, user.id);

  const trades = await getTrades(supabase, user.id);

  // Pull instrument/session/pattern lookups so the client can render
  // human-readable names without N+1 queries.
  const [{ data: instruments }, { data: sessions }, { data: patterns }] = await Promise.all([
    supabase.from('instruments').select('id, symbol, display_name'),
    supabase.from('sessions').select('id, name'),
    supabase.from('patterns').select('id, name'),
  ]);

  // User prefs for sticky form defaults.
  const { data: profile } = await supabase
    .from('profiles')
    .select('trade_prefs, plan')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    trades,
    instruments: instruments ?? [],
    sessions: sessions ?? [],
    patterns: patterns ?? [],
    prefs: profile?.trade_prefs ?? {},
    plan: profile?.plan ?? 'free',
  });
}

// POST /api/trades — create a trade in either 'open' or 'closed' status.
// The client sends the seven essential fields plus optional advanced ones;
// the server computes pip distance / risk amount / P&L and persists.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  // Required fields validation. Keep this tight — the client validates too,
  // but the server is the source of truth.
  const mode: 'open' | 'closed' = body.mode === 'open' ? 'open' : 'closed';
  const symbol: string = String(body.symbol || '').trim().toUpperCase();
  const direction: Direction = body.direction === 'Sell' ? 'Sell' : 'Buy';
  const entry = Number(body.entry);
  const stop = Number(body.stop);
  if (!symbol || !entry || !stop) {
    return NextResponse.json({ error: 'instrument, entry, and stop are required' }, { status: 400 });
  }
  const exit = mode === 'closed' ? Number(body.exit) : null;
  if (mode === 'closed' && (!exit || isNaN(exit))) {
    return NextResponse.json({ error: 'exit price required for closed trade' }, { status: 400 });
  }

  // Resolve instrument_id from symbol.
  const { data: instrument } = await supabase
    .from('instruments')
    .select('id')
    .eq('symbol', symbol)
    .single();
  if (!instrument) {
    return NextResponse.json({ error: 'Unknown instrument' }, { status: 400 });
  }

  // Load active edge so we can stamp edge_version_id (the snapshot pattern).
  const activeEdge = await getActiveEdge(supabase, user.id);

  // Compute pricing using the same domain function the UI uses, so the
  // displayed numbers and stored numbers always agree.
  const calc = computeTrade({
    symbol, direction,
    entry, stop,
    takeProfit: body.takeProfit ? Number(body.takeProfit) : null,
    exit,
    balance: Number(body.balance) || 0,
    size: body.size ? Number(body.size) : null,
    riskPct: body.riskPct ? Number(body.riskPct) : null,
  });

  // Resolve session by detected name.
  const sessionName = body.session || detectSession();
  const { data: sessionRow } = await supabase
    .from('sessions').select('id').eq('name', sessionName).maybeSingle();

  // Resolve pattern by name (optional).
  let patternId: number | null = null;
  if (body.pattern) {
    const { data: patternRow } = await supabase
      .from('patterns').select('id').eq('name', body.pattern).maybeSingle();
    patternId = patternRow?.id ?? null;
  }

  const now = new Date().toISOString();
  const tradeDate: string = body.date || now.slice(0, 10);

  const insertRow = {
    user_id: user.id,
    edge_version_id: activeEdge?.versionId ?? null,
    trade_date: tradeDate,
    instrument_id: instrument.id,
    direction,
    session_id: sessionRow?.id ?? null,
    pattern_id: patternId,
    confluence_score: body.confluenceScore != null ? Number(body.confluenceScore) : null,
    entry_price: entry,
    stop_loss: stop,
    take_profit: body.takeProfit ? Number(body.takeProfit) : null,
    exit_price: exit,
    position_size: calc.size || null,
    risk_amount_usd: calc.riskAmount || null,
    result: calc.result,
    pnl_pips: calc.pnlPips,
    pnl_usd: calc.pnlUsd,
    rr_achieved: calc.rr || null,
    rule_compliant: body.compliant !== false,
    emotion: body.emotion || null,
    notes_right: body.notesRight || null,
    notes_wrong: body.notesWrong || null,
    status: mode,
    closed_at: mode === 'closed' ? now : null,
    locked_at: null,
    correction_of_id: null,
    superseded_by_id: null,
    hidden: false,
    hidden_reason: null,
    audit_log: appendAudit([], { action: mode === 'open' ? 'opened' : 'created', note: `${mode} trade` }),
  };

  const { data: inserted, error } = await supabase
    .from('trades')
    .insert(insertRow)
    .select('id')
    .single();
  if (error || !inserted) {
    return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 });
  }

  // Update sticky prefs in the profile (last instrument / risk %).
  const newPrefs = {
    lastInstrument: symbol,
    lastRiskPct: body.riskPct ? Number(body.riskPct) : null,
    lastBalance: body.balance ? Number(body.balance) : null,
  };
  await supabase
    .from('profiles')
    .update({ trade_prefs: newPrefs })
    .eq('id', user.id);

  return NextResponse.json({ ok: true, id: inserted.id });
}
