'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';

const DEFAULT_EDGE = null; // removed — no edge is ever defaulted; dashboard page redirects to /edge-builder if missing

// A canned analysis used by the onboarding "try a sample" flow so a brand-new
// user feels the magic before uploading anything of their own. No API call.
const SAMPLE_ANALYSIS: Analysis = {
  read: 'Price swept the prior session low, printed a bullish CHoCH on the 15M, and is reacting from an unmitigated demand zone. Structure favours continuation toward the upper liquidity pool, aligned with the bullish daily trend.',
  factors: [
    { label: 'Aligns with HTF trend', met: true, points: 1, note: 'Daily and 4H both printing higher highs.' },
    { label: 'BOS or CHoCH confirmed', met: true, points: 1, note: 'Bullish CHoCH on 15M after the sweep.' },
    { label: 'FVG / OB / S&D zone at entry', met: true, points: 1, note: 'Reacting from an unmitigated demand zone.' },
    { label: 'Liquidity sweep confirmed', met: true, points: 1, note: 'Prior session low taken before reversal.' },
    { label: 'No high-impact news within 30 min', met: false, points: 0, note: "Can't verify from the chart — check the calendar." },
  ],
  score: 4, maxScore: 5,
  gate: [
    { rule: 'HTF bias confirmed', status: 'pass', note: '' },
    { rule: 'Structure break on entry TF', status: 'pass', note: '' },
    { rule: 'Entry from a marked zone', status: 'pass', note: '' },
    { rule: 'Stop beyond structure', status: 'pass', note: 'Logical stop below the demand zone.' },
    { rule: 'R:R at least 1:2', status: 'pass', note: 'Roughly 1:2.6 to the target.' },
    { rule: 'No news within 30 min', status: 'unclear', note: 'Unverifiable from the image.' },
  ],
  verdict: 'trade-full',
  verdictReason: 'Meets your full-size threshold. Strong HTF alignment with a clean liquidity sweep into the demand zone.',
  cautions: ['This is a sample setup. Gold is news-sensitive — always confirm the calendar before entering.'],
  meta: { instrument: 'XAUUSD', timeframe: '15M', bias: 'Bullish' },
};

type Analysis = {
  read: string;
  factors: { label: string; met: boolean; points: number; note: string }[];
  score: number;
  maxScore: number;
  gate: { rule: string; status: string; note: string }[];
  verdict: 'trade-full' | 'trade-reduced' | 'skip';
  verdictReason: string;
  cautions: string[];
  meta?: { instrument?: string; timeframe?: string; bias?: string };
};

const V = {
  'trade-full': { ramp: '#0a7c5f', soft: 'rgba(10,124,95,.08)', tx: '#0a7c5f', label: 'Trade — full size', icon: '✓' },
  'trade-reduced': { ramp: '#a26a18', soft: 'rgba(162,106,24,.09)', tx: '#a26a18', label: 'Trade — reduced size', icon: '◐' },
  'skip': { ramp: '#b04a25', soft: 'rgba(176,74,37,.08)', tx: '#b04a25', label: 'Skip — below your edge', icon: '✕' },
};

function Gauge({ score, max, color }: { score: number; max: number; color: string }) {
  const r = 46, circ = 2 * Math.PI * r;
  const pct = max ? score / max : 0;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ - circ * pct), 80);
    return () => clearTimeout(t);
  }, [circ, pct]);
  return (
    <div style={{ position: 'relative', width: 108, height: 108, flexShrink: 0 }}>
      <svg width="108" height="108" viewBox="0 0 108 108" role="img" aria-label={`Score ${score} of ${max}`}>
        <circle cx="54" cy="54" r={r} fill="none" stroke="rgba(60,40,15,.1)" strokeWidth="9" />
        <circle cx="54" cy="54" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 54 54)" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 36, fontWeight: 600, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 13, color: '#5d564d', fontFamily: "'JetBrains Mono', monospace" }}>/ {max}</span>
      </div>
    </div>
  );
}

