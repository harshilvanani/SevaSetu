// Donation amounts are in cents (CAD). Stripe Canada charges 2.9% + 30¢ per card payment.
// Keep in sync with supabase/functions/donate-checkout/index.ts.
export const MIN_DONATION_CENTS = 200;
export const MAX_DONATION_CENTS = 10_000_000;

/** Extra amount so the organization receives the full donation after Stripe's fee. */
export function coverFeeCents(amountCents: number): number {
  const total = Math.ceil((amountCents + 30) / (1 - 0.029));
  return total - amountCents;
}

export function formatCad(cents: number, locale = 'en-CA'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

/** "12.50" / "12,50" / "$12" → cents, or null. */
export function parseDollars(input: string): number | null {
  const n = Number(input.replace(/[$\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}
