import { useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { utcMsToPixel, pixelToUtcMs, formatTimeInZone, getUtcOffsetLabel, classifyMinute } from '@/utils/timezones';
import { DEFAULT_WORK_HOURS } from '@/utils/constants';
import type { Zone, WorkClass } from '@/types';

interface Props {
  needleUtcMs: number;
  selectedDate: string;
  isLive: boolean;
  blockWidth: number;
  infoPanelWidth: number;
  myTimezone: string;
  hour12: boolean;
  zones: Zone[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  onNeedleChange: (utcMs: number) => void;
  onExitLive: () => void;
}

// React 19: ref as plain prop
export function Needle({
  needleUtcMs, selectedDate, isLive, blockWidth, infoPanelWidth, myTimezone, hour12, zones,
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
    const rawPx = clientX - rect.left + container.scrollLeft - infoPanelWidth;
    return Math.max(0, Math.min(rawPx, blockWidth * 24));
  }, [containerRef, blockWidth, infoPanelWidth]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (isLive) onExitLive();
  }, [isLive, onExitLive]);

  const snapToHalfHour = useCallback((px: number): number => {
    // Each half-hour = blockWidth / 2 pixels
    const halfBlock = blockWidth / 2;
    const snapped = Math.round(px / halfBlock) * halfBlock;
    return Math.max(0, Math.min(snapped, blockWidth * 24));
  }, [blockWidth]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const px = snapToHalfHour(pixelFromClientX(e.clientX));
    onNeedleChange(pixelToUtcMs(px, selectedDate, blockWidth, myTimezone));
  }, [pixelFromClientX, snapToHalfHour, onNeedleChange, selectedDate, blockWidth, myTimezone]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    setDragging(false);
  }, []);

  // Smooth live transition — enabled 300 ms after entering live mode so the
  // initial snap-to-current-time is instant, then subsequent ticks glide.
  // Also resets on myTimezone change so switching timezone snaps immediately.
  const [liveTransition, setLiveTransition] = useState(false);
  useEffect(() => {
    if (!isLive) { setLiveTransition(false); return; }
    setLiveTransition(false);
    const t = setTimeout(() => setLiveTransition(true), 300);
    return () => { clearTimeout(t); setLiveTransition(false); };
  }, [isLive, myTimezone]);

  // Scroll needle into view when live
  useEffect(() => {
    if (!isLive) return;
    const container = containerRef.current;
    if (!container) return;
    const px = getPixelX();
    const visibleWidth = container.clientWidth - infoPanelWidth;
    const scrollLeft = container.scrollLeft;
    if (px < scrollLeft || px > scrollLeft + visibleWidth - 100) {
      container.scrollTo({ left: Math.max(0, px - visibleWidth / 2), behavior: 'smooth' });
    }
  }, [needleUtcMs, isLive, containerRef, getPixelX, infoPanelWidth]);

  const left = infoPanelWidth + getPixelX();

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
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: zone.tz,
  }).formatToParts(new Date(utcMs));
  const localHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24;
  const localMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return classifyMinute(localHour * 60 + localMinute, zone.workHours ?? DEFAULT_WORK_HOURS);
}

const WORK_DOT: Record<WorkClass, string> = {
  core:   '#4ade80', // green-400
  fringe: '#fbbf24', // amber-400
  off:    '#475569', // slate-600
};

function AllZonesTooltip({ zones, needleUtcMs, hour12, anchorX, anchorY }: TooltipProps) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rowHeight = 40;
  const tooltipHeight = zones.length * rowHeight + 32;
  const KNOB_OFFSET = 20; // distance from needle center to tooltip edge

  // Prefer right of needle; fall back to left if not enough room
  let left = anchorX + KNOB_OFFSET;
  if (left + TOOLTIP_WIDTH > vw - TOOLTIP_MARGIN) {
    left = anchorX - TOOLTIP_WIDTH - KNOB_OFFSET;
  }
  left = Math.max(TOOLTIP_MARGIN, left);

  // Align top of tooltip with the knob; nudge up if it overflows bottom
  let top = anchorY;
  if (top + tooltipHeight > vh - TOOLTIP_MARGIN) {
    top = vh - tooltipHeight - TOOLTIP_MARGIN;
  }
  top = Math.max(TOOLTIP_MARGIN, top);

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
