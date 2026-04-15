import JSZip from 'jszip';
import { db, type Liegenschaft, type Asset, type Mangel } from './db';
import { v4 as uuid } from 'uuid';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface ImportResult {
  liegenschaft: string;
  assets: number;
  maengel: number;
}

export async function importFromZip(file: File): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);

  // Find the erfassung.json - could be in root or in a subfolder
  let jsonFile: JSZip.JSZipObject | null = null;
  let basePath = '';

  zip.forEach((path, entry) => {
    if (path.endsWith('erfassung.json') && !entry.dir) {
      jsonFile = entry;
      basePath = path.replace('erfassung.json', '');
    }
  });

  if (!jsonFile) {
    throw new Error('Keine erfassung.json im ZIP gefunden');
  }

  const jsonText = await (jsonFile as JSZip.JSZipObject).async('text');
  const data = JSON.parse(jsonText);

  if (!data.liegenschaft) {
    throw new Error('Ungültiges Format: liegenschaft fehlt');
  }

  // Generate new IDs to avoid conflicts
  const idMap: Record<string, string> = {};
  const newLiegenschaftId = uuid();

  // Import Liegenschaft
  const l = data.liegenschaft;
  idMap[l.id] = newLiegenschaftId;

  await db.liegenschaften.add({
    id: newLiegenschaftId,
    name: l.name || 'Import',
    strasse: l.strasse || '',
    plz: l.plz || '',
    ort: l.ort || '',
    gebaeudeart: l.gebaeudeart || '',
    baujahr: l.baujahr || '',
    anzahlGeschosse: l.anzahlGeschosse || '',
    anzahlEinheiten: l.anzahlEinheiten || '',
    eigentuemer: l.eigentuemer || '',
    verwalter: l.verwalter || '',
    pruefer: l.pruefer || '',
    notizen: l.notizen || '',
    createdAt: l.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Import Assets
  let assetCount = 0;
  if (data.assets && Array.isArray(data.assets)) {
    for (const a of data.assets) {
      const newAssetId = uuid();
      idMap[a.id] = newAssetId;

      // Load photos from ZIP
      const fotos: string[] = [];
      if (a.fotos && Array.isArray(a.fotos)) {
        for (const fotoPath of a.fotos) {
          const fullPath = basePath + fotoPath;
          const fotoFile = zip.file(fullPath);
          if (fotoFile) {
            try {
              const blob = await fotoFile.async('blob');
              const base64 = await blobToBase64(blob);
              fotos.push(base64);
            } catch { /* skip */ }
          }
        }
      }

      await db.assets.add({
        id: newAssetId,
        liegenschaftId: newLiegenschaftId,
        begehungId: undefined,
        typ: a.typ || 'Andere',
        bezeichnung: a.bezeichnung || '',
        ort: a.ort || '',
        geschoss: a.geschoss || '',
        status: a.status || 'Nicht geprüft',
        fotos,
        letztePruefung: a.letztePruefung || '',
        naechstePruefung: a.naechstePruefung || '',
        notizen: a.notizen || '',
        createdAt: a.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      assetCount++;
    }
  }

  // Import Mängel
  let mangelCount = 0;
  if (data.maengel && Array.isArray(data.maengel)) {
    for (const m of data.maengel) {
      const newMangelId = uuid();

      // Load photos from ZIP
      const fotos: string[] = [];
      if (m.fotos && Array.isArray(m.fotos)) {
        for (const fotoPath of m.fotos) {
          const fullPath = basePath + fotoPath;
          const fotoFile = zip.file(fullPath);
          if (fotoFile) {
            try {
              const blob = await fotoFile.async('blob');
              const base64 = await blobToBase64(blob);
              fotos.push(base64);
            } catch { /* skip */ }
          }
        }
      }

      await db.maengel.add({
        id: newMangelId,
        liegenschaftId: newLiegenschaftId,
        begehungId: undefined,
        assetId: m.assetId ? idMap[m.assetId] : undefined,
        titel: m.titel || '',
        beschreibung: m.beschreibung || '',
        ort: m.ort || '',
        geschoss: m.geschoss || '',
        prioritaet: m.prioritaet || 'Mittel',
        status: m.status || 'Offen',
        fotos,
        createdAt: m.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      mangelCount++;
    }
  }

  return {
    liegenschaft: data.liegenschaft.name || 'Import',
    assets: assetCount,
    maengel: mangelCount,
  };
}
