const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

/** Skomprimuje obrázok (zmenší rozmer na max. MAX_DIMENSION px dlhšej strany,
 *  prevedie na JPEG s kvalitou JPEG_QUALITY) priamo v prehliadači cez Canvas API.
 *  Fotky z mobilu bývajú 3-8 MB - toto ich typicky zredukuje na pár stovák kB,
 *  čo výrazne zrýchli upload v teréne na mobilných dátach a šetrí Storage. */
export async function compressImage(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file instanceof Blob ? file : new Blob([file]);

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? (file instanceof Blob ? file : new Blob([file]))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}
