import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Download, FileJson } from 'lucide-react';
import type { AssetRecord } from '../types';
import { CATEGORY_LABELS, CONDITION_LABELS, CONDITION_COLORS } from '../types';
import { exportAssetsToCsv, exportAssetsToGeoJson } from '../lib/export';

interface Props {
  assets: AssetRecord[];
}

export default function StatsPanel({ assets }: Props) {
  const byCategory = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    label,
    pocet: assets.filter((a) => a.category === key).length,
  }));

  const byCondition = Object.entries(CONDITION_LABELS).map(([key, label]) => ({
    key,
    label,
    pocet: assets.filter((a) => a.condition === key).length,
  }));

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Export {assets.length} zobrazených záznamov (rešpektuje aktívne filtre)
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => exportAssetsToCsv(assets)}
            disabled={assets.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            onClick={() => exportAssetsToGeoJson(assets)}
            disabled={assets.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <FileJson className="h-3.5 w-3.5" /> GeoJSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Počet podľa kategórie</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="pocet" fill="#059669" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Počet podľa stavu</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCondition}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="pocet" radius={[4, 4, 0, 0]}>
                {byCondition.map((entry) => (
                  <Cell key={entry.key} fill={CONDITION_COLORS[entry.key as keyof typeof CONDITION_COLORS]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
