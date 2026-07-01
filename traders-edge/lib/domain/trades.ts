// Pure domain logic for trades. No I/O. Safe to unit test.
// Used by both server routes and client-side calc panel.

export type TradeStatus = 'open' | 'closed' | 'locked' | 'superseded';
export type TradeResult = 'Win' | 'Loss' | 'Breakeven';
export type Direction = 'Buy' | 'Sell';

// Pip size for the instruments the app supports. JPY pairs are 0.01,
// metals/oil are larger. Used to convert price differences into pips.
export function pipSize(symbol: string): number {
  if (/JPY$/.test(symbol)) return 0.01;
  if (symbol === 'XAUUSD') return 0.1;
  if (symbol === 'USOIL') return 0.01;
  return 0.0001;
}

// Approximate standard-lot pip value in USD for the major pairs. This
// is a preview-only number for the live calc panel — the server doesn't
// use it for anything authoritative, so the rough constant is fine.
const PIP_VALUE_PER_LOT_USD = 10;

export type CalcInput = {
  symbol: string;
  direction: Direction;
  entry: number;
  stop: number;
  takeProfit: number | null;
  exit: number | null;
  balance: number;
  // Either size (lots) OR riskPct must be provided. If both, size wins.
  size: number | null;
  riskPct: number | null;
};

export type CalcOutput = {
  stopPips: number;
  tpPips: number;
  size: number;            // resolved position size in lots
  riskAmount: number;      // dollars at risk
  riskPctActual: number;   // % of balance
  rr: number;              // R:R ratio (TP / Stop)
  // Only populated when exit price is present
  pnlPips: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  rMultiple: number | null;
  result: TradeResult | null;
};

export function computeTrade(i: CalcInput): CalcOutput {
  const pip = pipSize(i.symbol);
  const stopPips = i.entry && i.stop ? Math.abs(i.entry - i.stop) / pip : 0;
  const tpPips = i.entry && i.takeProfit ? Math.abs(i.entry - i.takeProfit) / pip : 0;

  // Resolve size: either provided directly, or computed from risk %.
  let size = i.size ?? 0;
  let riskAmount = 0;
  if (size > 0 && stopPips > 0) {
    riskAmount = size * stopPips * PIP_VALUE_PER_LOT_USD;
  } else if (i.riskPct && stopPips > 0 && i.balance > 0) {
    riskAmount = (i.riskPct / 100) * i.balance;
    size = riskAmount / (stopPips * PIP_VALUE_PER_LOT_USD);
  }
  const riskPctActual = riskAmount && i.balance ? (riskAmount / i.balance) * 100 : 0;
  const rr = stopPips && tpPips ? tpPips / stopPips : 0;

  // Outcome math only when there's an exit price.
  let pnlPips: number | null = null;
  let pnlUsd: number | null = null;
  let pnlPct: number | null = null;
  let rMultiple: number | null = null;
  let result: TradeResult | null = null;
  if (i.exit && i.entry) {
    const dirSign = i.direction === 'Buy' ? 1 : -1;
    pnlPips = ((i.exit - i.entry) / pip) * dirSign;
    if (stopPips > 0) {
      rMultiple = pnlPips / stopPips;
      pnlUsd = rMultiple * riskAmount;
      pnlPct = i.balance ? (pnlUsd / i.balance) * 100 : 0;
    }
    // Threshold for breakeven: within 0.1R of entry.
    result = rMultiple !== null
      ? (rMultiple > 0.1 ? 'Win' : rMultiple < -0.1 ? 'Loss' : 'Breakeven')
      : null;
  }

  return { stopPips, tpPips, size, riskAmount, riskPctActual, rr, pnlPips, pnlUsd, pnlPct, rMultiple, result };
}

// Session auto-detect from UTC hour. Returns the trading session likely
// active when the trade was placed. Used as a sensible default on the
// quick logger so the user doesn't have to pick.
export function detectSession(d: Date = new Date()): string {
  const h = d.getUTCHours();
  if (h >= 23 || h < 7) return 'Asian';
  if (h >= 7 && h < 12) return 'London';
  if (h >= 12 && h < 16) return 'London-NY overlap';
  if (h >= 16 && h < 21) return 'New York';
  return 'Off-hours';
}

// ===== Integrity model =====
// Three tiers govern what's editable post-close.
//   Tier 1: execution math (immutable once closed; correctable via supersede)
//   Tier 2: classification (editable until 7-day lock, with audit reason)
//   Tier 3: reflection (always editable, no audit)

export const TIER_1_FIELDS = ['entry_price', 'stop_loss', 'take_profit', 'exit_price', 'direction', 'instrument_id'] as const;
export const TIER_2_FIELDS = ['confluence_score', 'pattern_id', 'session_id', 'rule_compliant'] as const;
export const TIER_3_FIELDS = ['emotion', 'notes_right', 'notes_wrong'] as const;

export type TierEditCheck = {
  canEditTier1: boolean;
  canEditTier2: boolean;
  canEditTier3: boolean;
  tier2RequiresReason: boolean;
};

export function tierEditPermissions(status: TradeStatus): TierEditCheck {
  return {
    canEditTier1: status === 'open',
    canEditTier2: status === 'open' || status === 'closed',
    canEditTier3: status !== 'superseded',
    tier2RequiresReason: status === 'closed', // open trades don't need reason yet
  };
}

// Auto-lock window: closed trades flip to 'locked' after this elapses.
export const LOCK_WINDOW_MS = 7 * 86400 * 1000;

export function shouldAutoLock(t: { status: TradeStatus; closed_at: string | null }): boolean {
  if (t.status !== 'closed' || !t.closed_at) return false;
  return Date.now() - new Date(t.closed_at).getTime() > LOCK_WINDOW_MS;
}
