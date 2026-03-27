import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import type { Zone, WorkHours } from '@/types';
import { buildHourBlocks } from '@/utils/timezones';
import { HOUR_WIDTH_PX } from '@/utils/constants';
import { HourRuler } from './HourRuler';
import { TimelineRow } from './TimelineRow';
import { Needle } from './Needle';

const INFO_PANEL_WIDTH = 224; // matches w-56

interface Props {
  zones: Zone[];
  selectedDate: string;
  needleUtcMs: number;
  isLive: boolean;
  hour12: boolean;
  myTimezone: string;
  onRemoveZone: (id: string) => void;
  onReorderZones: (zones: Zone[]) => void;
  onNeedleChange: (utcMs: number) => void;
  onExitLive: () => void;
  onUpdateZoneWorkHours: (id: string, wh: WorkHours) => void;
  onResetZoneWorkHours: (id: string) => void;
}

export function TimelineGrid({
  zones, selectedDate, needleUtcMs, isLive, hour12, myTimezone,
  onRemoveZone, onReorderZones, onNeedleChange, onExitLive,
  onUpdateZoneWorkHours, onResetZoneWorkHours,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [blockWidth, setBlockWidth] = useState(HOUR_WIDTH_PX);

  // ── Dynamic block width via ResizeObserver ────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const available = el.clientWidth - INFO_PANEL_WIDTH;
      setBlockWidth(Math.max(HOUR_WIDTH_PX, Math.floor(available / 24)));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Drag-to-reorder state ─────────────────────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropIndex(index);
  }, []);

  const handleDrop = useCallback((index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...zones];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    onReorderZones(next);
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, zones, onReorderZones]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  // ── Hour blocks (per zone, respects per-zone work hours) ──────────────────
  const zoneBlocks = useMemo(
    () => zones.map((z) => ({
      zone: z,
      blocks: buildHourBlocks(selectedDate, z.tz, myTimezone, z.workHours),
    })),
    [zones, selectedDate, myTimezone],
  );

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="timeline-scroll" ref={scrollRef}>
        <HourRuler blockWidth={blockWidth} hour12={hour12} />

        <div className="relative">
          {zoneBlocks.map(({ zone, blocks }, i) => (
            <TimelineRow
              key={zone.id}
              zone={zone}
              hourBlocks={blocks}
              blockWidth={blockWidth}
              needleUtcMs={needleUtcMs}
              hour12={hour12}
              index={i}
              isDragging={dragIndex === i}
              isDropTarget={dropIndex === i && dragIndex !== i}
              onRemove={onRemoveZone}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onUpdateWorkHours={onUpdateZoneWorkHours}
              onResetWorkHours={onResetZoneWorkHours}
            />
          ))}

          {zones.length > 0 && (
            <Needle
              needleUtcMs={needleUtcMs}
              selectedDate={selectedDate}
              isLive={isLive}
              blockWidth={blockWidth}
              myTimezone={myTimezone}
              hour12={hour12}
              zones={zones}
              containerRef={scrollRef}
              onNeedleChange={onNeedleChange}
              onExitLive={onExitLive}
            />
          )}
        </div>
      </div>
    </div>
  );
}
