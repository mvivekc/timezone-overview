import type { Zone, WorkHours } from '../types';

export const HOUR_WIDTH_PX = 56;
export const HOUR_WIDTH_MOBILE_PX = 40;
export const TOTAL_WIDTH_PX = HOUR_WIDTH_PX * 24; // 1344px
export const STORAGE_KEY = 'tz-helper-v1';
export const ZONE_WARNING_THRESHOLD = 6;

const hm = (hours: number, minutes = 0) => hours * 60 + minutes;

export const WORK_CORE = { start: hm(9), end: hm(18) };   // green
export const WORK_FRINGE = { start: hm(7), end: hm(20) }; // amber

export const DEFAULT_WORK_HOURS: WorkHours = {
  fringeStart: WORK_FRINGE.start,
  coreStart: WORK_CORE.start,
  coreEnd: WORK_CORE.end,
  fringeEnd: WORK_FRINGE.end,
};

export const DEFAULT_ZONES: Zone[] = [
  { id: 'default-pt', tz: 'Europe/Lisbon',  label: 'Lisbon',    flag: '🇵🇹', person: '' },
  { id: 'default-de', tz: 'Europe/Berlin',  label: 'Berlin',    flag: '🇩🇪', person: '' },
  { id: 'default-ua', tz: 'Europe/Kyiv',    label: 'Kyiv',      flag: '🇺🇦', person: '' },
  { id: 'default-in', tz: 'Asia/Kolkata',   label: 'Bangalore', flag: '🇮🇳', person: '' },
];

// Curated IANA zone list for the Add Timezone modal
// `country` is used by SearchableSelect so typing the country name finds the city
export const COMMON_ZONES: { group: string; zones: { tz: string; label: string; flag: string; country?: string }[] }[] = [
  {
    group: 'Americas',
    zones: [
      { tz: 'America/New_York',      label: 'New York (ET)',       flag: '🇺🇸', country: 'United States' },
      { tz: 'America/Chicago',       label: 'Chicago (CT)',        flag: '🇺🇸', country: 'United States' },
      { tz: 'America/Denver',        label: 'Denver (MT)',         flag: '🇺🇸', country: 'United States' },
      { tz: 'America/Los_Angeles',   label: 'Los Angeles (PT)',    flag: '🇺🇸', country: 'United States' },
      { tz: 'America/Sao_Paulo',     label: 'São Paulo',           flag: '🇧🇷', country: 'Brazil' },
      { tz: 'America/Toronto',       label: 'Toronto',             flag: '🇨🇦', country: 'Canada' },
      { tz: 'America/Vancouver',     label: 'Vancouver',           flag: '🇨🇦', country: 'Canada' },
      { tz: 'America/Mexico_City',   label: 'Mexico City',         flag: '🇲🇽', country: 'Mexico' },
      { tz: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', flag: '🇦🇷', country: 'Argentina' },
    ],
  },
  {
    group: 'Europe',
    zones: [
      { tz: 'Europe/London',    label: 'London',      flag: '🇬🇧', country: 'United Kingdom' },
      { tz: 'Europe/Dublin',    label: 'Dublin',      flag: '🇮🇪', country: 'Ireland' },
      { tz: 'Europe/Lisbon',    label: 'Lisbon',      flag: '🇵🇹', country: 'Portugal' },
      { tz: 'Europe/Paris',     label: 'Paris',        flag: '🇫🇷', country: 'France' },
      { tz: 'Europe/Berlin',    label: 'Berlin',      flag: '🇩🇪', country: 'Germany' },
      { tz: 'Europe/Amsterdam', label: 'Amsterdam',   flag: '🇳🇱', country: 'Netherlands' },
      { tz: 'Europe/Madrid',    label: 'Madrid',      flag: '🇪🇸', country: 'Spain' },
      { tz: 'Europe/Rome',      label: 'Rome',        flag: '🇮🇹', country: 'Italy' },
      { tz: 'Europe/Warsaw',    label: 'Warsaw',      flag: '🇵🇱', country: 'Poland' },
      { tz: 'Europe/Stockholm', label: 'Stockholm',   flag: '🇸🇪', country: 'Sweden' },
      { tz: 'Europe/Zurich',    label: 'Zürich',      flag: '🇨🇭', country: 'Switzerland' },
      { tz: 'Europe/Kiev',      label: 'Kyiv',        flag: '🇺🇦', country: 'Ukraine' },
      { tz: 'Europe/Kyiv',      label: 'Kyiv (new)',  flag: '🇺🇦', country: 'Ukraine' },
      { tz: 'Europe/Moscow',    label: 'Moscow',      flag: '🇷🇺', country: 'Russia' },
      { tz: 'Europe/Istanbul',  label: 'Istanbul',    flag: '🇹🇷', country: 'Turkey' },
    ],
  },
  {
    group: 'Africa & Middle East',
    zones: [
      { tz: 'Africa/Cairo',         label: 'Cairo',        flag: '🇪🇬', country: 'Egypt' },
      { tz: 'Africa/Nairobi',       label: 'Nairobi',      flag: '🇰🇪', country: 'Kenya' },
      { tz: 'Africa/Lagos',         label: 'Lagos',        flag: '🇳🇬', country: 'Nigeria' },
      { tz: 'Asia/Dubai',           label: 'Dubai',        flag: '🇦🇪', country: 'United Arab Emirates' },
      { tz: 'Asia/Riyadh',          label: 'Riyadh',       flag: '🇸🇦', country: 'Saudi Arabia' },
      { tz: 'Asia/Jerusalem',       label: 'Tel Aviv',     flag: '🇮🇱', country: 'Israel' },
    ],
  },
  {
    group: 'Asia & Oceania',
    zones: [
      { tz: 'Asia/Kolkata',      label: 'Bangalore / Mumbai', flag: '🇮🇳', country: 'India' },
      { tz: 'Asia/Colombo',      label: 'Colombo',            flag: '🇱🇰', country: 'Sri Lanka' },
      { tz: 'Asia/Dhaka',        label: 'Dhaka',              flag: '🇧🇩', country: 'Bangladesh' },
      { tz: 'Asia/Bangkok',      label: 'Bangkok',            flag: '🇹🇭', country: 'Thailand' },
      { tz: 'Asia/Singapore',    label: 'Singapore',          flag: '🇸🇬', country: 'Singapore' },
      { tz: 'Asia/Hong_Kong',    label: 'Hong Kong',          flag: '🇭🇰', country: 'China' },
      { tz: 'Asia/Shanghai',     label: 'Shanghai / Beijing', flag: '🇨🇳', country: 'China' },
      { tz: 'Asia/Tokyo',        label: 'Tokyo',              flag: '🇯🇵', country: 'Japan' },
      { tz: 'Asia/Seoul',        label: 'Seoul',              flag: '🇰🇷', country: 'South Korea' },
      { tz: 'Australia/Sydney',  label: 'Sydney',             flag: '🇦🇺', country: 'Australia' },
      { tz: 'Australia/Melbourne', label: 'Melbourne',        flag: '🇦🇺', country: 'Australia' },
      { tz: 'Pacific/Auckland',  label: 'Auckland',           flag: '🇳🇿', country: 'New Zealand' },
    ],
  },
];
