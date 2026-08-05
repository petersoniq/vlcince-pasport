import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {
  Trash2,
  Pencil,
  Mail,
  Phone,
  Loader2,
  LocateFixed,
  ShieldCheck,
  Info,
  Download,
  Check,
  X,
  Move,
  History,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  MapPin,
} from 'lucide-react';
import type { AssetRecord, AssetCategory, AssetCondition, StatusHistoryEntry, AssetPhoto } from '../types';
import { useAuth } from '../lib/auth';
import { useTaxonomy } from '../lib/taxonomy';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageCompress';
import CommentsPanel from './CommentsPanel';

// Stred sídliska Vlčince, Žilina - použije sa len ako záloha, ak sa nepodarí zistiť polohu
const VLCINCE_CENTER: [number, number] = [49.2233, 18.7482];
const DEFAULT_ZOOM = 16;
const MAX_PHOTOS = 4;

function buildIcon(emoji: string, color: string, editing: boolean) {
  const ring = editing ? 'outline: 3px solid #2563eb; outline-offset: 2px;' : '';
  return L.divIcon({
    html: `<div style="
      width: 30px; height: 30px; border-radius: 9999px;
      background: ${color}; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center; font-size: 15px; ${ring}
    ">${emoji}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

interface EditDraft {
  category: AssetCategory;
  subtype: string;
  condition: AssetCondition;
  note: string;
  position: L.LatLng | null;
  newPhotos: { file: File; preview: string }[];
  removedPhotoIds: string[];
}

interface Props {
  assets: AssetRecord[];
  onAssetDeleted?: (id: string) => void;
  onAssetUpdated?: (asset: AssetRecord) => void;
}

/** Jednoduchá galéria fotiek s prepínaním šípkami (bez externej závislosti). */
function PhotoGallery({ photos }: { photos: AssetPhoto[] }) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  const photo = photos[index];

  return (
    <div className="relative mt-2">
      <img src={photo.photo_url} alt={`fotka záznamu ${index + 1} z ${photos.length}`} className="h-24 w-full rounded object-cover" />
      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
            aria-label="Predchádzajúca fotka"
            className="absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % photos.length)}
            aria-label="Ďalšia fotka"
            className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <span className="absolute bottom-1 right-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
            {index + 1}/{photos.length}
          </span>
        </>
      )}
    </div>
  );
}

/** Rozbaľovací panel s históriou zmien stavu záznamu - dáta sa načítajú lenivo (až po kliknutí). */
function HistoryPanel({ assetId }: { assetId: string }) {
  const { conditionLabel, conditionColor } = useTaxonomy();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<StatusHistoryEntry[] | null>(null);

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && entries === null) {
      setLoading(true);
      const { data } = await supabase
        .from('asset_status_history')
        .select('id, asset_id, old_condition, new_condition, changed_at, changed_by')
        .eq('asset_id', assetId)
        .order('changed_at', { ascending: false });
      setEntries((data as StatusHistoryEntry[]) ?? []);
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <button
        onClick={handleToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        <span className="flex items-center gap-1">
          <History className="h-3 w-3" aria-hidden="true" /> História zmien
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
          {!loading && entries?.length === 0 && (
            <p className="text-[11px] text-slate-400">Žiadna história.</p>
          )}
          {!loading &&
            entries?.map((h) => (
              <div key={h.id} className="text-[11px] text-slate-500">
                {h.old_condition ? (
                  <>
                    <span style={{ color: conditionColor(h.old_condition) }}>{conditionLabel(h.old_condition)}</span>
                    {' → '}
                  </>
                ) : (
                  'Vytvorené ako '
                )}
                <span style={{ color: conditionColor(h.new_condition) }} className="font-medium">
                  {conditionLabel(h.new_condition)}
                </span>
                <span className="text-slate-400"> · {new Date(h.changed_at).toLocaleString('sk-SK')}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function AssetPopupContent({
  asset,
  onAssetDeleted,
  onAssetUpdated,
  isEditing,
  draft,
  onStartEdit,
  onChangeDraft,
  onCancelEdit,
}: {
  asset: AssetRecord;
  onAssetDeleted?: (id: string) => void;
  onAssetUpdated?: (asset: AssetRecord) => void;
  isEditing: boolean;
  draft: EditDraft | null;
  onStartEdit: () => void;
  onChangeDraft: (draft: EditDraft) => void;
  onCancelEdit: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const { categories, conditions, categoryLabel, categoryEmoji, conditionLabel, conditionColor } = useTaxonomy();
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compressingEdit, setCompressingEdit] = useState(false);
  const canManage = !!user && (user.id === asset.user_id || isAdmin);

  const existingPhotos = (asset.photos ?? []).filter((p) => !draft?.removedPhotoIds.includes(p.id));

  const handleDelete = async () => {
    if (!confirm('Naozaj chceš tento záznam natrvalo odstrániť? Vrátane všetkých fotiek.')) return;
    setDeleting(true);

    // Najprv zmaž fyzické súbory zo Storage (DB cascade zmaže riadky, nie súbory)
    const paths = (asset.photos ?? []).map((p) => p.storage_path).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from('asset-photos').remove(paths);
    }

    const { error } = await supabase.from('vlcince_assets').delete().eq('id', asset.id);
    setDeleting(false);
    if (error) {
      alert(`Vymazanie zlyhalo: ${error.message}`);
      return;
    }
    onAssetDeleted?.(asset.id);
  };

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!draft) return;
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const remaining = MAX_PHOTOS - existingPhotos.length - draft.newPhotos.length;
    const toAdd = files.slice(0, remaining);

    setCompressingEdit(true);
    const compressed = await Promise.all(
      toAdd.map(async (file) => {
        const blob = await compressImage(file);
        const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
        return { file: compressedFile, preview: URL.createObjectURL(blob) };
      })
    );
    setCompressingEdit(false);
    onChangeDraft({ ...draft, newPhotos: [...draft.newPhotos, ...compressed] });
    e.target.value = '';
  };

  const removeNewPhoto = (i: number) => {
    if (!draft) return;
    onChangeDraft({ ...draft, newPhotos: draft.newPhotos.filter((_, idx) => idx !== i) });
  };

  const removeExistingPhoto = (photoId: string) => {
    if (!draft) return;
    onChangeDraft({ ...draft, removedPhotoIds: [...draft.removedPhotoIds, photoId] });
  };

  const handleSave = async () => {
    if (!draft || !user) return;
    setSaving(true);

    // 1) zmaž fotky označené na odstránenie (DB riadok + storage súbor)
    if (draft.removedPhotoIds.length > 0) {
      const toRemove = (asset.photos ?? []).filter((p) => draft.removedPhotoIds.includes(p.id));
      const paths = toRemove.map((p) => p.storage_path).filter(Boolean);
      if (paths.length > 0) await supabase.storage.from('asset-photos').remove(paths);
      await supabase.from('asset_photos').delete().in('id', draft.removedPhotoIds);
    }

    // 2) nahraj nové fotky
    const startPosition = existingPhotos.length;
    for (let i = 0; i < draft.newPhotos.length; i++) {
      const path = `${asset.id}-edit-${Date.now()}-${i}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('asset-photos')
        .upload(path, draft.newPhotos[i].file, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) {
        setSaving(false);
        alert(`Nahratie fotky zlyhalo: ${uploadError.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from('asset-photos').getPublicUrl(path);
      await supabase.from('asset_photos').insert({
        asset_id: asset.id,
        photo_url: pub.publicUrl,
        storage_path: path,
        user_id: user.id,
        position: startPosition + i,
      });
    }

    // 3) uprav samotný záznam
    const updatePayload: Record<string, unknown> = {
      category: draft.category,
      subtype: draft.subtype || null,
      condition: draft.condition,
      note: draft.note || null,
    };
    if (draft.position) {
      updatePayload.latitude = draft.position.lat;
      updatePayload.longitude = draft.position.lng;
    }

    const { data, error } = await supabase
      .from('vlcince_assets')
      .update(updatePayload)
      .eq('id', asset.id)
      .select(
        'id, created_at, category, subtype, condition, latitude, longitude, note, photo_url, user_id, author:profiles(display_name, contact_email, contact_phone, show_contact, role), photos:asset_photos(id, asset_id, photo_url, storage_path, user_id, position, created_at)'
      )
      .single();

    setSaving(false);
    if (error) {
      alert(`Uloženie zlyhalo: ${error.message}`);
      return;
    }
    if (data) onAssetUpdated?.(data as unknown as AssetRecord);
    onCancelEdit();
  };

  const hasUnsavedChanges = (): boolean => {
    if (!draft) return false;
    return (
      draft.category !== asset.category ||
      draft.subtype !== (asset.subtype ?? '') ||
      draft.condition !== asset.condition ||
      draft.note !== (asset.note ?? '') ||
      draft.position !== null ||
      draft.newPhotos.length > 0 ||
      draft.removedPhotoIds.length > 0
    );
  };

  const handleCancelClick = () => {
    if (hasUnsavedChanges() && !confirm('Zahodiť neuložené zmeny?')) return;
    draft?.newPhotos.forEach((p) => URL.revokeObjectURL(p.preview));
    onCancelEdit();
  };

  const authorRoleLabel = asset.author?.role === 'admin' ? 'Administrátor' : 'Člen komunity';

  if (isEditing && draft) {
    const totalPhotoCount = existingPhotos.length + draft.newPhotos.length;
    return (
      <div className="flex w-60 flex-col gap-2 text-sm">
        <p className="flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1.5 text-xs text-blue-700">
          <Move className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Potiahni značku na mape pre zmenu polohy
        </p>

        <div>
          <label htmlFor="edit-category" className="mb-0.5 block text-xs font-medium text-slate-600">
            Kategória
          </label>
          <select
            id="edit-category"
            value={draft.category}
            onChange={(e) => onChangeDraft({ ...draft, category: e.target.value })}
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="edit-subtype" className="mb-0.5 block text-xs font-medium text-slate-600">
            Podtyp
          </label>
          <input
            id="edit-subtype"
            type="text"
            value={draft.subtype}
            onChange={(e) => onChangeDraft({ ...draft, subtype: e.target.value })}
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
        </div>

        <div>
          <label htmlFor="edit-condition" className="mb-0.5 block text-xs font-medium text-slate-600">
            Stav
          </label>
          <select
            id="edit-condition"
            value={draft.condition}
            onChange={(e) => onChangeDraft({ ...draft, condition: e.target.value })}
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          >
            {conditions.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="edit-note" className="mb-0.5 block text-xs font-medium text-slate-600">
            Poznámka
          </label>
          <textarea
            id="edit-note"
            value={draft.note}
            onChange={(e) => onChangeDraft({ ...draft, note: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
        </div>

        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-600">
            Fotografie ({totalPhotoCount}/{MAX_PHOTOS})
          </label>
          {(existingPhotos.length > 0 || draft.newPhotos.length > 0) && (
            <div className="mb-1.5 grid grid-cols-4 gap-1.5">
              {existingPhotos.map((p) => (
                <div key={p.id} className="relative">
                  <img src={p.photo_url} alt="" className="h-14 w-full rounded object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(p.id)}
                    aria-label="Odstrániť fotku"
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              {draft.newPhotos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.preview} alt="" className="h-14 w-full rounded object-cover ring-2 ring-emerald-400" />
                  <button
                    type="button"
                    onClick={() => removeNewPhoto(i)}
                    aria-label="Odstrániť novú fotku"
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {totalPhotoCount < MAX_PHOTOS && (
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 px-2 py-2 text-xs text-slate-500 hover:border-blue-400">
              {compressingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              {compressingEdit ? 'Spracúvam…' : 'Pridať fotku'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhotos} disabled={compressingEdit} />
            </label>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[rgb(var(--brand-600))] px-2 py-1.5 text-xs font-medium text-white hover:bg-[rgb(var(--brand-700))] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Uložiť
          </button>
          <button
            onClick={handleCancelClick}
            disabled={saving}
            className="flex items-center justify-center gap-1 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
          >
            <X className="h-3 w-3" />
            Zrušiť
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <p className="font-semibold">
        {categoryEmoji(asset.category)} {categoryLabel(asset.category)}
      </p>
      {asset.subtype && <p className="text-slate-500">{asset.subtype}</p>}
      <p className="mt-1">
        Stav:{' '}
        <span style={{ color: conditionColor(asset.condition) }} className="font-medium">
          {conditionLabel(asset.condition)}
        </span>
      </p>
      {asset.note && <p className="mt-1 italic text-slate-600">„{asset.note}“</p>}

      <PhotoGallery photos={asset.photos ?? (asset.photo_url ? [{ id: 'legacy', asset_id: asset.id, photo_url: asset.photo_url, storage_path: '', user_id: null, position: 0, created_at: asset.created_at }] : [])} />

      {asset.author && (
        <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-600">
              {asset.author.display_name || 'Anonymný používateľ'}
            </span>
            <span
              className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                asset.author.role === 'admin'
                  ? 'bg-[rgb(var(--brand-100))] text-[rgb(var(--brand-700))] dark:bg-[rgb(var(--brand-900))] dark:text-[rgb(var(--brand-300))]'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {asset.author.role === 'admin' && <ShieldCheck className="h-2.5 w-2.5" />}
              {authorRoleLabel}
            </span>
          </div>

          {asset.author.show_contact && (asset.author.contact_email || asset.author.contact_phone) && (
            <div className="flex flex-col gap-0.5">
              {asset.author.contact_email && (
                <a href={`mailto:${asset.author.contact_email}`} className="flex items-center gap-1 hover:text-[rgb(var(--brand-700))]">
                  <Mail className="h-3 w-3" /> {asset.author.contact_email}
                </a>
              )}
              {asset.author.contact_phone && (
                <a href={`tel:${asset.author.contact_phone}`} className="flex items-center gap-1 hover:text-[rgb(var(--brand-700))]">
                  <Phone className="h-3 w-3" /> {asset.author.contact_phone}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-1 text-[10px] text-slate-400">
        {new Date(asset.created_at).toLocaleString('sk-SK')}
      </p>

      <HistoryPanel assetId={asset.id} />
      <CommentsPanel assetId={asset.id} />

      {canManage && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={onStartEdit}
            className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Upraviť
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" aria-hidden="true" />}
            Vymazať
          </button>
        </div>
      )}
    </div>
  );
}

/** Vycentruje mapu na aktuálnu GPS polohu - výhradne na požiadanie (tlačidlo). */
function LocateControl() {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  const centerOnMyLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Prehliadač nepodporuje geolokáciu.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], DEFAULT_ZOOM, { animate: true });
        setLocating(false);
        setDenied(false);
      },
      () => {
        setLocating(false);
        setDenied(true);
        alert('Nepodarilo sa zistiť polohu. Skontroluj povolenia pre polohu v prehliadači.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  return (
    <button
      onClick={centerOnMyLocation}
      title="Vycentrovať na moju polohu"
      aria-label="Vycentrovať mapu na moju aktuálnu polohu"
      className="absolute bottom-4 right-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-full bg-white text-[rgb(var(--brand-700))] shadow-lg hover:bg-[rgb(var(--brand-50))] dark:bg-slate-800 dark:text-[rgb(var(--brand-400))] dark:hover:bg-slate-700"
    >
      {locating ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <LocateFixed className={`h-5 w-5 ${denied ? 'text-red-500' : ''}`} />
      )}
    </button>
  );
}

/** Legenda farieb stavu - plávajúci panel, dá sa zbaliť. */
/** Heatmapa hustoty hlásení - vizualizuje, kde sa kumulujú poškodené/chýbajúce
 *  záznamy (užitočné pre admina pri plánovaní údržby). Vypnutá defaultne,
 *  zapína sa tlačidlom - vtedy sa skryjú markery a zobrazí sa len teplotná mapa. */
function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const heat = L.heatLayer(points, { radius: 28, blur: 22, maxZoom: 18 });
    heat.addTo(map);
    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

function Legend() {
  const { conditions } = useTaxonomy();
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute right-4 top-4 z-[1000]">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Zobraziť/skryť legendu farieb stavu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"
        title="Legenda"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-white p-3 text-xs shadow-lg dark:bg-slate-800 dark:text-slate-200">
          <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-100">Stav záznamu</p>
          {conditions.map((cond) => (
            <div key={cond.key} className="flex items-center gap-1.5 py-0.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cond.color }} />
              {cond.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Predstiahne OSM dlaždice pre sídlisko do cache Service Workera, aby mapa fungovala aj offline. */
function OfflineDownloadControl() {
  const map = useMap();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const lonToTileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
  const latToTileY = (lat: number, z: number) =>
    Math.floor(
      ((1 -
        Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
        2) *
        2 ** z
    );

  const handleDownload = async () => {
    const bounds = map.getBounds();
    const zooms = [15, 16, 17];
    const tiles: string[] = [];
    const subdomains = ['a', 'b', 'c'];

    zooms.forEach((z) => {
      const xMin = lonToTileX(bounds.getWest(), z);
      const xMax = lonToTileX(bounds.getEast(), z);
      const yMin = latToTileY(bounds.getNorth(), z);
      const yMax = latToTileY(bounds.getSouth(), z);
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          const s = subdomains[(x + y) % subdomains.length];
          tiles.push(`https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
        }
      }
    });

    setProgress({ done: 0, total: tiles.length });

    for (let i = 0; i < tiles.length; i += 6) {
      const batch = tiles.slice(i, i + 6);
      await Promise.all(batch.map((url) => fetch(url).catch(() => null)));
      setProgress({ done: Math.min(i + 6, tiles.length), total: tiles.length });
      await new Promise((r) => setTimeout(r, 150));
    }

    setTimeout(() => setProgress(null), 2000);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={!!progress}
      title="Stiahnuť mapu pre offline použitie"
      aria-label="Stiahnuť mapové dlaždice sídliska pre offline použitie"
      className="absolute bottom-4 left-4 z-[1000] flex h-11 items-center gap-2 rounded-full bg-white px-4 text-xs font-medium text-slate-600 shadow-lg hover:bg-slate-50 disabled:opacity-70 dark:bg-slate-800 dark:text-slate-300"
    >
      {progress ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress.done}/{progress.total} dlaždíc
        </>
      ) : (
        <>
          <Download className="h-4 w-4" aria-hidden="true" />
          Stiahnuť pre offline
        </>
      )}
    </button>
  );
}

