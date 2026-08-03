import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Category, ConditionDef } from '../types';

interface TaxonomyContextValue {
  categories: Category[];
  conditions: ConditionDef[];
  loading: boolean;
  categoryLabel: (key: string) => string;
  categoryEmoji: (key: string) => string;
  conditionLabel: (key: string) => string;
  conditionColor: (key: string) => string;
  refresh: () => Promise<void>;
}

const TaxonomyContext = createContext<TaxonomyContextValue | undefined>(undefined);

const FALLBACK_COLOR = '#64748b';
const FALLBACK_EMOJI = '📍';

export function TaxonomyProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [conditions, setConditions] = useState<ConditionDef[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [catRes, condRes] = await Promise.all([
      supabase.from('categories').select('*').eq('active', true).order('sort_order'),
      supabase.from('conditions').select('*').eq('active', true).order('sort_order'),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (condRes.data) setConditions(condRes.data as ConditionDef[]);
    setLoading(false);
  };

  useEffect(() => {
    load();

    // Realtime - ak admin pridá/upraví kategóriu/stav, prejaví sa všetkým bez refreshu
    const channel = supabase
      .channel('taxonomy_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conditions' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const categoryLabel = (key: string) => categories.find((c) => c.key === key)?.label ?? key;
  const categoryEmoji = (key: string) => categories.find((c) => c.key === key)?.emoji ?? FALLBACK_EMOJI;
  const conditionLabel = (key: string) => conditions.find((c) => c.key === key)?.label ?? key;
  const conditionColor = (key: string) => conditions.find((c) => c.key === key)?.color ?? FALLBACK_COLOR;

  return (
    <TaxonomyContext.Provider
      value={{ categories, conditions, loading, categoryLabel, categoryEmoji, conditionLabel, conditionColor, refresh: load }}
    >
      {children}
    </TaxonomyContext.Provider>
  );
}

export function useTaxonomy(): TaxonomyContextValue {
  const ctx = useContext(TaxonomyContext);
  if (!ctx) throw new Error('useTaxonomy musí byť použitý vnútri <TaxonomyProvider>');
  return ctx;
}
