import { useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { utcMsToPixel, pixelToUtcMs, formatTimeInZone, getUtcOffsetLabel, classifyHour } from '@/utils/timezones';
import { DEFAULT_WORK_HOURS } from '@/utils/constants';
import type { Zone, WorkClass } from '@/types';

const INFO_PANEL_WIDTH = 224; // matches w-56

interface Props {
  needleUtcMs: number;
  selectedDate: string;
  isLive: boolean;
  blockWidth: number;
  myTimezone: string;
  hour12: boolean;
  zones: Zone[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onNeedleChange: (utcMs: number) => void;
  onExitLive: () => void;
}

// React 19: ref as plain prop
export function Needle({
  needleUtcMs, selectedDate, isLive, blockWidth, myTimezone, hour12, zones,
  containerRef, onNeedleChange, onExitLive,
}: Props) {
  const isDragging = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const needleRef = useRef<HTMLDivElement>(null);
  // Tooltip screen position (fixed)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const showTooltip = dragging || hovering;

  // Recompute tooltip screen position whenever needle moves or visibility changes
  useEffect(() => {
    if (!showTooltip || !needleRef.current) { setTooltipPos(null); return; }
    const rect = needleRef.current.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, [showTooltip, needleUtcMs]);

  const getPixelX = useCallback(
    () => utcMsToPixel(needleUtcMs, selectedDate, blockWidth, myTimezone),
    [needleUtcMs, selectedDate, blockWidth, myTimezone]
  );

  const pixelFromClientX = useCallback((clientX: number): number => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const rawPx = clientX - rect.left + container.scrollLeft - INFO_PANEL_WIDTH;
    return Math.max(0, Math.min(rawPx, blockWidth * 24));
  }, [containerRef, blockWidth]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (isLive) onExitLive();
  }, [isLive, onExitLive]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const px = pixelFromClientX(e.clientX);
    onNeedleChange(pixelToUtcMs(px, selectedDate, blockWidth, myTimezone));
  }, [pixelFromClientX, onNeedleChange, selectedDate, blockWidth, myTimezone]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    setDragging(false);
  }, []);

  // Smooth live transition — enabled 300 ms after entering live mode so the
  // initial snap-to-current-time is instant, then subsequent ticks glide.
  const [liveTransition, setLiveTransition] = useState(false);
  useEffect(() => {
    if (!isLive) { setLiveTransition(false); return; }
    const t = setTimeout(() => setLiveTransition(true), 300);
    return () => { clearTimeout(t); setLiveTransition(false); };
  }, [isLive]);

  // Scroll needle into view when live
  useEffect(() => {
    if (!isLive) return;
    const container = containerRef.current;
    if (!container) return;
    const px = getPixelX();
    const visibleWidth = container.clientWidth - INFO_PANEL_WIDTH;
    const scrollLeft = container.scrollLeft;
    if (px < scrollLeft || px > scrollLeft + visibleWidth - 100) {
      container.scrollTo({ left: Math.max(0, px - visibleWidth / 2), behavior: 'smooth' });
    }
  }, [needleUtcMs, isLive, containerRef, getPixelX]);

  const left = INFO_PANEL_WIDTH + getPixelX();

  // ── All-zones tooltip rendered via portal (bypasses scroll container clipping) ──
  const tooltip = tooltipPos && showTooltip && createPortal(
    <AllZonesTooltip
      zones={zones}
      needleUtcMs={needleUtcMs}
      hour12={hour12}
      anchorX={tooltipPos.x}
      anchorY={tooltipPos.y}
    />,
    document.body
  );

  return (
    <>
      <div
        ref={needleRef}
        className={[
          'needle-zone',
          dragging ? 'dragging' : '',
          isLive && !dragging ? 'live' : '',
          liveTransition && !dragging ? 'live-transition' : '',
        ].filter(Boolean).join(' ')}
        style={{ left }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        role="slider"
        aria-valuenow={needleUtcMs}
        aria-label="Time needle — drag to explore"
        tabIndex={0}
      >
        <div className="needle-line" />
        <div className="needle-knob" />
      </div>
      {tooltip}
    </>
  );
}

// ── Sub-component: floating all-zones panel ────────────────────────────────────

interface TooltipProps {
  zones: Zone[];
  needleUtcMs: number;
  hour12: boolean;
  anchorX: number;
  anchorY: number;
}

const TOOLTIP_WIDTH = 280;
const TOOLTIP_MARGIN = 12;

function zoneWorkClass(zone: Zone, utcMs: number): WorkClass {
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: zone.tz })
      .format(new Date(utcMs)),
    10,
  );
  return classifyHour(localHour, zone.workHours ?? DEFAULT_WORK_HOURS);
}

const WORK_DOT: Record<WorkClass, string> = {
  core:   '#4ade80', // green-400
  fringe: '#fbbf24', // amber-400
  off:    '#475569', // slate-600
};

function AllZonesTooltip({ zones, needleUtcMs, hour12, anchorX, anchorY }: TooltipProps) {
  // Keep tooltip inside viewport horizontally
  const vw = window.innerWidth;
  let left = anchorX - TOOLTIP_WIDTH / 2;
  if (left < TOOLTIP_MARGIN) left = TOOLTIP_MARGIN;
  if (left + TOOLTIP_WIDTH > vw - TOOLTIP_MARGIN) left = vw - TOOLTIP_WIDTH - TOOLTIP_MARGIN;

  // Position above the knob (anchorY is the top of the needle zone)
  const rowHeight = 40; // estimate per zone row
  const tooltipHeight = zones.length * rowHeight + 32;
  const top = anchorY - tooltipHeight - 8;

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top: Math.max(8, top),
        width: TOOLTIP_WIDTH,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
      className="bg-slate-900 text-white rounded-xl shadow-2xl overflow-hidden"
    >
      <div className="px-3 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Time snapshot
        </span>
      </div>
      {zones.map((zone) => {
        const time = formatTimeInZone(needleUtcMs, zone.tz, hour12);
        const offset = getUtcOffsetLabel(zone.tz, needleUtcMs);
        const wc = zoneWorkClass(zone, needleUtcMs);
        return (
          <div key={zone.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 last:border-b-0">
            {/* Work-class indicator dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: WORK_DOT[wc] }}
              title={wc === 'core' ? 'Working hours' : wc === 'fringe' ? 'Early / late' : 'Off hours'}
            />
            <span className="text-xl leading-none">{zone.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 truncate leading-tight">
                {zone.label}{zone.person ? ` · ${zone.person}` : ''}
              </div>
              <div className="text-base font-bold tabular-nums leading-tight">{time}</div>
            </div>
            <span className="text-xs text-slate-500 shrink-0">{offset}</span>
          </div>
        );
      })}
    </div>
  );
}
