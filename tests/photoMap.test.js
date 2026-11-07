import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NASA_PICTURES, getPhotoForFeature } from '../src/utils/photoMap.js';

test('Photo Mapping: Site-Specific vs Representative Regional Illustrations', async (t) => {
  await t.test('Authentic site-specific missions map with isSiteSpecific=true', () => {
    // IM-1 Odysseus
    const odysseus = getPhotoForFeature({ id: 'clps-im1-odysseus', name: 'IM-1 (Odysseus)' });
    assert.equal(odysseus.id, 'pic-odysseus-malapert');
    assert.equal(odysseus.isSiteSpecific, true);
    assert.equal(odysseus.photoType, 'site-specific');
    assert.equal(odysseus.label, 'Site-Specific Photograph');
    assert.equal(odysseus.representationNotice, null);

    // Blue Ghost Mission 1
    const bgm1 = getPhotoForFeature({ id: 'clps-firefly-bgm1', name: 'Blue Ghost Mission 1' });
    assert.equal(bgm1.id, 'pic-blue-ghost-crisium');
    assert.equal(bgm1.isSiteSpecific, true);
    assert.equal(bgm1.label, 'Site-Specific Photograph');
    assert.equal(bgm1.representationNotice, null);

    // Shackleton crater & ridge
    const shackleton = getPhotoForFeature({ id: 'crater-shackleton', name: 'Shackleton Crater' });
    assert.equal(shackleton.id, 'pic-shackleton-ridge');
    assert.equal(shackleton.isSiteSpecific, true);
    assert.equal(shackleton.label, 'Site-Specific Photograph');
    assert.equal(shackleton.representationNotice, null);

    // Exact South Pole
    const southPole = getPhotoForFeature({ id: 'south-pole', name: 'South Pole', latitude: -90 });
    assert.equal(southPole.id, 'pic-south-pole-horizon');
    assert.equal(southPole.isSiteSpecific, true);
    assert.equal(southPole.label, 'Site-Specific Photograph');

    // Earth ground station
    const earthDsn = getPhotoForFeature({ body: 'earth', type: 'earth-station', name: 'Goldstone DSN' });
    assert.equal(earthDsn.id, 'pic-earth-marble');
    assert.equal(earthDsn.isSiteSpecific, true);
    assert.equal(earthDsn.label, 'Site-Specific Photograph');
  });

  await t.test('Unrelated polar craters are labeled Representative Regional Illustration', () => {
    const polarCraters = [
      { id: 'crater-cabeus', name: 'Cabeus Crater', latitude: -84.9 },
      { id: 'crater-haworth', name: 'Haworth Crater', latitude: -87.4 },
      { id: 'crater-nobile', name: 'Nobile Crater', latitude: -85.2 },
      { id: 'crater-amundsen', name: 'Amundsen Crater', latitude: -84.5 },
      { id: 'crater-shoemaker', name: 'Shoemaker Crater', latitude: -88.1 },
    ];

    for (const crater of polarCraters) {
      const photo = getPhotoForFeature(crater);
      assert.equal(photo.isSiteSpecific, false, `${crater.name} must not be flagged as site-specific`);
      assert.equal(photo.photoType, 'representative');
      assert.equal(
        photo.label,
        'Representative Regional Illustration',
        `${crater.name} must be labeled 'Representative Regional Illustration'`
      );
      assert.ok(
        photo.representationNotice.includes('Representative Regional Illustration'),
        `${crater.name} notice must disclose regional illustration`
      );
      assert.ok(
        photo.representationNotice.includes(crater.name),
        `${crater.name} notice must reference the feature name`
      );
    }
  });

  await t.test("Chang'e 4, Chang'e 6, and VIPER do not falsely map to Odysseus landing image", () => {
    // Chang'e 4 (farside South Pole-Aitken)
    const change4 = getPhotoForFeature({ id: 'landing-change-4', name: "Chang'e 4", latitude: -45.45 });
    assert.notEqual(
      change4.id,
      'pic-odysseus-malapert',
      "Chang'e 4 must not use the Odysseus landing photograph"
    );
    assert.equal(change4.isSiteSpecific, false);
    assert.equal(change4.label, 'Representative Regional Illustration');

    // Chang'e 6 (farside Apollo basin)
    const change6 = getPhotoForFeature({ id: 'landing-change-6', name: "Chang'e 6", latitude: -41.63 });
    assert.notEqual(
      change6.id,
      'pic-odysseus-malapert',
      "Chang'e 6 must not use the Odysseus landing photograph"
    );
    assert.equal(change6.isSiteSpecific, false);
    assert.equal(change6.label, 'Representative Regional Illustration');

    // Griffin Mission 1 / VIPER
    const viper = getPhotoForFeature({
      id: 'clps-griffin-gm1',
      name: 'Griffin Mission 1 (VIPER)',
      latitude: -85.0,
    });
    assert.notEqual(
      viper.id,
      'pic-odysseus-malapert',
      'VIPER must not use the Odysseus landing photograph'
    );
    assert.equal(viper.isSiteSpecific, false);
    assert.equal(viper.label, 'Representative Regional Illustration');

    // Blue Ghost Mission 2 (farside)
    const bgm2 = getPhotoForFeature({
      id: 'clps-firefly-bgm2',
      name: 'Blue Ghost Mission 2',
      locationType: 'placeholder',
    });
    assert.equal(bgm2.isSiteSpecific, false);
    assert.equal(bgm2.label, 'Representative Regional Illustration');
  });

  await t.test('Mare basins receive basalt plain representative illustration', () => {
    const mareTranquillitatis = getPhotoForFeature({
      id: 'mare-tranquillitatis',
      name: 'Mare Tranquillitatis',
      latitude: 8.5,
    });
    assert.equal(mareTranquillitatis.id, 'pic-blue-ghost-crisium');
    assert.equal(mareTranquillitatis.isSiteSpecific, false);
    assert.equal(mareTranquillitatis.label, 'Representative Regional Illustration');

    const apollo11 = getPhotoForFeature({
      id: 'landing-apollo-11',
      name: 'Apollo 11',
      landingSiteName: 'Mare Tranquillitatis',
      latitude: 0.67,
    });
    assert.equal(apollo11.id, 'pic-blue-ghost-crisium');
    assert.equal(apollo11.isSiteSpecific, false);
    assert.equal(apollo11.label, 'Representative Regional Illustration');
  });

  await t.test('Null or missing feature safely falls back to representative illustration', () => {
    const fallback = getPhotoForFeature(null);
    assert.ok(fallback);
    assert.equal(fallback.isSiteSpecific, false);
    assert.equal(fallback.label, 'Representative Regional Illustration');
  });

  await t.test('Duplicate root /pictures directory is removed and public/pictures has all images', () => {
    const rootPicturesExists = fs.existsSync(path.resolve('pictures'));
    assert.equal(rootPicturesExists, false, 'Root /pictures directory must not exist');

    for (const pic of NASA_PICTURES) {
      const publicPath = path.resolve('public', pic.src.replace(/^\//, ''));
      assert.ok(
        fs.existsSync(publicPath),
        `Public asset ${publicPath} must exist for ${pic.id}`
      );
    }
  });
});
