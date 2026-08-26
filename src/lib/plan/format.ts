export function usd(n: number, cents = false): string {
  const abs = Math.abs(n);
  const showCents = cents || abs < 1000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(n);
}

export function usdCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}k`;
  return usd(n);
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function yearsOld(n: number): string {
  return `${Math.floor(n)}`;
}
