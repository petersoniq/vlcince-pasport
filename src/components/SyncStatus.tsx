import { useEffect, useState, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { getAllQueuedAssets, clearErrorAssets } from '../lib/db';
import { syncQueue, initAutoSync } from '../lib/sync';
import type { PendingAsset } from '../types';

export default function SyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorItems, setErrorItems] = useState<PendingAsset[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const refreshCounts = useCallback(async () => {
    const all = await getAllQueuedAssets();
    setPendingCount(all.filter((a) => a.sync_status === 'pending').length);
    setErrorItems(all.filter((a) => a.sync_status === 'error'));
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    refreshCounts();
    const cleanup = initAutoSync(() => refreshCounts());
    const interval = setInterval(refreshCounts, 5000);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      cleanup();
      clearInterval(interval);
    };
  }, [refreshCounts]);

  const handleManualSync = async () => {
    setSyncing(true);
    await syncQueue();
    await refreshCounts();
    setSyncing(false);
  };

  const handleClearErrors = async () => {
    if (!confirm(`Naozaj vymazať ${errorItems.length} zaseknutých záznamov z tohto zariadenia? (dáta neboli nikdy odoslané na server)`)) {
      return;
    }
    await clearErrorAssets();
    await refreshCounts();
    setDetailsOpen(false);
  };

  const errorCount = errorItems.length;

  return (
    <div className="shrink-0 border-b border-slate-100 bg-white text-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-1.5">
          {online ? (
            <Wifi className="h-4 w-4 text-[rgb(var(--brand-600))]" />
          ) : (
            <WifiOff className="h-4 w-4 text-slate-400" />
          )}
          <span className={online ? 'text-[rgb(var(--brand-700))] dark:text-[rgb(var(--brand-400))]' : 'text-slate-500 dark:text-slate-400'}>
            {online ? 'Online' : 'Offline režim'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {pendingCount} čaká na odoslanie
            </span>
          )}
          {errorCount > 0 && (
            <button
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-950 dark:text-red-300"
            >
              <AlertCircle className="h-3 w-3" />
              {errorCount} zlyhalo
            </button>
          )}
          {(pendingCount > 0 || errorCount > 0) && (
            <button
              onClick={handleManualSync}
              disabled={syncing || !online}
              className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300 disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          )}
        </div>
      </div>

      {detailsOpen && errorCount > 0 && (
        <div className="flex flex-col gap-2 border-t border-red-100 bg-red-50 px-4 py-3">
          <p className="text-red-700">
            Tieto záznamy sa opakovane nepodarilo odoslať na server:
          </p>
          <ul className="flex flex-col gap-1 text-red-600">
            {errorItems.map((item) => (
              <li key={item.device_local_id} className="truncate">
                • {item.category} — {item.sync_error ?? 'neznáma chyba'}
              </li>
            ))}
          </ul>
          <button
            onClick={handleClearErrors}
            className="flex items-center justify-center gap-1.5 self-start rounded-md bg-red-600 px-3 py-1.5 font-medium text-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Vymazať zlyhané záznamy z tohto zariadenia
          </button>
        </div>
      )}
    </div>
  );
}
