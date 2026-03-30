import { useEffect, useState } from 'react';
import { PlusCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { TzOption } from '@/components/SearchableSelect';
import { formatTimeInZone, formatDateLabel, getLocalMidnightAsUTC } from '@/utils/timezones';
import { COMMON_ZONES } from '@/utils/constants';

interface Props {
  selectedDate: string;
  isLive: boolean;
  hour12: boolean;
  myTimezone: string;
  needleUtcMs: number;
  onDateChange: (date: string) => void;
  onGoLive: () => void;
  onSetHour12: (v: boolean) => void;
  onSetMyTz: (tz: string) => void;
  onTimeInput: (utcMs: number) => void;
  onAddZone: () => void;
}

// ─── Timezone option helpers ──────────────────────────────────────────────────

const ALL_ZONES = COMMON_ZONES.flatMap((g) => g.zones);

/** Returns the browser's IANA timezone, adding it to the list if absent */
function resolveBrowserTz(): TzOption | null {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const existing = ALL_ZONES.find((z) => z.tz === tz);
  if (existing) return null; // already in list, no need to inject
  return { tz, label: tz.replace('_', ' ').split('/').pop() ?? tz, flag: '🌐' };
}

// ─── Jump-to-time option helpers ─────────────────────────────────────────────

function buildTimeOptions(selectedDate: string, myTimezone: string, hour12: boolean) {
  const midnight = getLocalMidnightAsUTC(selectedDate, myTimezone);
  return Array.from({ length: 48 }, (_, i) => {
    const utcMs = midnight + i * 30 * 60_000;
    const label = formatTimeInZone(utcMs, myTimezone, hour12);
    const value = String(i); // index as value, resolve utcMs on select
    return { value, label, utcMs };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Header({
  selectedDate, isLive, hour12, myTimezone, needleUtcMs,
  onDateChange, onGoLive, onSetHour12, onSetMyTz, onTimeInput, onAddZone,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const localTime = formatTimeInZone(now, myTimezone, hour12);
  const dateLabel = formatDateLabel(selectedDate);

  const browserExtra = resolveBrowserTz();
  const timeOptions = buildTimeOptions(selectedDate, myTimezone, hour12);

  function handleTimeSelect(idx: string) {
    const opt = timeOptions[parseInt(idx, 10)];
    if (opt) onTimeInput(opt.utcMs);
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      {/* Primary row — visible on all screen sizes */}
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-2.5 sm:py-3">

        {/* Brand — ZoneSync logo */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl leading-none select-none" aria-hidden="true">🌐</span>
          <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none">ZoneSync</span>
        </div>

        <div className="h-10 w-px bg-slate-200 shrink-0 hidden sm:block" />

        {/* My timezone selector — searchable */}
        <div className="flex flex-col gap-0.5 flex-1 sm:flex-none shrink-0">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:block">My timezone</span>
          <SearchableSelect
            groups={COMMON_ZONES}
            value={myTimezone}
            onChange={onSetMyTz}
            placeholder="Search timezone…"
            extraOptions={browserExtra ? [browserExtra] : []}
            triggerClassName="h-8 w-full sm:w-52"
          />
        </div>

        {/* Desktop-only secondary controls inline */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="h-10 w-px bg-slate-200 shrink-0" />

          {/* Jump to time */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Jump to time</span>
            <Select onValueChange={handleTimeSelect}>
              <SelectTrigger className="h-8 w-36 text-sm font-mono" aria-label="Jump to time">
                <SelectValue placeholder="Select time…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Times in {myTimezone.split('/').pop()?.replace('_', ' ')}</SelectLabel>
                  {timeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="font-mono">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="h-10 w-px bg-slate-200 shrink-0" />

          {/* Date picker */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{dateLabel}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              aria-label="Select date"
            />
          </div>

          {/* 12/24h toggle */}
          <div className="flex flex-col gap-0.5 shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Time format</span>
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-sm">
            <button
              onClick={() => onSetHour12(false)}
              className={`px-3 h-8 font-medium transition-colors ${!hour12 ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              aria-pressed={!hour12}
            >
              24h
            </button>
            <button
              onClick={() => onSetHour12(true)}
              className={`px-3 h-8 font-medium transition-colors ${hour12 ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              aria-pressed={hour12}
            >
              12h
            </button>
          </div>
          </div>

        </div>

        {/* Spacer pushes live clock to the right */}
        <div className="flex-1" />

        {/* Live clock — right-aligned */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400 leading-tight">{myTimezone.replace(/_/g, ' ')}</div>
            <div className="text-base font-bold text-slate-900 tabular-nums leading-tight">{localTime}</div>
          </div>
          <div className="sm:hidden text-base font-bold text-slate-900 tabular-nums">{localTime}</div>
          <span
            className={`live-dot-lg shrink-0 ${isLive ? '' : 'live-dot-lg--idle'}`}
            title={isLive ? 'Live — showing current time' : 'Click to return to live'}
            aria-label={isLive ? 'Live' : 'Not live'}
            onClick={!isLive ? onGoLive : undefined}
            style={!isLive ? { cursor: 'pointer' } : undefined}
          />
        </div>

        <div className="h-10 w-px bg-slate-200 shrink-0 hidden sm:block" />

        {/* Add timezone button */}
        <Button size="sm" onClick={onAddZone} className="gap-1 sm:gap-1.5 shrink-0">
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="sm:hidden">Add</span>
          <span className="hidden sm:inline">Add timezone</span>
        </Button>
      </div>

      {/* Secondary row — mobile only */}
      <div className="sm:hidden flex items-center gap-2 px-4 py-2 border-t border-slate-100">
        {/* Jump to time */}
        <Select onValueChange={handleTimeSelect}>
          <SelectTrigger className="h-8 flex-1 text-sm font-mono" aria-label="Jump to time">
            <SelectValue placeholder="Jump to time…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Times in {myTimezone.split('/').pop()?.replace('_', ' ')}</SelectLabel>
              {timeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="font-mono">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Date picker */}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer flex-1"
          aria-label="Select date"
        />

        {/* 12/24h toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-sm shrink-0">
          <button
            onClick={() => onSetHour12(false)}
            className={`px-2.5 h-8 font-medium transition-colors ${!hour12 ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            aria-pressed={!hour12}
          >
            24h
          </button>
          <button
            onClick={() => onSetHour12(true)}
            className={`px-2.5 h-8 font-medium transition-colors ${hour12 ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
            aria-pressed={hour12}
          >
            12h
          </button>
        </div>

        {!isLive && (
          <Button variant="outline" size="sm" onClick={onGoLive} className="gap-1 shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="sr-only">Back to live</span>
          </Button>
        )}
      </div>

      {/* Exploring banner */}
      {!isLive && (
        <div className="px-4 sm:px-5 py-1.5 bg-blue-50 border-t border-blue-100 text-xs text-blue-700 flex items-center gap-2">
          <span className="font-semibold">Exploring:</span>
          <span className="font-mono font-bold">{formatTimeInZone(needleUtcMs, myTimezone, hour12)}</span>
          <span className="text-blue-500 hidden sm:inline">in {myTimezone.replace(/_/g, ' ')}</span>
          <button onClick={onGoLive} className="ml-auto text-blue-600 hover:underline font-medium">
            Return to live →
          </button>
        </div>
      )}
    </header>
  );
}
