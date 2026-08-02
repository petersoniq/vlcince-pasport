import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'vlcince-install-dismissed';

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error - iOS Safari špecifické
    window.navigator.standalone === true
  );
}

/** Ponúkne inštaláciu appky ako PWA. Na Android/Desktop Chrome/Edge zachytí natívny
 *  beforeinstallprompt a spustí ho na kliknutie. Na iOS Safari (kde tento event
 *  neexistuje) zobrazí krátky návod na "Pridať na plochu" cez zdieľacie menu. */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === '1');

  useEffect(() => {
    if (isStandalone()) return; // už je nainštalovaná, netreba nič ponúkať

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS nemá beforeinstallprompt vôbec - ak sme na iOS a nie sme v standalone, ponúkni návod
    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISSED_KEY, '1');
  };

  if (dismissed || isStandalone() || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[rgb(var(--brand-100))] bg-[rgb(var(--brand-50))] px-4 py-2 text-xs text-[rgb(var(--brand-800))] dark:border-[rgb(var(--brand-900))] dark:bg-[rgb(var(--brand-950))] dark:text-[rgb(var(--brand-300))]">
      {deferredPrompt ? (
        <>
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 shrink-0" />
            <span>Appku si môžeš nainštalovať na plochu pre rýchlejší prístup.</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleInstall}
              className="rounded-md bg-[rgb(var(--brand-600))] px-3 py-1 font-medium text-white hover:bg-[rgb(var(--brand-700))]"
            >
              Inštalovať
            </button>
            <button onClick={handleDismiss} aria-label="Zavrieť">
              <X className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Share className="h-4 w-4 shrink-0" />
            <span>
              Pridaj appku na plochu: klepni na <strong>Zdieľať</strong> a potom{' '}
              <strong>Pridať na plochu</strong>.
            </span>
          </div>
          <button onClick={handleDismiss} aria-label="Zavrieť" className="shrink-0">
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
