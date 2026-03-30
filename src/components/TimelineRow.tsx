import { useRef, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, GripVertical, RotateCcw } from 'lucide-react';
import type { Zone, HourBlock, WorkHours, WorkClass } from '@/types';
import { DEFAULT_WORK_HOURS } from '@/utils/constants';
import { formatTimeInZone, getUtcOffsetLabel, classifyMinute } from '@/utils/timezones';

interface Props {
  zone: Zone;
  hourBlocks: HourBlock[];
  blockWidth: number;
  needleUtcMs: number;
  hour12: boolean;
  index: number;
  isDragging: boolean;
  isDropTarget: boolean;
  onRemove: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
  onUpdateWorkHours: (id: string, wh: WorkHours) => void;
  onResetWorkHours: (id: string) => void;
  overlapColumns?: boolean[] | null;
  isReference?: boolean;
  onToggleReference?: (id: string) => void;
}

// ─── Boundary handle ──────────────────────────────────────────────────────────

/** Find column position for a boundary minute in local time.
 *  Uses UTC midpoints of each half-block to match the correct local wall-clock time,
 *  so handle positions stay correct regardless of myTimezone's UTC offset. */
function boundaryToCol(localMinutes: number, blocks: HourBlock[], ianaZone: string): number {
  if (blocks.length === 0) return 0;
  const target = ((localMinutes % 1440) + 1440) % 1440;

  // Walk 48 half-steps (each = 30 min of UTC), classifying by the local time at the
  // midpoint of each half-block in the row's timezone.
  let bestStep = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let halfStep = 0; halfStep <= 48; halfStep++) {
    // UTC at the start of this half-step
    const blockIdx = Math.floor(halfStep / 2);
    const halfOffset = (halfStep % 2) * 30 * 60_000; // 0 or 30 min in ms
    const utcAtStep = blocks[Math.min(blockIdx, blocks.length - 1)].utcMs + halfOffset;
    const localMins = utcMsToLocalMinutes(utcAtStep, ianaZone);
    const direct = Math.abs(localMins - target);
    const wrapped = 24 * 60 - direct;
    const distance = Math.min(direct, wrapped);
    if (distance === 0) return halfStep / 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestStep = halfStep;
    }
  }
  return bestStep / 2;
}

interface HandleProps {
  col: number;
  blockWidth: number;
  color: 'amber' | 'green';
  onPointerDown: (e: React.PointerEvent) => void;
}

function BoundaryHandle({ col, blockWidth, color, onPointerDown }: HandleProps) {
  const lineColor =
    color === 'green'
      ? 'bg-green-500/30 group-hover/bh:bg-green-500/70'
      : 'bg-amber-500/30 group-hover/bh:bg-amber-500/70';

  return (
    <div
      style={{ left: col * blockWidth }}
      className="absolute top-0 bottom-0 w-6 sm:w-3 -translate-x-3 sm:-translate-x-1.5 z-[1] cursor-ew-resize group/bh flex items-center justify-center select-none touch-none"
      onPointerDown={onPointerDown}
    >
      <div className={`w-0.5 h-full transition-colors duration-100 ${lineColor}`} />
      {/* Small drag-pill indicator at vertical center */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-5 rounded-full transition-colors duration-100 ${
          color === 'green'
            ? 'bg-green-500/40 group-hover/bh:bg-green-600/90'
            : 'bg-amber-500/40 group-hover/bh:bg-amber-500/90'
        }`}
      />
    </div>
  );
}

function formatBoundaryHour(localMinutes: number, hour12: boolean): string {
  const mins = Math.max(0, Math.min(23 * 60 + 30, localMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!hour12) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(m).padStart(2, '0')} ${suffix}`;
}

function boundaryLabel(boundary: keyof WorkHours): string {
  if (boundary === 'fringeStart') return 'Early start';
  if (boundary === 'coreStart') return 'Work start';
  if (boundary === 'coreEnd') return 'Work end';
  return 'Late end';
}

function workClassBg(cls: WorkClass): string {
  if (cls === 'core') return 'bg-[var(--color-core)]';
  if (cls === 'fringe') return 'bg-[var(--color-fringe)]';
  return 'bg-[var(--color-off)]';
}

function overlapRuns(slots: boolean[] | null | undefined): Array<{ start: number; end: number }> {
  if (!slots || slots.length === 0) return [];
  const runs: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  for (let i = 0; i <= slots.length; i++) {
    const active = i < slots.length ? slots[i] : false;
    if (active && start === null) {
      start = i;
    } else if (!active && start !== null) {
      runs.push({ start, end: i });
      start = null;
    }
  }
  return runs;
}

function utcMsToLocalMinutes(utcMs: number, ianaZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ianaZone,
  }).formatToParts(new Date(utcMs));
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24;
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return h * 60 + m;
}

