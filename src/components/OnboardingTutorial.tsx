import { useState } from 'react';
import { ClipboardPlus, Map as MapIcon, BarChart3, Users, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

interface Slide {
  icon: typeof ClipboardPlus;
  title: string;
  text: string;
}

const SLIDES: Slide[] = [
  {
    icon: ClipboardPlus,
    title: 'Zbieraj v teréne',
    text: 'V záložke Zber zaznamenaj lavičku, kôš, strom alebo iný prvok - appka si sama zistí tvoju GPS polohu. Funguje aj bez internetu, dáta sa odošlú neskôr.',
  },
  {
    icon: MapIcon,
    title: 'Prezri si mapu',
    text: 'Všetky záznamy uvidíš na mape, farebne podľa stavu. Klikni na značku pre detail, históriu zmien a diskusiu.',
  },
  {
    icon: BarChart3,
    title: 'Sleduj štatistiky',
    text: 'Prehľad počtov podľa kategórie a stavu, export do CSV/GeoJSON pre ďalšie spracovanie.',
  },
  {
    icon: Users,
    title: 'Si súčasť komunity',
    text: 'Diskutuj pod záznamami, sleduj históriu opráv. Ak si admin, máš navyše prístup k správe používateľov a záznamov.',
  },
];

export default function OnboardingTutorial({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const finish = async () => {
    if (user) {
      await supabase.from('profiles').update({ has_seen_onboarding: true }).eq('id', user.id);
    }
    onDone();
  };

  const next = () => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-slate-800" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <button
          onClick={finish}
          aria-label="Preskočiť úvod"
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--brand-100))] dark:bg-[rgb(var(--brand-900))]">
            <slide.icon className="h-7 w-7 text-[rgb(var(--brand-700))] dark:text-[rgb(var(--brand-300))]" />
          </div>
          <h2 id="onboarding-title" className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {slide.title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{slide.text}</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-5 bg-[rgb(var(--brand-600))]' : 'w-1.5 bg-slate-200 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[rgb(var(--brand-600))] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[rgb(var(--brand-700))]"
        >
          {isLast ? 'Začať používať appku' : 'Ďalej'}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
