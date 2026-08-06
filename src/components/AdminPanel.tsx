import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Users,
  Database,
  CheckSquare,
  Square,
  X,
  Tags,
  Plus,
  Sparkles,
  LayoutDashboard,
  Clock,
  Award,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useTaxonomy } from '../lib/taxonomy';
import type { AssetRecord, AssetCondition, Profile } from '../types';

type Tab = 'overview' | 'users' | 'assets' | 'taxonomy';

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const { categories, conditions, categoryLabel, conditionLabel, conditionColor, refresh: refreshTaxonomy } = useTaxonomy();
  const [tab, setTab] = useState<Tab>('overview');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCondition, setBulkCondition] = useState<AssetCondition>('');
  const [cleaningPhotos, setCleaningPhotos] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [profilesRes, assetsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase
        .from('vlcince_assets')
        .select(
          'id, created_at, category, subtype, condition, latitude, longitude, note, photo_url, user_id, author:profiles(display_name, contact_email, contact_phone, show_contact, role)'
        )
        .order('created_at', { ascending: false }),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (assetsRes.data) setAssets(assetsRes.data as unknown as AssetRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!bulkCondition && conditions[0]) setBulkCondition(conditions[0].key);
  }, [conditions, bulkCondition]);

  const toggleRole = async (profile: Profile) => {
    if (profile.id === currentUser?.id) {
      alert('Nemôžeš zmeniť vlastnú rolu.');
      return;
    }
    const nextRole = profile.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Naozaj chceš ${profile.display_name || profile.id} nastaviť ako "${nextRole}"?`)) return;

    setBusyId(profile.id);
    const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', profile.id);
    setBusyId(null);
    if (error) {
      alert(`Zmena role zlyhala: ${error.message}`);
      return;
    }
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, role: nextRole } : p)));
  };

  const deleteAsset = async (id: string) => {
    if (!confirm('Naozaj natrvalo vymazať tento záznam?')) return;
    setBusyId(id);
    const { error } = await supabase.from('vlcince_assets').delete().eq('id', id);
    setBusyId(null);
    if (error) {
      alert(`Vymazanie zlyhalo: ${error.message}`);
      return;
    }
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = assets.length > 0 && assets.every((a) => selected.has(a.id));

  const toggleSelectAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(assets.map((a) => a.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Naozaj natrvalo vymazať ${selected.size} vybraných záznamov? Túto akciu nemožno vrátiť späť.`)) {
      return;
    }
    setBulkBusy(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('vlcince_assets').delete().in('id', ids);
    setBulkBusy(false);
    if (error) {
      alert(`Hromadné vymazanie zlyhalo: ${error.message}`);
      return;
    }
    setAssets((prev) => prev.filter((a) => !selected.has(a.id)));
    clearSelection();
  };

  const bulkSetCondition = async () => {
    if (selected.size === 0 || !bulkCondition) return;
    if (!confirm(`Nastaviť stav "${conditionLabel(bulkCondition)}" pre ${selected.size} vybraných záznamov?`)) {
      return;
    }
    setBulkBusy(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from('vlcince_assets').update({ condition: bulkCondition }).in('id', ids);
    setBulkBusy(false);
    if (error) {
      alert(`Hromadná zmena stavu zlyhala: ${error.message}`);
      return;
    }
    setAssets((prev) => prev.map((a) => (selected.has(a.id) ? { ...a, condition: bulkCondition } : a)));
    clearSelection();
  };

  const handleCleanupPhotos = async () => {
    if (!confirm('Prehľadať Storage a vymazať fotky, ktoré už nie sú priradené k žiadnemu záznamu?')) return;
    setCleaningPhotos(true);
    setCleanupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-photos', { method: 'POST' });
      if (error) throw error;
      setCleanupResult(`Vymazaných ${data?.deleted ?? 0} nepoužitých súborov (skontrolovaných ${data?.checked ?? 0}).`);
    } catch (err) {
      setCleanupResult(`Chyba: ${err instanceof Error ? err.message : 'neznáma chyba'}`);
    }
    setCleaningPhotos(false);
  };

  const selectionSummary = useMemo(() => `${selected.size} vybraných`, [selected]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Načítavam…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-swipe-ignore className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('overview')}
          aria-pressed={tab === 'overview'}
          className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md py-1.5 text-sm font-medium ${
            tab === 'overview' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" /> Prehľad
        </button>
        <button
          onClick={() => setTab('users')}
          aria-pressed={tab === 'users'}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${
            tab === 'users' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Users className="h-4 w-4" /> Používatelia
        </button>
        <button
          onClick={() => setTab('assets')}
          aria-pressed={tab === 'assets'}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${
            tab === 'assets' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Database className="h-4 w-4" /> Záznamy
        </button>
        <button
          onClick={() => setTab('taxonomy')}
          aria-pressed={tab === 'taxonomy'}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${
            tab === 'taxonomy' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Tags className="h-4 w-4" /> Kategórie
        </button>
      </div>

      {tab === 'overview' && (
        <DashboardOverview
          assets={assets}
          profiles={profiles}
          categoryLabel={categoryLabel}
          conditionLabel={conditionLabel}
          conditionColor={conditionColor}
        />
      )}

      {tab === 'users' && (
        <div className="flex flex-col gap-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Users className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {p.display_name || 'Bez mena'}
                    {p.id === currentUser?.id && <span className="ml-1 text-xs text-slate-400">(ty)</span>}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(p.created_at).toLocaleDateString('sk-SK')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => toggleRole(p)}
                disabled={busyId === p.id || p.id === currentUser?.id}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                  p.role === 'admin'
                    ? 'bg-[rgb(var(--brand-100))] text-[rgb(var(--brand-700))] hover:bg-[rgb(var(--brand-200))]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {busyId === p.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : p.role === 'admin' ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <ShieldOff className="h-3.5 w-3.5" />
                )}
                {p.role === 'admin' ? 'Administrátor' : 'Člen'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'assets' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">Vymaže fotky v Storage, ktoré už nepatria k žiadnemu záznamu</span>
            </div>
            <button
              onClick={handleCleanupPhotos}
              disabled={cleaningPhotos}
              className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200"
            >
              {cleaningPhotos && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Vyčistiť nepoužité fotky
            </button>
          </div>
          {cleanupResult && (
            <p role="status" className="text-xs text-slate-500 dark:text-slate-400">{cleanupResult}</p>
          )}

          {assets.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 self-start text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              {allVisibleSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              {allVisibleSelected ? 'Zrušiť výber všetkých' : 'Vybrať všetky'}
            </button>
          )}

          {assets.map((a) => {
            const isSelected = selected.has(a.id);
            return (
              <div
                key={a.id}
                className={`flex items-center justify-between gap-2 rounded-lg border p-3 text-sm ${
                  isSelected
                    ? 'border-[rgb(var(--brand-300))] bg-[rgb(var(--brand-50))] dark:border-[rgb(var(--brand-800))] dark:bg-[rgb(var(--brand-950))]'
                    : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-800'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    onClick={() => toggleSelected(a.id)}
                    className="shrink-0 text-slate-400 hover:text-[rgb(var(--brand-600))]"
                    aria-label="Vybrať záznam"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-[rgb(var(--brand-600))]" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {categoryLabel(a.category)}
                      {a.subtype && <span className="font-normal text-slate-500"> · {a.subtype}</span>}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      <span style={{ color: conditionColor(a.condition) }}>{conditionLabel(a.condition)}</span>
                      {' · '}
                      {a.author?.display_name || 'neznámy autor'}
                      {' · '}
                      {new Date(a.created_at).toLocaleDateString('sk-SK')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteAsset(a.id)}
                  disabled={busyId === a.id}
                  className="flex shrink-0 items-center gap-1 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40"
                >
                  {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}

          {selected.size > 0 && (
            <div className="sticky bottom-2 mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <span className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {selectionSummary}
                <button onClick={clearSelection} className="text-slate-400 hover:text-slate-600" aria-label="Zrušiť výber">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>

              <div className="ml-auto flex items-center gap-2">
                <select
                  value={bulkCondition}
                  onChange={(e) => setBulkCondition(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700"
                >
                  {conditions.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={bulkSetCondition}
                  disabled={bulkBusy}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Nastaviť stav
                </button>
                <button
                  onClick={bulkDelete}
                  disabled={bulkBusy}
                  className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Vymazať
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'taxonomy' && <TaxonomyManager categories={categories} conditions={conditions} onChanged={refreshTaxonomy} />}
    </div>
  );
}

/** Správa konfigurovateľných kategórií a stavov - pridávanie nových, deaktivácia existujúcich. */
function TaxonomyManager({
  categories,
  conditions,
  onChanged,
}: {
  categories: { key: string; label: string; emoji: string; active: boolean; sort_order: number }[];
  conditions: { key: string; label: string; color: string; active: boolean; sort_order: number }[];
  onChanged: () => Promise<void>;
}) {
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📍');
  const [newCondLabel, setNewCondLabel] = useState('');
  const [newCondColor, setNewCondColor] = useState('#64748b');
  const [busy, setBusy] = useState(false);

  const slugify = (label: string) =>
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const addCategory = async () => {
    if (!newCatLabel.trim()) return;
    setBusy(true);
    const key = slugify(newCatLabel);
    const { error } = await supabase
      .from('categories')
      .insert({ key, label: newCatLabel.trim(), emoji: newCatEmoji || '📍', sort_order: categories.length + 1 });
    setBusy(false);
    if (error) {
      alert(`Pridanie kategórie zlyhalo: ${error.message}`);
      return;
    }
    setNewCatLabel('');
    setNewCatEmoji('📍');
    await onChanged();
  };

  const addCondition = async () => {
    if (!newCondLabel.trim()) return;
    setBusy(true);
    const key = slugify(newCondLabel);
    const { error } = await supabase
      .from('conditions')
      .insert({ key, label: newCondLabel.trim(), color: newCondColor, sort_order: conditions.length + 1 });
    setBusy(false);
    if (error) {
      alert(`Pridanie stavu zlyhalo: ${error.message}`);
      return;
    }
    setNewCondLabel('');
    await onChanged();
  };

  const toggleActive = async (table: 'categories' | 'conditions', key: string, active: boolean) => {
    setBusy(true);
    const { error } = await supabase.from(table).update({ active: !active }).eq('key', key);
    setBusy(false);
    if (error) {
      alert(`Zmena zlyhala: ${error.message}`);
      return;
    }
    await onChanged();
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Kategórie</h3>
        <div className="flex flex-col gap-1.5">
          {categories.map((c) => (
            <div key={c.key} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-2 text-sm dark:border-slate-800 dark:bg-slate-800">
              <span className="text-slate-700 dark:text-slate-200">{c.emoji} {c.label}</span>
              <button
                onClick={() => toggleActive('categories', c.key, c.active)}
                disabled={busy}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
              >
                Deaktivovať
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newCatEmoji}
            onChange={(e) => setNewCatEmoji(e.target.value)}
            className="w-14 rounded-md border border-slate-200 px-2 py-1.5 text-center text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            aria-label="Emoji novej kategórie"
          />
          <input
            type="text"
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.target.value)}
            placeholder="Názov novej kategórie…"
            className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            onClick={addCategory}
            disabled={busy || !newCatLabel.trim()}
            className="flex items-center gap-1 rounded-md bg-[rgb(var(--brand-600))] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Pridať
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Stavy</h3>
        <div className="flex flex-col gap-1.5">
          {conditions.map((c) => (
            <div key={c.key} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-2 text-sm dark:border-slate-800 dark:bg-slate-800">
              <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}
              </span>
              <button
                onClick={() => toggleActive('conditions', c.key, c.active)}
                disabled={busy}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
              >
                Deaktivovať
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="color"
            value={newCondColor}
            onChange={(e) => setNewCondColor(e.target.value)}
            className="h-9 w-12 rounded-md border border-slate-200 dark:border-slate-700"
            aria-label="Farba nového stavu"
          />
          <input
            type="text"
            value={newCondLabel}
            onChange={(e) => setNewCondLabel(e.target.value)}
            placeholder="Názov nového stavu…"
            className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            onClick={addCondition}
            disabled={busy || !newCondLabel.trim()}
            className="flex items-center gap-1 rounded-md bg-[rgb(var(--brand-600))] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Pridať
          </button>
        </div>
      </div>
    </div>
  );
}

/** Prehľadová dashboard záložka - štatistické karty + posledné kritické hlásenia,
 *  podľa dizajn manuálu (karty s celkovým počtom, rozdelením stavov,
 *  najaktívnejšími zberačmi a časom poslednej aktualizácie). */
function DashboardOverview({
  assets,
  profiles,
  categoryLabel,
  conditionLabel,
  conditionColor,
}: {
  assets: AssetRecord[];
  profiles: Profile[];
  categoryLabel: (key: string) => string;
  conditionLabel: (key: string) => string;
  conditionColor: (key: string) => string;
}) {
  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    assets.forEach((a) => counts.set(a.condition, (counts.get(a.condition) ?? 0) + 1));
    return Array.from(counts.entries()).map(([key, count]) => ({
      key,
      count,
      label: conditionLabel(key),
      color: conditionColor(key),
    }));
  }, [assets, conditionLabel, conditionColor]);

  const topCollectors = useMemo(() => {
    const counts = new Map<string, { name: string; avatar: string | null; count: number }>();
    assets.forEach((a) => {
      if (!a.user_id) return;
      const existing = counts.get(a.user_id);
      const profile = profiles.find((p) => p.id === a.user_id);
      if (existing) existing.count++;
      else counts.set(a.user_id, { name: profile?.display_name || 'Anonym', avatar: profile?.avatar_url ?? null, count: 1 });
    });
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [assets, profiles]);

  const lastUpdate = useMemo(() => {
    if (assets.length === 0) return null;
    return assets.reduce((latest, a) => (a.created_at > latest ? a.created_at : latest), assets[0].created_at);
  }, [assets]);

  const recentCritical = useMemo(
    () => assets.filter((a) => a.condition === 'poskodeny' || a.condition === 'chybajuci').slice(0, 8),
    [assets]
  );

  const totalCount = assets.length;
  const maxStatusCount = Math.max(1, ...statusBreakdown.map((s) => s.count));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-800">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalCount}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Celkovo záznamov</p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-800">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Stav záznamov</p>
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            {statusBreakdown.map((s) => (
              <div
                key={s.key}
                style={{ width: `${(s.count / maxStatusCount) * 100 * (1 / statusBreakdown.length)}%`, backgroundColor: s.color }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
            {statusBreakdown.map((s) => (
              <span key={s.key} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label} {s.count}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-800">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Award className="h-3.5 w-3.5" /> Najaktívnejší zberači
          </p>
          {topCollectors.length === 0 && <p className="text-xs text-slate-400">Zatiaľ žiadne dáta</p>}
          <div className="flex flex-col gap-1">
            {topCollectors.map((c) => (
              <div key={c.name} className="flex items-center gap-1.5 text-xs">
                <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  {c.avatar ? <img src={c.avatar} alt="" className="h-full w-full object-cover" /> : <Users className="h-3 w-3 text-slate-400" />}
                </div>
                <span className="truncate text-slate-600 dark:text-slate-300">{c.name}</span>
                <span className="ml-auto text-slate-400">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-800">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" /> Posledná aktualizácia
          </p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {lastUpdate ? new Date(lastUpdate).toLocaleString('sk-SK') : '–'}
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Posledné nahlásené požiadavky</h3>
        {recentCritical.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">Žiadne poškodené/chýbajúce záznamy 🎉</p>
        )}
        <div className="flex flex-col gap-1.5">
          {recentCritical.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-700 dark:text-slate-200">
                  {categoryLabel(a.category)}
                  {a.subtype && <span className="font-normal text-slate-400"> · {a.subtype}</span>}
                </p>
                <p className="text-slate-400 dark:text-slate-500">{new Date(a.created_at).toLocaleString('sk-SK')}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: conditionColor(a.condition) }}
              >
                {conditionLabel(a.condition)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
