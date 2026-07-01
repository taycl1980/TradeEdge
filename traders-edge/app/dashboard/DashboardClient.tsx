'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import AnalyzeTab from './AnalyzeTab';
import TrackTab from './TrackTab';
import InsightsTab from './InsightsTab';

type TabKey = 'analyze' | 'track' | 'insights';

export default function DashboardClient({
  userEmail, plan, analysisCount, cap, edgeId, edge,
}: { userEmail: string; plan: string; analysisCount: number; cap: number; edgeId: string; edge: any; }) {
  const supabase = createClient();
  const [tab, setTab] = useState<TabKey>('analyze');
  const [upgrading, setUpgrading] = useState(false);

  async function signOut() { await supabase.auth.signOut(); location.href = '/login'; }

  async function startUpgrade() {
    setUpgrading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'monthly' }),
      });
      if (!res.ok) throw new Error('checkout failed');
      const json = await res.json();
      window.location.href = json.url;
    } catch { setUpgrading(false); }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'analyze', label: 'Analyze' },
    { key: 'track', label: 'Track' },
    { key: 'insights', label: 'Insights' },
  ];

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.brand}>
          <div style={S.mark}>◎</div>
          <span style={S.bname}>Trader&apos;s Edge</span>
        </div>
        <div style={S.headerRight}>
          <span style={S.usagePill}>
            {plan === 'pro' ? 'Pro — unlimited' : `${Math.max(0, cap - analysisCount)} free analyses left`}
          </span>
          {plan !== 'pro' && (
            <button style={S.upBtn} onClick={startUpgrade} disabled={upgrading}>
              {upgrading ? 'Opening…' : 'Upgrade'}
            </button>
          )}
          <a href="/edge-builder?edit=1" style={S.headerLink}>My edge</a>
          <a href="/dashboard/settings" style={S.headerLink}>Settings</a>
          <button style={S.headerLink} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <nav style={S.tabBar}>
        <div style={S.tabBarInner}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ ...S.tabBtn, ...(tab === t.key ? S.tabBtnOn : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main style={S.main}>
        {tab === 'analyze' && (
          <AnalyzeTab plan={plan} analysisCount={analysisCount} cap={cap} edgeId={edgeId} edge={edge} />
        )}
        {tab === 'track' && <TrackTab edge={edge} plan={plan} />}
        {tab === 'insights' && <InsightsTab edge={edge} />}
      </main>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#faf7f2', color: '#1a1816', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(60,40,15,.08)', background: '#fffdf9', flexWrap: 'wrap', gap: 12 },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  mark: { width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#0a7c5f,#0a5c45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, color: '#fffdf9' },
  bname: { fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600, fontSize: 17, letterSpacing: '-0.01em' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  usagePill: { fontSize: 12, color: '#5d564d', background: '#f4efe6', padding: '5px 11px', borderRadius: 20, fontFamily: "'JetBrains Mono', monospace" },
  upBtn: { background: '#0a7c5f', color: '#fffdf9', border: 'none', borderRadius: 7, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  headerLink: { background: 'transparent', color: '#5d564d', border: '1px solid rgba(60,40,15,.16)', borderRadius: 7, padding: '6px 12px', fontSize: 13, cursor: 'pointer', textDecoration: 'none' },
  tabBar: { background: '#fffdf9', borderBottom: '1px solid rgba(60,40,15,.08)', paddingTop: 4 },
  tabBarInner: { maxWidth: 720, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 4 },
  tabBtn: { background: 'transparent', border: 'none', color: '#5d564d', padding: '12px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -1, fontFamily: 'Inter, system-ui, sans-serif' },
  tabBtnOn: { color: '#0a7c5f', borderBottom: '2px solid #0a7c5f', fontWeight: 600 },
  main: { maxWidth: 720, margin: '0 auto', padding: '28px 20px 80px' },
};
