import { useState, useCallback, useMemo } from 'react';
import { Camera, Check, Loader2, AlertTriangle, X } from 'lucide-react';
import LocationBadge, { type LocationState } from './LocationBadge';
import type { AssetCategory, AssetCondition, PendingAsset, AssetRecord } from '../types';
import { queueAsset } from '../lib/db';
import { syncQueue, registerBackgroundSync } from '../lib/sync';
import { useAuth } from '../lib/auth';
import { useTaxonomy } from '../lib/taxonomy';
import { compressImage } from '../lib/imageCompress';

const DUPLICATE_RADIUS_M = 15;
const MAX_PHOTOS = 4;

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
  existingAssets?: AssetRecord[];
}

export default function CollectForm({ onSaved, existingAssets = [] }: Props) {
  const { user } = useAuth();
  const { categories, conditions, categoryEmoji } = useTaxonomy();
  const [location, setLocation] = useState<LocationState | null>(null);
  const [category, setCategory] = useState<AssetCategory>('');
  const [condition, setCondition] = useState<AssetCondition>('');
  const [subtype, setSubtype] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<{ blob: Blob; preview: string }[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  // Predvolená kategória/stav = prvá dostupná, akonáhle sa načítajú z DB
  const effectiveCategory = category || categories[0]?.key || '';
  const effectiveCondition = condition || conditions[0]?.key || '';

  const handleLocationChange = useCallback((loc: LocationState) => setLocation(loc), []);

  const nearbyDuplicates = useMemo(() => {
    if (!location?.latitude || !location.longitude) return [];
    return existingAssets.filter(
      (a) =>
        a.category === effectiveCategory &&
        distanceMeters(location.latitude!, location.longitude!, a.latitude, a.longitude) <= DUPLICATE_RADIUS_M
    );
  }, [existingAssets, location, effectiveCategory]);

  const handlePhotosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);

    setCompressing(true);
    const compressed = await Promise.all(
      toAdd.map(async (file) => {
        const blob = await compressImage(file);
        return { blob, preview: URL.createObjectURL(blob) };
      })
    );
    setCompressing(false);
    setPhotos((prev) => [...prev, ...compressed]);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const resetForm = () => {
    setSubtype('');
    setNote('');
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setCondition('');
    setDuplicateConfirmed(false);
  };

  const doSave = async () => {
    if (!user || !location?.latitude || !location.longitude) return;
    setSaving(true);

    const pending: PendingAsset = {
      device_local_id: generateLocalId(),
      user_id: user.id,
      category: effectiveCategory,
      subtype,
      condition: effectiveCondition,
      latitude: location.latitude,
      longitude: location.longitude,
      gps_accuracy_m: location.accuracy,
      note,
      photo_blobs: photos.map((p) => p.blob),
      created_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await queueAsset(pending);
    if (navigator.onLine) syncQueue();
    registerBackgroundSync();

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
          {categories.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                setCategory(cat.key);
                setDuplicateConfirmed(false);
              }}
              aria-pressed={effectiveCategory === cat.key}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                effectiveCategory === cat.key
                  ? 'border-[rgb(var(--brand-600))] bg-[rgb(var(--brand-600))] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[rgb(var(--brand-300))] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span aria-hidden="true">{cat.emoji}</span> {cat.label}
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
          {conditions.map((cond) => (
            <button
              key={cond.key}
              type="button"
              onClick={() => setCondition(cond.key)}
              aria-pressed={effectiveCondition === cond.key}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                effectiveCondition === cond.key
                  ? 'border-[rgb(var(--brand-600))] bg-[rgb(var(--brand-600))] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {cond.label}
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
        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Fotografie ({photos.length}/{MAX_PHOTOS})
        </label>
        {photos.length > 0 && (
          <div className="mb-2 grid grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <img src={p.preview} alt={`náhľad fotky ${i + 1}`} className="h-16 w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={`Odstrániť fotku ${i + 1}`}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500 hover:border-[rgb(var(--brand-400))] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            {compressing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {compressing ? 'Spracúvam fotky…' : 'Odfotiť / vybrať fotky'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotosChange}
              className="hidden"
              disabled={compressing}
            />
          </label>
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
        <div role="status" className="rounded-lg bg-[rgb(var(--brand-50))] px-3 py-2 text-center text-sm text-[rgb(var(--brand-700))] dark:bg-[rgb(var(--brand-950))] dark:text-[rgb(var(--brand-300))]">
          {savedMessage}
        </div>
      )}
    </form>
  );
}
