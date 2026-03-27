import { useEffect, useState } from 'react';
import { Clock, PlusCircle, RefreshCw } from 'lucide-react';
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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="flex items-center gap-4 px-5 py-3 flex-wrap">

        {/* Current time in my timezone */}
        <div className="flex items-center gap-3 shrink-0">
          <Clock className="w-5 h-5 text-blue-600" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{localTime}</span>
              {isLive && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                  <span className="live-dot" />
                  Live
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{myTimezone.replace(/_/g, ' ')}</div>
          </div>
        </div>

        <div className="h-10 w-px bg-slate-200 shrink-0" />

        {/* My timezone selector — searchable */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">My timezone</span>
          <SearchableSelect
            groups={COMMON_ZONES}
            value={myTimezone}
            onChange={onSetMyTz}
            placeholder="Search timezone…"
            extraOptions={browserExtra ? [browserExtra] : []}
            triggerClassName="h-8 w-52"
          />
        </div>

        <div className="h-10 w-px bg-slate-200 shrink-0" />

        {/* Jump to time — 48 half-hour slots via Radix Select */}
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

        {/* Right side: 12/24h toggle + actions */}
        <div className="flex items-center gap-2 ml-auto">
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

          {!isLive && (
            <Button variant="outline" size="sm" onClick={onGoLive} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Back to live
            </Button>
          )}

          <Button size="sm" onClick={onAddZone} className="gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" />
            Add timezone
          </Button>
        </div>
      </div>

      {/* Exploring banner */}
      {!isLive && (
        <div className="px-5 py-1.5 bg-blue-50 border-t border-blue-100 text-xs text-blue-700 flex items-center gap-2">
          <span className="font-semibold">Exploring:</span>
          <span className="font-mono font-bold">{formatTimeInZone(needleUtcMs, myTimezone, hour12)}</span>
          <span className="text-blue-500">in {myTimezone.replace(/_/g, ' ')}</span>
          <button onClick={onGoLive} className="ml-auto text-blue-600 hover:underline font-medium">
            Return to live →
          </button>
        </div>
      )}
    </header>
  );
}
