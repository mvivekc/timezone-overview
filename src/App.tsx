import { useReducer, useEffect, useCallback, useState } from 'react';
import type { AppState, AppAction, Zone, WorkHours } from './types';
import { loadFromStorage, saveToStorage } from './utils/storage';
import { todayString } from './utils/timezones';
import { ZONE_WARNING_THRESHOLD } from './utils/constants';
import { Header } from './components/Header';
import { TimelineGrid } from './components/TimelineGrid';
import { AddTimezoneModal } from './components/AddTimezoneModal';
import { AlertTriangle, X, RotateCcw } from 'lucide-react';

// ─── Reducer ─────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_NEEDLE':
      return { ...state, needleUtcMs: action.payload, isLive: false };
    case 'SET_LIVE':
      return {
        ...state,
        isLive: action.payload,
        needleUtcMs: action.payload ? Date.now() : state.needleUtcMs,
        selectedDate: action.payload ? todayString() : state.selectedDate,
      };
    case 'SET_DATE':
      return { ...state, selectedDate: action.payload };
    case 'ADD_ZONE':
      return { ...state, zones: [...state.zones, action.payload] };
    case 'REMOVE_ZONE':
      return { ...state, zones: state.zones.filter((z) => z.id !== action.payload) };
    case 'DISMISS_WARNING':
      return { ...state, dismissedWarning: true };
    case 'REORDER_ZONES':
      return { ...state, zones: action.payload };
    case 'SET_HOUR12':
      return { ...state, hour12: action.payload };
    case 'SET_MY_TZ':
      // Switching timezone snaps needle to current time in the new reference
      return { ...state, myTimezone: action.payload, isLive: true, needleUtcMs: Date.now() };
    case 'SET_ZONE_WORK_HOURS':
      return {
        ...state,
        zones: state.zones.map((z) =>
          z.id === action.payload.id ? { ...z, workHours: action.payload.workHours } : z,
        ),
      };
    case 'RESET_ZONE_WORK_HOURS':
      return {
        ...state,
        zones: state.zones.map((z) => {
          if (z.id !== action.payload) return z;
          const { workHours: _dropped, ...rest } = z;
          return rest;
        }),
      };
    case 'RESET_ALL_WORK_HOURS':
      return {
        ...state,
        zones: state.zones.map(({ workHours: _dropped, ...rest }) => rest),
      };
    default:
      return state;
  }
}

