import JSZip from 'jszip';
import type { Liegenschaft, Mangel } from './db';

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
  maengel: Mangel[]
): Promise<Blob> {
  const zip = new JSZip();
  const folderName = `${liegenschaft.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')}_${liegenschaft.begehungsDatum || 'ohne-datum'}`;
  const root = zip.folder(folderName)!;

  // Export Liegenschaft data
  const exportData = {
    liegenschaft: {
      ...liegenschaft,
    },
    maengel: maengel.map(m => ({
      ...m,
      fotos: m.fotos.map((_, i) => `fotos/${m.id}_foto_${i + 1}.jpg`),
    })),
    exportDatum: new Date().toISOString(),
    version: '1.0.0',
  };

  root.file('erfassung.json', JSON.stringify(exportData, null, 2));

  // Export photos
  const fotosFolder = root.folder('fotos')!;
  for (const mangel of maengel) {
    for (let i = 0; i < mangel.fotos.length; i++) {
      const foto = mangel.fotos[i];
      if (foto) {
        try {
          const { blob, ext } = base64ToBlob(foto);
          fotosFolder.file(`${mangel.id}_foto_${i + 1}.${ext}`, blob);
        } catch {
          // Skip invalid photos
        }
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
