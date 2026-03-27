import type { StorageSchema, Zone } from '../types';
import { DEFAULT_ZONES, STORAGE_KEY } from './constants';

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
    return parsed as StorageSchema;
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
