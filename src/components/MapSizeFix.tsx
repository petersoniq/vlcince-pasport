import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/** Rieši známy Leaflet bug: ak sa mapa vytvorí v momente, keď jej kontajner
 *  ešte nemá definitívnu veľkosť (napr. počas prechodu medzi záložkami cez
 *  swipe, alebo tesne po dobehnutí lazy-loaded chunku), Leaflet si zle spočíta
 *  rozmery dlaždíc a zobrazí prázdnu bielu plochu, kým nepríde k resize okna.
 *  Toto vynúti prepočet hneď po vytvorení (viackrát, pre istotu) a zároveň
 *  sleduje zmenu veľkosti samotného kontajnera (napr. pri otvorení/zatvorení
 *  klávesnice na mobile alebo zmene orientácie). Vlož ako dieťa <MapContainer>. */
export default function MapSizeFix() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize();

    const raf = requestAnimationFrame(invalidate);
    const timeouts = [50, 200, 500].map((ms) => setTimeout(invalidate, ms));

    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => invalidate());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      timeouts.forEach(clearTimeout);
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
}
