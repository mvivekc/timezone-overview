import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface TzOption {
  tz: string;
  label: string;
  flag: string;
  country?: string; // e.g. "Germany" so typing "ger" finds Berlin
}

export interface TzGroup {
  group: string;
  zones: TzOption[];
}

interface Props {
  groups: TzGroup[];
  value: string;
  onChange: (tz: string) => void;
  placeholder?: string;
  className?: string;
  /** Extra options injected above the groups (e.g. browser-detected TZ) */
  extraOptions?: TzOption[];
  triggerClassName?: string;
}

export function SearchableSelect({
  groups,
  value,
  onChange,
  placeholder = 'Search timezone…',
  className = '',
  extraOptions = [],
  triggerClassName = '',
}: Props) {
  const allZones: TzOption[] = [...extraOptions, ...groups.flatMap((g) => g.zones)];
  const selected = allZones.find((z) => z.tz === value);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setQuery('');
    // Let DOM settle then focus
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSelect = (tz: string) => {
    onChange(tz);
    setOpen(false);
    setQuery('');
  };

  const q = query.toLowerCase().trim();
  const filtered = q
    ? allZones.filter(
        (z) =>
          z.label.toLowerCase().includes(q) ||
          z.tz.toLowerCase().includes(q) ||
          (z.country?.toLowerCase().includes(q) ?? false),
      )
    : null;

  // Show a "use as custom IANA" row when query looks like a tz and isn't in the list
  const rawQuery = query.trim();
  const showCustomIana =
    q &&
    rawQuery.includes('/') &&
    !allZones.find((z) => z.tz.toLowerCase() === rawQuery.toLowerCase());

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Closed state: button trigger */}
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          className={`flex items-center gap-1.5 w-full px-3 text-sm rounded-md border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 truncate ${triggerClassName}`}
        >
          {selected ? (
            <span className="flex-1 text-left truncate">
              {selected.flag} {selected.label}
            </span>
          ) : (
            <span className="flex-1 text-left text-slate-400">{placeholder}</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
        </button>
      ) : (
        /* Open state: search input replaces trigger */
        <div className="flex items-center gap-1.5 w-full px-3 rounded-md border border-blue-500 bg-white ring-2 ring-blue-500/20" style={{ height: 'inherit' }}>
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setOpen(false); setQuery(''); }
              if (e.key === 'Enter' && filtered?.length === 1) handleSelect(filtered[0].tz);
              if (e.key === 'Enter' && filtered?.length === 0 && showCustomIana) handleSelect(rawQuery);
            }}
            placeholder={selected ? `${selected.flag} ${selected.label}` : placeholder}
            className="flex-1 text-sm bg-transparent outline-none py-1.5"
            autoFocus
          />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filtered ? (
            <>
              {filtered.length === 0 && !showCustomIana && (
                <div className="px-3 py-2 text-sm text-slate-400">
                  No results — try an IANA id like <span className="font-mono">America/Chicago</span>
                </div>
              )}
              {filtered.map((z) => (
                <OptionRow key={z.tz} option={z} active={z.tz === value} onSelect={handleSelect} />
              ))}
              {showCustomIana && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(rawQuery); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-slate-50 text-slate-500 border-t border-slate-100"
                >
                  <span>🌐</span>
                  <span>Use <span className="font-mono text-slate-700">{rawQuery}</span> as IANA timezone</span>
                </button>
              )}
            </>
          ) : (
            <>
              {extraOptions.length > 0 && (
                <GroupSection label="Detected" zones={extraOptions} value={value} onSelect={handleSelect} />
              )}
              {groups.map((g) => (
                <GroupSection key={g.group} label={g.group} zones={g.zones} value={value} onSelect={handleSelect} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GroupSection({
  label,
  zones,
  value,
  onSelect,
}: {
  label: string;
  zones: TzOption[];
  value: string;
  onSelect: (tz: string) => void;
}) {
  return (
    <div>
      <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 sticky top-0">
        {label}
      </div>
      {zones.map((z) => (
        <OptionRow key={z.tz} option={z} active={z.tz === value} onSelect={onSelect} />
      ))}
    </div>
  );
}

function OptionRow({
  option,
  active,
  onSelect,
}: {
  option: TzOption;
  active: boolean;
  onSelect: (tz: string) => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onSelect(option.tz); }}
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-slate-50 ${
        active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
      }`}
    >
      <span>{option.flag}</span>
      <span className="truncate">{option.label}</span>
    </button>
  );
}
