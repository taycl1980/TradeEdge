'use client';

import { useEffect, useMemo, useState } from 'react';

type Trade = {
  id: string;
  pnl_pips: number | null;
  pnl_usd: number | null;
  rr_achieved: number | null;
  result: string | null;
  rule_compliant: boolean;
  confluence_score: number | null;
  status: string;
  hidden: boolean;
};

export default function InsightsTab({ edge }: { edge: any }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trades')
      .then((r) => r.json())
      .then((j) => setTrades(j.trades || []))
      .finally(() => setLoading(false));
  }, []);

  // Only count active, closed trades. Hidden/superseded/open stay out
  // of stats — the entire integrity story. Using `T` (not shadowing
  // the outer `trades`) sidesteps the temporal-dead-zone bug we hit
  // in the prototype iteration.
  const T = useMemo(
    () => trades.filter((t) => !t.hidden && t.status !== 'superseded' && t.status !== 'open'),
    [trades]
  );

  const stats = useMemo(() => {
    const n = T.length;
    const wins = T.filter((t) => t.result === 'Win').length;
    const losses = T.filter((t) => t.result === 'Loss').length;
    const bes = T.filter((t) => t.result === 'Breakeven').length;
    const decisive = wins + losses;
    const wr = decisive ? wins / decisive : 0;
    const pnl = T.reduce((a, t) => a + (+t.pnl_pips! || 0), 0);
    const pnlUsd = T.reduce((a, t) => a + (+t.pnl_usd! || 0), 0);
    const comp = T.filter((t) => t.rule_compliant).length;
    const cr = n ? comp / n : 0;
    const gw = T.filter((t) => (t.pnl_pips ?? 0) > 0).reduce((a, t) => a + (+t.pnl_pips! || 0), 0);
    const gl = Math.abs(T.filter((t) => (t.pnl_pips ?? 0) < 0).reduce((a, t) => a + (+t.pnl_pips! || 0), 0));
    const pf = gl > 0 ? gw / gl : (wins > 0 ? Infinity : 0);
    const avgWin = wins ? gw / wins : 0;
    const avgLoss = losses ? gl / losses : 0;

    // Expectancy in R-multiples using stored R:R when present.
    const tradesWithR = T.filter((t) => t.rr_achieved != null && t.result !== 'Breakeven');
    let expectancyR: number | null = null;
    if (tradesWithR.length >= 3) {
      const winRows = tradesWithR.filter((t) => t.result === 'Win');
      const winR = winRows.length
        ? winRows.reduce((a, t) => a + (+t.rr_achieved! || 0), 0) / winRows.length
        : 0;
      expectancyR = wr * winR - (1 - wr) * 1;
    } else if (avgLoss > 0) {
      const winR = avgWin / avgLoss;
      expectancyR = wr * winR - (1 - wr) * 1;
    }

    return { n, wins, losses, bes, wr, pnl, pnlUsd, comp, cr, pf, avgWin, avgLoss, expectancyR };
  }, [T]);

  const grade = useMemo(() => gradeEdge({ ...stats, goal: edge?.goal || 30 }), [stats, edge?.goal]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#5d564d' }}>Loading…</div>;

  return (
    <div>
      <h1 style={S.h1}>Insights</h1>
      <p style={S.sub}>An honest read of your edge — judged by the data, not by encouragement. After 30 logged trades, the full validation engine activates and the verdict gets sharper.</p>

      <SampleBanner n={stats.n} />
      <VerdictHero grade={grade} stats={stats} />

      <div style={S.statsGrid}>
        <Metric label="Trades" value={stats.n} sub={`${stats.comp} compliant`} />
        <Metric label="Win rate" value={stats.n ? `${Math.round(stats.wr * 100)}%` : '—'} sub={`${stats.wins}W / ${stats.losses}L / ${stats.bes}BE`} />
        <Metric label="Profit factor" value={stats.n ? (stats.pf === Infinity ? '∞' : stats.pf.toFixed(2)) : '—'} sub="target ≥ 1.5" />
        <Metric label="Compliance" value={stats.n ? `${Math.round(stats.cr * 100)}%` : '—'} sub="target 100%" />
        <Metric label="Total P&L" value={stats.n ? `${stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(0)} p` : '—'} sub={stats.pnlUsd ? `${stats.pnlUsd >= 0 ? '+$' : '-$'}${Math.abs(stats.pnlUsd).toFixed(0)}` : ''} />
        <Metric label="Avg R:R" value={stats.avgLoss ? `${(stats.avgWin / stats.avgLoss).toFixed(2)}R` : '—'} sub={`goal ≥ ${edge?.rr || 2}R`} />
      </div>

      <Expectancy stats={stats} />
      <ByScore trades={T} edge={edge} />
      <PnlCurve trades={T} />
      <Critique grade={grade} stats={stats} />
      <Projection stats={stats} />
      <Readiness stats={stats} edge={edge} />
    </div>
  );
}

