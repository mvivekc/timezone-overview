import type { StorageSchema, Zone } from '../types';
import { DEFAULT_ZONES, STORAGE_KEY, DEFAULT_WORK_HOURS } from './constants';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function loadFromStorage(): StorageSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSchema();
    const parsed = JSON.parse(raw) as Partial<StorageSchema>;
    if (parsed.version !== 1) return defaultSchema();
    const schema = parsed as StorageSchema;
    return {
      ...schema,
      zones: migrateZones(schema.zones),
    };
  } catch {
    return defaultSchema();
  }
}

export function saveToStorage(
  zones: Zone[],
  selectedDate: string,
  isLive: boolean,
  hour12: boolean,
  myTimezone: string,
): void {
  const schema: StorageSchema = {
    version: 1,
    zones,
    preferences: { selectedDate, isLive, hour12, myTimezone },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
  } catch {
    // storage quota exceeded — fail silently
  }
}

function defaultSchema(): StorageSchema {
  return {
    version: 1,
    zones: DEFAULT_ZONES,
    preferences: {
      selectedDate: today(),
      isLive: true,
      hour12: false,
      myTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };
}

function migrateZones(zones: Zone[] | undefined): Zone[] {
  if (!zones) return DEFAULT_ZONES;
  return zones.map((zone) => {
    if (!zone.workHours) return zone;
    const wh = zone.workHours;
    return {
      ...zone,
      workHours: {
        fringeStart: normalizeMinutesValue(wh.fringeStart),
        coreStart: normalizeMinutesValue(wh.coreStart),
        coreEnd: normalizeMinutesValue(wh.coreEnd),
        fringeEnd: normalizeMinutesValue(wh.fringeEnd),
        lunchStart: typeof wh.lunchStart === 'number'
          ? normalizeMinutesValue(wh.lunchStart)
          : DEFAULT_WORK_HOURS.lunchStart,
        lunchEnd: typeof wh.lunchEnd === 'number'
          ? normalizeMinutesValue(wh.lunchEnd)
          : DEFAULT_WORK_HOURS.lunchEnd,
      },
    };
  });
}

/**
 * Backward compatibility:
 * - Legacy saved values were whole hours (0..23)
 * - New values are minutes since midnight (0..1439) in 30-minute increments
 */
function normalizeMinutesValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const legacyHourLike = value >= 0 && value <= 24;
  const minutes = legacyHourLike ? value * 60 : value;
  const snapped = Math.round(minutes / 30) * 30;
  return Math.max(0, Math.min(snapped, 23 * 60 + 30));
}
