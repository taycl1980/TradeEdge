import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { appendAudit } from '@/lib/tradesRepo';
import { computeTrade, type Direction } from '@/lib/domain/trades';

export const runtime = 'nodejs';

// POST /api/trades/[id]/close — Closes an open trade by recording the
// exit price. Computes final P&L using the trade's stored entry/stop/
// direction. Open trades have no exit until this fires.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { exit } = await req.json().catch(() => ({}));
  if (!exit) return NextResponse.json({ error: 'exit required' }, { status: 400 });

  // Load the trade plus the instrument symbol (needed for pip math).
  const { data: trade } = await supabase
    .from('trades')
    .select('*, instruments(symbol)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();
  if (!trade) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (trade.status !== 'open') {
    return NextResponse.json({ error: 'Only open trades can be closed here' }, { status: 400 });
  }

  const symbol = (trade as any).instruments?.symbol;
  const calc = computeTrade({
    symbol,
    direction: trade.direction as Direction,
    entry: trade.entry_price,
    stop: trade.stop_loss,
    takeProfit: trade.take_profit,
    exit: Number(exit),
    balance: 0,
    size: trade.position_size,
    riskPct: null,
  });

  const now = new Date().toISOString();
  const auditLog = appendAudit(trade.audit_log ?? [], {
    action: 'closed',
    note: `exit ${exit}, result ${calc.result}, R-multiple ${calc.rMultiple?.toFixed(2)}`,
  });

  const { error } = await supabase
    .from('trades')
    .update({
      exit_price: Number(exit),
      pnl_pips: calc.pnlPips,
      pnl_usd: calc.pnlUsd,
      result: calc.result,
      status: 'closed',
      closed_at: now,
      audit_log: auditLog,
    })
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
