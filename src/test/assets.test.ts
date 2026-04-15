import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { saveAssetWithMangel } from '@/lib/assets';

beforeEach(async () => {
  await db.assets.clear();
  await db.maengel.clear();
  await db.liegenschaften.clear();
  await db.begehungen.clear();
});

describe('saveAssetWithMangel', () => {
  const baseInput = {
    liegenschaftId: 'lg-1',
    typ: 'Feuerlöscher' as const,
    bezeichnung: 'Feuerlöscher EG',
    ort: 'Eingangsbereich',
    geschoss: 'EG',
    fotos: [],
    letztePruefung: '2026-01-15',
    naechstePruefung: '2029-01-15',
    notizen: '',
  };

  it('creates asset with status OK and no Mangel', async () => {
    const result = await saveAssetWithMangel({ ...baseInput, status: 'OK' });

    expect(result.assetId).toBeDefined();
    expect(result.mangelId).toBeUndefined();

    const assets = await db.assets.toArray();
    expect(assets).toHaveLength(1);
    expect(assets[0].status).toBe('OK');

    const maengel = await db.maengel.toArray();
    expect(maengel).toHaveLength(0);
  });

  it('creates asset with status Nicht geprüft and no Mangel', async () => {
    const result = await saveAssetWithMangel({ ...baseInput, status: 'Nicht geprüft' });

    expect(result.mangelId).toBeUndefined();

    const maengel = await db.maengel.toArray();
    expect(maengel).toHaveLength(0);
  });

  it('creates asset with status Mangelhaft AND auto-creates a Mangel (without description)', async () => {
    const result = await saveAssetWithMangel({ ...baseInput, status: 'Mangelhaft' });

    expect(result.assetId).toBeDefined();
    expect(result.mangelId).toBeDefined();

    const assets = await db.assets.toArray();
    expect(assets).toHaveLength(1);
    expect(assets[0].status).toBe('Mangelhaft');

    const maengel = await db.maengel.toArray();
    expect(maengel).toHaveLength(1);
    expect(maengel[0].assetId).toBe(result.assetId);
    expect(maengel[0].liegenschaftId).toBe('lg-1');
    expect(maengel[0].titel).toContain('Feuerlöscher EG');
    expect(maengel[0].prioritaet).toBe('Hoch');
    expect(maengel[0].status).toBe('Offen');
    expect(maengel[0].ort).toBe('Eingangsbereich');
    expect(maengel[0].geschoss).toBe('EG');
  });

  it('creates asset with status Mangelhaft AND auto-creates a Mangel (with description)', async () => {
    const result = await saveAssetWithMangel({
      ...baseInput,
      status: 'Mangelhaft',
      mangelBeschreibung: 'Plombe gebrochen, Druck zu niedrig',
    });

    const maengel = await db.maengel.toArray();
    expect(maengel).toHaveLength(1);
    expect(maengel[0].beschreibung).toBe('Plombe gebrochen, Druck zu niedrig');
    expect(maengel[0].assetId).toBe(result.assetId);
  });

  it('links Mangel to Begehung when begehungId is provided', async () => {
    const result = await saveAssetWithMangel({
      ...baseInput,
      status: 'Mangelhaft',
      begehungId: 'beg-1',
    });

    const assets = await db.assets.toArray();
    expect(assets[0].begehungId).toBe('beg-1');

    const maengel = await db.maengel.toArray();
    expect(maengel[0].begehungId).toBe('beg-1');
    expect(maengel[0].assetId).toBe(result.assetId);
  });

  it('uses typ as bezeichnung fallback', async () => {
    const result = await saveAssetWithMangel({
      ...baseInput,
      bezeichnung: '',
      status: 'Mangelhaft',
    });

    const assets = await db.assets.toArray();
    expect(assets[0].bezeichnung).toBe('Feuerlöscher');

    const maengel = await db.maengel.toArray();
    expect(maengel[0].titel).toContain('Feuerlöscher');
  });

  it('copies fotos to the Mangel entry', async () => {
    const result = await saveAssetWithMangel({
      ...baseInput,
      status: 'Mangelhaft',
      fotos: ['data:image/jpeg;base64,abc123'],
    });

    const maengel = await db.maengel.toArray();
    expect(maengel[0].fotos).toEqual(['data:image/jpeg;base64,abc123']);
  });

  it('works for all asset types with Mangelhaft', async () => {
    const types = ['Brandschutztür', 'RWA-Anlage', 'Notbeleuchtung', 'BMA', 'Fluchtweg'] as const;

    for (const typ of types) {
      await db.assets.clear();
      await db.maengel.clear();

      const result = await saveAssetWithMangel({
        ...baseInput,
        typ,
        bezeichnung: `${typ} Test`,
        status: 'Mangelhaft',
      });

      const maengel = await db.maengel.toArray();
      expect(maengel).toHaveLength(1);
      expect(maengel[0].titel).toContain(typ);
      expect(maengel[0].assetId).toBe(result.assetId);
    }
  });
});
