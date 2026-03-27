export interface WorkHours {
  fringeStart: number;  // 0–23, e.g. 7
  coreStart: number;    // e.g. 9
  coreEnd: number;      // e.g. 18
  fringeEnd: number;    // e.g. 20
}

export interface Zone {
  id: string;
  tz: string;        // IANA timezone identifier e.g. "Europe/Lisbon"
  label: string;     // Display name e.g. "Lisbon"
  flag: string;      // Emoji flag e.g. "🇵🇹"
  person: string;    // Optional person name e.g. "João"
  workHours?: WorkHours; // undefined = use global default
}

export type WorkClass = 'core' | 'fringe' | 'off';

export interface HourBlock {
  hour: number;       // 0–23 local hour
  utcMs: number;      // UTC ms for start of this hour block
  workClass: WorkClass;
}

export interface AppState {
  zones: Zone[];
  selectedDate: string;  // YYYY-MM-DD
  needleUtcMs: number;
  isLive: boolean;
  dismissedWarning: boolean;
  hour12: boolean;       // 12h vs 24h display toggle
  myTimezone: string;    // user's reference timezone
}

export type AppAction =
  | { type: 'SET_NEEDLE'; payload: number }
  | { type: 'SET_LIVE'; payload: boolean }
  | { type: 'SET_DATE'; payload: string }
  | { type: 'ADD_ZONE'; payload: Zone }
  | { type: 'REMOVE_ZONE'; payload: string }
  | { type: 'DISMISS_WARNING' }
  | { type: 'REORDER_ZONES'; payload: Zone[] }
  | { type: 'SET_HOUR12'; payload: boolean }
  | { type: 'SET_MY_TZ'; payload: string }
  | { type: 'SET_ZONE_WORK_HOURS'; payload: { id: string; workHours: WorkHours } }
  | { type: 'RESET_ZONE_WORK_HOURS'; payload: string }
  | { type: 'RESET_ALL_WORK_HOURS' };

// localStorage schema — versioned for future migrations
export interface StorageSchema {
  version: 1;
  zones: Zone[];
  preferences: {
    selectedDate: string | null;
    isLive: boolean;
    hour12?: boolean;
    myTimezone?: string;
  };
}