// ─── TimelineRow ──────────────────────────────────────────────────────────────

export function TimelineRow({
  zone, hourBlocks, blockWidth, needleUtcMs, hour12,
  index, isDragging, isDropTarget,
  onRemove, onDragStart, onDragOver, onDrop, onDragEnd,
  onUpdateWorkHours, onResetWorkHours,
  overlapColumns = null,
  isReference = false,
  onToggleReference,
}: Props) {
  const currentTime = formatTimeInZone(needleUtcMs, zone.tz, hour12);
  const utcOffset = getUtcOffsetLabel(zone.tz, needleUtcMs);

  // Compute work class at needle time for background color
  const localParts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: zone.tz,
  }).formatToParts(new Date(needleUtcMs));
  const localHour = parseInt(localParts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24;
  const localMinute = parseInt(localParts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const localMinutes = localHour * 60 + localMinute;
  const wh = zone.workHours ?? DEFAULT_WORK_HOURS;
  const needleWorkClass = classifyMinute(localMinutes, wh);

  const infoPanelBgClass =
    needleWorkClass === 'core' ? 'bg-green-100' :
    needleWorkClass === 'fringe' ? 'bg-amber-50' :
    'bg-white';

  const timeLabelTextClass =
    needleWorkClass === 'core' ? 'text-green-900' :
    needleWorkClass === 'fringe' ? 'text-amber-900' :
    'text-slate-700';

  const timeDisplayTextClass =
    needleWorkClass === 'core' ? 'text-green-800' :
    needleWorkClass === 'fringe' ? 'text-amber-800' :
    'text-slate-900';

  // Track whether pointer started on the row-reorder grip
  const fromHandle = useRef(false);

  // Reference to the hour-blocks area for hit-testing during work-hours drag
  const blocksRef = useRef<HTMLDivElement>(null);

  // Keep a live ref so mousemove closures always see the current value
  const whRef = useRef<WorkHours>(wh);
  useEffect(() => { whRef.current = wh; });

  const [dragPreview, setDragPreview] = useState<{
    boundary: keyof WorkHours;
    localMinutes: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  // ── Work-hours boundary drag ────────────────────────────────────────────────

  const startBoundaryDrag = useCallback(
    (e: React.PointerEvent, boundary: keyof WorkHours) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      // Capture blockWidth and hourBlocks at drag-start time
      const bw = blockWidth;
      const blocks = hourBlocks;
      setDragPreview({
        boundary,
        localMinutes: whRef.current[boundary],
        clientX: e.clientX,
        clientY: e.clientY,
      });

      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        if (!blocksRef.current) return;
        const rect = blocksRef.current.getBoundingClientRect();
        const px = Math.max(0, Math.min(ev.clientX - rect.left, bw * 24 - 1));
        const colFloat = px / bw;
        const halfStep = Math.max(0, Math.min(48, Math.round(colFloat * 2)));
        // Derive local minutes from the UTC time at this half-step position
        const blockIdx = Math.min(Math.floor(halfStep / 2), blocks.length - 1);
        const halfOffset = (halfStep % 2) * 30 * 60_000;
        const utcAtStep = (blocks[blockIdx]?.utcMs ?? 0) + halfOffset;
        const candidateMinutes = utcMsToLocalMinutes(utcAtStep, zone.tz);

        const cur = whRef.current;
        const next = { ...cur };

        if (boundary === 'fringeStart') {
          next.fringeStart = Math.max(0, Math.min(candidateMinutes, cur.coreStart - 30));
        } else if (boundary === 'coreStart') {
          next.coreStart = Math.max(cur.fringeStart + 30, Math.min(candidateMinutes, cur.coreEnd - 30));
        } else if (boundary === 'coreEnd') {
          next.coreEnd = Math.max(cur.coreStart + 30, Math.min(candidateMinutes, cur.fringeEnd - 30));
        } else if (boundary === 'fringeEnd') {
          next.fringeEnd = Math.max(cur.coreEnd + 30, Math.min(candidateMinutes, 23 * 60 + 30));
        }

        setDragPreview({
          boundary,
          localMinutes: next[boundary],
          clientX: ev.clientX,
          clientY: ev.clientY,
        });
        onUpdateWorkHours(zone.id, next);
      };

      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        setDragPreview(null);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [blockWidth, hourBlocks, zone.id, onUpdateWorkHours],
  );

  // Pre-compute handle column positions
  const fringeStartCol = boundaryToCol(wh.fringeStart, hourBlocks, zone.tz);
  const coreStartCol = boundaryToCol(wh.coreStart, hourBlocks, zone.tz);
  const coreEndCol = boundaryToCol(wh.coreEnd, hourBlocks, zone.tz);
  const fringeEndCol = boundaryToCol(wh.fringeEnd, hourBlocks, zone.tz);

  const hasCustomWorkHours = zone.workHours !== undefined;
  const overlapSlotRuns = overlapRuns(overlapColumns);

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          if (!fromHandle.current) { e.preventDefault(); return; }
          const ghost = document.createElement('div');
          ghost.style.cssText = 'width:1px;height:1px;opacity:0;position:fixed;top:-9999px';
          document.body.appendChild(ghost);
          e.dataTransfer.setDragImage(ghost, 0, 0);
          setTimeout(() => document.body.removeChild(ghost), 0);
          onDragStart(index);
        }}
        onDragOver={(e) => onDragOver(e, index)}
        onDrop={() => onDrop(index)}
        onDragEnd={onDragEnd}
        className={[
          'flex items-stretch border-b border-slate-100 last:border-b-0 group transition-all duration-150',
          isDragging ? 'opacity-40' : 'opacity-100',
          isDropTarget ? 'border-t-2 border-t-blue-400' : '',
          !isDragging ? 'hover:bg-slate-50/60' : '',
        ].join(' ')}
      >
        {/* Info panel */}
        <div className={`flex items-center gap-2 px-2 sm:px-3 py-3 sm:py-4 ${infoPanelBgClass} border-r border-slate-100 shrink-0 w-44 sm:w-72 sticky left-0 z-[40] ${isReference ? 'border-l-4 border-l-indigo-400' : ''}`}>
        {/* Row-reorder drag grip */}
        <div
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0 touch-none"
          onMouseDown={() => { fromHandle.current = true; }}
          onMouseUp={() => { fromHandle.current = false; }}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <button
          type="button"
          onClick={() => onToggleReference?.(zone.id)}
          className="flex flex-1 min-w-0 items-center gap-2 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          title="Click to compare overlaps from this location"
        >
          <span className="text-2xl leading-none select-none" aria-hidden="true">{zone.flag}</span>

          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm ${timeLabelTextClass} truncate leading-tight`}>{zone.label}</div>
            {zone.person && (
              <div className="text-xs text-slate-500 truncate mt-0.5">{zone.person}</div>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-base font-bold ${timeDisplayTextClass} tabular-nums`}>{currentTime}</span>
              <span className="text-xs text-slate-500 font-medium">{utcOffset}</span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {hasCustomWorkHours && (
            <button
              onClick={() => onResetWorkHours(zone.id)}
              aria-label={`Reset work hours for ${zone.label}`}
              title="Reset to default work hours"
              className="p-2 sm:p-1.5 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors duration-200"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-2" />
            </button>
          )}
          <button
            onClick={() => onRemove(zone.id)}
            aria-label={`Remove ${zone.label}`}
            className="transition-opacity p-2 sm:p-1.5 rounded-md hover:bg-red-50 hover:text-red-500 text-slate-300 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

        {/* Hour blocks + boundary handles */}
        <div ref={blocksRef} className="relative flex h-[60px] sm:h-[72px]">
        {hourBlocks.map((block, colIndex) => (
          // Paint each hour block in two 30-minute halves so boundaries
          // at :30 start exactly at the handle location.
          (() => {
            const leftClass = classifyMinute(utcMsToLocalMinutes(block.utcMs + 15 * 60_000, zone.tz), wh);
            const rightClass = classifyMinute(utcMsToLocalMinutes(block.utcMs + 45 * 60_000, zone.tz), wh);
            return (
          <div
            key={`${block.utcMs}-${colIndex}`}
            style={{ width: blockWidth, minWidth: blockWidth }}
            className="hour-block relative bg-[var(--color-off)]"
            title={`${String(Math.floor(block.localMinutes / 60)).padStart(2, '0')}:${String(block.localMinutes % 60).padStart(2, '0')} local`}
          >
            <div className={`absolute inset-y-0 left-0 w-1/2 ${workClassBg(leftClass)}`} />
            <div className={`absolute inset-y-0 right-0 w-1/2 ${workClassBg(rightClass)}`} />
          </div>
            );
          })()
        ))}

        {overlapSlotRuns.map((run, idx) => (
          <div
            key={`overlap-run-${idx}`}
            className="hour-block-overlap absolute"
            style={{
              left: `${(run.start / 2) * blockWidth}px`,
              width: `${((run.end - run.start) / 2) * blockWidth}px`,
            }}
          />
        ))}

        {/* Fringe-start handle (amber) */}
        <BoundaryHandle
          col={fringeStartCol}
          blockWidth={blockWidth}
          color="amber"
          onPointerDown={(e) => startBoundaryDrag(e, 'fringeStart')}
        />
        {/* Core-start handle (green) */}
        <BoundaryHandle
          col={coreStartCol}
          blockWidth={blockWidth}
          color="green"
          onPointerDown={(e) => startBoundaryDrag(e, 'coreStart')}
        />
        {/* Core-end handle (green) */}
        <BoundaryHandle
          col={coreEndCol}
          blockWidth={blockWidth}
          color="green"
          onPointerDown={(e) => startBoundaryDrag(e, 'coreEnd')}
        />
        {/* Fringe-end handle (amber) */}
        <BoundaryHandle
          col={fringeEndCol}
          blockWidth={blockWidth}
          color="amber"
          onPointerDown={(e) => startBoundaryDrag(e, 'fringeEnd')}
        />
        </div>
      </div>
      {dragPreview &&
        createPortal(
          <div
            role="tooltip"
            aria-live="polite"
            style={{
              position: 'fixed',
              left: dragPreview.clientX,
              top: dragPreview.clientY + 18,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
            className="bg-slate-900 text-white rounded-md shadow-xl px-2.5 py-1.5 border border-slate-700"
          >
            <div className="text-[10px] text-slate-300 leading-none mb-1">
              {boundaryLabel(dragPreview.boundary)}
            </div>
            <div className="text-xs font-semibold tabular-nums leading-none">
              {formatBoundaryHour(dragPreview.localMinutes, hour12)}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