export default function AnalyzeTab({
  plan, analysisCount, cap, edgeId, edge,
}: { plan: string; analysisCount: number; cap: number; edgeId: string; edge: any; }) {
  const supabase = createClient();

  const [img, setImg] = useState<{ data: string; type: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [error, setError] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [usage, setUsage] = useState({ count: analysisCount, cap, plan });
  const fileRef = useRef<HTMLInputElement>(null);
  const freshUser = analysisCount === 0;

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) loadImage(file);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  function loadImage(file: File) {
    if (file.size > 5 * 1024 * 1024) { setError('Image is over 5MB — please use a smaller screenshot.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImg({ data: url.split(',')[1], type: file.type, url });
      setResult(null); setError(''); setShowDetail(false); setIsSample(false);
    };
    reader.readAsDataURL(file);
  }

  // Prompt assembly now happens SERVER-SIDE in /api/analyze, built from the
  // user's stored edge (security minimum: never trust a client-built prompt).
  // The client only ever sends the image.

  function showSample() {
    setResult(SAMPLE_ANALYSIS); setIsSample(true); setError(''); setShowDetail(false);
    setImg(null);
    setTimeout(() => window.scrollTo({ top: 240, behavior: 'smooth' }), 60);
  }

  async function analyze() {
    if (!img) return;
    setLoading(true); setError(''); setResult(null); setIsSample(false);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: img.data, imageType: img.type }),
      });
      if (res.status === 402) { setError('cap'); return; }
      if (res.status === 409) { setError('Set up your edge before analyzing — refresh the page.'); return; }
      if (res.status === 429) { setError('Too many requests — wait a moment and try again.'); return; }
      if (res.status === 503) { setError('Analysis is briefly at capacity. Please try again shortly.'); return; }
      if (res.status === 413) { setError('That image is too large — please upload a smaller screenshot.'); return; }
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || e.error || 'failed'); }
      const json = await res.json();
      setResult(json.analysis);
      if (json.usage) setUsage(json.usage);
    } catch (e: any) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  async function upgrade(planType: 'monthly' | 'annual') {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planType }),
    });
    const { url } = await res.json();
    if (url) location.href = url;
  }

  const v = result ? V[result.verdict] : null;
  const metMap = result ? result.factors.filter((f) => f.met).length : 0;
  const gatePass = result ? result.gate.filter((g) => g.status === 'pass').length : 0;

  return (
    <div>
        <div style={st.edgeBadge}>Scored against <b style={{ color: '#1a1816' }}>{edge.name}</b> · {edge.cf.length} factors · gate of {edge.cl.length}</div>

        {/* Onboarding banner for brand-new users */}
        {freshUser && !result && !img && (
          <div style={st.onboard}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>See it work in one tap</div>
            <div style={{ fontSize: 13, color: '#5d564d', marginBottom: 14, lineHeight: 1.6 }}>
              New here? Run a sample setup to see how the AI scores a chart against your edge — no upload needed.
            </div>
            <button style={st.sampleBtn} onClick={showSample}>✦ Try a sample chart</button>
          </div>
        )}

        {!result && <h1 style={st.h1}>Analyze a setup</h1>}
        {!result && <p style={st.sub}>Drop or paste (⌘V) a candlestick screenshot. The AI reads it against your edge and gives a verdict in one glance.</p>}

        {!img && !result && (
          <div style={st.drop} onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]); }}>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && loadImage(e.target.files[0])} />
            <div style={{ fontSize: 36, opacity: .4 }}>⬆</div>
            <div style={{ fontWeight: 600, marginTop: 10 }}>Drop, paste, or click to upload a chart</div>
            <div style={{ fontSize: 12, color: '#5d564d', marginTop: 4 }}>PNG or JPG, up to 5MB</div>
          </div>
        )}

        {img && !result && (
          <div style={st.card}>
            <img src={img.url} alt="chart" style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid rgba(60,40,15,.08)' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button style={st.primary} onClick={analyze} disabled={loading}>
                {loading ? <span className="spin">◌</span> : '✦'} {loading ? ' Reading your chart…' : ' Analyze against my edge'}
              </button>
              <button style={st.ghost} onClick={() => { setImg(null); setResult(null); }}>Remove</button>
            </div>
          </div>
        )}

        {/* ===== RESULTS PAGE ===== */}
        {result && v && (
          <>
            {isSample && (
              <div style={st.sampleTag}>◎ Sample result — this is how every analysis looks. Upload your own chart when ready.</div>
            )}

            <div style={{ ...st.hero, background: v.soft }}>
              <Gauge score={result.score} max={result.maxScore} color={v.ramp} />
              <div>
                <div style={{ fontSize: 21, fontWeight: 600, color: v.tx, letterSpacing: '.01em' }}>{v.icon} {v.label}</div>
                <div style={{ fontSize: 13.5, color: '#1a1816', marginTop: 4, lineHeight: 1.5 }}>{result.verdictReason}</div>
                {result.meta && (result.meta.instrument || result.meta.timeframe) && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {result.meta.instrument && <span style={st.chip}>◈ {result.meta.instrument}</span>}
                    {result.meta.timeframe && <span style={st.chip}>◷ {result.meta.timeframe}</span>}
                    {result.meta.bias && <span style={st.chip}>↗ {result.meta.bias}</span>}
                  </div>
                )}
              </div>
            </div>

            <div style={{ ...st.card, marginBottom: 14 }}>
              <div style={st.cardH}>What the AI sees</div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: '#1a1816' }}>{result.read}</p>
            </div>

            <div style={{ ...st.card, marginBottom: 14 }}>
              <div style={st.cardH}>Confluence factors · {metMap} of {result.factors.length} met</div>
              {result.factors.map((f, i) => (
                <div key={i} style={st.facRow}>
                  <span style={{ fontSize: 18, marginTop: 1, color: f.met ? '#0a7c5f' : '#8f8678' }}>{f.met ? '✓' : '○'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: f.met ? '#1a1816' : '#5d564d' }}>{f.label}
                      {f.met && <span style={st.ptPill}>+{f.points}</span>}</div>
                    {f.note && <div style={st.note}>{f.note}</div>}
                  </div>
                </div>
              ))}
            </div>

            <button style={st.toggle} onClick={() => setShowDetail(!showDetail)}>
              {showDetail ? '▲ Hide' : '▼ Show'} entry gate &amp; cautions
            </button>

            {showDetail && (
              <div style={{ ...st.card, margin: '10px 0 14px' }}>
                <div style={st.cardH}>Entry gate · {gatePass} of {result.gate.length} pass</div>
                {result.gate.map((g, i) => {
                  const c = g.status === 'pass' ? '#0a7c5f' : g.status === 'fail' ? '#b04a25' : '#a26a18';
                  const ic = g.status === 'pass' ? '✓' : g.status === 'fail' ? '✕' : '?';
                  return (
                    <div key={i} style={st.facRow}>
                      <span style={{ fontSize: 18, marginTop: 1, color: c }}>{ic}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14 }}>{g.rule}</div>
                        {g.note && <div style={st.note}>{g.note}</div>}
                      </div>
                    </div>
                  );
                })}
                {result.cautions?.length > 0 && (
                  <div style={st.caution}>{result.cautions.map((c, i) => <div key={i}>⚠ {c}</div>)}</div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {!isSample && <button style={st.primary} onClick={() => location.reload()}>↻ Analyze another</button>}
              {isSample && <button style={st.primary} onClick={() => { setResult(null); setIsSample(false); }}>✦ Analyze my own chart</button>}
              <button style={st.ghost} onClick={() => alert('Share cards ship in the next build.')}>⇪ Share</button>
            </div>

            <p style={st.disc}>An AI read of a static image against your own checklist — decision support, not financial advice or a signal. Verify on your live chart before any entry.</p>
          </>
        )}

        {error === 'cap' && (
          <div style={st.upgradeCard}>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Unlock unlimited analysis</h2>
            <p style={{ color: '#5d564d', fontSize: 13.5, marginBottom: 18 }}>You&apos;ve used your {cap} free chart analyses. Go Pro for unlimited reads and the full performance suite.</p>
            <div style={st.priceRow} onClick={() => upgrade('annual')}>
              <div><div style={{ fontWeight: 600 }}>Annual <span style={st.saveBadge}>Save 38%</span></div><div style={st.priceSub}>$7.42/mo billed yearly</div></div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>$89<span style={{ fontSize: 12, color: '#5d564d' }}>/yr</span></div>
            </div>
            <div style={st.priceRowAlt} onClick={() => upgrade('monthly')}>
              <div><div style={{ fontWeight: 600 }}>Monthly</div><div style={st.priceSub}>Cancel anytime</div></div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>$12<span style={{ fontSize: 12, color: '#5d564d' }}>/mo</span></div>
            </div>
            <button style={st.ghostFull} onClick={() => setError('')}>Maybe later</button>
          </div>
        )}
        {error && error !== 'cap' && <div style={st.errorBox}>{error}</div>}
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(60,40,15,.08)', background: '#fffdf9' },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  mark: { width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#0a7c5f,#0a5c45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#fffdf9' },
  bname: { fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em' },
  usagePill: { fontSize: 12, color: '#5d564d', background: '#f4efe6', padding: '5px 11px', borderRadius: 20, fontFamily: "'JetBrains Mono', monospace" },
  upBtn: { background: '#0a7c5f', color: '#fffdf9', border: 'none', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  signout: { background: 'transparent', color: '#5d564d', border: '1px solid rgba(60,40,15,.16)', borderRadius: 7, padding: '6px 12px', fontSize: 13, cursor: 'pointer', textDecoration: 'none' },
  edgeBadge: { background: 'rgba(103,89,198,.08)', border: '1px solid rgba(103,89,198,.22)', color: '#6759c6', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 18 },
  onboard: { background: '#fffdf9', border: '1px solid rgba(10,124,95,.22)', borderRadius: 14, padding: 20, marginBottom: 18, boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  sampleBtn: { background: '#0a7c5f', color: '#fffdf9', border: 'none', borderRadius: 7, padding: '10px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  sampleTag: { background: 'rgba(103,89,198,.08)', color: '#6759c6', padding: '9px 14px', borderRadius: 8, fontSize: 12.5, marginBottom: 12 },
  h1: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 30, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.15 },
  sub: { color: '#5d564d', fontSize: 14, marginBottom: 22, lineHeight: 1.6 },
  drop: { border: '1.5px dashed rgba(60,40,15,.16)', borderRadius: 14, padding: '44px 20px', textAlign: 'center', cursor: 'pointer', background: '#fffdf9' },
  card: { background: '#fffdf9', border: '1px solid rgba(60,40,15,.08)', borderRadius: 14, padding: '16px 18px', marginBottom: 16, boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  cardH: { fontSize: 11.5, fontWeight: 600, color: '#5d564d', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" },
  hero: { borderRadius: 14, padding: 22, marginTop: 8, marginBottom: 14, display: 'flex', gap: 20, alignItems: 'center', background: 'linear-gradient(135deg,#fffdf9,#f4efe6)', border: '1px solid rgba(60,40,15,.16)', boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#5d564d', background: '#f4efe6', padding: '4px 10px', borderRadius: 20, fontFamily: "'JetBrains Mono', monospace" },
  facRow: { display: 'flex', gap: 11, padding: '11px 0', borderBottom: '1px solid rgba(60,40,15,.05)' },
  note: { fontSize: 12.5, color: '#5d564d', marginTop: 2, lineHeight: 1.5 },
  ptPill: { background: 'rgba(10,124,95,.1)', color: '#0a7c5f', fontSize: 10.5, padding: '2px 8px', borderRadius: 20, marginLeft: 6, fontFamily: "'JetBrains Mono', monospace" },
  toggle: { background: 'none', border: 'none', color: '#0a7c5f', fontSize: 13, cursor: 'pointer', padding: '8px 0', fontFamily: "'JetBrains Mono', monospace" },
  caution: { background: 'rgba(162,106,24,.09)', color: '#a26a18', border: '1px solid rgba(162,106,24,.22)', padding: 12, borderRadius: 8, fontSize: 12.5, marginTop: 12, lineHeight: 1.7 },
  primary: { background: '#0a7c5f', color: '#fffdf9', border: 'none', borderRadius: 7, padding: '11px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  ghost: { background: 'transparent', color: '#1a1816', border: '1px solid rgba(60,40,15,.16)', borderRadius: 7, padding: '11px 18px', fontSize: 14, cursor: 'pointer' },
  ghostFull: { width: '100%', background: 'transparent', color: '#5d564d', border: '1px solid rgba(60,40,15,.16)', borderRadius: 7, padding: '10px', fontSize: 13, cursor: 'pointer', marginTop: 8 },
  disc: { fontSize: 11, color: '#8f8678', marginTop: 14, lineHeight: 1.6 },
  upgradeCard: { background: '#fffdf9', border: '1px solid rgba(60,40,15,.16)', borderRadius: 14, padding: 26, marginTop: 16, boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  priceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #0a7c5f', background: 'rgba(10,124,95,.06)', borderRadius: 10, padding: '15px 18px', marginBottom: 10, cursor: 'pointer' },
  priceRowAlt: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(60,40,15,.08)', borderRadius: 10, padding: '15px 18px', marginBottom: 4, cursor: 'pointer' },
  priceSub: { fontSize: 11.5, color: '#5d564d' },
  saveBadge: { background: 'rgba(10,124,95,.1)', color: '#0a7c5f', fontSize: 10, padding: '2px 6px', borderRadius: 10, marginLeft: 6, fontFamily: "'JetBrains Mono', monospace" },
  errorBox: { background: 'rgba(176,74,37,.08)', color: '#b04a25', border: '1px solid rgba(176,74,37,.22)', padding: 14, borderRadius: 8, fontSize: 13, marginTop: 14 },
};
