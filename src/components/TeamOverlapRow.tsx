import { Users } from 'lucide-react';

interface Props {
  blockWidth: number;
  overlapColumns: boolean[];
  durationMinutes: number;
  infoPanelWidth: number;
}

function overlapRuns(slots: boolean[]): Array<{ start: number; end: number }> {
  if (!slots.length) return [];
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

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function TeamOverlapRow({ blockWidth, overlapColumns, durationMinutes, infoPanelWidth }: Props) {
  const runs = overlapRuns(overlapColumns);

  return (
    <div className="flex items-stretch border-t-2 border-slate-200 bg-slate-50/70">
      <div style={{ width: infoPanelWidth }} className="flex items-center gap-2 px-3 py-2 border-r border-slate-200 shrink-0 sticky left-0 z-[40] bg-slate-50">
        <Users className="w-4 h-4 text-indigo-600 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">Team Overlap</div>
          <div className="text-xs text-slate-600">{formatDuration(durationMinutes)}</div>
        </div>
      </div>

      <div className="relative flex h-8">
        {Array.from({ length: 24 }, (_, colIndex) => (
          <div
            key={colIndex}
            style={{ width: blockWidth, minWidth: blockWidth }}
            className="border-r border-slate-200/80 bg-transparent relative"
          />
        ))}
        {runs.map((run, idx) => (
          <div
            key={`team-overlap-${idx}`}
            className="absolute inset-y-0 bg-indigo-200/80"
            style={{
              left: `${(run.start / 2) * blockWidth}px`,
              width: `${((run.end - run.start) / 2) * blockWidth}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
