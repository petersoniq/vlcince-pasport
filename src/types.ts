// Typy zodpovedajú SQL enumom v supabase/schema.sql

export type AssetCategory =
  | 'lavicka'
  | 'kos'
  | 'zelen_strom'
  | 'zelen_kry'
  | 'zelen_trvalka'
  | 'detsky_prvok'
  | 'sportovy_prvok'
  | 'osvetlenie'
  | 'ine';

export type AssetCondition = 'dobry' | 'poskodeny' | 'chybajuci' | 'na_vymenu';

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  lavicka: 'Lavička',
  kos: 'Odpadkový kôš',
  zelen_strom: 'Strom',
  zelen_kry: 'Ker / živý plot',
  zelen_trvalka: 'Trávnik / záhon',
  detsky_prvok: 'Detský prvok',
  sportovy_prvok: 'Športový/fitness prvok',
  osvetlenie: 'Verejné osvetlenie',
  ine: 'Iné',
};

export const CONDITION_LABELS: Record<AssetCondition, string> = {
  dobry: 'Dobrý stav',
  poskodeny: 'Poškodený',
  chybajuci: 'Chýbajúci',
  na_vymenu: 'Na výmenu',
};

export const CONDITION_COLORS: Record<AssetCondition, string> = {
  dobry: '#16a34a',
  poskodeny: '#f59e0b',
  chybajuci: '#dc2626',
  na_vymenu: '#9333ea',
};

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  show_contact: boolean;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

/** Záznam tak, ako existuje (alebo bude existovať) v Supabase */
export interface AssetRecord {
  id: string;
  created_at: string;
  category: AssetCategory;
  subtype: string | null;
  condition: AssetCondition;
  latitude: number;
  longitude: number;
  note: string | null;
  photo_url: string | null;
  user_id: string | null;
  /** Voliteľne pripojené cez join s profiles - meno, kontakt a rola autora (ak si to zvolil zverejniť) */
  author?: {
    display_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    show_contact: boolean;
    role: 'user' | 'admin';
  } | null;
}

/** Záznam vo fronte v IndexedDB pred odoslaním na server (zberná časť appky) */
export interface PendingAsset {
  device_local_id: string;
  user_id: string;
  category: AssetCategory;
  subtype: string;
  condition: AssetCondition;
  latitude: number;
  longitude: number;
  gps_accuracy_m: number | null;
  note: string;
  photo_blob: Blob | null;
  created_at: string;
  sync_status: 'pending' | 'syncing' | 'error';
  sync_error?: string;
}

export interface StatusHistoryEntry {
  id: string;
  asset_id: string;
  old_condition: AssetCondition | null;
  new_condition: AssetCondition;
  changed_at: string;
  changed_by: string | null;
}

export interface AssetComment {
  id: string;
  asset_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: {
    display_name: string | null;
    role: 'user' | 'admin';
  } | null;
}

/** Filtre používané v mapovom/štatistickom pohľade */
export interface Filters {
  categories: AssetCategory[];
  conditions: AssetCondition[];
  search: string;
  myOnly: boolean;
  dateFrom: string | null; // ISO dátum (yyyy-mm-dd), vrátane
  dateTo: string | null; // ISO dátum (yyyy-mm-dd), vrátane
}
