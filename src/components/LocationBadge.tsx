import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, ChevronDown, History } from 'lucide-react';

const LocationMiniMap = lazy(() => import('./LocationMiniMap'));

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  status: 'locating' | 'ok' | 'error';
  /** true = súradnice sú z poslednej známej polohy (GPS práve zlyhal/nedostupný) */
  stale?: boolean;
  errorMessage?: string;
}

interface Props {
  onChange: (loc: LocationState) => void;
}

type Quality = 'excellent' | 'good' | 'fair' | 'poor';

function getQuality(accuracy: number): Quality {
  if (accuracy <= 10) return 'excellent';
  if (accuracy <= 25) return 'good';
  if (accuracy <= 50) return 'fair';
  return 'poor';
}

const QUALITY_META: Record<
  Quality,
  { label: string; hint: string; color: string; textClass: string; bg: string }
> = {
  excellent: {
    label: 'Presná poloha',
    hint: 'GPS signál je vynikajúci',
    color: '#16a34a',
    textClass: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950',
  },
  good: {
    label: 'Dobrá presnosť',
    hint: 'GPS signál je v poriadku',
    color: '#059669',
    textClass: 'text-[rgb(var(--brand-700))] dark:text-[rgb(var(--brand-400))]',
    bg: 'bg-[rgb(var(--brand-50))] dark:bg-[rgb(var(--brand-950))]',
  },
  fair: {
    label: 'Približná poloha',
    hint: 'Skús prejsť na otvorené priestranstvo',
    color: '#d97706',
    textClass: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950',
  },
  poor: {
    label: 'Slabý GPS signál',
    hint: 'Poloha nemusí byť presná - počkaj chvíľu',
    color: '#dc2626',
    textClass: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950',
  },
};

/** Vizuálny "radar" indikátor - pulzujúce kruhy okolo bodky namiesto
 *  vypisovania surových súradníc. Farba/rýchlosť signalizuje kvalitu GPS. */
function RadarPulse({ color }: { color: string }) {
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <span
        className="absolute h-full w-full animate-[radar-ping_2s_ease-out_infinite] rounded-full"
        style={{ backgroundColor: color }}
      />
      <span
        className="absolute h-full w-full animate-[radar-ping_2s_ease-out_infinite] rounded-full"
        style={{ backgroundColor: color, animationDelay: '0.7s' }}
      />
      <span className="relative h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900" style={{ backgroundColor: color }} />
    </div>
  );
}

const LAST_KNOWN_KEY = 'vlcince-last-known-position';

/** Zobrazuje a priebežne sleduje GPS polohu (watchPosition – presnejšie ako
 *  jednorazový getCurrentPosition, najmä pod strechami stromov v teréne).
 *  Ak GPS zlyhá, appka namiesto zablokovania zberu ponúkne poslednú známu
 *  polohu (uloženú v tomto zariadení) s jasným upozornením, že je "stale". */
export default function LocationBadge({ onChange }: Props) {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    status: 'locating',
  });
  const [showCoords, setShowCoords] = useState(false);
  const lastKnownRef = useRef<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_KNOWN_KEY);
      if (raw) lastKnownRef.current = JSON.parse(raw);
    } catch {
      // ignoruj poškodené dáta v localStorage
    }
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      const errState: LocationState = {
        latitude: null,
        longitude: null,
        accuracy: null,
        status: 'error',
        errorMessage: 'Prehliadač nepodporuje geolokáciu',
      };
      setState(errState);
      onChange(errState);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next: LocationState = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          status: 'ok',
        };
        setState(next);
        onChange(next);
        lastKnownRef.current = { latitude: next.latitude!, longitude: next.longitude!, accuracy: next.accuracy! };
        try {
          localStorage.setItem(LAST_KNOWN_KEY, JSON.stringify(lastKnownRef.current));
        } catch {
          // localStorage môže byť plné/zakázané - nič sa nedeje, len sa nebude cachovať
        }
      },
      (err) => {
        // GPS zlyhal - ak máme poslednú známu polohu z tohto zariadenia, použi ju
        // (s jasným upozornením), namiesto úplného zablokovania zberu.
        if (lastKnownRef.current) {
          const next: LocationState = {
            latitude: lastKnownRef.current.latitude,
            longitude: lastKnownRef.current.longitude,
            accuracy: lastKnownRef.current.accuracy,
            status: 'ok',
            stale: true,
            errorMessage: err.message,
          };
          setState(next);
          onChange(next);
        } else {
          const next: LocationState = {
            latitude: null,
            longitude: null,
            accuracy: null,
            status: 'error',
            errorMessage: err.message,
          };
          setState(next);
          onChange(next);
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onChange]);

  if (state.status === 'locating') {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Zisťujem polohu…</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Chvíľu strpenia, hľadám GPS signál</p>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-50 px-3 py-2.5 dark:bg-red-950">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-red-700 dark:text-red-300">Poloha nedostupná</p>
          <p className="text-xs text-red-500 dark:text-red-400">{state.errorMessage}</p>
        </div>
      </div>
    );
  }

  if (state.stale) {
    return (
      <div className="rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-950">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
            <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Poloha nedostupná</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">Používa sa posledná známa poloha z tohto zariadenia</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCoords((v) => !v)}
            className="shrink-0 rounded-full p-1.5 text-amber-500 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Zobraziť súradnice"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showCoords ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {showCoords && (
          <div className="mt-2 border-t border-black/5 pt-2 text-center font-mono text-[11px] text-amber-600 dark:border-white/10 dark:text-amber-500">
            {state.latitude?.toFixed(6)}, {state.longitude?.toFixed(6)}
          </div>
        )}

        {state.latitude && state.longitude && (
          <div className="mt-2">
            <Suspense fallback={<div className="h-28 w-full animate-pulse rounded-xl bg-amber-100 dark:bg-amber-900" />}>
              <LocationMiniMap latitude={state.latitude} longitude={state.longitude} accuracyColor="#d97706" />
            </Suspense>
          </div>
        )}
      </div>
    );
  }

  const quality = getQuality(state.accuracy ?? 999);
  const meta = QUALITY_META[quality];

  return (
    <div className={`rounded-xl px-3 py-2.5 ${meta.bg}`}>
      <div className="flex items-center gap-3">
        <RadarPulse color={meta.color} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${meta.textClass}`}>
            {meta.label}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {meta.hint} · presnosť ± {Math.round(state.accuracy ?? 0)} m
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCoords((v) => !v)}
          className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Zobraziť súradnice"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showCoords ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showCoords && (
        <div className="mt-2 border-t border-black/5 pt-2 text-center font-mono text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">
          {state.latitude?.toFixed(6)}, {state.longitude?.toFixed(6)}
        </div>
      )}

      {state.latitude && state.longitude && (
        <div className="mt-2">
          <Suspense fallback={<div className="h-28 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />}>
            <LocationMiniMap latitude={state.latitude} longitude={state.longitude} accuracyColor={meta.color} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