// ============================================================
//  Sub-components
// ============================================================

function SampleBanner({ n }: { n: number }) {
  let text: React.ReactNode;
  let bg = '#f4efe6', border = 'rgba(60,40,15,.16)', color = '#5d564d', icon = '◌';
  if (n === 0) {
    text = <>No trades logged yet. The edge-validation engine needs <b>at least 30 trades</b> to give you a meaningful verdict. Start logging in <b>Track</b>.</>;
  } else if (n < 10) {
    bg = 'rgba(162,106,24,.09)'; border = 'rgba(162,106,24,.22)'; color = '#a26a18'; icon = '⚑';
    text = <><b>Sample too thin to trust — {n} trade{n === 1 ? '' : 's'}.</b> Any verdict at this stage is noise. The honest answer to &quot;does my edge work?&quot; is &quot;we don&apos;t know yet.&quot;</>;
  } else if (n < 30) {
    bg = 'rgba(162,106,24,.09)'; border = 'rgba(162,106,24,.22)'; color = '#a26a18'; icon = '⚑';
    text = <><b>{n}/30 trades — preliminary read only.</b> The numbers are starting to mean something but are still inside the noise band. Treat any reading as ±20% until 30.</>;
  } else if (n < 50) {
    bg = 'rgba(10,124,95,.08)'; border = 'rgba(10,124,95,.22)'; color = '#0a7c5f'; icon = '✓';
    text = <><b>{n} trades — verdict has weight.</b> Sample is large enough to make real calls about your edge. Past 50, it becomes statistically robust.</>;
  } else {
    bg = 'rgba(10,124,95,.08)'; border = 'rgba(10,124,95,.22)'; color = '#0a7c5f'; icon = '✓';
    text = <><b>{n} trades — statistically robust.</b> The verdict below reflects your real edge, not a small-sample illusion.</>;
  }
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 14px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.55, marginBottom: 14, background: bg, border: `1px solid ${border}`, color }}>
      <span>{icon}</span><span>{text}</span>
    </div>
  );
}

