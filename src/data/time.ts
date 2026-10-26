/**
 * Wall-clock time in an IANA zone <-> UTC instants, without a date library.
 * Repeats are computed from the stored local time ("09:00" in Europe/Belgrade),
 * never by adding 24h in UTC, so a daily 09:00 stays at 09:00 across DST.
 */
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly';

export type LocalParts = { y: number; m: number; d: number; hh: number; mm: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat | null {
  if (fmtCache.has(tz)) return fmtCache.get(tz)!;
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
    return f;
  } catch {
    return null; // unknown zone or no Intl time zone support
  }
}

/** The device's zone, e.g. "Europe/Belgrade". Falls back to UTC. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** The wall-clock parts of instant `ts` in zone `tz`. */
export function localParts(ts: number, tz: string): LocalParts {
  const f = formatter(tz);
  if (!f) {
    const d = new Date(ts);
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), hh: d.getHours(), mm: d.getMinutes() };
  }
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(ts))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { y: p.year, m: p.month, d: p.day, hh: p.hour % 24, mm: p.minute };
}

/** Offset of zone `tz` from UTC at instant `ts`, in ms (e.g. +2h in CEST). */
function offsetAt(ts: number, tz: string): number {
  const l = localParts(ts, tz);
  const asUtc = Date.UTC(l.y, l.m - 1, l.d, l.hh, l.mm);
  return asUtc - Math.floor(ts / 60000) * 60000;
}

/**
 * The UTC instant for a wall-clock time in `tz`. A time that does not exist
 * (inside a spring-forward gap) moves to the first valid minute after it.
 */
export function zonedToUtc(p: LocalParts, tz: string): number {
  const guess = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  const off1 = offsetAt(guess, tz);
  const off2 = offsetAt(guess - off1, tz);
  const ts = guess - off2;
  const back = localParts(ts, tz);
  if (back.hh !== p.hh || back.mm !== p.mm) {
    // In a spring-forward gap the wall time never happens. Using the offset
    // from before the change lands on the same distance past the gap
    // (02:30 -> 03:30), the first real minute after it.
    return guess - Math.min(off1, off2);
  }
  return ts;
}

export function parseLocalTime(s: string): { hh: number; mm: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`bad local time: ${s}`);
  return { hh: Number(m[1]), mm: Number(m[2]) };
}

export function formatLocalTime(hh: number, mm: number): string {
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Calendar date arithmetic in plain Y/M/D (no time zone involved). */
function addDays(p: { y: number; m: number; d: number }, n: number) {
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function addMonths(p: { y: number; m: number; d: number }, n: number, dayOfMonth: number) {
  const idx = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { y, m, d: Math.min(dayOfMonth, daysInMonth(y, m)) };
}

/**
 * The next time a reminder fires strictly after `after`.
 * For 'none' it is the stored instant (which may be in the past: the caller
 * decides). Monthly keeps the original day of month, clamped to short months.
 */
export function nextOccurrence(
  r: { fireAt: number; timezone: string; localTime: string; repeat: Repeat },
  after: number,
): number {
  if (r.repeat === 'none' || r.fireAt > after) return r.fireAt;
  const { hh, mm } = parseLocalTime(r.localTime);
  const start = localParts(r.fireAt, r.timezone);
  const dom = start.d;
  let date = { y: start.y, m: start.m, d: start.d };
  for (let i = 1; i <= 2000; i++) {
    date =
      r.repeat === 'daily'
        ? addDays(date, 1)
        : r.repeat === 'weekly'
          ? addDays(date, 7)
          : addMonths({ y: start.y, m: start.m, d: dom }, i, dom);
    const ts = zonedToUtc({ ...date, hh, mm }, r.timezone);
    if (ts > after) return ts;
  }
  throw new Error('no next occurrence found');
}
