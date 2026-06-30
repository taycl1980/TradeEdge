import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
        background:
          'radial-gradient(circle at 50% 0%, rgba(10,124,95,.05), transparent 45%), #faf7f2',
        color: '#1a1816',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: 'linear-gradient(135deg,#0a7c5f,#0a5c45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          marginBottom: 24,
          color: '#fffdf9',
        }}
      >
        ◎
      </div>
      <h1
        style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: 42,
          fontWeight: 600,
          maxWidth: 640,
          lineHeight: 1.12,
          marginBottom: 16,
          letterSpacing: '-0.015em',
        }}
      >
        The discipline engine for prop firm traders
      </h1>
      <p style={{ fontSize: 16, color: '#5d564d', maxWidth: 520, marginBottom: 32, lineHeight: 1.6 }}>
        Define your edge. Score every setup against your own confluence model. Let AI read your
        charts before you enter — and prove whether your strategy actually has an edge.
      </p>
      <Link
        href="/login"
        style={{
          background: '#0a7c5f',
          color: '#fffdf9',
          padding: '13px 28px',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 15,
          textDecoration: 'none',
        }}
      >
        Start free
      </Link>
      <div style={{ marginTop: 40, fontSize: 12, color: '#8f8678' }}>
        <Link href="/legal/disclaimer" style={{ color: '#8f8678', textDecoration: 'underline' }}>
          Not financial advice — for educational and discipline-tracking purposes only.
        </Link>
      </div>
    </main>
  );
}
