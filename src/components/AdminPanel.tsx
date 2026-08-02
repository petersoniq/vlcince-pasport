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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { AssetRecord, AssetCondition, Profile } from '../types';
import { CATEGORY_LABELS, CONDITION_LABELS, CONDITION_COLORS } from '../types';

type Tab = 'users' | 'assets';

const CONDITIONS = Object.keys(CONDITION_LABELS) as AssetCondition[];

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCondition, setBulkCondition] = useState<AssetCondition>('dobry');

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

  // ---------------------------------------------------------------------
  // Hromadné akcie
  // ---------------------------------------------------------------------

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
    if (selected.size === 0) return;
    if (!confirm(`Nastaviť stav "${CONDITION_LABELS[bulkCondition]}" pre ${selected.size} vybraných záznamov?`)) {
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
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('users')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${
            tab === 'users' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Users className="h-4 w-4" /> Používatelia ({profiles.length})
        </button>
        <button
          onClick={() => setTab('assets')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${
            tab === 'assets' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Database className="h-4 w-4" /> Všetky záznamy ({assets.length})
        </button>
      </div>

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
                      {CATEGORY_LABELS[a.category]}
                      {a.subtype && <span className="font-normal text-slate-500"> · {a.subtype}</span>}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      <span style={{ color: CONDITION_COLORS[a.condition] }}>{CONDITION_LABELS[a.condition]}</span>
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

          {/* Plávajúci panel hromadných akcií - zobrazí sa len keď je niečo vybrané */}
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
                  onChange={(e) => setBulkCondition(e.target.value as AssetCondition)}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-700"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {CONDITION_LABELS[c]}
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
    </div>
  );
}
