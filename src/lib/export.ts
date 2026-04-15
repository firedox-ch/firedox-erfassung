import JSZip from 'jszip';
import type { Liegenschaft, Mangel, Asset } from './db';

function base64ToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const ext = mime.split('/')[1] || 'jpg';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return { blob: new Blob([array], { type: mime }), ext };
}

export async function exportAsZip(
  liegenschaft: Liegenschaft,
  maengel: Mangel[],
  assets: Asset[] = []
): Promise<Blob> {
  const zip = new JSZip();
  const folderName = `${liegenschaft.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')}_${new Date().toISOString().split('T')[0]}`;
  const root = zip.folder(folderName)!;

  const exportData = {
    liegenschaft,
    assets: assets.map(a => ({
      ...a,
      fotos: a.fotos.map((_, i) => `fotos/asset_${a.id}_${i + 1}.jpg`),
    })),
    maengel: maengel.map(m => ({
      ...m,
      fotos: m.fotos.map((_, i) => `fotos/mangel_${m.id}_${i + 1}.jpg`),
    })),
    exportDatum: new Date().toISOString(),
    version: '2.0.0',
  };

  root.file('erfassung.json', JSON.stringify(exportData, null, 2));

  const fotosFolder = root.folder('fotos')!;

  // Asset photos
  for (const asset of assets) {
    for (let i = 0; i < asset.fotos.length; i++) {
      if (asset.fotos[i]) {
        try {
          const { blob, ext } = base64ToBlob(asset.fotos[i]);
          fotosFolder.file(`asset_${asset.id}_${i + 1}.${ext}`, blob);
        } catch { /* skip */ }
      }
    }
  }

  // Mangel photos
  for (const mangel of maengel) {
    for (let i = 0; i < mangel.fotos.length; i++) {
      if (mangel.fotos[i]) {
        try {
          const { blob, ext } = base64ToBlob(mangel.fotos[i]);
          fotosFolder.file(`mangel_${mangel.id}_${i + 1}.${ext}`, blob);
        } catch { /* skip */ }
      }
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
