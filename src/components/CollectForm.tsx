import { useState, useCallback, useMemo } from 'react';
import { Camera, Check, Loader2, AlertTriangle } from 'lucide-react';
import LocationBadge, { type LocationState } from './LocationBadge';
import { CATEGORY_LABELS, CONDITION_LABELS } from '../types';
import type { AssetCategory, AssetCondition, PendingAsset, AssetRecord } from '../types';
import { queueAsset } from '../lib/db';
import { syncQueue } from '../lib/sync';
import { useAuth } from '../lib/auth';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as AssetCategory[];
const CONDITIONS = Object.keys(CONDITION_LABELS) as AssetCondition[];
const DUPLICATE_RADIUS_M = 15;

function generateLocalId(): string {
  return crypto.randomUUID();
}

/** Haversine vzdialenosť medzi dvomi GPS bodmi v metroch. */
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface Props {
  onSaved?: () => void;
  /** Aktuálne existujúce záznamy - použité na kontrolu duplicít v okolí polohy. */
  existingAssets?: AssetRecord[];
}

export default function CollectForm({ onSaved, existingAssets = [] }: Props) {
  const { user } = useAuth();
  const [location, setLocation] = useState<LocationState | null>(null);
  const [category, setCategory] = useState<AssetCategory>('lavicka');
  const [condition, setCondition] = useState<AssetCondition>('dobry');
  const [subtype, setSubtype] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const handleLocationChange = useCallback((loc: LocationState) => setLocation(loc), []);

  // Záznamy rovnakej kategórie v okruhu DUPLICATE_RADIUS_M od aktuálnej polohy
  const nearbyDuplicates = useMemo(() => {
    if (!location?.latitude || !location.longitude) return [];
    return existingAssets.filter(
      (a) =>
        a.category === category &&
        distanceMeters(location.latitude!, location.longitude!, a.latitude, a.longitude) <= DUPLICATE_RADIUS_M
    );
  }, [existingAssets, location, category]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setSubtype('');
    setNote('');
    setPhoto(null);
    setPhotoPreview(null);
    setCondition('dobry');
    setDuplicateConfirmed(false);
  };

  const doSave = async () => {
    if (!user || !location?.latitude || !location.longitude) return;
    setSaving(true);

    const pending: PendingAsset = {
      device_local_id: generateLocalId(),
      user_id: user.id,
      category,
      subtype,
      condition,
      latitude: location.latitude,
      longitude: location.longitude,
      gps_accuracy_m: location.accuracy,
      note,
      photo_blob: photo,
      created_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await queueAsset(pending);
    if (navigator.onLine) syncQueue();

    setSaving(false);
    setSavedMessage(
      navigator.onLine
        ? 'Záznam uložený a odosiela sa na server.'
        : 'Záznam uložený lokálne – odošle sa po obnovení pripojenia.'
    );
    resetForm();
    onSaved?.();
    setTimeout(() => setSavedMessage(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Musíš byť prihlásený, aby si mohol pridávať záznamy.');
      return;
    }
    if (!location || location.status !== 'ok' || !location.latitude || !location.longitude) {
      alert('Poloha ešte nie je dostupná, počkaj chvíľu alebo skontroluj GPS.');
      return;
    }
    // Ak existuje podobný záznam nablízku a používateľ to ešte nepotvrdil, zastav a ukáž varovanie
    if (nearbyDuplicates.length > 0 && !duplicateConfirmed) {
      return;
    }
    await doSave();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <LocationBadge onChange={handleLocationChange} />

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Kategória</label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(cat);
                setDuplicateConfirmed(false);
              }}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                category === cat
                  ? 'border-[rgb(var(--brand-600))] bg-[rgb(var(--brand-600))] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[rgb(var(--brand-300))] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {nearbyDuplicates.length > 0 && !duplicateConfirmed && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <div className="flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>
              {nearbyDuplicates.length === 1 ? 'Podobný záznam už existuje' : `${nearbyDuplicates.length} podobné záznamy už existujú`}{' '}
              menej ako {DUPLICATE_RADIUS_M} m odtiaľto. Naozaj chceš pridať nový, alebo si niekto už zaznamenal ten istý objekt?
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDuplicateConfirmed(true)}
            className="self-start rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            Áno, je to iný objekt - pokračovať
          </button>
        </div>
      )}

      <div>
        <label htmlFor="subtype" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Podtyp (voliteľné)
        </label>
        <input
          id="subtype"
          type="text"
          value={subtype}
          onChange={(e) => setSubtype(e.target.value)}
          placeholder="napr. lavička s operadlom, smrek pichľavý…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Stav</label>
        <div className="grid grid-cols-2 gap-2">
          {CONDITIONS.map((cond) => (
            <button
              key={cond}
              type="button"
              onClick={() => setCondition(cond)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                condition === cond
                  ? 'border-[rgb(var(--brand-600))] bg-[rgb(var(--brand-600))] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {CONDITION_LABELS[cond]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Poznámka (voliteľné)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Doplňujúce informácie…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Fotografia</label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500 hover:border-[rgb(var(--brand-400))] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <Camera className="h-5 w-5" />
          {photoPreview ? 'Zmeniť fotku' : 'Odfotiť / vybrať fotku'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </label>
        {photoPreview && (
          <img
            src={photoPreview}
            alt="náhľad"
            className="mt-2 h-32 w-full rounded-lg object-cover"
          />
        )}
      </div>

      <button
        type="submit"
        disabled={saving || !user || !location || location.status !== 'ok' || (nearbyDuplicates.length > 0 && !duplicateConfirmed)}
        className="flex items-center justify-center gap-2 rounded-lg bg-[rgb(var(--brand-600))] px-4 py-3 font-semibold text-white transition hover:bg-[rgb(var(--brand-700))] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
        Uložiť záznam
      </button>

      {savedMessage && (
        <div className="rounded-lg bg-[rgb(var(--brand-50))] px-3 py-2 text-center text-sm text-[rgb(var(--brand-700))] dark:bg-[rgb(var(--brand-950))] dark:text-[rgb(var(--brand-300))]">
          {savedMessage}
        </div>
      )}
    </form>
  );
}
