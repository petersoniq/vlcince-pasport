import { supabase } from './supabase';
import {
  getPendingAssets,
  updateAssetStatus,
  removeAsset,
} from './db';
import type { PendingAsset } from '../types';

let syncInFlight = false;

/** Nahrá jednu fotku do Supabase Storage a vráti verejnú URL + cestu. */
async function uploadOnePhoto(
  deviceLocalId: string,
  index: number,
  blob: Blob
): Promise<{ url: string; path: string } | null> {
  const path = `${deviceLocalId}-${index}.jpg`;
  const { error } = await supabase.storage
    .from('asset-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    console.error('Chyba pri nahrávaní fotky:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('asset-photos').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

async function syncOne(item: PendingAsset): Promise<void> {
  await updateAssetStatus(item.device_local_id, 'syncing');

  // Obranná kontrola: záznamy vytvorené staršou verziou appky (pred zavedením
  // prihlasovania) nemajú priradené user_id a nikdy sa nemôžu synchronizovať
  // (RLS to zamietne). Namiesto nekonečného opakovania to rovno označíme ako
  // neopraviteľnú chybu - používateľ ich môže vymazať v SyncStatus paneli.
  if (!item.user_id) {
    await updateAssetStatus(
      item.device_local_id,
      'error',
      'Záznam nemá priradeného autora (vytvorený staršou verziou appky) - vymaž ho a zaznamenaj znova.'
    );
    return;
  }

  try {
    // Najprv nahraj všetky fotky (nezávisle od insertu záznamu)
    const uploaded = (
      await Promise.all(item.photo_blobs.map((blob, i) => uploadOnePhoto(item.device_local_id, i, blob)))
    ).filter((r): r is { url: string; path: string } => r !== null);

    // upsert na device_local_id -> ak sa záznam už dostal na server pri
    // predchádzajúcom (napr. prerušenom) pokuse, nevytvorí sa duplicita
    const { data: assetRow, error } = await supabase
      .from('vlcince_assets')
      .upsert(
        {
          category: item.category,
          subtype: item.subtype || null,
          condition: item.condition,
          latitude: item.latitude,
          longitude: item.longitude,
          gps_accuracy_m: item.gps_accuracy_m,
          note: item.note || null,
          photo_url: uploaded[0]?.url ?? null, // spätná kompatibilita - prvá fotka
          source: 'terenny_zber',
          device_local_id: item.device_local_id,
          user_id: item.user_id,
        },
        { onConflict: 'device_local_id' }
      )
      .select('id')
      .single();

    if (error) throw error;

    // Zapíš všetky fotky do asset_photos (aj tú prvú - photo_url stĺpec je len legacy zrkadlo)
    if (assetRow && uploaded.length > 0) {
      await supabase.from('asset_photos').insert(
        uploaded.map((u, i) => ({
          asset_id: assetRow.id,
          photo_url: u.url,
          storage_path: u.path,
          user_id: item.user_id,
          position: i,
        }))
      );
    }

    await removeAsset(item.device_local_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Neznáma chyba pri synchronizácii';
    await updateAssetStatus(item.device_local_id, 'error', message);
  }
}

/** Prejde celú offline frontu a pokúsi sa ju odoslať do Supabase.
 *  Bezpečné volať opakovane (napr. pri každom 'online' evente) – beží len jedna inštancia naraz. */
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (syncInFlight) return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  syncInFlight = true;
  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPendingAssets();
    for (const item of pending) {
      const before = await getPendingAssets();
      const stillExists = before.some((p) => p.device_local_id === item.device_local_id);
      if (!stillExists) continue;

      await syncOne(item);
      const after = await getPendingAssets();
      const succeeded = !after.some((p) => p.device_local_id === item.device_local_id);
      if (succeeded) synced += 1;
      else failed += 1;
    }
  } finally {
    syncInFlight = false;
  }

  return { synced, failed };
}

/** Zaregistruje Background Sync tag - prehliadač (ak podporuje) automaticky
 *  zobudí Service Worker a spustí syncQueue() aj keď je appka zatvorená.
 *  Bezpečné volať aj keď prehliadač Background Sync nepodporuje (napr. Safari) -
 *  vtedy jednoducho nič nerobí, spolieha sa na existujúci setInterval retry. */
export async function registerBackgroundSync(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const syncManager = (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;
    if (syncManager) {
      await syncManager.register('sync-assets');
    }
  } catch {
    // Background Sync nie je podporovaný alebo zlyhal - ticho ignoruj,
    // klasický setInterval retry v initAutoSync() to aj tak pokryje.
  }
}

/** Zaregistruje automatický sync pri návrate pripojenia a periodický retry. */
export function initAutoSync(onResult?: (r: { synced: number; failed: number }) => void) {
  const run = async () => {
    const result = await syncQueue();
    if (result.synced > 0 || result.failed > 0) onResult?.(result);
  };

  window.addEventListener('online', run);
  // periodický pokus (napr. pri nestabilnom 3G) každých 30s
  const interval = setInterval(run, 30_000);
  run(); // pokus hneď pri štarte appky

  return () => {
    window.removeEventListener('online', run);
    clearInterval(interval);
  };
}
