import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import type { Zone, WorkHours } from '@/types';
import { buildHourBlocks } from '@/utils/timezones';
import { computeOverlapColumns, computeTeamOverlapColumns, computeTeamOverlapMinutes } from '@/utils/overlaps';
import { HOUR_WIDTH_PX, HOUR_WIDTH_MOBILE_PX } from '@/utils/constants';
import { HourRuler } from './HourRuler';
import { TimelineRow } from './TimelineRow';
import { Needle } from './Needle';
import { TeamOverlapRow } from './TeamOverlapRow';

interface Props {
  zones: Zone[];
  selectedDate: string;
  needleUtcMs: number;
  isLive: boolean;
  hour12: boolean;
  myTimezone: string;
  selectedReferenceZoneId: string | null;
  onRemoveZone: (id: string) => void;
  onReorderZones: (zones: Zone[]) => void;
  onNeedleChange: (utcMs: number) => void;
  onExitLive: () => void;
  onUpdateZoneWorkHours: (id: string, wh: WorkHours) => void;
  onResetZoneWorkHours: (id: string) => void;
  onToggleReferenceZone: (id: string) => void;
}

export function TimelineGrid({
  zones, selectedDate, needleUtcMs, isLive, hour12, myTimezone,
  selectedReferenceZoneId,
  onRemoveZone, onReorderZones, onNeedleChange, onExitLive,
  onUpdateZoneWorkHours, onResetZoneWorkHours,
  onToggleReferenceZone,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [blockWidth, setBlockWidth] = useState(HOUR_WIDTH_PX);
  const [infoPanelWidth, setInfoPanelWidth] = useState(288);

  // ── Dynamic block width via ResizeObserver ────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const isMobile = el.clientWidth < 640;
      const panelW = isMobile ? 176 : 288;
      const minBlock = isMobile ? HOUR_WIDTH_MOBILE_PX : HOUR_WIDTH_PX;
      setInfoPanelWidth(panelW);
      setBlockWidth(Math.max(minBlock, Math.floor((el.clientWidth - panelW) / 24)));
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

  const overlapColumnsByZone = useMemo(() => {
    if (!selectedReferenceZoneId) return new Map<string, boolean[] | null>();
    const referenceZone = zones.find((zone) => zone.id === selectedReferenceZoneId);
    if (!referenceZone) return new Map<string, boolean[] | null>();

    const map = new Map<string, boolean[] | null>();
    for (const zone of zones) {
      if (zone.id === referenceZone.id) {
        map.set(zone.id, null);
        continue;
      }
      map.set(zone.id, computeOverlapColumns(referenceZone, zone, selectedDate, myTimezone));
    }
    return map;
  }, [zones, selectedReferenceZoneId, selectedDate, myTimezone]);

  const teamOverlapColumns = useMemo(
    () => computeTeamOverlapColumns(zones, selectedDate, myTimezone),
    [zones, selectedDate, myTimezone],
  );

  const teamOverlapMinutes = useMemo(
    () => computeTeamOverlapMinutes(zones, selectedDate, myTimezone),
    [zones, selectedDate, myTimezone],
  );

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="timeline-scroll" ref={scrollRef}>
        <HourRuler blockWidth={blockWidth} hour12={hour12} myTimezone={myTimezone} infoPanelWidth={infoPanelWidth} />

        <div>
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
              overlapColumns={overlapColumnsByZone.get(zone.id) ?? null}
              isReference={selectedReferenceZoneId === zone.id}
              onToggleReference={onToggleReferenceZone}
            />
          ))}

          {zones.length > 1 && (
            <TeamOverlapRow
              blockWidth={blockWidth}
              overlapColumns={teamOverlapColumns}
              durationMinutes={teamOverlapMinutes}
              infoPanelWidth={infoPanelWidth}
            />
          )}
        </div>

        {/* Needle spans full scroll container height so the knob can sit on the ruler row */}
        {zones.length > 0 && (
          <Needle
            needleUtcMs={needleUtcMs}
            selectedDate={selectedDate}
            isLive={isLive}
            blockWidth={blockWidth}
            infoPanelWidth={infoPanelWidth}
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
  );
}
