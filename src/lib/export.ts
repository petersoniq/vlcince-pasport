import type { AssetRecord } from '../types';
import { CATEGORY_LABELS, CONDITION_LABELS } from '../types';

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportAssetsToCsv(assets: AssetRecord[]) {
  const headers = [
    'id',
    'kategoria',
    'podtyp',
    'stav',
    'latitude',
    'longitude',
    'poznamka',
    'autor',
    'vytvorene',
  ];
  const rows = assets.map((a) =>
    [
      a.id,
      CATEGORY_LABELS[a.category],
      a.subtype ?? '',
      CONDITION_LABELS[a.condition],
      String(a.latitude),
      String(a.longitude),
      a.note ?? '',
      a.author?.display_name ?? '',
      new Date(a.created_at).toLocaleString('sk-SK'),
    ]
      .map((v) => csvEscape(String(v)))
      .join(';')
  );
  const csv = [headers.join(';'), ...rows].join('\n');
  // BOM na začiatku, aby Excel správne rozpoznal UTF-8 (diakritika)
  downloadBlob('\uFEFF' + csv, `vlcince-pasport-${Date.now()}.csv`, 'text/csv;charset=utf-8');
}

export function exportAssetsToGeoJson(assets: AssetRecord[]) {
  const geojson = {
    type: 'FeatureCollection',
    features: assets.map((a) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
      properties: {
        id: a.id,
        category: a.category,
        category_label: CATEGORY_LABELS[a.category],
        subtype: a.subtype,
        condition: a.condition,
        condition_label: CONDITION_LABELS[a.condition],
        note: a.note,
        author: a.author?.display_name ?? null,
        created_at: a.created_at,
      },
    })),
  };
  downloadBlob(JSON.stringify(geojson, null, 2), `vlcince-pasport-${Date.now()}.geojson`, 'application/geo+json');
}
