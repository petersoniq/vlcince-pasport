import { useRef } from 'react';

const SWIPE_MIN_DISTANCE = 60; // px - minimálna vzdialenosť, aby sa to nepovažovalo za náhodný tap
const SWIPE_MAX_VERTICAL_RATIO = 0.5; // gesto musí byť prevažne horizontálne, nie scroll

interface Options<T extends string> {
  order: T[];
  current: T;
  onNavigate: (next: T) => void;
}

/** Umožní prepínanie medzi záložkami potiahnutím prsta doľava/doprava.
 *  Zámerne ignoruje gestá, ktoré začínajú nad Leaflet mapou (`.leaflet-container`)
 *  alebo nad horizontálne posúvateľným obsahom (napr. galéria fotiek v popupe) -
 *  tam má prednosť natívne ťahanie/priblíženie mapy, nie prepnutie záložky. */
export function useSwipeNavigation<T extends string>({ order, current, onNavigate }: Options<T>) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const ignoreGesture = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Nechaj mapu (pan/zoom/drag markera) a akýkoľvek iný horizontálne posúvateľný
    // prvok spracovať gesto samostatne - swipe na prepnutie záložky sa neaktivuje.
    ignoreGesture.current = !!target.closest('.leaflet-container, [data-swipe-ignore]');
    if (ignoreGesture.current) return;

    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (ignoreGesture.current || startX.current === null || startY.current === null) {
      startX.current = null;
      startY.current = null;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX.current;
    const deltaY = endY - startY.current;
    startX.current = null;
    startY.current = null;

    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE) return;
    if (Math.abs(deltaY) > Math.abs(deltaX) * SWIPE_MAX_VERTICAL_RATIO) return; // príliš zvislé -> je to scroll

    const currentIndex = order.indexOf(current);
    if (currentIndex === -1) return;

    if (deltaX < 0 && currentIndex < order.length - 1) {
      onNavigate(order[currentIndex + 1]); // swipe doľava -> ďalšia záložka
    } else if (deltaX > 0 && currentIndex > 0) {
      onNavigate(order[currentIndex - 1]); // swipe doprava -> predchádzajúca záložka
    }
  };

  return { onTouchStart, onTouchEnd };
}
