import { Suspense, lazy, useState } from 'react';
import { TreePine, LogIn, UserPlus, Loader2, Moon, Sun, MapPin, ClipboardList, Users } from 'lucide-react';
import { useTheme } from '../lib/theme';
import AuthForm from './AuthForm';
import type { AssetRecord } from '../types';
import { APP_VERSION } from '../version';

const MapView = lazy(() => import('./MapView'));

interface Props {
  assets: AssetRecord[];
  loadingAssets: boolean;
}

/** Úvodná obrazovka pre neprihlásených návštevníkov appky.
 *  Predstaví projekt, ponúkne prihlásenie/registráciu a zároveň umožní
 *  hocikomu (aj bez účtu) prezrieť si verejnú mapu existujúcich záznamov -
 *  RLS "Verejné čítanie" politika toto bezpečne umožňuje bez prihlásenia. */
export default function WelcomeScreen({ assets, loadingAssets }: Props) {
  const { theme, toggleTheme } = useTheme();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-slate-100 bg-[rgb(var(--brand-700))] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white shadow-sm dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2">
          <TreePine className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight">Vlčince – Pasport</h1>
            <p className="truncate text-xs text-[rgb(var(--brand-100))]">Mobiliár a zeleň sídliska</p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="shrink-0 rounded-md bg-[rgb(var(--brand-800)/40%)] p-2 text-white"
          aria-label="Prepnúť tmavý režim"
          title="Prepnúť svetlý/tmavý režim"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      {/* Predstavenie projektu + CTA */}
      <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Komunitný projekt na mapovanie stavu lavičiek, košov, detských prvkov a zelene na
          sídlisku Vlčince. Mapu nižšie si môže prezrieť ktokoľvek – ak chceš sám pridávať alebo
          upravovať záznamy v teréne, priprav sa vytvorením účtu.
        </p>

        <div className="mb-3 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2 dark:bg-slate-800">
            <MapPin className="h-4 w-4 text-[rgb(var(--brand-600))]" />
            {assets.length} záznamov
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2 dark:bg-slate-800">
            <ClipboardList className="h-4 w-4 text-[rgb(var(--brand-600))]" />
            Zber v teréne
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-slate-50 py-2 dark:bg-slate-800">
            <Users className="h-4 w-4 text-[rgb(var(--brand-600))]" />
            Komunitné dáta
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => openAuth('login')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[rgb(var(--brand-600))] px-3 py-2.5 text-sm font-semibold text-[rgb(var(--brand-700))] hover:bg-[rgb(var(--brand-50))] dark:text-[rgb(var(--brand-400))] dark:hover:bg-[rgb(var(--brand-950))]"
          >
            <LogIn className="h-4 w-4" /> Prihlásiť sa
          </button>
          <button
            onClick={() => openAuth('register')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[rgb(var(--brand-600))] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[rgb(var(--brand-700))]"
          >
            <UserPlus className="h-4 w-4" /> Registrovať sa
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-slate-300 dark:text-slate-600">
          Vlčince – Pasport v{APP_VERSION}
        </p>
      </div>

      {/* Mapa sa počas otvoreného prihlasovacieho okna vôbec nevykresľuje -
          jej plávajúce ovládacie tlačidlá (poloha/legenda/offline, z-[1000])
          by inak mohli "presvitať" cez modal a blokovať kliknutia v rohoch. */}
      {!authOpen && (
        <div className="relative min-h-0 flex-1">
          {loadingAssets ? (
            <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Načítavam mapu…
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Načítavam mapu…
                </div>
              }
            >
              <MapView assets={assets} />
            </Suspense>
          )}
        </div>
      )}

      {authOpen && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setAuthOpen(false)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] dark:bg-slate-800 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AuthForm initialMode={authMode} onClose={() => setAuthOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
