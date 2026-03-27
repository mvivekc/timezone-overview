import type { HourBlock, WorkClass, WorkHours } from '../types';
import { HOUR_WIDTH_PX, DEFAULT_WORK_HOURS } from './constants';

// ─── Time formatting ──────────────────────────────────────────────────────────

export function formatTimeInZone(utcMs: number, ianaZone: string, hour12 = false): string {
  if (hour12) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: ianaZone,
    }).format(new Date(utcMs));
  }
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ianaZone,
  }).format(new Date(utcMs));
}

export function formatDateLabel(dateString: string): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

/** Returns e.g. "UTC+5:30" or "UTC-8:00" for a given zone at a given UTC ms */
export function getUtcOffsetLabel(ianaZone: string, utcMs: number): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: ianaZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(utcMs));
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  return tz.replace('GMT', 'UTC');
}

// ─── Working hour classification ─────────────────────────────────────────────

export function classifyHour(hour: number, wh: WorkHours = DEFAULT_WORK_HOURS): WorkClass {
  if (hour >= wh.coreStart && hour < wh.coreEnd) return 'core';
  if (hour >= wh.fringeStart && hour < wh.fringeEnd) return 'fringe';
  return 'off';
}

/** Hour label for the ruler: 24h → "09", 12h → "9a" / "12p" */
export function hourRulerLabel(h: number, hour12: boolean): string {
  if (!hour12) return String(h).padStart(2, '0');
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

// ─── Midnight anchor ─────────────────────────────────────────────────────────

export function getLocalMidnightAsUTC(dateString: string, ianaZone: string): number {
  // Binary-search approach: find the UTC ms where it is exactly 00:00:00
  // in ianaZone on dateString. This correctly handles all DST edge cases
  // regardless of the browser's own timezone.
  const [y, m, d] = dateString.split('-').map(Number);

  // Rough UTC midnight for the date (off by at most ±14 hours due to timezone spread)
  const roughUtc = Date.UTC(y, m - 1, d, 12, 0, 0); // noon UTC as starting point

  // Binary search over ±15 hours around noon UTC to find the 00:00 local crossing
  let lo = roughUtc - 15 * 3_600_000;
  let hi = roughUtc + 15 * 3_600_000;

  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const localMinutes = getLocalMinutesSinceMidnight(mid, ianaZone, dateString);
    if (localMinutes === null || localMinutes > 0) {
      hi = mid;
    } else {
      lo = mid;
    }
    if (hi - lo <= 1000) break;
  }

  return hi;
}

/**
 * Returns minutes elapsed since local midnight in ianaZone at utcMs,
 * but only if the local date matches dateString. Returns null if on wrong day.
 */
function getLocalMinutesSinceMidnight(utcMs: number, ianaZone: string, dateString: string): number | null {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
    timeZone: ianaZone,
  });
  const parts = fmt.formatToParts(new Date(utcMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const localDate = `${get('year')}-${get('month')}-${get('day')}`;
  if (localDate !== dateString) return null;
  const h = parseInt(get('hour'), 10);
  const min = parseInt(get('minute'), 10);
  // Handle 24:00 edge case some engines emit
  return h === 24 ? 0 : h * 60 + min;
}


// ─── Hour blocks ──────────────────────────────────────────────────────────────

/**
 * Builds 24 HourBlock entries aligned to the reference timezone's midnight.
 * Column `col` (0–23) represents "hour col in myTimezone". The workClass of
 * each block is determined by what LOCAL hour it is in `ianaZone` at that
 * moment — so working-hour highlights are correctly shifted per timezone.
 */
export function buildHourBlocks(
  dateString: string,
  ianaZone: string,
  myTimezone: string,
  workHours?: WorkHours,
): HourBlock[] {
  const wh = workHours ?? DEFAULT_WORK_HOURS;
  const refMidnightUtc = getLocalMidnightAsUTC(dateString, myTimezone);
  const blocks: HourBlock[] = [];

  for (let col = 0; col < 24; col++) {
    // UTC instant at the start of column col (= hour col in myTimezone)
    const utcMs = refMidnightUtc + col * 3_600_000;

    // What local hour is it in ianaZone at this UTC instant?
    const localHour = parseInt(
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        hour12: false,
        timeZone: ianaZone,
      }).format(new Date(utcMs)),
      10,
    );

    blocks.push({ hour: localHour, utcMs, workClass: classifyHour(localHour, wh) });
  }

  return blocks;
}

// ─── Needle ↔ pixel math (dynamic block width) ────────────────────────────────

/**
 * blockWidth: actual rendered width of each hour column in pixels.
 * myTimezone: reference timezone for the day (defaults to browser timezone).
 */
export function pixelToUtcMs(px: number, dateString: string, blockWidth: number, myTimezone?: string): number {
  const tz = myTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const totalWidth = blockWidth * 24;
  const midnightUtc = getLocalMidnightAsUTC(dateString, tz);
  const msPerPx = (24 * 60 * 60 * 1000) / totalWidth;
  return midnightUtc + px * msPerPx;
}

export function utcMsToPixel(utcMs: number, dateString: string, blockWidth: number, myTimezone?: string): number {
  const tz = myTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const totalWidth = blockWidth * 24;
  const midnightUtc = getLocalMidnightAsUTC(dateString, tz);
  const msPerPx = (24 * 60 * 60 * 1000) / totalWidth;
  const px = (utcMs - midnightUtc) / msPerPx;
  return Math.max(0, Math.min(px, totalWidth - blockWidth));
}

/** Convert a "HH:MM" string (in myTimezone) to a UTC ms value on selectedDate */
export function timeStringToUtcMs(timeStr: string, dateString: string, myTimezone: string): number | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const midnight = getLocalMidnightAsUTC(dateString, myTimezone);
  return midnight + (h * 60 + m) * 60_000;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export { HOUR_WIDTH_PX };
