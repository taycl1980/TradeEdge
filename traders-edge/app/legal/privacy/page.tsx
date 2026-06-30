import LegalShell, { legalStyles as s } from '@/components/LegalShell';

export default function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p style={s.p}>
        This policy explains what we collect and how we handle it. We are
        privacy-minded by design and deliberately avoid storing sensitive data.
      </p>

      <h2 style={s.h2}>What we collect</h2>
      <p style={s.p}>
        Account email (for login), your strategy definitions and trade journal
        entries (so the App works across your devices), and basic usage counts
        (to enforce plan limits). That is the extent of it.
      </p>

      <h2 style={s.h2}>What we do NOT store</h2>
      <p style={s.p}>
        We do not store payment card details — these are handled entirely by our
        payment processor, Stripe. We do not store API keys, passwords in plain
        text (authentication is handled by Supabase), or any government identifiers.
      </p>

      <h2 style={s.h2}>Chart images</h2>
      <p style={s.p}>
        Chart screenshots you upload for AI analysis are sent to our AI provider
        (Anthropic) to generate the analysis and are not retained by us after the
        analysis is returned. Avoid uploading images containing personal or
        sensitive information.
      </p>

      <h2 style={s.h2}>Third parties</h2>
      <p style={s.p}>
        We use Supabase (authentication and database), Stripe (payments), and
        Anthropic (AI analysis). Each processes data only as needed to provide its
        part of the service.
      </p>

      <h2 style={s.h2}>Your rights</h2>
      <p style={s.p}>
        You can export or delete your data at any time by deleting your account.
        Depending on your jurisdiction (e.g. GDPR), you may have additional rights;
        contact us to exercise them.
      </p>

      <h2 style={s.h2}>Contact</h2>
      <p style={s.p}>Add your privacy contact email here.</p>
    </LegalShell>
  );
}
