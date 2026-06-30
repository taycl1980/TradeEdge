import LegalShell, { legalStyles as s } from '@/components/LegalShell';

export default function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p style={s.p}>
        These Terms govern your use of Trader&apos;s Edge (&quot;the App&quot;). By
        creating an account or using the App, you agree to these Terms.
      </p>

      <h2 style={s.h2}>1. Accounts</h2>
      <p style={s.p}>
        You must provide a valid email and keep your login secure. You are
        responsible for activity under your account. You must be of legal age in
        your jurisdiction to trade and to enter contracts.
      </p>

      <h2 style={s.h2}>2. The service</h2>
      <p style={s.p}>
        The App provides discipline-tracking, journaling, and AI-assisted chart
        analysis tools. It does not provide financial advice, execute trades, or
        connect to brokers. See our Risk Disclaimer.
      </p>

      <h2 style={s.h2}>3. Subscriptions &amp; billing</h2>
      <p style={s.p}>
        Paid plans are billed in advance on a recurring basis through our payment
        processor (Stripe). You can cancel at any time; access continues until the
        end of the paid period. Prices may change with notice. We do not store your
        card details — all payment data is handled by Stripe.
      </p>

      <h2 style={s.h2}>4. Refunds</h2>
      <p style={s.p}>
        Describe your refund policy here (e.g. 7-day money-back guarantee). Adapt to
        your jurisdiction&apos;s consumer-protection requirements.
      </p>

      <h2 style={s.h2}>5. Acceptable use</h2>
      <p style={s.p}>
        You agree not to misuse the App, attempt to bypass usage limits, reverse
        engineer it, or use it for unlawful purposes.
      </p>

      <h2 style={s.h2}>6. Limitation of liability</h2>
      <p style={s.p}>
        The App is provided &quot;as is&quot; without warranties. To the maximum
        extent permitted by law, we are not liable for any trading losses or
        indirect damages arising from your use of the App.
      </p>

      <h2 style={s.h2}>7. Termination</h2>
      <p style={s.p}>
        We may suspend or terminate accounts that violate these Terms. You may
        delete your account at any time.
      </p>

      <h2 style={s.h2}>8. Contact</h2>
      <p style={s.p}>Add your support email here.</p>
    </LegalShell>
  );
}
