import LegalShell, { legalStyles as s } from '@/components/LegalShell';

export default function RefundPolicy() {
  return (
    <LegalShell title="Refund Policy">
      <p style={s.p}>
        We want you to feel confident about your subscription. This policy explains
        when refunds are issued and how to request one.
      </p>

      <h2 style={s.h2}>Free tier</h2>
      <p style={s.p}>
        Trader&apos;s Edge offers a free tier so you can evaluate the product before
        paying anything. We strongly recommend using the free tier to confirm the
        product fits your workflow before upgrading.
      </p>

      <h2 style={s.h2}>14-day refund window</h2>
      <p style={s.p}>
        If you upgrade to a paid plan and decide within <strong>14 days</strong> that
        Trader&apos;s Edge isn&apos;t right for you, you can request a full refund of
        your most recent payment. To request a refund, email{' '}
        <a style={s.link} href="mailto:support@example.com">support@example.com</a>{' '}
        from the email address on your account. We don&apos;t require a reason.
        Refunds are processed within 5–10 business days to the original payment method.
      </p>

      <h2 style={s.h2}>After 14 days</h2>
      <p style={s.p}>
        After the 14-day window, paid subscriptions are non-refundable. You can
        cancel at any time from your <strong>Settings → Billing</strong> page;
        cancellation takes effect at the end of your current billing period and you
        retain Pro access until then. You will not be charged again.
      </p>

      <h2 style={s.h2}>Annual plans</h2>
      <p style={s.p}>
        The 14-day refund window applies to annual plans the same as monthly plans.
        After 14 days, annual plans are non-refundable but can be cancelled to
        prevent future renewals. Cancelling an annual plan does not result in a
        prorated refund of the remaining term.
      </p>

      <h2 style={s.h2}>Service issues</h2>
      <p style={s.p}>
        If a technical issue on our side prevents you from using a paid feature for
        an extended period, we will issue a prorated credit or refund at our
        discretion. Outages of less than 24 hours within any 30-day period do not
        typically qualify, but reach out and we&apos;ll review your case.
      </p>

      <h2 style={s.h2}>Chargebacks</h2>
      <p style={s.p}>
        Please contact us before initiating a chargeback with your bank. Almost all
        billing concerns can be resolved more quickly via email than through a
        chargeback dispute. Accounts with unresolved chargebacks may be closed.
      </p>

      <h2 style={s.h2}>Contact</h2>
      <p style={s.p}>
        Refund requests and billing questions:{' '}
        <a style={s.link} href="mailto:support@example.com">support@example.com</a>.
        Include the email address on your account so we can locate your subscription.
      </p>

      <p style={{ ...s.p, marginTop: 28, fontSize: 13, color: '#8f8678' }}>
        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
      </p>
    </LegalShell>
  );
}
