// Pure domain logic shared by screens. Mirrors the server rules in supabase/migrations (task_remaining, etc.)
// so the UI can show accurate capacity before the server confirms.

export type TaskLike = {
  type: 'quantity' | 'role';
  status: 'draft' | 'open' | 'full' | 'closed' | 'completed';
  target_qty: number | null;
  positions: number | null;
  max_per_volunteer: number | null;
  max_volunteers: number | null;
  claimed_total: number;
  volunteers_count: number;
  verified_total: number;
  pending_total: number;
  signup_deadline?: string | null;
};

/** Units (quantity) or positions (role) still claimable. */
export function remaining(t: TaskLike): number {
  if (t.type === 'role') return Math.max((t.positions ?? 0) - t.volunteers_count, 0);
  if (t.max_volunteers != null && t.volunteers_count >= t.max_volunteers) return 0;
  return Math.max((t.target_qty ?? 0) - t.claimed_total, 0);
}

export function capacity(t: TaskLike): number {
  return t.type === 'role' ? (t.positions ?? 0) : (t.target_qty ?? 0);
}

/** Fraction already claimed (drives the orange capacity bar). */
export function claimedFraction(t: TaskLike): number {
  const cap = capacity(t);
  if (!cap) return 0;
  return Math.min(1, (cap - remaining(t)) / cap);
}

/** Largest quantity this volunteer may request right now. */
export function maxClaim(t: TaskLike): number {
  if (t.type === 'role') return remaining(t) > 0 ? 1 : 0;
  return Math.min(remaining(t), t.max_per_volunteer ?? Number.POSITIVE_INFINITY);
}

export function signupClosed(t: TaskLike, now = new Date()): boolean {
  return !!t.signup_deadline && new Date(t.signup_deadline) < now;
}

export type JoinState = 'open' | 'full' | 'closed';
export function joinState(t: TaskLike, now = new Date()): JoinState {
  if (t.status === 'closed' || t.status === 'completed' || t.status === 'draft' || signupClosed(t, now)) return 'closed';
  if (t.status === 'full' || remaining(t) === 0) return 'full';
  return 'open';
}

/** Verified / awaiting review / to go — totals never count pending reports as impact. */
export function progressBreakdown(assigned: number, verified: number, pending: number) {
  const v = Math.min(verified, assigned);
  const p = Math.min(pending, assigned - v);
  return { verified: v, pending: p, toGo: Math.max(assigned - v - p, 0) };
}

/** Units a volunteer can still report on an assignment. */
export function reportable(claimed: number, verified: number, pending: number): number {
  return Math.max(claimed - verified - pending, 0);
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Period = 'morning' | 'afternoon' | 'evening';
export type Slot = { weekday: number; period: Period }; // weekday 0 = Monday

/** Map a local time to a weekday (0 = Mon) and availability period. Night hours map to the nearest period. */
export function slotOf(date: Date): Slot {
  const weekday = (date.getDay() + 6) % 7;
  const h = date.getHours();
  const period: Period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return { weekday, period };
}

/**
 * Whether a seva fits the volunteer's weekly availability.
 * Tasks with no fixed time (e.g. virtual, any time before a deadline) always fit.
 */
export function fitsAvailability(startsAt: string | null | undefined, slots: Slot[]): boolean {
  if (!startsAt) return true;
  if (slots.length === 0) return false;
  const s = slotOf(new Date(startsAt));
  return slots.some((x) => x.weekday === s.weekday && x.period === s.period);
}

/** Hours a task contributes per the "from task schedule" rule. */
export function taskHours(t: { type: 'quantity' | 'role'; minutes_per_unit?: number | null }, startsAt?: string | null, endsAt?: string | null, units = 1) {
  if (t.type === 'quantity') return ((t.minutes_per_unit ?? 0) * units) / 60;
  if (!startsAt || !endsAt) return 0;
  return Math.max(0, (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000);
}
