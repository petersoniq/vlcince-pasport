// Kategórie a stavy sú od v2.0 konfigurovateľné (tabuľky categories/conditions v DB),
// nie pevné TS union typy. Reťazcový typ + dynamické načítanie cez lib/taxonomy.tsx.
export type AssetCategory = string;
export type AssetCondition = string;

export interface Category {
  key: string;
  label: string;
  emoji: string;
  sort_order: number;
  active: boolean;
}

export interface ConditionDef {
  key: string;
  label: string;
  color: string;
  sort_order: number;
  active: boolean;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  show_contact: boolean;
  role: 'user' | 'admin';
  has_seen_onboarding: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssetPhoto {
  id: string;
  asset_id: string;
  photo_url: string;
  storage_path: string;
  user_id: string | null;
  position: number;
  created_at: string;
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
  /** @deprecated nahradené `photos` (viacnásobné fotky) - ponechané pre spätnú kompatibilitu */
  photo_url: string | null;
  user_id: string | null;
  photos?: AssetPhoto[];
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
  /** Viacnásobné fotky - už skomprimované (JPEG Blob) pred uložením do fronty */
  photo_blobs: Blob[];
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
  dateFrom: string | null;
  dateTo: string | null;
}
