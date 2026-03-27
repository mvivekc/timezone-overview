import { useRef, useCallback, useEffect } from 'react';
import { X, GripVertical, RotateCcw } from 'lucide-react';
import type { Zone, HourBlock, WorkHours, WorkClass } from '@/types';
import { DEFAULT_WORK_HOURS } from '@/utils/constants';
import { formatTimeInZone, getUtcOffsetLabel, classifyHour } from '@/utils/timezones';

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
}

// ─── Boundary handle ──────────────────────────────────────────────────────────

/** Find the column (0-23) whose left edge is the best position for a boundary hour */
function boundaryToCol(hour: number, blocks: HourBlock[]): number {
  const idx = blocks.findIndex((b) => b.hour === hour);
  if (idx >= 0) return idx;
  // DST gap: find first column whose local hour exceeds the boundary
  const next = blocks.findIndex((b) => b.hour > hour);
  return next >= 0 ? next : blocks.length;
}

interface HandleProps {
  col: number;
  blockWidth: number;
  color: 'amber' | 'green';
  onMouseDown: (e: React.MouseEvent) => void;
}

function BoundaryHandle({ col, blockWidth, color, onMouseDown }: HandleProps) {
  const lineColor =
    color === 'green'
      ? 'bg-green-500/30 group-hover/bh:bg-green-500/70'
      : 'bg-amber-500/30 group-hover/bh:bg-amber-500/70';

  return (
    <div
      style={{ left: col * blockWidth }}
      className="absolute top-0 bottom-0 w-3 -translate-x-1.5 z-10 cursor-ew-resize group/bh flex items-center justify-center select-none"
      onMouseDown={onMouseDown}
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

// ─── TimelineRow ──────────────────────────────────────────────────────────────

export function TimelineRow({
  zone, hourBlocks, blockWidth, needleUtcMs, hour12,
  index, isDragging, isDropTarget,
  onRemove, onDragStart, onDragOver, onDrop, onDragEnd,
  onUpdateWorkHours, onResetWorkHours,
}: Props) {
  const currentTime = formatTimeInZone(needleUtcMs, zone.tz, hour12);
  const utcOffset = getUtcOffsetLabel(zone.tz, needleUtcMs);

  // Compute work class at needle time for background color
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: zone.tz }).format(
      new Date(needleUtcMs)
    ),
    10
  );
  const wh = zone.workHours ?? DEFAULT_WORK_HOURS;
  const needleWorkClass = classifyHour(localHour, wh);

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

  // ── Work-hours boundary drag ────────────────────────────────────────────────

  const startBoundaryDrag = useCallback(
    (e: React.MouseEvent, boundary: keyof WorkHours) => {
      e.preventDefault();
      e.stopPropagation();

      // Capture blockWidth and hourBlocks at drag-start time
      const bw = blockWidth;
      const blocks = hourBlocks;

      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent) => {
        if (!blocksRef.current) return;
        const rect = blocksRef.current.getBoundingClientRect();
        const px = Math.max(0, ev.clientX - rect.left);
        const col = Math.min(23, Math.floor(px / bw));
        const newHour = blocks[col]?.hour ?? col;

        const cur = whRef.current;
        const next = { ...cur };

        if (boundary === 'fringeStart') {
          next.fringeStart = Math.max(0, Math.min(newHour, cur.coreStart - 1));
        } else if (boundary === 'coreStart') {
          next.coreStart = Math.max(cur.fringeStart + 1, Math.min(newHour, cur.coreEnd - 1));
        } else if (boundary === 'coreEnd') {
          next.coreEnd = Math.max(cur.coreStart + 1, Math.min(newHour, cur.fringeEnd - 1));
        } else if (boundary === 'fringeEnd') {
          next.fringeEnd = Math.max(cur.coreEnd + 1, Math.min(newHour, 23));
        }

        onUpdateWorkHours(zone.id, next);
      };

      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [blockWidth, hourBlocks, zone.id, onUpdateWorkHours],
  );

  // Pre-compute handle column positions
  const fringeStartCol = boundaryToCol(wh.fringeStart, hourBlocks);
  const coreStartCol = boundaryToCol(wh.coreStart, hourBlocks);
  const coreEndCol = boundaryToCol(wh.coreEnd, hourBlocks);
  const fringeEndCol = boundaryToCol(wh.fringeEnd, hourBlocks);

  const hasCustomWorkHours = zone.workHours !== undefined;

  return (
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
      <div className={`flex items-center gap-2 px-3 py-4 ${infoPanelBgClass} border-r border-slate-100 shrink-0 w-56`}>
        {/* Row-reorder drag grip */}
        <div
          className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0 touch-none"
          onMouseDown={() => { fromHandle.current = true; }}
          onMouseUp={() => { fromHandle.current = false; }}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <span className="text-2xl leading-none select-none" aria-hidden="true">{zone.flag}</span>

        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm ${timeLabelTextClass} truncate leading-tight`}>{zone.label}</div>
          {zone.person && (
            <div className="text-xs text-slate-500 truncate mt-0.5">{zone.person}</div>
          )}
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-base font-bold ${timeDisplayTextClass} tabular-nums`}>{currentTime}</span>
            <span className="text-xs text-slate-500 font-medium">{utcOffset}</span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Per-zone reset — only visible when zone has custom work hours */}
          {hasCustomWorkHours && (
            <button
              onClick={() => onResetWorkHours(zone.id)}
              aria-label={`Reset work hours for ${zone.label}`}
              title="Reset to default work hours"
              className="p-1.5 rounded-md hover:bg-amber-50 hover:text-amber-600 text-slate-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => onRemove(zone.id)}
            aria-label={`Remove ${zone.label}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-50 hover:text-red-500 text-slate-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hour blocks + boundary handles */}
      <div ref={blocksRef} className="relative flex h-[72px]">
        {hourBlocks.map((block) => (
          <div
            key={block.hour}
            style={{ width: blockWidth, minWidth: blockWidth }}
            className={`hour-block ${block.workClass}`}
            title={`${String(block.hour).padStart(2, '0')}:00 local`}
          />
        ))}

        {/* Fringe-start handle (amber) */}
        <BoundaryHandle
          col={fringeStartCol}
          blockWidth={blockWidth}
          color="amber"
          onMouseDown={(e) => startBoundaryDrag(e, 'fringeStart')}
        />
        {/* Core-start handle (green) */}
        <BoundaryHandle
          col={coreStartCol}
          blockWidth={blockWidth}
          color="green"
          onMouseDown={(e) => startBoundaryDrag(e, 'coreStart')}
        />
        {/* Core-end handle (green) */}
        <BoundaryHandle
          col={coreEndCol}
          blockWidth={blockWidth}
          color="green"
          onMouseDown={(e) => startBoundaryDrag(e, 'coreEnd')}
        />
        {/* Fringe-end handle (amber) */}
        <BoundaryHandle
          col={fringeEndCol}
          blockWidth={blockWidth}
          color="amber"
          onMouseDown={(e) => startBoundaryDrag(e, 'fringeEnd')}
        />
      </div>
    </div>
  );
}
