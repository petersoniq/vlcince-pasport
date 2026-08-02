import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Accent = 'green' | 'blue' | 'violet' | 'rose';
const STORAGE_KEY = 'vlcince-accent';

export const ACCENT_OPTIONS: { key: Accent; label: string; swatch: string }[] = [
  { key: 'green', label: 'Zelená', swatch: '#059669' },
  { key: 'blue', label: 'Modrá', swatch: '#2563eb' },
  { key: 'violet', label: 'Fialová', swatch: '#7c3aed' },
  { key: 'rose', label: 'Ružová', swatch: '#e11d48' },
];

interface AccentContextValue {
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

const AccentContext = createContext<AccentContextValue | undefined>(undefined);

function getInitialAccent(): Accent {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'green' || stored === 'blue' || stored === 'violet' || stored === 'rose') return stored;
  return 'green';
}

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<Accent>(getInitialAccent);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem(STORAGE_KEY, accent);
  }, [accent]);

  const setAccent = (next: Accent) => setAccentState(next);

  return <AccentContext.Provider value={{ accent, setAccent }}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentContextValue {
  const ctx = useContext(AccentContext);
  if (!ctx) throw new Error('useAccent musí byť použitý vnútri <AccentProvider>');
  return ctx;
}
