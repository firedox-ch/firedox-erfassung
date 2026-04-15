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
  begehungsDatum: string;
  pruefer: string;
  notizen: string;
  createdAt: string;
  updatedAt: string;
}

export interface Mangel {
  id: string;
  liegenschaftId: string;
  titel: string;
  beschreibung: string;
  ort: string;
  geschoss: string;
  prioritaet: 'Gering' | 'Mittel' | 'Hoch' | 'Kritisch';
  status: 'Offen' | 'Erledigt';
  fotos: string[]; // base64 data URLs
  createdAt: string;
  updatedAt: string;
}

const db = new Dexie('FiredoxErfassung') as Dexie & {
  liegenschaften: EntityTable<Liegenschaft, 'id'>;
  maengel: EntityTable<Mangel, 'id'>;
};

db.version(1).stores({
  liegenschaften: 'id, name, createdAt',
  maengel: 'id, liegenschaftId, prioritaet, status, createdAt',
});

export { db };