function VerdictHero({ grade, stats }: { grade: Grade; stats: any }) {
  return (
    <div style={S.verdictHero}>
      <div style={{ ...S.gradeBadge, color: grade.color, borderColor: grade.color }}>
        {grade.letter}
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={S.verdictHeadline}>{grade.headline}</div>
        <div style={S.verdictSub}>{grade.sub}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {grade.tags.map(([t, kind], i) => (
            <span key={i} style={{
              fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", padding: '3px 8px', borderRadius: 12,
              background: kind === 'good' ? 'rgba(10,124,95,.1)' : kind === 'bad' ? 'rgba(176,74,37,.1)' : '#ede6d8',
              color: kind === 'good' ? '#0a7c5f' : kind === 'bad' ? '#b04a25' : '#5d564d',
            }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: any; sub: string }) {
  return (
    <div style={S.metric}>
      <div style={S.metricL}>{label}</div>
      <div style={S.metricV}>{value}</div>
      <div style={S.metricS}>{sub}</div>
    </div>
  );
}

function Expectancy({ stats }: { stats: any }) {
  if (stats.expectancyR == null) {
    return (
      <div style={S.card}>
        <div style={S.cardH}>Profit expectancy · per trade</div>
        <div style={{ color: '#5d564d', fontSize: 13 }}>Not enough data with R:R values yet. Log a few trades with entry, stop, and exit prices filled in and this will compute automatically.</div>
      </div>
    );
  }
  const e = stats.expectancyR;
  const tone = e > 0.05 ? 'good' : e < -0.05 ? 'bad' : 'flat';
  const color = tone === 'good' ? '#0a7c5f' : tone === 'bad' ? '#b04a25' : '#5d564d';
  const verdict = e >= 0.3 ? "A profitable trader's edge"
    : e >= 0 ? 'Marginally positive — your edge exists but is thin'
    : 'Net losing per trade as currently executed';
  const dollarsPerTrade = e * 100;
  const sign = e >= 0 ? '+' : '';
  return (
    <div style={S.card}>
      <div style={S.cardH}>Profit expectancy · per trade</div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700, color, lineHeight: 1, minWidth: 108 }}>{sign}{e.toFixed(2)}R</div>
        <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: '#5d564d', lineHeight: 1.6 }}>
          <div style={{ color: '#1a1816', fontWeight: 600, marginBottom: 4 }}>{verdict}</div>
          <div>Every trade you take, on average, {e >= 0 ? 'makes' : 'loses'} you <b style={{ fontFamily: "'JetBrains Mono', monospace", color }}>{e >= 0 ? '$' : '-$'}{Math.abs(dollarsPerTrade).toFixed(2)}</b> if you risk $100 per trade. {e > 0 ? 'Over time and reps, this compounds.' : 'Compounded over hundreds of trades, this is a real drawdown.'}</div>
        </div>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: '#8f8678', marginTop: 8, padding: '9px 11px', background: '#f4efe6', borderRadius: 6, border: '1px solid rgba(60,40,15,.08)', lineHeight: 1.65 }}>
        expectancy = (win% × avg win R) − (loss% × 1R)<br />
        {Math.round(stats.wr * 100)}% × {stats.avgLoss ? (stats.avgWin / stats.avgLoss).toFixed(2) : '—'}R − {Math.round((1 - stats.wr) * 100)}% × 1R = {sign}{e.toFixed(2)}R per trade
      </div>
    </div>
  );
}

