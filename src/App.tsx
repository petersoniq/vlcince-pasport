import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import {
  TreePine,
  Map as MapIcon,
  BarChart3,
  ClipboardPlus,
  Loader2,
  SlidersHorizontal,
  User,
  Moon,
  Sun,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from './lib/auth';
import { useTheme } from './lib/theme';
import { supabase } from './lib/supabase';
import WelcomeScreen from './components/WelcomeScreen';
import ProfileEditor from './components/ProfileEditor';
import CollectForm from './components/CollectForm';
import SyncStatus from './components/SyncStatus';
import InstallPrompt from './components/InstallPrompt';
import FilterPanel from './components/FilterPanel';
import type { AssetRecord, Filters } from './types';

// Lenivé (lazy) načítanie ťažších komponentov - Leaflet+cluster (MapView),
// Recharts (StatsPanel) a AdminPanel sa stiahnu až pri prvom prepnutí na danú
// záložku, nie hneď pri štarte appky. Výrazne zmenšuje počiatočný JS bundle.
const MapView = lazy(() => import('./components/MapView'));
const StatsPanel = lazy(() => import('./components/StatsPanel'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

const EMPTY_FILTERS: Filters = {
  categories: [],
  conditions: [],
  search: '',
  myOnly: false,
  dateFrom: null,
  dateTo: null,
};

type View = 'zber' | 'mapa' | 'statistiky' | 'admin';

const NAV_ITEMS: { key: View; label: string; icon: typeof ClipboardPlus }[] = [
  { key: 'zber', label: 'Zber', icon: ClipboardPlus },
  { key: 'mapa', label: 'Mapa', icon: MapIcon },
  { key: 'statistiky', label: 'Štatistiky', icon: BarChart3 },
];

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  );
}

export default function App() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>('zber');
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAssets() {
      setLoading(true);
      const { data, error } = await supabase
        .from('vlcince_assets')
        .select(
          'id, created_at, category, subtype, condition, latitude, longitude, note, photo_url, user_id, author:profiles(display_name, contact_email, contact_phone, show_contact, role)'
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Chyba pri načítaní dát:', error.message);
      } else if (isMounted && data) {
        setAssets(data as unknown as AssetRecord[]);
      }
      setLoading(false);
    }

    loadAssets();

    const channel = supabase
      .channel('vlcince_assets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vlcince_assets' }, () =>
        loadAssets()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (filters.myOnly && asset.user_id !== user?.id) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(asset.category)) {
        return false;
      }
      if (filters.conditions.length > 0 && !filters.conditions.includes(asset.condition)) {
        return false;
      }
      if (filters.dateFrom && asset.created_at < filters.dateFrom) return false;
      if (filters.dateTo && asset.created_at.slice(0, 10) > filters.dateTo) return false;
      const q = filters.search.trim().toLowerCase();
      if (
        q &&
        !(asset.note ?? '').toLowerCase().includes(q) &&
        !(asset.subtype ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [assets, filters, user?.id]);

  const attentionCount = useMemo(
    () => assets.filter((a) => a.condition === 'poskodeny' || a.condition === 'chybajuci').length,
    [assets]
  );

  const navItems = useMemo(
    () => (isAdmin ? [...NAV_ITEMS, { key: 'admin' as View, label: 'Admin', icon: ShieldCheck }] : NAV_ITEMS),
    [isAdmin]
  );

  const handleAssetDeleted = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAssetUpdated = (updated: AssetRecord) => {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
  };

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Načítavam…
      </div>
    );
  }

  if (!user) {
    return <WelcomeScreen assets={assets} loadingAssets={loading} />;
  }

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

        <div className="flex shrink-0 items-center gap-2">
          <nav className="hidden items-center gap-1 rounded-lg bg-[rgb(var(--brand-800)/40%)] p-1 sm:flex">
            {navItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === key ? 'bg-white text-[rgb(var(--brand-800))] shadow-sm' : 'text-[rgb(var(--brand-100))] hover:bg-[rgb(var(--brand-800)/60%)]'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
                {key === 'mapa' && attentionCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {attentionCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {(view === 'mapa' || view === 'statistiky') && (
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="rounded-md bg-[rgb(var(--brand-800)/40%)] p-2 text-white sm:hidden"
              aria-label="Filtre"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="rounded-md bg-[rgb(var(--brand-800)/40%)] p-2 text-white"
            aria-label="Prepnúť tmavý režim"
            title="Prepnúť svetlý/tmavý režim"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setProfileOpen(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[rgb(var(--brand-800)/40%)] text-white"
            aria-label="Profil"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      <InstallPrompt />

      {view === 'zber' && <div className="shrink-0"><SyncStatus /></div>}

      {profile?.role === 'admin' && attentionCount > 0 && view !== 'mapa' && (
        <button
          onClick={() => setView('mapa')}
          className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-left text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {attentionCount} {attentionCount === 1 ? 'záznam vyžaduje' : 'záznamov vyžaduje'} pozornosť (poškodené/chýbajúce) – zobraziť na mape
        </button>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {(view === 'mapa' || view === 'statistiky') && (
          <>
            {filtersOpen && (
              <div
                className="absolute inset-0 z-[1500] bg-black/30 sm:hidden"
                onClick={() => setFiltersOpen(false)}
              >
                <aside
                  className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto bg-white shadow-xl dark:bg-slate-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FilterPanel
                    filters={filters}
                    onChange={setFilters}
                    totalCount={assets.length}
                    filteredCount={filteredAssets.length}
                  />
                </aside>
              </div>
            )}

            <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 sm:block">
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                totalCount={assets.length}
                filteredCount={filteredAssets.length}
              />
            </aside>
          </>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto">
          {view === 'zber' && (
            <div className="mx-auto max-w-md pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4">
              <CollectForm existingAssets={assets} />
            </div>
          )}

          {view !== 'zber' && loading && <ListSkeleton />}

          <Suspense fallback={<ListSkeleton />}>
            {view === 'mapa' && !loading && (
              <MapView assets={filteredAssets} onAssetDeleted={handleAssetDeleted} onAssetUpdated={handleAssetUpdated} />
            )}
            {view === 'statistiky' && !loading && (
              <div className="pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4">
                <StatsPanel assets={filteredAssets} />
              </div>
            )}

            {view === 'admin' && isAdmin && <AdminPanel />}
          </Suspense>
        </main>
      </div>

      <nav className="z-20 flex shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900 sm:hidden">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setView(key);
              setFiltersOpen(false);
            }}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              view === key ? 'text-[rgb(var(--brand-700))] dark:text-[rgb(var(--brand-400))]' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
            {key === 'mapa' && attentionCount > 0 && (
              <span className="absolute right-6 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {attentionCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {profileOpen && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] dark:bg-slate-800 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ProfileEditor onClose={() => setProfileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
