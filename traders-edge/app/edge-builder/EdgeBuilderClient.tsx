'use client';

import { useState } from 'react';
import { EDGE_TEMPLATES, EdgeConfig, ConfluenceFactor, maxScore, validateEdgeConfig } from '@/lib/domain/edge';

const TEMPLATE_META: Record<string, { icon: string; desc: string }> = {
  smc: { icon: '◈', desc: 'Liquidity, BOS/CHoCH, FVG and order blocks — the institutional footprint approach.' },
  ict: { icon: '◷', desc: 'Killzones, fair value gaps, optimal trade entry and market-maker models.' },
  sd: { icon: '▭', desc: 'Fresh zones, drop-base-rally / rally-base-drop, strong departure candles.' },
  trend: { icon: '↗', desc: 'Moving averages, higher-highs/lower-lows, and pullback entries with momentum.' },
  blank: { icon: '✎', desc: 'A blank slate. Build your confluence model and gate entirely your own way.' },
};

export default function EdgeBuilderClient({
  existingEdgeId, existingConfig,
}: { existingEdgeId?: string; existingConfig?: EdgeConfig }) {
  const isEdit = !!existingEdgeId;
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [tmplKey, setTmplKey] = useState<string | null>(isEdit ? 'edit' : null);
  const [edge, setEdge] = useState<EdgeConfig | null>(existingConfig ? JSON.parse(JSON.stringify(existingConfig)) : null);
  const [instInput, setInstInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function pickTemplate(key: string) {
    setTmplKey(key);
    setEdge(JSON.parse(JSON.stringify(EDGE_TEMPLATES[key])));
  }

  function next() {
    if (step === 1 && !tmplKey) { setError('Pick a template to start.'); return; }
    setError('');
    setStep((s) => Math.min(s + 1, 4));
  }
  function back() { setStep((s) => Math.max(s - 1, isEdit ? 2 : 1)); }

  function updateFactor(i: number, field: keyof ConfluenceFactor, value: string | number) {
    if (!edge) return;
    const cf = [...edge.cf];
    cf[i] = { ...cf[i], [field]: field === 'pts' ? Number(value) || 1 : value };
    setEdge({ ...edge, cf });
  }
  function addFactor() {
    if (!edge) return;
    setEdge({ ...edge, cf: [...edge.cf, { label: '', desc: '', pts: 1 }] });
  }
  function removeFactor(i: number) {
    if (!edge) return;
    setEdge({ ...edge, cf: edge.cf.filter((_, idx) => idx !== i) });
  }

  function updateRule(i: number, value: string) {
    if (!edge) return;
    const cl = [...edge.cl];
    cl[i] = value;
    setEdge({ ...edge, cl });
  }
  function addRule() {
    if (!edge) return;
    setEdge({ ...edge, cl: [...edge.cl, ''] });
  }
  function removeRule(i: number) {
    if (!edge) return;
    setEdge({ ...edge, cl: edge.cl.filter((_, idx) => idx !== i) });
  }

  function addInstrument() {
    if (!edge || !instInput.trim()) return;
    const v = instInput.trim().toUpperCase();
    if (!edge.instr.includes(v)) setEdge({ ...edge, instr: [...edge.instr, v] });
    setInstInput('');
  }
  function removeInstrument(i: number) {
    if (!edge) return;
    setEdge({ ...edge, instr: edge.instr.filter((_, idx) => idx !== i) });
  }

  async function finish() {
    if (!edge) return;
    const cleanCf = edge.cf.filter((c) => c.label.trim());
    const cleanCl = edge.cl.filter((c) => c.trim());
    const finalEdge: EdgeConfig = { ...edge, cf: cleanCf, cl: cleanCl };

    const problems = validateEdgeConfig(finalEdge);
    if (problems.length) { setError(problems[0]); return; }

    setSaving(true);
    setError('');
    try {
      const res = isEdit
        ? await fetch('/api/edges', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ edgeId: existingEdgeId, config: finalEdge }),
          })
        : await fetch('/api/edges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: finalEdge }),
          });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.problems?.[0] || e.error || 'Failed to save edge');
      }
      location.href = '/dashboard';
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setSaving(false);
    }
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.brand}><div style={S.mark}>◎</div><span style={S.bname}>Trader&apos;s Edge</span></div>
      </header>
      <main style={S.main}>
        <h1 style={S.h1}>Define your edge</h1>
        <p style={S.sub}>Start from a proven template, then make it yours. Your confluence model and entry gate power the whole app.</p>

        <div style={S.stepper}>
          {(isEdit ? ['Confluence', 'Entry gate', 'Markets & risk'] : ['Template', 'Confluence', 'Entry gate', 'Markets & risk']).map((label, i) => {
            const n = isEdit ? i + 2 : i + 1;
            return (
              <div key={label} style={S.stepDot}>
                <span style={{ ...S.stepNum, ...(step === n ? S.stepNumOn : step > n ? S.stepNumDone : {}) }}>{i + 1}</span>
                <span style={step === n ? S.stepLabelOn : S.stepLabel}>{label}</span>
                {i < (isEdit ? 2 : 3) && <span style={S.stepLine} />}
              </div>
            );
          })}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        {step === 1 && !isEdit && (
          <div style={S.tmplGrid}>
            {Object.entries(EDGE_TEMPLATES).map(([key, t]) => (
              <div
                key={key}
                style={{ ...S.tmpl, ...(tmplKey === key ? S.tmplSel : {}) }}
                onClick={() => pickTemplate(key)}
              >
                <div style={S.tmplIcon}>{TEMPLATE_META[key].icon}</div>
                <h3 style={S.tmplH}>{t.name}</h3>
                <p style={S.tmplP}>{TEMPLATE_META[key].desc}</p>
              </div>
            ))}
          </div>
        )}

        {step === 2 && edge && (
          <div>
            <div style={S.card}>
              <div style={S.cardH}>Confluence factors · max {maxScore(edge.cf)} pts</div>
              <p style={S.hint}>Edit the wording, change the points, add your own, or remove what you don&apos;t use.</p>
              {edge.cf.map((c, i) => (
                <div key={i} style={S.ruleRow}>
                  <div style={{ flex: 1 }}>
                    <input
                      style={S.input}
                      placeholder="Factor name (e.g. HTF trend alignment)"
                      value={c.label}
                      onChange={(e) => updateFactor(i, 'label', e.target.value)}
                    />
                    <textarea
                      style={{ ...S.input, marginTop: 6, minHeight: 34, fontSize: 12.5 }}
                      placeholder="Short description (optional)"
                      value={c.desc || ''}
                      onChange={(e) => updateFactor(i, 'desc', e.target.value)}
                    />
                  </div>
                  <input
                    type="number"
                    min={1}
                    style={{ ...S.input, width: 60, textAlign: 'center' }}
                    value={c.pts}
                    onChange={(e) => updateFactor(i, 'pts', e.target.value)}
                  />
                  <button style={S.removeBtn} onClick={() => removeFactor(i)}>✕</button>
                </div>
              ))}
              <button style={S.ghostSm} onClick={addFactor}>+ Add factor</button>
              <hr style={S.divider} />
              <div style={S.grid2}>
                <div>
                  <label style={S.label}>Minimum score to trade</label>
                  <input type="number" min={1} style={S.input} value={edge.min}
                    onChange={(e) => setEdge({ ...edge, min: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <label style={S.label}>Score for full size</label>
                  <input type="number" min={1} style={S.input} value={edge.full}
                    onChange={(e) => setEdge({ ...edge, full: Number(e.target.value) || 1 })} />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && edge && (
          <div style={S.card}>
            <div style={S.cardH}>Entry gate rules</div>
            <p style={S.hint}>Hard rules that must all pass before you log an entry. Make it strict.</p>
            {edge.cl.map((rule, i) => (
              <div key={i} style={S.ruleRow}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  placeholder="Rule (e.g. No trade within 30 min of news)"
                  value={rule}
                  onChange={(e) => updateRule(i, e.target.value)}
                />
                <button style={S.removeBtn} onClick={() => removeRule(i)}>✕</button>
              </div>
            ))}
            <button style={S.ghostSm} onClick={addRule}>+ Add rule</button>
          </div>
        )}

        {step === 4 && edge && (
          <div>
            <div style={S.card}>
              <div style={S.cardH}>Your markets</div>
              <label style={S.label}>Add instruments you trade</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  placeholder="e.g. EURUSD"
                  value={instInput}
                  onChange={(e) => setInstInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInstrument(); } }}
                />
                <button style={S.ghostSm} onClick={addInstrument}>+</button>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {edge.instr.map((x, i) => (
                  <span key={x} style={S.chip}>{x} <span style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => removeInstrument(i)}>✕</span></span>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardH}>Risk rules</div>
              <div style={S.grid3}>
                <div>
                  <label style={S.label}>Max risk per trade (%)</label>
                  <input type="number" step={0.1} style={S.input} value={edge.risk}
                    onChange={(e) => setEdge({ ...edge, risk: Number(e.target.value) || 1 })} />
                </div>
                <div>
                  <label style={S.label}>Min R:R ratio</label>
                  <input type="number" step={0.1} style={S.input} value={edge.rr}
                    onChange={(e) => setEdge({ ...edge, rr: Number(e.target.value) || 2 })} />
                </div>
                <div>
                  <label style={S.label}>Streak goal (trades)</label>
                  <input type="number" style={S.input} value={edge.goal}
                    onChange={(e) => setEdge({ ...edge, goal: Number(e.target.value) || 30 })} />
                </div>
              </div>
            </div>
            <div style={S.card}>
              <label style={S.label}>Name your strategy</label>
              <input style={S.input} value={edge.name} onChange={(e) => setEdge({ ...edge, name: e.target.value })} />
            </div>
          </div>
        )}

        <div style={S.navRow}>
          {step > (isEdit ? 2 : 1) ? <button style={S.ghost} onClick={back}>← Back</button> : <span />}
          {step < 4 ? (
            <button style={S.primary} onClick={next}>Continue →</button>
          ) : (
            <button style={S.primary} onClick={finish} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? '✓ Save changes' : '✓ Launch my engine'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#faf7f2', color: '#1a1816', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { padding: '20px 24px', borderBottom: '1px solid rgba(60,40,15,.08)', background: '#fffdf9' },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  mark: { width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#0a7c5f,#0a5c45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#fffdf9' },
  bname: { fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em' },
  main: { maxWidth: 680, margin: '0 auto', padding: '32px 20px 80px' },
  h1: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 30, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.01em', lineHeight: 1.15 },
  sub: { color: '#5d564d', fontSize: 14, marginBottom: 26, lineHeight: 1.6 },
  stepper: { display: 'flex', gap: 4, marginBottom: 26, flexWrap: 'wrap', alignItems: 'center' },
  stepDot: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#8f8678', fontFamily: "'JetBrains Mono', monospace" },
  stepNum: { width: 22, height: 22, borderRadius: '50%', background: '#f4efe6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 },
  stepNumOn: { background: '#0a7c5f', color: '#fffdf9' },
  stepNumDone: { background: 'rgba(10,124,95,.12)', color: '#0a7c5f' },
  stepLabelOn: { color: '#1a1816' },
  stepLabel: { color: '#8f8678' },
  stepLine: { width: 16, height: 1, background: 'rgba(60,40,15,.16)', margin: '0 4px' },
  errorBox: { background: 'rgba(176,74,37,.08)', color: '#b04a25', border: '1px solid rgba(176,74,37,.22)', padding: '10px 14px', borderRadius: 9, fontSize: 13, marginBottom: 16 },
  tmplGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 },
  tmpl: { border: '1px solid rgba(60,40,15,.08)', borderRadius: 12, padding: 18, cursor: 'pointer', background: '#fffdf9', boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  tmplSel: { borderColor: '#0a7c5f', background: 'rgba(10,124,95,.06)' },
  tmplIcon: { width: 36, height: 36, borderRadius: 9, background: '#f4efe6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, marginBottom: 10, color: '#0a7c5f' },
  tmplH: { fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 16, fontWeight: 600, marginBottom: 5, letterSpacing: '-0.005em' },
  tmplP: { fontSize: 12, color: '#5d564d', lineHeight: 1.5 },
  card: { background: '#fffdf9', border: '1px solid rgba(60,40,15,.08)', borderRadius: 14, padding: '18px 20px', marginBottom: 16, boxShadow: '0 1px 0 rgba(60,40,15,.03)' },
  cardH: { fontSize: 11.5, fontWeight: 600, color: '#5d564d', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace" },
  hint: { fontSize: 12.5, color: '#5d564d', marginBottom: 14, lineHeight: 1.55 },
  ruleRow: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid rgba(60,40,15,.05)' },
  input: { width: '100%', fontSize: 13.5, padding: '9px 11px', borderRadius: 7, border: '1px solid rgba(60,40,15,.16)', background: '#fffdf9', color: '#1a1816', fontFamily: 'Inter, system-ui, sans-serif' },
  label: { display: 'block', fontSize: 12, color: '#5d564d', marginBottom: 6 },
  removeBtn: { background: 'transparent', border: '1px solid rgba(176,74,37,.25)', color: '#b04a25', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12 },
  ghostSm: { background: 'transparent', border: '1px solid rgba(60,40,15,.16)', color: '#1a1816', borderRadius: 7, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer', marginTop: 12 },
  divider: { border: 'none', borderTop: '1px solid rgba(60,40,15,.08)', margin: '16px 0' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: '#f4efe6', fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace" },
  navRow: { display: 'flex', justifyContent: 'space-between', marginTop: 8 },
  primary: { background: '#0a7c5f', color: '#fffdf9', border: 'none', borderRadius: 7, padding: '11px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  ghost: { background: 'transparent', color: '#1a1816', border: '1px solid rgba(60,40,15,.16)', borderRadius: 7, padding: '11px 18px', fontSize: 14, cursor: 'pointer' },
};
