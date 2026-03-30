import { hourRulerLabel } from '@/utils/timezones';

interface Props {
  blockWidth: number;
  hour12: boolean;
  myTimezone: string;
  infoPanelWidth: number;
}

export function HourRuler({ blockWidth, hour12, myTimezone, infoPanelWidth }: Props) {
  const tzLabel = myTimezone.replace(/_/g, ' ');

  return (
    <div className="flex sticky top-0 bg-slate-50 border-b border-slate-200" style={{ zIndex: 31 }}>
      {/* Spacer aligned with the info panel */}
      <div style={{ width: infoPanelWidth, zIndex: 40 }} className="shrink-0 flex items-center px-3 sticky left-0 bg-slate-50">
        <span className="text-[11px] text-slate-500 font-medium truncate">
          00-23 in {tzLabel}
        </span>
      </div>

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
