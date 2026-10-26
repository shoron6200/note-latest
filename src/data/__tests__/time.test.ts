import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { localParts, nextOccurrence, zonedToUtc } from '../time';

const TZ = 'Europe/Belgrade'; // CEST (UTC+2) until 25 Oct 2026, then CET (UTC+1)

describe('zoned time', () => {
  test('wall clock to UTC on both sides of the DST change', () => {
    assert.equal(zonedToUtc({ y: 2026, m: 10, d: 24, hh: 9, mm: 0 }, TZ), Date.UTC(2026, 9, 24, 7, 0));
    assert.equal(zonedToUtc({ y: 2026, m: 10, d: 26, hh: 9, mm: 0 }, TZ), Date.UTC(2026, 9, 26, 8, 0));
  });

  test('a time skipped by spring-forward moves to the first real minute after', () => {
    // 29 Mar 2026, 02:00 -> 03:00 in Belgrade. 02:30 does not exist.
    const ts = zonedToUtc({ y: 2026, m: 3, d: 29, hh: 2, mm: 30 }, TZ);
    const back = localParts(ts, TZ);
    assert.equal(back.hh, 3);
    assert.equal(back.mm, 30);
  });

  test('other zones', () => {
    assert.equal(zonedToUtc({ y: 2026, m: 7, d: 1, hh: 9, mm: 0 }, 'America/New_York'), Date.UTC(2026, 6, 1, 13, 0));
    assert.equal(zonedToUtc({ y: 2026, m: 7, d: 1, hh: 9, mm: 0 }, 'Asia/Kolkata'), Date.UTC(2026, 6, 1, 3, 30));
  });
});

describe('repeats', () => {
  test('a daily 09:00 stays at 09:00 local across the DST change', () => {
    const r = { fireAt: Date.UTC(2026, 9, 24, 7, 0), timezone: TZ, localTime: '09:00', repeat: 'daily' as const };
    const n1 = nextOccurrence(r, r.fireAt);
    const n2 = nextOccurrence({ ...r, fireAt: n1 }, n1);
    const n3 = nextOccurrence({ ...r, fireAt: n2 }, n2);
    for (const n of [n1, n2, n3]) {
      const p = localParts(n, TZ);
      assert.deepEqual([p.hh, p.mm], [9, 0]);
    }
    assert.equal(n1 - r.fireAt, 25 * 3600_000); // 24 -> 25 Oct: the clocks go back, so that day is 25h long
    assert.equal(n2 - n1, 24 * 3600_000);
  });

  test('weekly and catch-up after a long gap', () => {
    const r = { fireAt: Date.UTC(2026, 9, 5, 7, 0), timezone: TZ, localTime: '09:00', repeat: 'weekly' as const };
    const next = nextOccurrence(r, Date.UTC(2026, 9, 18, 12, 0));
    assert.equal(next, Date.UTC(2026, 9, 19, 7, 0)); // Mon 19 Oct, 09:00 CEST
  });

  test('monthly keeps the day, clamped in short months', () => {
    const r = { fireAt: Date.UTC(2026, 0, 31, 8, 0), timezone: TZ, localTime: '09:00', repeat: 'monthly' as const };
    const feb = nextOccurrence(r, r.fireAt);
    assert.deepEqual([localParts(feb, TZ).m, localParts(feb, TZ).d], [2, 28]);
    const mar = nextOccurrence(r, feb);
    assert.deepEqual([localParts(mar, TZ).m, localParts(mar, TZ).d], [3, 31]);
  });

  test('a one-off is returned as is', () => {
    const r = { fireAt: 5, timezone: TZ, localTime: '09:00', repeat: 'none' as const };
    assert.equal(nextOccurrence(r, 1e12), 5);
  });
});