function ByScore({ trades, edge }: { trades: Trade[]; edge: any }) {
  if (trades.length < 5) {
    return (
      <div style={S.card}>
        <div style={S.cardH}>By confluence score · where is your edge?</div>
        <div style={{ color: '#5d564d', fontSize: 13 }}>Log at least 5 trades and this breaks down where your edge actually lives — by confluence score. Hint: most traders find their 5/5 setups win 2-3x more than their 3/5 setups.</div>
      </div>
    );
  }
  const maxScore = edge?.cf?.reduce((a: number, c: any) => a + (+c.pts || 0), 0) || 5;
  const buckets: Record<number, { trades: number; wins: number; pnl: number }> = {};
  trades.forEach((t) => {
    const s = t.confluence_score || 0;
    if (!buckets[s]) buckets[s] = { trades: 0, wins: 0, pnl: 0 };
    buckets[s].trades++;
    if (t.result === 'Win') buckets[s].wins++;
    buckets[s].pnl += +t.pnl_pips! || 0;
  });
  const scores = Object.keys(buckets).map(Number).sort((a, b) => b - a);

  let takeaway: React.ReactNode = null;
  if (scores.length >= 2) {
    const hi = scores[0], lo = scores[scores.length - 1];
    const hwr = buckets[hi].trades ? buckets[hi].wins / buckets[hi].trades : 0;
    const lwr = buckets[lo].trades ? buckets[lo].wins / buckets[lo].trades : 0;
    const diff = (hwr - lwr) * 100;
    if (diff >= 25 && buckets[lo].trades >= 3) {
      takeaway = <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(10,124,95,.08)', borderRadius: 8, fontSize: 12.5, color: '#0a7c5f', lineHeight: 1.6 }}>
        <b>Clear edge concentration.</b> Your {hi}/{maxScore} setups win {Math.round(hwr * 100)}% while your {lo}/{maxScore} setups win {Math.round(lwr * 100)}%. Raising your minimum to {hi} would have meaningfully changed P&L on these {trades.length} trades.
      </div>;
    }
  }

  return (
    <div style={S.card}>
      <div style={S.cardH}>By confluence score · where is your edge?</div>
      {scores.map((s) => {
        const b = buckets[s];
        const wr = b.trades ? b.wins / b.trades : 0;
        const color = wr >= 0.55 ? '#0a7c5f' : wr >= 0.35 ? '#a26a18' : '#b04a25';
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid rgba(60,40,15,.05)', fontSize: 12.5 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, minWidth: 48, color: '#5d564d' }}>{s}/{maxScore}</span>
            <div style={{ flex: 1, height: 18, background: '#f4efe6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(2, wr * 100)}%`, background: color, borderRadius: 4, transition: 'width .4s ease' }} />
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#1a1816', minWidth: 96, textAlign: 'right' }}>{b.trades}t · {Math.round(wr * 100)}% · {b.pnl >= 0 ? '+' : ''}{b.pnl.toFixed(0)}p</span>
          </div>
        );
      })}
      {takeaway}
    </div>
  );
}

function PnlCurve({ trades }: { trades: Trade[] }) {
  if (!trades.length) {
    return (
      <div style={S.card}>
        <div style={S.cardH}>P&L curve</div>
        <div style={{ textAlign: 'center', padding: 28, color: '#5d564d', fontSize: 13 }}>No trades yet.</div>
      </div>
    );
  }
  let cum = 0;
  const points = trades.slice().reverse().map((t) => { cum += (+t.pnl_pips! || 0); return cum; });
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  return (
    <div style={S.card}>
      <div style={S.cardH}>P&L curve</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130, paddingTop: 10 }}>
        {points.map((p, i) => {
          const h = Math.max(3, ((p - min) / range) * 100);
          const color = p >= 0 ? '#0a7c5f' : '#b04a25';
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', maxWidth: 46, borderRadius: '5px 5px 0 0', background: color, minHeight: 3, height: `${h}%` }} />
              <div style={{ fontSize: 10.5, color: '#8f8678', fontFamily: "'JetBrains Mono', monospace" }}>#{i + 1}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Critique({ grade, stats }: { grade: Grade; stats: any }) {
  if (stats.n < 10) {
    return (
      <div style={S.critiqueCard}>
        <CritiqueHeader />
        <div style={{ ...S.critiqueSummary, color: '#5d564d' }}>
          Hold off on conclusions until you have at least 10 trades. Anything I&apos;d tell you right now is overfitting to noise. Log more reps and come back — the critique engine activates at 10 trades and gets sharp at 30.
        </div>
      </div>
    );
  }
  const summary = buildCritiqueSummary(grade, stats);
  const works = buildWhatWorks(stats);
  const breaks = buildWhatBreaks(stats);
  const improve = buildImprovements(stats);
  return (
    <div style={S.critiqueCard}>
      <CritiqueHeader />
      <div style={S.critiqueSummary} dangerouslySetInnerHTML={{ __html: summary }} />
      <CritiqueSection title="What's working" points={works} tone="good" />
      <CritiqueSection title="What's breaking" points={breaks} tone="bad" />
      <CritiqueSection title="If you change one thing this week" points={improve} tone="warn" />
    </div>
  );
}

function CritiqueHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(103,89,198,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6759c6', fontSize: 14 }}>⌬</div>
      <h3 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 15.5, fontWeight: 600 }}>Profitable-trader read of your edge</h3>
      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(103,89,198,.12)', color: '#6759c6', fontWeight: 600, letterSpacing: '.04em', fontFamily: "'JetBrains Mono', monospace", marginLeft: 'auto' }}>AI REASONING</span>
    </div>
  );
}

