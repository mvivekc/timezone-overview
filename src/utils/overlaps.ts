import type { WorkHours, Zone } from '@/types';
import { DEFAULT_WORK_HOURS } from './constants';
import { getLocalMidnightAsUTC } from './timezones';

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
function getFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
}

function getLocalMinutes(formatter: Intl.DateTimeFormat, utcMs: number): number {
  const parts = formatter.formatToParts(new Date(utcMs));
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return (hour % 24) * 60 + minute;
}

function isWithinWorkHours(localMinutes: number, wh: WorkHours): boolean {
  const start = wh.coreStart;
  const end = wh.coreEnd;

  // Supports both daytime windows (e.g. 09-18) and overnight shifts (e.g. 22-06).
  if (start === end) return true; // treat equal start/end as "always available"
  if (end > start) return localMinutes >= start && localMinutes < end;
  return localMinutes >= start || localMinutes < end;
}

function buildAvailabilityByMinute(zone: Zone, dayStartUtcMs: number): boolean[] {
  const formatter = getFormatter(zone.tz);
  const wh = zone.workHours ?? DEFAULT_WORK_HOURS;
  const availability = new Array<boolean>(DAY_MINUTES);

  for (let minute = 0; minute < DAY_MINUTES; minute++) {
    const utcMs = dayStartUtcMs + minute * MINUTE_MS;
    const localMinutes = getLocalMinutes(formatter, utcMs);
    availability[minute] = isWithinWorkHours(localMinutes, wh);
  }

  return availability;
}

function intersectTwo(a: boolean[], b: boolean[]): boolean[] {
  const out = new Array<boolean>(DAY_MINUTES);
  for (let i = 0; i < DAY_MINUTES; i++) out[i] = a[i] && b[i];
  return out;
}

function intersectMany(sets: boolean[][]): boolean[] {
  if (sets.length === 0) return new Array<boolean>(DAY_MINUTES).fill(false);
  const out = [...sets[0]];
  for (let i = 1; i < sets.length; i++) {
    for (let m = 0; m < DAY_MINUTES; m++) out[m] = out[m] && sets[i][m];
  }
  return out;
}

function toHalfHourColumns(availabilityByMinute: boolean[]): boolean[] {
  const columns = new Array<boolean>(48).fill(false);
  for (let slot = 0; slot < 48; slot++) {
    const start = slot * 30;
    const end = start + 30;
    let hasAny = false;
    for (let m = start; m < end; m++) {
      if (availabilityByMinute[m]) {
        hasAny = true;
        break;
      }
    }
    columns[slot] = hasAny;
  }
  return columns;
}

function countTrueMinutes(availabilityByMinute: boolean[]): number {
  let count = 0;
  for (let i = 0; i < DAY_MINUTES; i++) {
    if (availabilityByMinute[i]) count++;
  }
  return count;
}

function getDayStart(selectedDate: string, myTimezone: string): number {
  return getLocalMidnightAsUTC(selectedDate, myTimezone);
}

export function computeOverlapColumns(
  zoneA: Zone,
  zoneB: Zone,
  selectedDate: string,
  myTimezone: string,
): boolean[] {
  const dayStartUtcMs = getDayStart(selectedDate, myTimezone);
  const availabilityA = buildAvailabilityByMinute(zoneA, dayStartUtcMs);
  const availabilityB = buildAvailabilityByMinute(zoneB, dayStartUtcMs);
  return toHalfHourColumns(intersectTwo(availabilityA, availabilityB));
}

export function computeTeamOverlapColumns(
  zones: Zone[],
  selectedDate: string,
  myTimezone: string,
): boolean[] {
  if (zones.length === 0) return new Array<boolean>(48).fill(false);
  const dayStartUtcMs = getDayStart(selectedDate, myTimezone);
  const sets = zones.map((zone) => buildAvailabilityByMinute(zone, dayStartUtcMs));
  return toHalfHourColumns(intersectMany(sets));
}

export function computeTeamOverlapMinutes(
  zones: Zone[],
  selectedDate: string,
  myTimezone: string,
): number {
  if (zones.length === 0) return 0;
  const dayStartUtcMs = getDayStart(selectedDate, myTimezone);
  const sets = zones.map((zone) => buildAvailabilityByMinute(zone, dayStartUtcMs));
  return countTrueMinutes(intersectMany(sets));
}
