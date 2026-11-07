import { describe, expect, it } from '@jest/globals';

import {
  claimedFraction,
  distanceKm,
  fitsAvailability,
  joinState,
  maxClaim,
  progressBreakdown,
  remaining,
  reportable,
  slotOf,
  type TaskLike,
  taskHours,
} from '../seva';

const qty = (over: Partial<TaskLike> = {}): TaskLike => ({
  type: 'quantity',
  status: 'open',
  target_qty: 120,
  positions: null,
  max_per_volunteer: 12,
  max_volunteers: null,
  claimed_total: 84,
  volunteers_count: 14,
  verified_total: 0,
  pending_total: 0,
  ...over,
});

const role = (over: Partial<TaskLike> = {}): TaskLike => ({
  ...qty(),
  type: 'role',
  target_qty: null,
  positions: 2,
  max_per_volunteer: null,
  claimed_total: 1,
  volunteers_count: 1,
  ...over,
});

describe('capacity', () => {
  it('counts remaining units for quantity tasks', () => {
    expect(remaining(qty())).toBe(36);
    expect(claimedFraction(qty())).toBeCloseTo(0.7);
  });

  it('caps a claim at per-volunteer max and remaining', () => {
    expect(maxClaim(qty())).toBe(12);
    expect(maxClaim(qty({ claimed_total: 118 }))).toBe(2);
  });

  it('treats max volunteers as a hard limit', () => {
    expect(remaining(qty({ max_volunteers: 14 }))).toBe(0);
  });

  it('counts positions for role tasks', () => {
    expect(remaining(role())).toBe(1);
    expect(maxClaim(role())).toBe(1);
    expect(remaining(role({ volunteers_count: 2 }))).toBe(0);
  });

  it('derives join state', () => {
    expect(joinState(qty())).toBe('open');
    expect(joinState(qty({ claimed_total: 120 }))).toBe('full');
    expect(joinState(qty({ status: 'closed' }))).toBe('closed');
    expect(joinState(qty({ signup_deadline: '2000-01-01T00:00:00Z' }))).toBe('closed');
  });
});

describe('progress', () => {
  it('keeps verified, pending and remaining distinct', () => {
    expect(progressBreakdown(4, 2, 1)).toEqual({ verified: 2, pending: 1, toGo: 1 });
    expect(progressBreakdown(4, 5, 3)).toEqual({ verified: 4, pending: 0, toGo: 0 });
  });

  it('limits what can still be reported', () => {
    expect(reportable(4, 2, 1)).toBe(1);
    expect(reportable(4, 3, 2)).toBe(0);
  });
});

describe('availability', () => {
  it('maps times to Monday-first weekday and period', () => {
    // Saturday 10:00 local
    const d = new Date(2026, 10, 14, 10, 0);
    expect(slotOf(d)).toEqual({ weekday: 5, period: 'morning' });
    expect(slotOf(new Date(2026, 10, 12, 18, 30))).toEqual({ weekday: 3, period: 'evening' });
  });

  it('matches seva to weekly slots', () => {
    const sat10 = new Date(2026, 10, 14, 10, 0).toISOString();
    expect(fitsAvailability(sat10, [{ weekday: 5, period: 'morning' }])).toBe(true);
    expect(fitsAvailability(sat10, [{ weekday: 5, period: 'evening' }])).toBe(false);
    expect(fitsAvailability(null, [])).toBe(true);
  });
});

describe('geo + hours', () => {
  it('computes distance', () => {
    const toronto = { lat: 43.6532, lng: -79.3832 };
    const mississauga = { lat: 43.589, lng: -79.6441 };
    expect(distanceKm(toronto, mississauga)).toBeGreaterThan(20);
    expect(distanceKm(toronto, mississauga)).toBeLessThan(23);
  });

  it('computes task hours from schedule', () => {
    expect(taskHours({ type: 'quantity', minutes_per_unit: 30 }, null, null, 4)).toBe(2);
    expect(taskHours({ type: 'role' }, '2026-11-14T10:00:00Z', '2026-11-14T13:00:00Z')).toBe(3);
  });
});