function CritiqueSection({ title, points, tone }: { title: string; points: string[]; tone: 'good' | 'bad' | 'warn' }) {
  const color = tone === 'good' ? '#0a7c5f' : tone === 'bad' ? '#b04a25' : '#a26a18';
  const bullet = tone === 'good' ? '+' : tone === 'bad' ? '−' : '→';
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 700, color: '#6759c6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{title}</div>
      {points.length === 0 ? (
        <div style={{ color: '#5d564d', fontSize: 12.5 }}>{tone === 'good' ? 'Nothing clearly working yet at this sample size.' : 'No clear issues identified — keep logging.'}</div>
      ) : (
        points.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', fontSize: 12.5, lineHeight: 1.6 }}>
            <span style={{ color, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, minWidth: 18, paddingTop: 3 }}>{bullet}</span>
            <span dangerouslySetInnerHTML={{ __html: p }} />
          </div>
        ))
      )}
    </div>
  );
}

function Projection({ stats }: { stats: any }) {
  if (stats.n < 10 || stats.expectancyR == null) {
    return (
      <div style={S.card}>
        <div style={S.cardH}>Projection · if this edge holds</div>
        <div style={{ color: '#5d564d', fontSize: 13 }}>Projection unlocks once there&apos;s enough data to ground it. Log more trades with R:R values.</div>
      </div>
    );
  }
  const e = stats.expectancyR;
  const risk = 100;
  const per100 = e * risk * 100;
  const annualRate = 60;
  const annual = e * risk * annualRate;
  const propPass = e > 0.2 ? 'realistic' : e > 0 ? 'tight — possible but with little margin' : 'not while expectancy is negative';
  const propColor = e > 0.2 ? '#0a7c5f' : e > 0 ? '#a26a18' : '#b04a25';
  return (
    <div style={S.card}>
      <div style={S.cardH}>Projection · if this edge holds</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <ProjCol label="Next 100 trades" value={`${per100 >= 0 ? '+$' : '-$'}${Math.abs(per100).toFixed(0)}`} sub="at $100 risk/trade" color={per100 >= 0 ? '#0a7c5f' : '#b04a25'} />
        <ProjCol label="Annual (60 trades)" value={`${annual >= 0 ? '+$' : '-$'}${Math.abs(annual).toFixed(0)}`} sub="if this edge holds" color={annual >= 0 ? '#0a7c5f' : '#b04a25'} />
        <ProjCol label="Prop firm pass" value={propPass} sub="on current edge" color={propColor} small />
      </div>
      <div style={{ fontSize: 11.5, color: '#8f8678', marginTop: 12, lineHeight: 1.55, paddingTop: 11, borderTop: '1px solid rgba(60,40,15,.08)', fontStyle: 'italic' }}>
        Projections, not predictions. They assume your edge holds and you actually risk what you say you risk. Real markets compress edges over time.
      </div>
    </div>
  );
}

