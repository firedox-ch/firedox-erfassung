import Dexie, { type EntityTable } from 'dexie';

export interface Liegenschaft {
  id: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  gebaeudeart: string;
  baujahr: string;
  anzahlGeschosse: string;
  anzahlEinheiten: string;
  eigentuemer: string;
  verwalter: string;
  pruefer: string;
  notizen: string;
  createdAt: string;
  updatedAt: string;
}

export const ASSET_TYPEN = [
  'Feuerlöscher',
  'Brandschutztür',
  'RWA-Anlage',
  'Notbeleuchtung',
  'BMA',
  'Fluchtweg',
  'Sprinkleranlage',
  'Rauchmelder',
  'Löschposten',
  'Andere',
] as const;

export type AssetTyp = (typeof ASSET_TYPEN)[number];
export type AssetStatus = 'OK' | 'Mangelhaft' | 'Nicht geprüft';

export interface Asset {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export type BegehungTyp = 'Erstbegehung' | 'Kontrollbegehung';
export type BegehungStatus = 'Aktiv' | 'Abgeschlossen';

export interface Begehung {
  id: string;
  liegenschaftId: string;
  typ: BegehungTyp;
  datum: string;
  pruefer: string;
  status: BegehungStatus;
  notizen: string;
  createdAt: string;
  updatedAt: string;
}

export interface Mangel {
  id: string;
  liegenschaftId: string;
  begehungId?: string;
  assetId?: string;
  titel: string;
  beschreibung: string;
  ort: string;
  geschoss: string;
  prioritaet: 'Gering' | 'Mittel' | 'Hoch' | 'Kritisch';
  status: 'Offen' | 'Erledigt';
  fotos: string[];
  createdAt: string;
  updatedAt: string;
}

const db = new Dexie('FiredoxErfassung') as Dexie & {
  liegenschaften: EntityTable<Liegenschaft, 'id'>;
  assets: EntityTable<Asset, 'id'>;
  begehungen: EntityTable<Begehung, 'id'>;
  maengel: EntityTable<Mangel, 'id'>;
};

db.version(1).stores({
  liegenschaften: 'id, name, createdAt',
  maengel: 'id, liegenschaftId, prioritaet, status, createdAt',
});

db.version(2).stores({
  liegenschaften: 'id, name, createdAt',
  assets: 'id, liegenschaftId, typ, status, createdAt',
  begehungen: 'id, liegenschaftId, typ, status, createdAt',
  maengel: 'id, liegenschaftId, begehungId, assetId, prioritaet, status, createdAt',
});

export { db };
