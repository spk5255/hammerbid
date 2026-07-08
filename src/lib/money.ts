// Money utilities — all arithmetic happens in integer cents (§3.2:
// numeric(12,2) in the DB, strings in transit, no float math on prices).

export function toCents(value: string | number): number {
  const m = String(value)
    .trim()
    .match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return NaN;
  const [, sign, whole, frac = ""] = m;
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return sign === "-" ? -cents : cents;
}

export function centsToAmount(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "25" + "2.50" -> "27.50" (exact, cents-based) */
export function addAmounts(a: string | number, b: string | number): string {
  return centsToAmount(toCents(a) + toCents(b));
}

/**
 * amount + 5% buyer's premium, rounded half-up to cents — must match
 * close_listing's round(amount * 1.05, 2). 105/100 keeps it integer-exact.
 */
export function withBuyerPremium(amount: string | number): string {
  const cents = toCents(amount);
  if (Number.isNaN(cents)) return "";
  return centsToAmount(Math.round((cents * 105) / 100));
}

/** Display formatting only: "1234.5" -> "$1,234.50" */
export function formatMoney(value: string | number): string {
  const cents = toCents(value);
  if (Number.isNaN(cents)) return "$—";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${whole}.${String(abs % 100).padStart(2, "0")}`;
}
