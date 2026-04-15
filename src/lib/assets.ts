import { v4 as uuid } from 'uuid';
import { db, type AssetTyp, type AssetStatus } from './db';

export interface SaveAssetInput {
  liegenschaftId: string;
  begehungId?: string;
  typ: AssetTyp;
  bezeichnung: string;
  ort: string;
  geschoss: string;
  status: AssetStatus;
  fotos: string[];
  letztePruefung: string;
  naechstePruefung: string;
  notizen: string;
  mangelBeschreibung?: string;
}

export async function saveAssetWithMangel(input: SaveAssetInput): Promise<{ assetId: string; mangelId?: string }> {
  const assetId = uuid();
  const now = new Date().toISOString();

  await db.assets.add({
    id: assetId,
    liegenschaftId: input.liegenschaftId,
    begehungId: input.begehungId,
    typ: input.typ,
    bezeichnung: input.bezeichnung || input.typ,
    ort: input.ort,
    geschoss: input.geschoss,
    status: input.status,
    fotos: input.fotos,
    letztePruefung: input.letztePruefung,
    naechstePruefung: input.naechstePruefung,
    notizen: input.notizen,
    createdAt: now,
    updatedAt: now,
  });

  // Always create a Mangel when status is Mangelhaft
  let mangelId: string | undefined;
  if (input.status === 'Mangelhaft') {
    mangelId = uuid();
    await db.maengel.add({
      id: mangelId,
      liegenschaftId: input.liegenschaftId,
      begehungId: input.begehungId,
      assetId,
      titel: `${input.bezeichnung || input.typ}: Mangel festgestellt`,
      beschreibung: input.mangelBeschreibung || '',
      ort: input.ort,
      geschoss: input.geschoss,
      prioritaet: 'Hoch',
      status: 'Offen',
      fotos: input.fotos,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { assetId, mangelId };
}
