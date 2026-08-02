import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PendingAsset } from '../types';

interface VlcinceDB extends DBSchema {
  pending_assets: {
    key: string; // device_local_id
    value: PendingAsset;
    indexes: { 'by-status': string };
  };
}

const DB_NAME = 'vlcince-collector';
const DB_VERSION = 1;
const STORE = 'pending_assets';

let dbPromise: Promise<IDBPDatabase<VlcinceDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<VlcinceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'device_local_id' });
        store.createIndex('by-status', 'sync_status');
      },
    });
  }
  return dbPromise;
}

/** Uloží nový záznam do offline fronty (vždy, aj keď je pripojenie aktívne –
 *  zjednodušuje to logiku: sync mechanizmus rieši odoslanie separátne). */
export async function queueAsset(asset: PendingAsset): Promise<void> {
  const db = await getDb();
  await db.put(STORE, asset);
}

/** Vráti všetky záznamy čakajúce na odoslanie (pending alebo error - retry). */
export async function getPendingAssets(): Promise<PendingAsset[]> {
  const db = await getDb();
  const all = await db.getAll(STORE);
  return all.filter((a) => a.sync_status !== 'syncing');
}

/** Všetky záznamy vo fronte (pre zobrazenie stavu v UI, vrátane odoslaných zostávajú
 *  krátkodobo kým sa nezmažú). */
export async function getAllQueuedAssets(): Promise<PendingAsset[]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function updateAssetStatus(
  deviceLocalId: string,
  status: PendingAsset['sync_status'],
  error?: string
): Promise<void> {
  const db = await getDb();
  const record = await db.get(STORE, deviceLocalId);
  if (!record) return;
  record.sync_status = status;
  record.sync_error = error;
  await db.put(STORE, record);
}

export async function removeAsset(deviceLocalId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, deviceLocalId);
}

/** Vymaže všetky záznamy vo fronte, ktoré opakovane zlyhávajú (napr. staré záznamy
 *  bez priradeného user_id z verzie appky pred zavedením prihlasovania). */
export async function clearErrorAssets(): Promise<number> {
  const db = await getDb();
  const errored = await db.getAllFromIndex(STORE, 'by-status', 'error');
  await Promise.all(errored.map((a) => db.delete(STORE, a.device_local_id)));
  return errored.length;
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE, 'by-status', 'pending');
  return all.length;
}
