'use client';

import { useEffect, useState, useMemo } from 'react';
import { computeTrade, detectSession, computeCurrentStreak, computeBestStreak, computeStreakHistory, type Direction } from '@/lib/domain/trades';

type Trade = {
  id: string;
  trade_date: string;
  instrument_id: number | null;
  direction: Direction | null;
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
};

type Lookup = { id: number; name?: string; symbol?: string };

export default function TrackTab({ edge, plan }: { edge: any; plan: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [instruments, setInstruments] = useState<Lookup[]>([]);
  const [sessions, setSessions] = useState<Lookup[]>([]);
  const [patterns, setPatterns] = useState<Lookup[]>([]);
  const [prefs, setPrefs] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Quick log form state
  const [mode, setMode] = useState<'closed' | 'open'>('closed');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<Direction>('Buy');
  const [confluence, setConfluence] = useState(3);
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [exit, setExit] = useState('');
  const [size, setSize] = useState('');
  const [riskPct, setRiskPct] = useState('');
  const [balance, setBalance] = useState('');
  const [riskMode, setRiskMode] = useState<'size' | 'pct'>('size');
  const [compliant, setCompliant] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pattern, setPattern] = useState('');
  const [emotion, setEmotion] = useState('');
  const [mae, setMae] = useState('');
  const [notesRight, setNotesRight] = useState('');
  const [notesWrong, setNotesWrong] = useState('');
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Log filters and modals
  const [filter, setFilter] = useState<'active' | 'hidden' | 'all'>('active');
  const [modal, setModal] = useState<null | { kind: string; trade: Trade }>(null);

  const maxScore = edge?.cf?.reduce((a: number, c: any) => a + (+c.pts || 0), 0) || 5;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/trades');
      if (!res.ok) throw new Error('load failed');
      const json = await res.json();
      setTrades(json.trades || []);
      setInstruments(json.instruments || []);
      setSessions(json.sessions || []);
      setPatterns(json.patterns || []);
      setPrefs(json.prefs || {});
      // Hydrate sticky form defaults from prefs
      if (json.prefs?.lastInstrument && !symbol) setSymbol(json.prefs.lastInstrument);
      if (json.prefs?.lastRiskPct && !riskPct) setRiskPct(String(json.prefs.lastRiskPct));
      if (json.prefs?.lastBalance && !balance) setBalance(String(json.prefs.lastBalance));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Live calc — recomputed on any input change for the calc panel.
  const calc = useMemo(() => {
    if (!symbol || !entry || !stop) return null;
    return computeTrade({
      symbol, direction,
      entry: +entry, stop: +stop,
      takeProfit: takeProfit ? +takeProfit : null,
      exit: mode === 'closed' && exit ? +exit : null,
      balance: balance ? +balance : 0,
      size: size ? +size : null,
      riskPct: riskMode === 'pct' && riskPct ? +riskPct : null,
    });
  }, [symbol, direction, entry, stop, takeProfit, exit, size, riskPct, riskMode, mode, balance]);

  function resetForm() {
    setEntry(''); setStop(''); setTakeProfit(''); setExit('');
    setSize(''); setMae(''); setNotesRight(''); setNotesWrong(''); setDate('');
  }

  async function submit() {
    if (!symbol) return showToast('Pick an instrument');
    if (!entry || !stop) return showToast('Entry and stop required');
    if (mode === 'closed' && !exit) return showToast('Exit price required for closed trade');
    if (riskMode === 'pct' && riskPct && !balance) return showToast('Enter account balance to use risk %');
    if (riskMode === 'size' && !size) return showToast('Position size required');
    if (riskMode === 'pct' && !riskPct) return showToast('Risk % required');

    setSubmitting(true);
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode, symbol, direction,
          entry: +entry, stop: +stop,
          takeProfit: takeProfit ? +takeProfit : undefined,
          exit: mode === 'closed' ? +exit : undefined,
          size: size ? +size : undefined,
          riskPct: riskMode === 'pct' && riskPct ? +riskPct : undefined,
          balance: balance ? +balance : undefined,
          confluenceScore: confluence,
          compliant,
          pattern: pattern || undefined,
          emotion: emotion || undefined,
          notesRight: notesRight || undefined,
          notesWrong: notesWrong || undefined,
          date: date || undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'log failed');
      }
      showToast(mode === 'open' ? 'Live trade opened' : 'Trade logged');
      resetForm();
      await load();
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Streak: three separate metrics computed from real trading date order
  // (not insert order — see lib/domain/trades.ts for why that matters).
  const streak = useMemo(() => computeCurrentStreak(trades), [trades]);
  const bestStreak = useMemo(() => computeBestStreak(trades), [trades]);
  const streakHistory = useMemo(() => computeStreakHistory(trades), [trades]);
  const [showStreakHistory, setShowStreakHistory] = useState(false);

  const goal = edge?.goal || 30;
  const openTrades = trades.filter((t) => t.status === 'open' && !t.hidden);

  // Filtered list for the log
  const displayed = useMemo(() => {
    if (filter === 'hidden') return trades.filter((t) => t.hidden);
    if (filter === 'all') return trades;
    return trades.filter((t) => !t.hidden && t.status !== 'superseded');
  }, [trades, filter]);

  const hiddenCount = trades.filter((t) => t.hidden).length;

  return (
    <div>
      <h1 style={S.h1}>Track</h1>
      <p style={S.sub}>Log fast, lock honestly. Quick log is built for sub-30-second entry — everything else is computed.</p>

      {/* Streak card */}
      <div style={S.streakCard}>
        <div style={S.streakNum}>{streak}</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={S.streakHeadRow}>
            <div style={S.streakLabel}>Compliant streak</div>
            {bestStreak > 0 && <span style={S.bestPill}>Best: {bestStreak}</span>}
          </div>
          <div style={S.barTrack}><div style={{ ...S.barFill, width: `${Math.min((streak / goal) * 100, 100)}%` }} /></div>
          <div style={S.streakSub}>
            {streak >= goal ? 'Goal reached — keep going, no ceiling on this.' : `${streak} compliant in a row — ${goal - streak} to go (goal: ${goal})`}
          </div>
        </div>
        {streakHistory.length > 0 && (
          <button style={S.historyToggle} onClick={() => setShowStreakHistory(!showStreakHistory)}>
            {showStreakHistory ? '▲ Hide' : '▾ History'}
          </button>
        )}
      </div>

      {showStreakHistory && (
        <div style={S.historyCard}>
          <div style={S.historyH}>Streak history · most recent first</div>
          {streakHistory.map((run, i) => (
            <div key={i} style={S.historyRow}>
              <span style={{ ...S.historyLen, color: run.brokenBy ? '#8f8678' : '#0a7c5f' }}>{run.length}</span>
              <div style={{ flex: 1 }}>
                <div style={S.historyDates}>{run.startDate} → {run.endDate}</div>
                <div style={S.historyNote}>
                  {run.brokenBy
                    ? `Broken by a non-compliant trade on ${run.brokenBy.date}`
                    : 'Still active — this is your current streak'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Open trades strip */}
      {openTrades.length > 0 && (
        <div style={S.openStrip}>
          <div style={S.openStripH}><span style={S.liveDot} />Live trades · {openTrades.length}</div>
          {openTrades.map((t) => {
            const sym = instruments.find((i) => i.id === t.instrument_id)?.symbol;
            return (
              <div key={t.id} style={S.openRow}>
                <span style={S.openPair}>{sym}</span>
                <span style={S.openDir}>{t.direction}</span>
                <span style={S.openPrices}>
                  {t.entry_price} → SL {t.stop_loss}{t.take_profit ? ` · TP ${t.take_profit}` : ''}
                </span>
                <button style={S.tcAction} onClick={() => setModal({ kind: 'close', trade: t })}>Close trade</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick log card */}
      <div style={S.card}>
        <div style={S.quickLogHead}>
          <div>
            <div style={S.cardH}>Log a trade</div>
            <div style={S.quickLogSub}>7 fields, ~30 seconds. Everything else is computed.</div>
          </div>
          <div style={S.modeToggle}>
            <button onClick={() => setMode('closed')} style={{ ...S.modeBtn, ...(mode === 'closed' ? S.modeBtnOn : {}) }}>Closed trade</button>
            <button onClick={() => setMode('open')} style={{ ...S.modeBtn, ...(mode === 'open' ? S.modeBtnOn : {}) }}>Open a live trade</button>
          </div>
        </div>

        <div style={S.quickGrid}>
          {/* Instrument */}
          <div>
            <label style={S.lbl}>Instrument</label>
            <select style={S.field} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              <option value="">—</option>
              {(edge?.instr || []).map((s: string) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Direction toggle */}
          <div>
            <label style={S.lbl}>Direction</label>
            <div style={S.dirToggle}>
              <button onClick={() => setDirection('Buy')} style={{ ...S.dirBtn, ...(direction === 'Buy' ? S.dirBtnLong : {}) }}>↗ Buy</button>
              <button onClick={() => setDirection('Sell')} style={{ ...S.dirBtn, ...(direction === 'Sell' ? S.dirBtnShort : {}) }}>↘ Sell</button>
            </div>
          </div>

          {/* Confluence stepper */}
          <div>
            <label style={S.lbl}>Confluence</label>
            <div style={S.confStepper}>
              <button style={S.stepBtn} onClick={() => setConfluence(Math.max(1, confluence - 1))}>−</button>
              <span style={S.confVal}>{confluence}</span>
              <span style={S.confMax}>/ {maxScore}</span>
              <button style={S.stepBtn} onClick={() => setConfluence(Math.min(maxScore, confluence + 1))}>+</button>
            </div>
          </div>

          {/* Prices */}
          <div>
            <label style={S.lbl}>Entry</label>
            <input style={S.field} type="number" step="0.00001" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="1.08540" />
          </div>
          <div>
            <label style={S.lbl}>Stop loss</label>
            <input style={S.field} type="number" step="0.00001" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="1.08400" />
          </div>
          <div>
            <label style={S.lbl}>Take profit</label>
            <input style={S.field} type="number" step="0.00001" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="1.08820" />
          </div>

          {/* Position size with mode toggle */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={S.lblRow}>
              <span>{riskMode === 'size' ? 'Position size (lots)' : 'Risk %'}</span>
              <button style={S.riskModeBtn} onClick={() => setRiskMode(riskMode === 'size' ? 'pct' : 'size')}>
                switch to {riskMode === 'size' ? 'risk %' : 'position size'}
              </button>
            </label>
            {riskMode === 'size'
              ? <input style={S.field} type="number" step="0.01" value={size} onChange={(e) => setSize(e.target.value)} placeholder="0.10" />
              : <input style={S.field} type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} placeholder="1.0" />
            }
          </div>

          {/* Account balance — only relevant in risk % mode, where position
              size is derived FROM the balance. Sticky across sessions. */}
          {riskMode === 'pct' && (
            <div>
              <label style={S.lbl}>Account balance ($)</label>
              <input
                style={{ ...S.field, ...(riskPct && !balance ? S.fieldWarn : {}) }}
                type="number"
                step="1"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="10000"
              />
              {riskPct && !balance && (
                <div style={S.fieldWarnNote}>Enter your balance — risk % needs it to size the trade.</div>
              )}
            </div>
          )}

          {/* Exit (closed mode only) */}
          {mode === 'closed' && (
            <div>
              <label style={S.lbl}>Exit price</label>
              <input style={S.field} type="number" step="0.00001" value={exit} onChange={(e) => setExit(e.target.value)} placeholder="1.08810" />
            </div>
          )}

          {/* Compliance */}
          <div>
            <label style={S.lbl}>Rule compliant?</label>
            <div style={S.dirToggle}>
              <button onClick={() => setCompliant(true)} style={{ ...S.dirBtn, ...(compliant ? S.dirBtnLong : {}) }}>✓ Yes</button>
              <button onClick={() => setCompliant(false)} style={{ ...S.dirBtn, ...(!compliant ? S.dirBtnShort : {}) }}>✕ No</button>
            </div>
          </div>
        </div>

        {/* Live calc panel */}
        <div style={S.calcPanel}>
          <div style={S.calcH}>Live calculations</div>
          <div style={S.calcGrid}>
            <CalcItem label="Stop distance" value={calc?.stopPips ? `${calc.stopPips.toFixed(1)} pips` : '—'} />
            <CalcItem label="TP distance" value={calc?.tpPips ? `${calc.tpPips.toFixed(1)} pips` : '—'} />
            <CalcItem label="Risk amount" value={calc?.riskAmount ? `$${calc.riskAmount.toFixed(2)}` : '—'} />
            <CalcItem label="Risk % of acct" value={calc?.riskPctActual ? `${calc.riskPctActual.toFixed(2)}%` : '—'}
              tone={calc && calc.riskPctActual > (edge?.risk || 1) + 0.5 ? 'warn' : calc?.riskPctActual ? 'good' : ''} />
            <CalcItem label="Position size" value={calc?.size ? `${calc.size.toFixed(2)} lot` : '—'} />
            <CalcItem label="Risk:Reward" value={calc?.rr ? `1 : ${calc.rr.toFixed(2)}` : '—'}
              tone={calc && calc.rr >= (edge?.rr || 2) ? 'good' : calc?.rr ? 'warn' : ''} />
            <CalcItem label="Session" value={detectSession()} />
            <CalcItem label="Day" value={new Date().toLocaleDateString('en-US', { weekday: 'short' })} />
            {mode === 'closed' && exit && calc?.pnlPips != null && (
              <>
                <CalcItem label="Result" value={calc.result || '—'} tone={calc.result === 'Win' ? 'good' : calc.result === 'Loss' ? 'bad' : ''} />
                <CalcItem label="P&L (pips)" value={`${calc.pnlPips >= 0 ? '+' : ''}${calc.pnlPips.toFixed(1)}`} tone={calc.pnlPips >= 0 ? 'good' : 'bad'} />
                <CalcItem label="R multiple" value={`${(calc.rMultiple ?? 0) >= 0 ? '+' : ''}${(calc.rMultiple ?? 0).toFixed(2)}R`} tone={(calc.rMultiple ?? 0) >= 0 ? 'good' : 'bad'} />
                <CalcItem label="P&L ($)" value={calc.pnlUsd ? `${calc.pnlUsd >= 0 ? '+$' : '-$'}${Math.abs(calc.pnlUsd).toFixed(2)}` : '—'} tone={(calc.pnlUsd ?? 0) >= 0 ? 'good' : 'bad'} />
              </>
            )}
          </div>
        </div>

        {/* Advanced disclosure */}
        <button style={S.advToggle} onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? '▴ Hide advanced fields' : '▾ Show advanced fields (optional)'}
        </button>
        {showAdvanced && (
          <div style={S.advBlock}>
            <div style={S.grid3}>
              <div>
                <label style={S.lbl}>Date <span style={S.lblHint}>(if backfilling)</span></label>
                <input style={S.field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Pattern</label>
                <select style={S.field} value={pattern} onChange={(e) => setPattern(e.target.value)}>
                  <option value="">—</option>
                  {patterns.map((p) => <option key={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Emotion</label>
                <select style={S.field} value={emotion} onChange={(e) => setEmotion(e.target.value)}>
                  <option value="">—</option>
                  {['Calm', 'Confident', 'Anxious', 'FOMO', 'Revenge', 'Bored'].map((e) => <option key={e}>{e}</option>)}
                </select>
              </div>
            </div>
            <div style={{ ...S.grid2, marginTop: 10 }}>
              <div>
                <label style={S.lbl}>What went right</label>
                <textarea style={{ ...S.field, minHeight: 50 }} value={notesRight} onChange={(e) => setNotesRight(e.target.value)} placeholder="Followed the plan…" />
              </div>
              <div>
                <label style={S.lbl}>What to improve</label>
                <textarea style={{ ...S.field, minHeight: 50 }} value={notesWrong} onChange={(e) => setNotesWrong(e.target.value)} placeholder="Took it slightly early…" />
              </div>
            </div>
            {plan !== 'pro' && (
              <div style={S.proBlock}>
                <span style={S.proBadge}>◆ PRO</span>
                <span style={{ fontSize: 12.5, color: '#5d564d' }}>Chart screenshot uploads are a Pro feature.</span>
              </div>
            )}
          </div>
        )}

        <div style={S.logActions}>
          <button style={S.primary} onClick={submit} disabled={submitting}>
            {submitting ? 'Saving…' : mode === 'closed' ? '+ Log closed trade' : '◉ Open live trade'}
          </button>
          <span style={S.speedHint}>Auto-detects: session · account % · R-multiple · pip distance</span>
        </div>
      </div>

      {/* Trade log */}
      <div style={S.card}>
        <div style={S.logHeader}>
          <div style={S.cardH}>Trade log</div>
          <div style={S.logFilters}>
            {(['active', 'hidden', 'all'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ ...S.filterBtn, ...(filter === f ? S.filterBtnOn : {}) }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'hidden' && hiddenCount > 0 && <span style={S.filterCount}>{hiddenCount}</span>}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={S.empty}>Loading…</div>
        ) : displayed.length === 0 ? (
          <div style={S.empty}>No trades match this filter.</div>
        ) : (
          displayed.map((t) => (
            <TradeCard
              key={t.id}
              trade={t}
              instruments={instruments}
              sessions={sessions}
              patterns={patterns}
              onAction={(kind) => setModal({ kind, trade: t })}
              onRestore={async () => {
                await fetch(`/api/trades/${t.id}/hide`, { method: 'DELETE' });
                showToast('Trade restored');
                await load();
              }}
            />
          ))
        )}
      </div>

      {modal && (
        <TradeModal
          modal={modal}
          instruments={instruments}
          patterns={patterns}
          sessions={sessions}
          onClose={() => setModal(null)}
          onDone={async (msg) => { showToast(msg); await load(); setModal(null); }}
        />
      )}

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

// ============================================================
//  Sub-components
// ============================================================

function CalcItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const color = tone === 'good' ? '#0a7c5f' : tone === 'warn' ? '#a26a18' : tone === 'bad' ? '#b04a25' : '#1a1816';
  const opacity = value === '—' ? 0.5 : 1;
  return (
    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: '#8f8678', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color, opacity }}>{value}</div>
    </div>
  );
}

function TradeCard({
  trade, instruments, sessions, patterns, onAction, onRestore,
}: {
  trade: Trade;
  instruments: Lookup[];
  sessions: Lookup[];
  patterns: Lookup[];
  onAction: (kind: string) => void;
  onRestore: () => void;
}) {
  const sym = instruments.find((i) => i.id === trade.instrument_id)?.symbol;
  const sess = sessions.find((s) => s.id === trade.session_id)?.name;
  const pat = patterns.find((p) => p.id === trade.pattern_id)?.name;
  const pnlColor = (trade.pnl_pips ?? 0) >= 0 ? '#0a7c5f' : '#b04a25';
  const statusMap: Record<string, { bg: string; color: string; label: string }> = {
    open: { bg: 'rgba(103,89,198,.12)', color: '#6759c6', label: '◉ LIVE' },
    closed: { bg: 'rgba(10,124,95,.1)', color: '#0a7c5f', label: '✓ CLOSED' },
    locked: { bg: '#ede6d8', color: '#5d564d', label: '⚿ LOCKED' },
    superseded: { bg: 'rgba(176,74,37,.1)', color: '#b04a25', label: '⊘ SUPERSEDED' },
  };
  const st = statusMap[trade.status];

  function cell(label: string, value: any) {
    if (value == null || value === '') return null;
    return (
      <div key={label}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: '#8f8678', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#1a1816', fontWeight: 500, marginTop: 2 }}>{value}</div>
      </div>
    );
  }

  const cells = [
    cell('Date', trade.trade_date),
    cell('Session', sess),
    cell('Pattern', pat),
    cell('Score', trade.confluence_score),
    cell('Size', trade.position_size != null ? `${(+trade.position_size).toFixed(2)} lot` : null),
    cell('Risk', trade.risk_amount_usd ? `$${(+trade.risk_amount_usd).toFixed(0)}` : null),
    cell('Entry', trade.entry_price),
    cell('Stop', trade.stop_loss),
    cell('TP', trade.take_profit),
    cell('Exit', trade.exit_price),
    cell('R:R', trade.rr_achieved != null ? `1:${(+trade.rr_achieved).toFixed(2)}` : null),
    cell('P&L $', trade.pnl_usd ? `${trade.pnl_usd >= 0 ? '+$' : '-$'}${Math.abs(trade.pnl_usd).toFixed(2)}` : null),
    cell('Emotion', trade.emotion),
  ].filter(Boolean);

  const cardStyle: React.CSSProperties = {
    background: '#f4efe6',
    borderRadius: 10,
    padding: '13px 15px',
    marginBottom: 9,
    opacity: trade.hidden ? 0.55 : trade.status === 'superseded' ? 0.6 : 1,
    borderLeft: trade.status === 'superseded' ? '3px solid #b04a25' : trade.status === 'locked' ? '3px solid #8f8678' : 'none',
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: '#8f8678' }}>#{trade.id.slice(0, 6)}</span>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{sym}</span>
        <span style={{ fontSize: 11, color: '#5d564d', fontFamily: "'JetBrains Mono', monospace" }}>{trade.direction}</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 7px', borderRadius: 4, letterSpacing: '.04em', fontFamily: "'JetBrains Mono', monospace", background: st.bg, color: st.color }}>{st.label}</span>
        {trade.hidden && <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 7px', borderRadius: 4, background: 'rgba(162,106,24,.12)', color: '#a26a18', fontFamily: "'JetBrains Mono', monospace" }}>⚑ HIDDEN</span>}
        <span style={{ flex: 1 }} />
        {trade.pnl_pips != null && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14.5, color: pnlColor }}>
            {trade.pnl_pips >= 0 ? '+' : ''}{(+trade.pnl_pips).toFixed(1)} pips
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '9px 12px' }}>
        {cells}
      </div>

      {(trade.notes_right || trade.notes_wrong) && (
        <div style={{ fontSize: 11.5, color: '#5d564d', marginTop: 8, lineHeight: 1.5 }}>
          {trade.notes_right && <div><span style={{ color: '#0a7c5f', fontWeight: 600 }}>+</span> {trade.notes_right}</div>}
          {trade.notes_wrong && <div><span style={{ color: '#b04a25', fontWeight: 600 }}>~</span> {trade.notes_wrong}</div>}
        </div>
      )}

      <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid rgba(60,40,15,.08)', display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', fontSize: 11 }}>
        {trade.result && (
          <span style={{ display: 'inline-flex', fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, fontFamily: "'JetBrains Mono', monospace", background: trade.result === 'Win' ? 'rgba(10,124,95,.1)' : trade.result === 'Loss' ? 'rgba(176,74,37,.1)' : '#ede6d8', color: trade.result === 'Win' ? '#0a7c5f' : trade.result === 'Loss' ? '#b04a25' : '#5d564d' }}>{trade.result}</span>
        )}
        <span style={{ display: 'inline-flex', fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, fontFamily: "'JetBrains Mono', monospace", background: trade.rule_compliant ? 'rgba(10,124,95,.1)' : 'rgba(176,74,37,.1)', color: trade.rule_compliant ? '#0a7c5f' : '#b04a25' }}>
          {trade.rule_compliant ? 'Rule ✓' : 'Rule ✕'}
        </span>
        <span style={{ flex: 1 }} />
        {/* Action buttons depend on state */}
        {trade.hidden && <button style={btnStyle} onClick={onRestore}>↶ Restore</button>}
        {!trade.hidden && trade.status === 'open' && (
          <>
            <button style={btnStyle} onClick={() => onAction('close')}>Close trade</button>
            <button style={btnStyle} onClick={() => onAction('edit')}>Edit</button>
          </>
        )}
        {!trade.hidden && trade.status === 'closed' && (
          <>
            <button style={btnStyle} onClick={() => onAction('edit')}>Edit</button>
            <button style={btnStyle} onClick={() => onAction('correct')}>Report error</button>
            <button style={btnDangerStyle} onClick={() => onAction('hide')}>Not a real trade</button>
          </>
        )}
        {!trade.hidden && trade.status === 'locked' && (
          <>
            <button style={btnStyle} onClick={() => onAction('edit')}>Edit notes</button>
            <button style={btnStyle} onClick={() => onAction('correct')}>Report error</button>
          </>
        )}
        {trade.status === 'superseded' && (
          <span style={{ fontSize: 10, color: '#8f8678', fontFamily: "'JetBrains Mono', monospace" }}>corrected by #{(trade.superseded_by_id || '').slice(0, 6)}</span>
        )}
      </div>

      {trade.audit_log && trade.audit_log.length > 1 && (
        <div style={{ marginTop: 9, padding: '9px 11px', background: '#fffdf9', borderRadius: 6, border: '1px solid rgba(60,40,15,.08)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#5d564d' }}>
          <div style={{ color: '#8f8678', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>History</div>
          {trade.audit_log.slice().reverse().map((a, i) => (
            <div key={i} style={{ padding: '3px 0', lineHeight: 1.5 }}>
              <span style={{ color: '#8f8678' }}>{new Date(a.at).toLocaleString()}</span> · <span style={{ color: '#1a1816' }}>{a.action}{a.note ? ` — ${a.note}` : ''}{a.reason ? ` — ${a.reason}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(60,40,15,.16)', color: '#5d564d',
  fontSize: 10.5, padding: '4px 9px', borderRadius: 5, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
};
const btnDangerStyle: React.CSSProperties = { ...btnStyle, borderColor: 'rgba(176,74,37,.25)', color: '#b04a25' };

function TradeModal({
  modal, instruments, sessions, patterns, onClose, onDone,
}: {
  modal: { kind: string; trade: Trade };
  instruments: Lookup[];
  sessions: Lookup[];
  patterns: Lookup[];
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
}) {
  const { kind, trade } = modal;
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    exit: '',
    entry: trade.entry_price ?? '',
    stop: trade.stop_loss ?? '',
    takeProfit: trade.take_profit ?? '',
    exitPrice: trade.exit_price ?? '',
    direction: trade.direction || 'Buy',
    confluenceScore: trade.confluence_score ?? '',
    compliant: trade.rule_compliant,
    sessionId: trade.session_id ?? '',
    patternId: trade.pattern_id ?? '',
    emotion: trade.emotion ?? '',
    notesRight: trade.notes_right ?? '',
    notesWrong: trade.notes_wrong ?? '',
    reason: '',
    hideReason: 'Duplicate entry',
    hideNote: '',
  });

  async function submit() {
    setBusy(true);
    try {
      if (kind === 'close') {
        if (!form.exit) throw new Error('Exit required');
        const res = await fetch(`/api/trades/${trade.id}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exit: +form.exit }),
        });
        if (!res.ok) throw new Error('close failed');
        await onDone('Trade closed');
      } else if (kind === 'edit') {
        const body: any = {
          confluenceScore: form.confluenceScore ? +form.confluenceScore : undefined,
          compliant: form.compliant,
          sessionId: form.sessionId || undefined,
          patternId: form.patternId || undefined,
          emotion: form.emotion,
          notesRight: form.notesRight,
          notesWrong: form.notesWrong,
          reason: form.reason,
        };
        if (trade.status === 'open') {
          body.entry = +form.entry;
          body.stop = +form.stop;
          body.takeProfit = form.takeProfit ? +form.takeProfit : undefined;
          body.exit = form.exitPrice ? +form.exitPrice : undefined;
          body.direction = form.direction;
        }
        const res = await fetch(`/api/trades/${trade.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error || 'edit failed');
        }
        await onDone('Changes saved');
      } else if (kind === 'correct') {
        if (!form.reason) throw new Error('Reason required');
        const res = await fetch(`/api/trades/${trade.id}/correct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry: +form.entry, stop: +form.stop,
            takeProfit: form.takeProfit ? +form.takeProfit : undefined,
            exit: form.exitPrice ? +form.exitPrice : undefined,
            reason: form.reason,
          }),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error || 'correction failed');
        }
        await onDone('Correction recorded');
      } else if (kind === 'hide') {
        const res = await fetch(`/api/trades/${trade.id}/hide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: form.hideReason, note: form.hideNote }),
        });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error || 'hide failed');
        }
        await onDone('Trade hidden');
      }
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(60,40,15,.35)',
    backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 20,
  };
  const card: React.CSSProperties = {
    background: '#fffdf9', border: '1px solid rgba(60,40,15,.16)', borderRadius: 14,
    padding: '22px 24px', maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto',
    boxShadow: '0 12px 36px rgba(60,40,15,.18)',
  };
  const tier: React.CSSProperties = {
    background: '#f4efe6', border: '1px solid rgba(60,40,15,.08)', borderRadius: 6,
    padding: '10px 12px', marginBottom: 10, fontSize: 12, lineHeight: 1.55,
  };
  const tierH: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8f8678',
    textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5,
  };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, color: '#5d564d', marginBottom: 5 };
  const fld: React.CSSProperties = {
    width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 6,
    border: '1px solid rgba(60,40,15,.16)', background: '#fffdf9', color: '#1a1816',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  function set(k: string, v: any) { setForm({ ...form, [k]: v }); }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 18, fontWeight: 600, marginBottom: 14 }}>
          {kind === 'close' && `Close trade #${trade.id.slice(0, 6)}`}
          {kind === 'edit' && `Edit trade #${trade.id.slice(0, 6)}`}
          {kind === 'correct' && `Report data error on #${trade.id.slice(0, 6)}`}
          {kind === 'hide' && `Mark #${trade.id.slice(0, 6)} as not a real trade`}
        </div>

        {kind === 'close' && (
          <>
            <label style={lbl}>Exit price</label>
            <input style={fld} type="number" step="0.00001" value={form.exit} onChange={(e) => set('exit', e.target.value)} />
            <p style={{ fontSize: 11.5, color: '#5d564d', marginTop: 12, lineHeight: 1.55 }}>
              Closing this trade computes the final P&amp;L from your stored entry / stop / exit. Once closed, the price fields lock — by design.
            </p>
          </>
        )}

        {kind === 'edit' && (
          <>
            {trade.status === 'open' ? (
              <div style={tier}>
                <div style={tierH}>Tier 1 — execution (immutable once closed)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={lbl}>Entry</label><input style={fld} type="number" step="0.00001" value={form.entry} onChange={(e) => set('entry', e.target.value)} /></div>
                  <div><label style={lbl}>Stop</label><input style={fld} type="number" step="0.00001" value={form.stop} onChange={(e) => set('stop', e.target.value)} /></div>
                  <div><label style={lbl}>Take profit</label><input style={fld} type="number" step="0.00001" value={form.takeProfit} onChange={(e) => set('takeProfit', e.target.value)} /></div>
                  <div><label style={lbl}>Direction</label><select style={fld} value={form.direction} onChange={(e) => set('direction', e.target.value)}><option>Buy</option><option>Sell</option></select></div>
                </div>
              </div>
            ) : (
              <div style={tier}>
                <div style={tierH}>Tier 1 — locked ⚿</div>
                Entry, stop, exit, direction are locked. Use <b>Report error</b> if the original data was wrong.
              </div>
            )}

            {trade.status !== 'locked' && (
              <div style={tier}>
                <div style={tierH}>Tier 2 — classification (audited)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={lbl}>Confluence</label><input style={fld} type="number" value={form.confluenceScore} onChange={(e) => set('confluenceScore', e.target.value)} /></div>
                  <div><label style={lbl}>Rule compliant?</label><select style={fld} value={form.compliant ? 'yes' : 'no'} onChange={(e) => set('compliant', e.target.value === 'yes')}><option value="yes">Yes</option><option value="no">No</option></select></div>
                  <div><label style={lbl}>Pattern</label><select style={fld} value={form.patternId} onChange={(e) => set('patternId', +e.target.value)}><option value="">—</option>{patterns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                  <div><label style={lbl}>Session</label><select style={fld} value={form.sessionId} onChange={(e) => set('sessionId', +e.target.value)}><option value="">—</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                </div>
              </div>
            )}

            <div style={tier}>
              <div style={tierH}>Tier 3 — reflection (always editable)</div>
              <div><label style={lbl}>Emotion</label><input style={fld} value={form.emotion} onChange={(e) => set('emotion', e.target.value)} /></div>
              <div style={{ marginTop: 8 }}><label style={lbl}>What went right</label><textarea style={{ ...fld, minHeight: 50 }} value={form.notesRight} onChange={(e) => set('notesRight', e.target.value)} /></div>
              <div style={{ marginTop: 8 }}><label style={lbl}>What to improve</label><textarea style={{ ...fld, minHeight: 50 }} value={form.notesWrong} onChange={(e) => set('notesWrong', e.target.value)} /></div>
            </div>

            {trade.status === 'closed' && (
              <div style={{ marginTop: 14 }}>
                <label style={lbl}>Reason for edit (required for Tier 2 changes)</label>
                <input style={fld} value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. misremembered the pattern when logging" />
              </div>
            )}
          </>
        )}

        {kind === 'correct' && (
          <>
            <p style={{ fontSize: 12, color: '#5d564d', lineHeight: 1.55, marginBottom: 14 }}>
              Reporting a data error creates a <b>corrected copy</b> and marks the original as superseded.
              Both records stay visible — this preserves the audit trail.
            </p>
            <div style={tier}>
              <div style={tierH}>Corrected values</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Entry</label><input style={fld} type="number" step="0.00001" value={form.entry} onChange={(e) => set('entry', e.target.value)} /></div>
                <div><label style={lbl}>Stop</label><input style={fld} type="number" step="0.00001" value={form.stop} onChange={(e) => set('stop', e.target.value)} /></div>
                <div><label style={lbl}>Take profit</label><input style={fld} type="number" step="0.00001" value={form.takeProfit} onChange={(e) => set('takeProfit', e.target.value)} /></div>
                <div><label style={lbl}>Exit</label><input style={fld} type="number" step="0.00001" value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} /></div>
              </div>
            </div>
            <label style={lbl}>Why was the original wrong? (required)</label>
            <input style={fld} value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. wrong decimal place on entry" />
          </>
        )}

        {kind === 'hide' && (
          <>
            <p style={{ fontSize: 12, color: '#5d564d', lineHeight: 1.55, marginBottom: 14 }}>
              Hidden trades stay in your full history but are excluded from stats. They are <b>not deleted</b> — the integrity of your discipline ledger depends on it.
            </p>
            <label style={lbl}>Why? (required)</label>
            <select style={fld} value={form.hideReason} onChange={(e) => set('hideReason', e.target.value)}>
              <option>Duplicate entry</option>
              <option>Test entry</option>
              <option>Wrong account / not a real trade</option>
              <option>Other</option>
            </select>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Note (optional)</label>
              <input style={fld} value={form.hideNote} onChange={(e) => set('hideNote', e.target.value)} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={{ background: 'transparent', color: '#1a1816', border: '1px solid rgba(60,40,15,.16)', borderRadius: 7, padding: '10px 18px', fontSize: 13.5, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ background: '#0a7c5f', color: '#fffdf9', border: 'none', borderRadius: 7, padding: '10px 22px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            {busy ? 'Saving…' : kind === 'close' ? 'Close trade' : kind === 'correct' ? 'Create corrected copy' : kind === 'hide' ? 'Hide' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Styles
// ============================================================

const S: Record<string, React.CSSProperties> = {
  h1: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 30, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.15 },
  sub: { color: '#5d564d', fontSize: 14, marginBottom: 22, lineHeight: 1.6, maxWidth: 560 },

  streakCard: { display: 'flex', alignItems: 'center', gap: 18, background: 'linear-gradient(135deg,#fffdf9,#f4efe6)', border: '1px solid rgba(60,40,15,.16)', borderRadius: 14, padding: '18px 22px', marginBottom: 16, flexWrap: 'wrap', boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  streakNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 34, fontWeight: 600 },
  streakLabel: { fontSize: 12.5, color: '#5d564d', marginBottom: 7 },
  streakSub: { fontSize: 11, color: '#8f8678', marginTop: 6 },
  streakHeadRow: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 },
  bestPill: { fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: '#6759c6', background: 'rgba(103,89,198,.1)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 },
  historyToggle: { background: 'transparent', border: '1px solid rgba(60,40,15,.16)', color: '#5d564d', fontSize: 11, padding: '6px 12px', borderRadius: 6, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer', alignSelf: 'flex-start' },
  historyCard: { background: '#fffdf9', border: '1px solid rgba(60,40,15,.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  historyH: { fontSize: 10.5, fontWeight: 600, color: '#5d564d', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" },
  historyRow: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid rgba(60,40,15,.05)' },
  historyLen: { fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, minWidth: 28, textAlign: 'center' },
  historyDates: { fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: '#1a1816' },
  historyNote: { fontSize: 11.5, color: '#5d564d', marginTop: 2 },
  barTrack: { height: 7, background: '#ede6d8', borderRadius: 20, overflow: 'hidden' },
  barFill: { height: '100%', background: 'linear-gradient(90deg,#0a7c5f,#3aa384)', borderRadius: 20, transition: 'width .4s ease' },

  openStrip: { background: 'linear-gradient(135deg, rgba(103,89,198,.06), rgba(103,89,198,.02))', border: '1px solid rgba(103,89,198,.22)', borderRadius: 14, padding: '14px 18px', marginBottom: 16 },
  openStripH: { display: 'flex', alignItems: 'center', gap: 9, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 600, color: '#6759c6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: '#6759c6' },
  openRow: { display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: '1px solid rgba(103,89,198,.12)', fontSize: 12.5, flexWrap: 'wrap' },
  openPair: { fontWeight: 700, minWidth: 64 },
  openDir: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#5d564d' },
  openPrices: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: '#5d564d', flex: 1, minWidth: 0 },
  tcAction: { background: 'transparent', border: '1px solid rgba(60,40,15,.16)', color: '#5d564d', fontSize: 10.5, padding: '4px 9px', borderRadius: 5, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer' },

  card: { background: '#fffdf9', border: '1px solid rgba(60,40,15,.08)', borderRadius: 14, padding: '20px 22px', marginBottom: 16, boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  cardH: { fontSize: 11.5, fontWeight: 600, color: '#5d564d', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" },

  quickLogHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' },
  quickLogSub: { fontSize: 11.5, color: '#5d564d', fontFamily: "'JetBrains Mono', monospace" },
  modeToggle: { display: 'flex', gap: 4, background: '#f4efe6', padding: 3, borderRadius: 8 },
  modeBtn: { padding: '6px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, border: 'none', background: 'transparent', color: '#5d564d', fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer' },
  modeBtnOn: { background: '#0a7c5f', color: '#fffdf9' },

  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '11px 14px', marginBottom: 14 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },

  lbl: { display: 'block', fontSize: 11.5, color: '#5d564d', marginBottom: 5 },
  lblRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#5d564d', marginBottom: 5 },
  lblHint: { fontSize: 10, color: '#8f8678', fontWeight: 400 },
  field: { width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(60,40,15,.16)', background: '#fffdf9', color: '#1a1816', fontFamily: 'Inter, system-ui, sans-serif' },

  dirToggle: { display: 'flex', gap: 0, background: '#fffdf9', border: '1px solid rgba(60,40,15,.16)', borderRadius: 6, overflow: 'hidden', height: 36 },
  dirBtn: { flex: 1, padding: '0 10px', border: 'none', background: 'transparent', color: '#5d564d', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' },
  dirBtnLong: { background: '#0a7c5f', color: '#fffdf9' },
  dirBtnShort: { background: '#b04a25', color: '#fffdf9' },

  confStepper: { display: 'flex', alignItems: 'center', gap: 0, background: '#fffdf9', border: '1px solid rgba(60,40,15,.16)', borderRadius: 6, height: 36, padding: '0 4px' },
  stepBtn: { width: 30, height: 28, border: 'none', background: 'transparent', color: '#5d564d', fontSize: 18, fontWeight: 600, borderRadius: 4, cursor: 'pointer' },
  confVal: { flex: 1, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color: '#0a7c5f' },
  confMax: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8f8678', paddingRight: 4 },

  riskModeBtn: { background: 'none', border: 'none', color: '#0a7c5f', fontSize: 10.5, padding: 0, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer', textDecoration: 'underline' },
  fieldWarn: { borderColor: 'rgba(162,106,24,.5)', background: 'rgba(162,106,24,.05)' },
  fieldWarnNote: { fontSize: 10.5, color: '#a26a18', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" },

  calcPanel: { background: '#f4efe6', border: '1px solid rgba(60,40,15,.08)', borderRadius: 10, padding: '13px 15px', marginBottom: 14 },
  calcH: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: '#8f8678', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 9 },
  calcGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px 14px' },

  advToggle: { background: 'none', border: 'none', color: '#0a7c5f', fontSize: 12.5, padding: '8px 0', fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer', display: 'block' },
  advBlock: { padding: '14px 0 0', borderTop: '1px solid rgba(60,40,15,.08)', marginTop: 6 },
  proBlock: { display: 'flex', alignItems: 'center', gap: 11, background: 'rgba(10,124,95,.04)', border: '1px dashed rgba(10,124,95,.3)', borderRadius: 10, padding: '14px 16px', marginTop: 14 },
  proBadge: { fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'linear-gradient(135deg, #0a7c5f, #0a5c45)', color: '#fffdf9', letterSpacing: '.05em', fontFamily: "'JetBrains Mono', monospace" },

  logActions: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' },
  primary: { background: '#0a7c5f', color: '#fffdf9', border: 'none', borderRadius: 7, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' },
  speedHint: { fontSize: 10.5, color: '#8f8678', fontFamily: "'JetBrains Mono', monospace", fontStyle: 'italic' },

  logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  logFilters: { display: 'flex', gap: 4, background: '#f4efe6', padding: 3, borderRadius: 6 },
  filterBtn: { padding: '5px 11px', borderRadius: 4, fontSize: 11, fontWeight: 600, border: 'none', background: 'transparent', color: '#5d564d', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' },
  filterBtnOn: { background: 'rgba(10,124,95,.1)', color: '#0a7c5f' },
  filterCount: { background: '#ede6d8', color: '#8f8678', fontSize: 9.5, padding: '1px 5px', borderRadius: 8 },

  empty: { textAlign: 'center' as const, padding: '34px 18px', color: '#5d564d', fontSize: 13 },

  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1816', color: '#fffdf9', padding: '11px 20px', borderRadius: 30, fontSize: 13, fontWeight: 600, zIndex: 80, boxShadow: '0 8px 22px rgba(60,40,15,.18)' },
};