export default function MapView({ assets, onAssetDeleted, onAssetUpdated }: Props) {
  const { categoryEmoji, conditionColor } = useTaxonomy();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [heatmapView, setHeatmapView] = useState(false);

  const heatPoints = useMemo<[number, number, number][]>(
    () =>
      assets
        .filter((a) => a.condition === 'poskodeny' || a.condition === 'chybajuci')
        .map((a) => [a.latitude, a.longitude, a.condition === 'chybajuci' ? 1 : 0.6]),
    [assets]
  );

  const startEdit = (asset: AssetRecord) => {
    setEditingId(asset.id);
    setDraft({
      category: asset.category,
      subtype: asset.subtype ?? '',
      condition: asset.condition,
      note: asset.note ?? '',
      position: null,
      newPhotos: [],
      removedPhotoIds: [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  useEffect(() => {
    if (!editingId) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editingId]);

  const icons = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    return (category: AssetCategory, condition: AssetCondition, editing: boolean) => {
      const key = `${category}-${condition}-${editing}`;
      if (!cache.has(key)) cache.set(key, buildIcon(categoryEmoji(category), conditionColor(condition), editing));
      return cache.get(key)!;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryEmoji, conditionColor]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={VLCINCE_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        scrollWheelZoom
        aria-label="Mapa záznamov mobiliáru a zelene sídliska Vlčince"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> prispievatelia'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {heatmapView ? (
          <HeatmapLayer points={heatPoints} />
        ) : (
          <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
            {assets.map((asset) => {
              const isEditing = editingId === asset.id;
              const position: L.LatLngExpression =
                isEditing && draft?.position ? draft.position : [asset.latitude, asset.longitude];
              const displayCategory = isEditing && draft ? draft.category : asset.category;
              const displayCondition = isEditing && draft ? draft.condition : asset.condition;

              return (
                <Marker
                  key={asset.id}
                  position={position}
                  icon={icons(displayCategory, displayCondition, isEditing)}
                  draggable={isEditing}
                  eventHandlers={
                    isEditing
                      ? {
                          dragend: (e) => {
                            const marker = e.target as L.Marker;
                            setDraft((d) => (d ? { ...d, position: marker.getLatLng() } : d));
                          },
                        }
                      : undefined
                  }
                >
                  <Popup autoClose={false} closeOnClick={false} maxHeight={360}>
                    <AssetPopupContent
                      asset={asset}
                      onAssetDeleted={onAssetDeleted}
                      onAssetUpdated={onAssetUpdated}
                      isEditing={isEditing}
                      draft={isEditing ? draft : null}
                      onStartEdit={() => startEdit(asset)}
                      onChangeDraft={setDraft}
                      onCancelEdit={cancelEdit}
                    />
                  </Popup>
                </Marker>
              );
            })}
          </MarkerClusterGroup>
        )}

        <LocateControl />
        <Legend />
        <OfflineDownloadControl />

        <button
          onClick={() => setHeatmapView((v) => !v)}
          aria-pressed={heatmapView}
          title={heatmapView ? 'Zobraziť značky' : 'Zobraziť heatmapu hlásení'}
          className={`absolute right-4 top-16 z-[1000] flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition ${
            heatmapView
              ? 'bg-[rgb(var(--brand-600))] text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {heatmapView ? <MapPin className="h-4 w-4" /> : <Flame className="h-4 w-4" />}
        </button>
      </MapContainer>
    </div>
  );
}