function ProjCol({ label, value, sub, color, small }: { label: string; value: string; sub: string; color: string; small?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 140, background: '#f4efe6', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8f8678', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: small ? 14 : 20, fontWeight: 700, color, lineHeight: small ? 1.3 : 1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: '#8f8678', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function Readiness({ stats, edge }: { stats: any; edge: any }) {
  const goal = edge?.goal || 30;
  const items: [string, boolean, string][] = [
    [`${goal} compliant trades`, stats.comp >= goal, `${stats.comp}/${goal}`],
    ['Win rate ≥ 55%', stats.wr >= 0.55, stats.n ? `${Math.round(stats.wr * 100)}%` : '—'],
    ['Profit factor ≥ 1.5', stats.pf >= 1.5, stats.n ? (stats.pf === Infinity ? '∞' : stats.pf.toFixed(2)) : '—'],
    ['100% rule compliance', stats.cr === 1 && stats.n > 0, stats.n ? `${Math.round(stats.cr * 100)}%` : '—'],
  ];
  return (
    <div style={S.card}>
      <div style={S.cardH}>Prop firm readiness</div>
      {items.map(([l, met, v], i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(60,40,15,.05)' : 'none', fontSize: 13 }}>
          <span style={{ color: met ? '#0a7c5f' : '#8f8678' }}>{met ? '✓' : '○'}</span>
          <span style={{ flex: 1 }}>{l}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: met ? '#0a7c5f' : '#5d564d' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  Grading & critique — pure functions ported from prototype
// ============================================================

type Grade = { letter: string; color: string; headline: string; sub: string; tags: [string, 'good' | 'bad' | 'neutral'][] };

function gradeEdge(stats: any): Grade {
  const { n, wr, pf, cr, expectancyR } = stats;
  if (n === 0) return { letter: '—', color: '#8f8678', headline: 'No data yet', sub: 'Log your first trade in Track to start building the picture.', tags: [] };
  if (n < 10) return { letter: '?', color: '#8f8678', headline: 'Not yet rated', sub: `Sample (${n} trades) is too small to grade honestly. The math needs more reps to separate edge from noise.`, tags: [['too thin', 'neutral']] };

  let score = 0;
  const tags: [string, 'good' | 'bad' | 'neutral'][] = [];
  if (expectancyR != null) {
    if (expectancyR >= 0.6) { score += 40; tags.push(['expectancy strong', 'good']); }
    else if (expectancyR >= 0.3) { score += 30; tags.push(['expectancy positive', 'good']); }
    else if (expectancyR >= 0) { score += 18; tags.push(['expectancy marginal', 'neutral']); }
    else { tags.push(['expectancy negative', 'bad']); }
  } else { score += 12; }

  if (pf >= 2 || pf === Infinity) { score += 25; tags.push(['PF excellent', 'good']); }
  else if (pf >= 1.5) score += 20;
  else if (pf >= 1.2) score += 13;
  else if (pf >= 1.0) { score += 8; tags.push(['PF break-even', 'neutral']); }
  else tags.push(['PF losing', 'bad']);

  if (wr >= 0.55) score += 15;
  else if (wr >= 0.45) score += 10;
  else if (wr >= 0.35) score += 5;
  else tags.push(['win rate low', 'bad']);

  if (cr >= 1) score += 20;
  else if (cr >= 0.9) score += 16;
  else if (cr >= 0.7) score += 8;
  else tags.push(['discipline weak', 'bad']);

  const trustworthy = n >= 30;
  let letter, color, headline, sub;
  if (score >= 80) { letter = 'A'; color = '#0a7c5f'; headline = 'Profitable edge confirmed'; sub = 'Your edge is producing real money in the way profitable traders\' edges do. The job now is sizing, consistency, and not getting cocky.'; }
  else if (score >= 65) { letter = 'B'; color = '#3aa384'; headline = 'Edge works — needs sharpening'; sub = 'The math is on your side. There are specific leaks dragging the result down. Plug those and this becomes an A.'; }
  else if (score >= 45) { letter = 'C'; color = '#a26a18'; headline = 'Borderline — the math is close to flat'; sub = 'Right now, you are not meaningfully profitable. Small changes (either direction) decide whether this works.'; }
  else if (score >= 25) { letter = 'D'; color = '#c76d3a'; headline = 'Losing edge as currently traded'; sub = 'The data says this approach, as you are executing it, is bleeding money. The fix is real, not cosmetic.'; }
  else { letter = 'F'; color = '#b04a25'; headline = 'Edge is upside-down'; sub = 'What you are doing is the opposite of profitable. Stop trading real money and figure out what changed.'; }
  if (!trustworthy) sub += ` (Caveat: ${n} trades — still inside the noise band. Verdict sharpens at 30+.)`;

  return { letter, color, headline, sub, tags: tags.slice(0, 4) };
}

function buildCritiqueSummary(grade: Grade, m: any): string {
  const { wr, pf, cr, expectancyR, n } = m;
  const pfStr = pf === Infinity ? '∞' : pf.toFixed(2);
  const eStr = expectancyR != null ? `${expectancyR >= 0 ? '+' : ''}${expectancyR.toFixed(2)}R` : '—';
  if (grade.letter === 'A') return `${n} trades in and the math is clean: win rate ${Math.round(wr * 100)}%, profit factor ${pfStr}, expectancy ${eStr}. A profitable trader would say: <b>your edge is real, and your job now is to stop tinkering with it</b>. The fastest way to lose an A-grade edge is to "improve" it past the point that worked.`;
  if (grade.letter === 'B') return `${n} trades shows a working edge with leaks. Win rate ${Math.round(wr * 100)}%, profit factor ${pfStr}, expectancy ${eStr}. A profitable trader would say: <b>the foundation is sound, but specific things are dragging the result down</b>. Don't redesign the edge — find the leak.`;
  if (grade.letter === 'C') return `${n} trades and the math is sitting on a knife edge. Win rate ${Math.round(wr * 100)}%, profit factor ${pfStr}, expectancy ${eStr}. A profitable trader would say: <b>you're not making money, but you're not blowing up either</b>. This state is dangerous — it feels like progress but it's just survival.`;
  if (grade.letter === 'D') return `${n} trades and the data is honest: you're losing money. Win rate ${Math.round(wr * 100)}%, profit factor ${pfStr}, expectancy ${eStr}. A profitable trader would say: <b>stop adding risk until the edge changes</b>. Either the strategy isn't right for current conditions, or the execution is killing what would otherwise work.`;
  return `${n} trades and the result is unambiguous: you're trading the opposite of an edge. Win rate ${Math.round(wr * 100)}%, profit factor ${pfStr}, expectancy ${eStr}. A profitable trader would say: <b>stop trading real money until you understand why</b>.`;
}

function buildWhatWorks(m: any): string[] {
  const pts: string[] = [];
  if (m.cr >= 0.9) pts.push(`<b>Discipline is holding</b> — ${Math.round(m.cr * 100)}% rule-compliant. That's prop-firm-ready behaviour and the rarest skill in this game.`);
  if (m.pf >= 1.5) pts.push(`<b>Profit factor of ${m.pf === Infinity ? '∞' : m.pf.toFixed(2)}</b> — you're earning meaningfully more on wins than you give back on losses.`);
  if (m.wr >= 0.55 && m.avgLoss > 0) pts.push(`<b>Win rate ${Math.round(m.wr * 100)}% with R:R ${(m.avgWin / m.avgLoss).toFixed(2)}</b> — high enough win rate to feel real and a payoff structure that doesn't depend on lottery tickets.`);
  if (m.expectancyR != null && m.expectancyR >= 0.3) pts.push(`<b>Expectancy of +${m.expectancyR.toFixed(2)}R</b> per trade is professional-grade. Most retail traders never see numbers this clean.`);
  if (m.wr < 0.5 && m.pf >= 1.3) pts.push(`You're winning <i>less</i> than half the time but still making money — your <b>R:R discipline is doing the heavy lifting</b>.`);
  return pts;
}

function buildWhatBreaks(m: any): string[] {
  const pts: string[] = [];
  if (m.cr < 0.9 && m.n >= 10) pts.push(`<b>Compliance is leaking at ${Math.round(m.cr * 100)}%</b>. Rules you wrote for yourself are being broken in ${m.n - m.comp} of ${m.n} trades. Until this is at 100%, no other change you make will matter.`);
  if (m.expectancyR != null && m.expectancyR < 0) pts.push(`<b>Negative expectancy of ${m.expectancyR.toFixed(2)}R per trade</b>. Each trade you take is, on average, a paper cut. Scaling up makes the wound bigger.`);
  if (m.avgLoss > 0 && m.avgWin / m.avgLoss < 1.5 && m.wr < 0.55) pts.push(`Your <b>R:R is too tight</b>: average win ${m.avgWin.toFixed(1)} vs average loss ${m.avgLoss.toFixed(1)}. With your win rate, you need a wider payoff.`);
  if (m.pf < 1.0 && m.pf > 0) pts.push(`<b>Profit factor under 1.0</b> means losses are mechanically larger than wins. The math itself is upside-down before psychology enters the picture.`);
  if (m.wr < 0.35 && m.n >= 15) pts.push(`<b>Win rate below 35%</b> is unusual even for high-R:R systems. Either you're taking trades that aren't really setups, or your stops are too tight.`);
  return pts;
}

function buildImprovements(m: any): string[] {
  const pts: string[] = [];
  if (m.cr < 0.9 && m.n >= 10) {
    pts.push(`<b>Get to 100% compliance first.</b> Until every trade follows your own gate rules, you can't tell whether the strategy or the execution is the problem.`);
  } else if (m.expectancyR != null && m.expectancyR < 0) {
    pts.push(`<b>Stop adding risk.</b> Either drop position size in half while you diagnose, or paper-trade until expectancy turns positive.`);
  } else if (m.avgLoss > 0 && m.avgWin / m.avgLoss < 1.5) {
    pts.push(`<b>Widen your R:R target.</b> Targets are too close to entries. For your win rate to make money, you need at least a 1.5R average win.`);
  } else if (m.expectancyR != null && m.expectancyR >= 0.3) {
    pts.push(`<b>Don't change anything. Resist the urge to "improve".</b> An edge this clean dies when traders get clever.`);
  } else {
    pts.push(`<b>Tighten your edge instead of broadening it.</b> Raise the minimum score by 1 and trade fewer, higher-quality setups.`);
  }
  if (m.n < 50) {
    pts.push(`<b>Keep logging — the next 20 trades change everything.</b> Don't make big strategy decisions inside this window.`);
  } else {
    pts.push(`<b>Review your worst 5 losses in detail.</b> Five trades you wish you hadn't taken probably share a pattern — find it.`);
  }
  return pts;
}

// ============================================================
//  Styles
// ============================================================

const S: Record<string, React.CSSProperties> = {
  h1: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 30, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.15 },
  sub: { color: '#5d564d', fontSize: 14, marginBottom: 22, lineHeight: 1.6, maxWidth: 560 },

  verdictHero: { background: 'linear-gradient(135deg, #fffdf9, #f4efe6)', border: '1px solid rgba(60,40,15,.16)', borderRadius: 14, padding: '22px 24px', marginBottom: 16, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  gradeBadge: { width: 96, height: 96, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 48, fontWeight: 700, border: '3px solid', background: 'rgba(60,40,15,.04)' },
  verdictHeadline: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 20, fontWeight: 700, marginBottom: 6, lineHeight: 1.25 },
  verdictSub: { fontSize: 13, color: '#5d564d', lineHeight: 1.55 },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 },
  metric: { background: '#f4efe6', borderRadius: 10, padding: '14px 16px' },
  metricL: { fontSize: 10.5, color: '#8f8678', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '.04em' },
  metricV: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 22, fontWeight: 700 },
  metricS: { fontSize: 10.5, color: '#8f8678', marginTop: 2 },

  card: { background: '#fffdf9', border: '1px solid rgba(60,40,15,.08)', borderRadius: 14, padding: '20px 22px', marginBottom: 16, boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  cardH: { fontSize: 11.5, fontWeight: 600, color: '#5d564d', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" },

  critiqueCard: { background: 'linear-gradient(135deg, rgba(103,89,198,.06), rgba(103,89,198,.02))', border: '1px solid rgba(103,89,198,.22)', borderRadius: 14, padding: '20px 22px', marginBottom: 16, boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  critiqueSummary: { fontSize: 13.5, lineHeight: 1.7, color: '#1a1816', marginBottom: 16 },
};
