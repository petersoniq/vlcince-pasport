import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  latitude: number;
  longitude: number;
  accuracyColor: string;
}

/** Malý, neinteraktívny náhľad polohy - potvrdí používateľovi "si tu", bez
 *  zbytočných kontrol (žiadny zoom/drag), aby zostal vizuálne nenápadný
 *  v hornej časti zberného formulára. Samostatný lazy chunk - Leaflet sa
 *  stiahne až keď appka reálne získa GPS súradnice. */
export default function LocationMiniMap({ latitude, longitude, accuracyColor }: Props) {
  return (
    <div className="h-28 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <MapContainer
        center={[latitude, longitude]}
        zoom={17}
        className="h-full w-full"
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
        aria-label="Náhľad aktuálnej polohy na mape"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <CircleMarker
          center={[latitude, longitude]}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: accuracyColor, fillOpacity: 0.9 }}
        />
      </MapContainer>
    </div>
  );
}
