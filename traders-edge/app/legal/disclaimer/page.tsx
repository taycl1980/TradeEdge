import LegalShell, { legalStyles as s } from '@/components/LegalShell';

export default function Disclaimer() {
  return (
    <LegalShell title="Risk Disclaimer">
      <p style={s.p}>
        Trader&apos;s Edge (&quot;the App&quot;) is an educational and discipline-tracking
        tool. It is <strong>not</strong> financial advice, investment advice, or a
        recommendation to buy, sell, or hold any financial instrument.
      </p>

      <h2 style={s.h2}>No financial advice</h2>
      <p style={s.p}>
        Nothing in the App — including AI-generated chart analysis, confluence
        scores, gate verdicts, statistics, or any other output — constitutes
        financial, investment, legal, or tax advice. All outputs are decision-support
        information generated against rules you define yourself. You are solely
        responsible for your own trading decisions.
      </p>

      <h2 style={s.h2}>AI analysis is not a signal</h2>
      <p style={s.p}>
        The AI chart analysis is an automated interpretation of a static image
        scored against your own checklist. It can be wrong, can misread price
        levels, and does not predict market movements. Never treat it as a trade
        signal. Always verify independently before acting.
      </p>

      <h2 style={s.h2}>Trading involves substantial risk</h2>
      <p style={s.p}>
        Trading forex, commodities, and other leveraged instruments carries a high
        level of risk and may not be suitable for all investors. You can lose some
        or all of your capital. Past performance — including any statistics shown in
        the App — is not indicative of future results.
      </p>

      <h2 style={s.h2}>No guarantee of outcomes</h2>
      <p style={s.p}>
        We make no guarantee that using the App will improve your trading
        performance, help you pass any prop firm evaluation, or produce profits.
        The App does not execute trades and is not connected to any brokerage or
        prop firm.
      </p>

      <h2 style={s.h2}>Your responsibility</h2>
      <p style={s.p}>
        By using the App you acknowledge that you trade at your own risk and that
        the operators of the App are not liable for any losses, damages, or costs
        arising from your use of the App or reliance on its outputs.
      </p>
    </LegalShell>
  );
}