function buildInitialState(): AppState {
  const stored = loadFromStorage();
  // Always prefer the browser's actual IANA timezone as the default reference.
  // A previously-saved preference overrides only if it's a non-empty string.
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const myTimezone = stored.preferences.myTimezone || browserTz;
  return {
    zones: stored.zones,
    selectedDate: stored.preferences.selectedDate ?? todayString(),
    needleUtcMs: Date.now(),
    isLive: stored.preferences.isLive ?? true,
    dismissedWarning: false,
    hour12: stored.preferences.hour12 ?? false,
    myTimezone,
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReferenceZoneId, setSelectedReferenceZoneId] = useState<string | null>(null);

  // Live mode tick
  useEffect(() => {
    if (!state.isLive) return;
    const id = setInterval(() => dispatch({ type: 'SET_LIVE', payload: true }), 30_000);
    return () => clearInterval(id);
  }, [state.isLive]);

  // Persist on every relevant change
  useEffect(() => {
    saveToStorage(state.zones, state.selectedDate, state.isLive, state.hour12, state.myTimezone);
  }, [state.zones, state.selectedDate, state.isLive, state.hour12, state.myTimezone]);

  const handleNeedleChange = useCallback((utcMs: number) => {
    dispatch({ type: 'SET_NEEDLE', payload: utcMs });
  }, []);

  const handleGoLive = useCallback(() => dispatch({ type: 'SET_LIVE', payload: true }), []);
  const handleExitLive = useCallback(() => dispatch({ type: 'SET_LIVE', payload: false }), []);
  const handleDateChange = useCallback((d: string) => dispatch({ type: 'SET_DATE', payload: d }), []);
  const handleSetHour12 = useCallback((v: boolean) => dispatch({ type: 'SET_HOUR12', payload: v }), []);
  const handleSetMyTz = useCallback((tz: string) => dispatch({ type: 'SET_MY_TZ', payload: tz }), []);

  const handleTimeInput = useCallback((utcMs: number) => {
    dispatch({ type: 'SET_NEEDLE', payload: utcMs });
  }, []);

  const handleAddZone = useCallback((zone: Zone) => {
    dispatch({ type: 'ADD_ZONE', payload: zone });
  }, []);

  const handleRemoveZone = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ZONE', payload: id });
  }, []);

  const handleReorderZones = useCallback((zones: Zone[]) => {
    dispatch({ type: 'REORDER_ZONES', payload: zones });
  }, []);

  const handleUpdateZoneWorkHours = useCallback((id: string, wh: WorkHours) => {
    dispatch({ type: 'SET_ZONE_WORK_HOURS', payload: { id, workHours: wh } });
  }, []);

  const handleResetZoneWorkHours = useCallback((id: string) => {
    dispatch({ type: 'RESET_ZONE_WORK_HOURS', payload: id });
  }, []);

  const handleResetAllWorkHours = useCallback(() => {
    dispatch({ type: 'RESET_ALL_WORK_HOURS' });
  }, []);

  const handleToggleReferenceZone = useCallback((id: string) => {
    setSelectedReferenceZoneId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!selectedReferenceZoneId) return;
    const stillExists = state.zones.some((zone) => zone.id === selectedReferenceZoneId);
    if (!stillExists) setSelectedReferenceZoneId(null);
  }, [state.zones, selectedReferenceZoneId]);

  const showWarning = !state.dismissedWarning && state.zones.length > ZONE_WARNING_THRESHOLD;
  const hasCustomWorkHours = state.zones.some((z) => z.workHours !== undefined);

  return (
    <>
      <title>Timezone Helper</title>

      <div className="min-h-screen bg-slate-100 flex flex-col">
        <Header
          selectedDate={state.selectedDate}
          isLive={state.isLive}
          hour12={state.hour12}
          myTimezone={state.myTimezone}
          needleUtcMs={state.needleUtcMs}
          onDateChange={handleDateChange}
          onGoLive={handleGoLive}
          onSetHour12={handleSetHour12}
          onSetMyTz={handleSetMyTz}
          onTimeInput={handleTimeInput}
          onAddZone={() => setModalOpen(true)}
        />

        <main className="flex-1 w-full px-5 py-5 flex flex-col gap-4">

          {showWarning && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              <span>
                You have <strong>{state.zones.length}</strong> timezones — horizontal scrolling may be needed on smaller screens.
              </span>
              <button
                onClick={() => dispatch({ type: 'DISMISS_WARNING' })}
                className="ml-auto p-0.5 rounded hover:bg-amber-100 text-amber-600"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-5 px-1 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3.5 h-3.5 rounded-sm bg-[var(--color-core)] border border-[var(--color-core-border)]" />
              Working hours (default 9–18)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3.5 h-3.5 rounded-sm bg-[var(--color-fringe)] border border-[var(--color-fringe-border)]" />
              Early / late (default 7–9, 18–20)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3.5 h-3.5 rounded-sm bg-slate-200 border border-slate-300" />
              Off hours
            </span>
            <div className="ml-auto flex items-center gap-3">
              {hasCustomWorkHours && (
                <button
                  onClick={handleResetAllWorkHours}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                  title="Reset all per-zone work hours to global defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset all work hours
                </button>
              )}
              <span className="text-xs text-slate-400 hidden sm:block">
                Drag the coloured handles on each row to adjust work hours · Drag the blue bar to explore times
              </span>
            </div>
          </div>

          {/* Timeline */}
          {state.zones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
              <p className="text-lg">No timezones yet</p>
              <button
                onClick={() => setModalOpen(true)}
                className="text-sm text-blue-600 hover:underline focus:outline-none"
              >
                + Add your first timezone
              </button>
            </div>
          ) : (
            <>
              <TimelineGrid
                zones={state.zones}
                selectedDate={state.selectedDate}
                needleUtcMs={state.needleUtcMs}
                isLive={state.isLive}
                hour12={state.hour12}
                myTimezone={state.myTimezone}
                selectedReferenceZoneId={selectedReferenceZoneId}
                onRemoveZone={handleRemoveZone}
                onReorderZones={handleReorderZones}
                onNeedleChange={handleNeedleChange}
                onExitLive={handleExitLive}
                onUpdateZoneWorkHours={handleUpdateZoneWorkHours}
                onResetZoneWorkHours={handleResetZoneWorkHours}
                onToggleReferenceZone={handleToggleReferenceZone}
              />
            </>
          )}
        </main>

        <AddTimezoneModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onAdd={handleAddZone}
        />
      </div>
    </>
  );
}
