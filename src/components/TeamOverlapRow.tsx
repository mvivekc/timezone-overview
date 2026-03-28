import { Users } from 'lucide-react';

interface Props {
  blockWidth: number;
  overlapColumns: boolean[];
  durationMinutes: number;
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function TeamOverlapRow({ blockWidth, overlapColumns, durationMinutes }: Props) {
  return (
    <div className="flex items-stretch border-t-2 border-slate-200 bg-slate-50/70">
      <div className="flex items-center gap-2 px-3 py-2 border-r border-slate-200 shrink-0 w-56">
        <Users className="w-4 h-4 text-indigo-600 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">Team Overlap</div>
          <div className="text-xs text-slate-600">{formatDuration(durationMinutes)}</div>
        </div>
      </div>

      <div className="relative flex h-8">
        {overlapColumns.map((isOverlap, colIndex) => (
          <div
            key={colIndex}
            style={{ width: blockWidth, minWidth: blockWidth }}
            className="border-r border-slate-200/80 bg-transparent relative"
          >
            {isOverlap && (
              <div className="absolute inset-0 bg-indigo-200/80" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
