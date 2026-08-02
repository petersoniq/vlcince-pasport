import { Search } from 'lucide-react';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  CONDITION_COLORS,
  type AssetCategory,
  type AssetCondition,
  type Filters,
} from '../types';
import { useAuth } from '../lib/auth';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as AssetCategory[];
const CONDITIONS = Object.keys(CONDITION_LABELS) as AssetCondition[];

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  totalCount: number;
  filteredCount: number;
}

export default function FilterPanel({ filters, onChange, totalCount, filteredCount }: Props) {
  const { user } = useAuth();

  const toggleCategory = (cat: AssetCategory): void => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: next });
  };

  const toggleCondition = (cond: AssetCondition): void => {
    const next = filters.conditions.includes(cond)
      ? filters.conditions.filter((c) => c !== cond)
      : [...filters.conditions, cond];
    onChange({ ...filters, conditions: next });
  };

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Hľadať v poznámkach…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {user && (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[rgb(var(--brand-50))] px-3 py-2 text-sm text-[rgb(var(--brand-800))] dark:bg-[rgb(var(--brand-900)/30%)] dark:text-[rgb(var(--brand-300))]">
          <input
            type="checkbox"
            checked={filters.myOnly}
            onChange={(e) => onChange({ ...filters, myOnly: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 accent-[rgb(var(--brand-600))] dark:border-slate-600"
          />
          Zobraziť len moje záznamy
        </label>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Obdobie vytvorenia
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
            max={filters.dateTo ?? undefined}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <span className="text-xs text-slate-400">–</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
            min={filters.dateFrom ?? undefined}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-[rgb(var(--brand-500))] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        {(filters.dateFrom || filters.dateTo) && (
          <button
            onClick={() => onChange({ ...filters, dateFrom: null, dateTo: null })}
            className="mt-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Zrušiť obdobie
          </button>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Kategória
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                filters.categories.includes(cat)
                  ? 'border-[rgb(var(--brand-600))] bg-[rgb(var(--brand-600))] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-[rgb(var(--brand-300))] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Stav
        </h3>
        <div className="flex flex-col gap-1.5">
          {CONDITIONS.map((cond) => (
            <label
              key={cond}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <input
                type="checkbox"
                checked={filters.conditions.includes(cond)}
                onChange={() => toggleCondition(cond)}
                className="h-4 w-4 rounded border-slate-300 accent-[rgb(var(--brand-600))] dark:border-slate-600"
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CONDITION_COLORS[cond] }}
              />
              {CONDITION_LABELS[cond]}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-auto rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        Zobrazených <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredCount}</span> z{' '}
        {totalCount} záznamov
      </div>
    </div>
  );
}
