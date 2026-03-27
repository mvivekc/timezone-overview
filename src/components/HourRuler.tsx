import { hourRulerLabel } from '@/utils/timezones';

interface Props {
  blockWidth: number;
  hour12: boolean;
}

export function HourRuler({ blockWidth, hour12 }: Props) {
  return (
    <div className="flex sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
      {/* Spacer aligned with the info panel (w-56 = 224px) */}
      <div className="w-56 shrink-0" />

      {/* 24 hour labels */}
      <div className="flex">
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            style={{ width: blockWidth, minWidth: blockWidth }}
            className="text-center text-xs text-slate-400 font-medium py-2 border-r border-slate-200 select-none"
          >
            {hourRulerLabel(h, hour12)}
          </div>
        ))}
      </div>
    </div>
  );
}
