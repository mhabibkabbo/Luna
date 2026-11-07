import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_POLAR_LANDMARKS,
  getVolatileDataForFeature,
} from '../src/data/lunarCanonicalCatalog.js';
import { NASA_DATASETS_REGISTRY } from '../src/data/nasaProvenance.js';
import { PREDEFINED_COMPARISON_SITES } from '../src/utils/comparisonEngine.js';

test('PSR Area, H2O Abundance & Grid Resolution Consistency Audit', async (t) => {
  await t.test('Site-specific PSR areas and H2O abundances are differentiated across craters', () => {
    const shackleton = getVolatileDataForFeature({ id: 'crater-shackleton', name: 'Shackleton Crater' });
    const cabeus = getVolatileDataForFeature({ id: 'crater-cabeus', name: 'Cabeus Crater' });
    const haworth = getVolatileDataForFeature({ id: 'crater-haworth', name: 'Haworth Crater' });
    const shoemaker = getVolatileDataForFeature({ id: 'crater-shoemaker', name: 'Shoemaker Crater' });
    const faustini = getVolatileDataForFeature({ id: 'crater-faustini', name: 'Faustini Crater' });
    const nobile = getVolatileDataForFeature({ id: 'crater-nobile', name: 'Nobile Crater' });
    const amundsen = getVolatileDataForFeature({ id: 'crater-amundsen', name: 'Amundsen Crater' });
    const deGerlache = getVolatileDataForFeature({ id: 'crater-de-gerlache', name: 'de Gerlache' });

    // 1. Shackleton
    assert.equal(shackleton.psrAreaKm2, 28.4);
    assert.equal(shackleton.psrAreaM2, 28400000);
    assert.equal(shackleton.isPSR, true);
    assert.ok(shackleton.h2oAbundance.includes('100–150 ppm'));

    // 2. Cabeus (LCROSS confirmed)
    assert.equal(cabeus.psrAreaKm2, 950.0);
    assert.equal(cabeus.isPSR, true);
    assert.ok(cabeus.h2oAbundance.includes('LCROSS'));
    assert.notEqual(cabeus.psrAreaKm2, shackleton.psrAreaKm2, 'Cabeus PSR area must differ from Shackleton');

    // 3. Haworth
    assert.equal(haworth.psrAreaKm2, 225.0);
    assert.ok(haworth.h2oAbundance.includes('200–400 ppm'));
    assert.notEqual(haworth.psrAreaKm2, shackleton.psrAreaKm2, 'Haworth PSR area must differ from Shackleton');

    // 4. Shoemaker
    assert.equal(shoemaker.psrAreaKm2, 330.0);
    assert.ok(shoemaker.h2oAbundance.includes('300–500 ppm'));
    assert.notEqual(shoemaker.psrAreaKm2, shackleton.psrAreaKm2, 'Shoemaker PSR area must differ from Shackleton');

    // 5. Faustini
    assert.equal(faustini.psrAreaKm2, 145.0);

    // 6. Nobile
    assert.equal(nobile.psrAreaKm2, 110.0);
    assert.ok(nobile.h2oAbundance.includes('VIPER'));

    // 7. Amundsen
    assert.equal(amundsen.psrAreaKm2, 410.0);

    // 8. de Gerlache
    assert.equal(deGerlache.psrAreaKm2, 45.0);
  });

  await t.test('Illuminated ridges and peaks report 0 km2 PSR area', () => {
    const southPole = getVolatileDataForFeature({ id: 'south-pole', name: 'Lunar South Pole (90°S)', latitude: -90 });
    assert.equal(southPole.psrAreaKm2, 0);
    assert.equal(southPole.isPSR, false);
    assert.ok(southPole.h2oAbundance.includes('< 10 ppm'));

    const malapert = getVolatileDataForFeature({ id: 'mons-malapert', name: 'Malapert Massif', latitude: -86.02 });
    assert.equal(malapert.psrAreaKm2, 0);
    assert.equal(malapert.isPSR, false);

    const mouton = getVolatileDataForFeature({ id: 'clps-im2-athena', name: 'IM-2 Athena (Mons Mouton)', latitude: -84.79 });
    assert.equal(mouton.psrAreaKm2, 0);
    assert.equal(mouton.isPSR, false);
  });

  await t.test('LOLA polar DEM is authoritatively documented as 400 m/px across registry and datasets', () => {
    const polarDemDs = NASA_DATASETS_REGISTRY.find((ds) => ds.id === 'lro-lola-sp-dem');
    assert.ok(polarDemDs, 'LRO LOLA polar DEM must exist in dataset registry');
    assert.ok(
      polarDemDs.spatialResolution.includes('400 m/px'),
      'Polar DEM resolution must be documented as 400 m/px'
    );
    assert.equal(
      polarDemDs.spatialResolution.includes('5 m/px'),
      false,
      'Polar DEM resolution must not be documented as 5 m/px'
    );
  });

  await t.test('Comparison predefined candidate sites have valid coordinates and LOLA DEM compatibility', () => {
    for (const site of PREDEFINED_COMPARISON_SITES) {
      const lat = site.latitude ?? site.lat;
      const lon = site.longitude ?? site.lon;
      assert.ok(typeof lat === 'number', `Site ${site.id} must have numeric latitude`);
      assert.ok(typeof lon === 'number', `Site ${site.id} must have numeric longitude`);
      if (Math.abs(lat) >= 80) {
        // Polar site must be within 80°S-90°S 400 m/px coverage
        assert.ok(lat <= -80 && lat >= -90, `Polar site ${site.id} latitude must be between -80 and -90`);
      }
    }
  });
});
