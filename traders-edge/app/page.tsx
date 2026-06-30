import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, background: 'radial-gradient(circle at 50% 0%, rgba(29,158,117,.1), transparent 45%), #0d1526' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#1d9e75,#0f6e56)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 24 }}>◎</div>
      <h1 style={{ fontSize: 38, maxWidth: 640, lineHeight: 1.15, marginBottom: 16 }}>The discipline engine for prop firm traders</h1>
      <p style={{ fontSize: 16, color: '#9fb0c9', maxWidth: 520, marginBottom: 32, lineHeight: 1.6 }}>
        Define your edge. Score every setup against your own confluence model. Let AI read your charts before you enter — and prove whether your strategy actually has an edge.
      </p>
      <Link href="/login" style={{ background: '#1d9e75', color: '#fff', padding: '13px 28px', borderRadius: 10, fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
        Start free
      </Link>
      <div style={{ marginTop: 40, fontSize: 12, color: '#65769180' }}>
        <Link href="/legal/disclaimer" style={{ color: '#65769180', textDecoration: 'none' }}>
          Not financial advice — for educational and discipline-tracking purposes only.
        </Link>
      </div>
    </main>
  );
}
