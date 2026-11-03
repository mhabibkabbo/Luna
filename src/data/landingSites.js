/**
 * @file landingSites.js
 * Verified lunar landing sites dataset.
 * Sourced from NASA NSSDC Master Catalog, NASA History Office, CNSA, ISRO, and JAXA.
 *
 * CHANGE LOG (2026-11-02) - each edited/added entry also has an inline CHANGED/ADDED comment with the reason.
 * Full source list: docs/lunar-sites-sources.md
 *
 *  CHANGED  landing-chandrayaan-3          longitude 32.35 -> 32.32 (NSSDC / LRO value)
 *  CHANGED  landing-artemis3-shackleton    old point was inside Shackleton crater; now "Peak Near Shackleton"
 *  CHANGED  landing-artemis3-mouton        relabelled: IM-2 / Griffin-1 / VIPER region, not one of the 13 official regions
 *  ADDED    landing-artemis3-faustini-rim-a, -nobile-rim-2, -amundsen-rim, -de-gerlache-rim-2, -site-004, -connecting-ridge
 *  ADDED    landing-change-7, landing-vikram-impact, landing-luna-25-impact, landing-beresheet-impact, landing-hakuto-r-m1-impact
 *  TODO     Artemis III regions with no published coordinates yet: Connecting Ridge Extension, de Gerlache Rim 1,
 *           de Gerlache-Kocher Massif, Leibnitz Beta Plateau, Nobile Rim 1 (see comment at the end of LANDING_SITES)
 */

import { CLPS_MISSIONS } from './clpsMissions.js';

export const CLPS_SITE_FEATURES = CLPS_MISSIONS.map((m) => ({
  id: m.id,
  name: m.name,
  type: 'clps-mission',
  latitude: m.latitude,
  longitude: m.longitude,
  agency: `${m.provider} / NASA CLPS`,
  date: m.landingDate || m.launchDate,
  status:
    m.missionStatus === 'completed'
      ? 'Completed soft landing'
      : m.missionStatus === 'failed'
      ? 'Flight anomaly (Earth re-entry)'
      : 'Planned mission target',
  description: m.description,
  source: m.source,
  sourceUrl: m.sourceUrl,
  isClps: true,
  clpsData: m,
  locationType: m.locationType,
  horizonEligible: m.horizonEligible !== false, // ADDED 2026-11-02: lets the horizon exporter skip placeholder positions
  taskOrder: m.taskOrder,
  provider: m.provider,
  lander: m.lander,
  payloads: m.payloads,
  objectives: m.objectives,
}));

/**
 * @type {Array<import('../types/lunar.js').LunarFeature>}
 */
export const LANDING_SITES = [
  // ==========================================
  // CREWED APOLLO MISSIONS
  // ==========================================
  {
    id: 'landing-apollo-11',
    name: 'Apollo 11 (Tranquility Base)',
    type: 'landing-site',
    latitude: 0.6741,
    longitude: 23.4730,
    agency: 'NASA',
    date: '1969-07-20',
    status: 'Successful crewed soft landing',
    description: 'First human landing on the Moon. Astronauts Neil Armstrong and Buzz Aldrin landed the LM Eagle in southern Mare Tranquillitatis, deployed the EASEP scientific package, and collected 21.5 kg of lunar samples.',
    source: 'NASA History / NSSDC ID: 1969-059C',
  },
  {
    id: 'landing-apollo-12',
    name: 'Apollo 12 (Ocean of Storms)',
    type: 'landing-site',
    latitude: -3.0124,
    longitude: -23.4216,
    agency: 'NASA',
    date: '1969-11-19',
    status: 'Successful crewed soft landing',
    description: 'Precision landing by Pete Conrad and Alan Bean within 180 meters of the robotic Surveyor 3 spacecraft in Oceanus Procellarum, retrieving camera and mechanical parts after 2.5 years of lunar exposure.',
    source: 'NASA History / NSSDC ID: 1969-099C',
  },
  {
    id: 'landing-apollo-14',
    name: 'Apollo 14 (Fra Mauro)',
    type: 'landing-site',
    latitude: -3.6453,
    longitude: -17.4714,
    agency: 'NASA',
    date: '1971-02-05',
    status: 'Successful crewed soft landing',
    description: 'Landed in the Fra Mauro highlands by Alan Shepard and Edgar Mitchell to sample Imbrium basin impact ejecta. Shepard famously hit two golf balls on the lunar surface.',
    source: 'NASA History / NSSDC ID: 1971-008C',
  },
  {
    id: 'landing-apollo-15',
    name: 'Apollo 15 (Hadley-Apennine)',
    type: 'landing-site',
    latitude: 26.1322,
    longitude: 3.6339,
    agency: 'NASA',
    date: '1971-07-30',
    status: 'Successful crewed soft landing',
    description: 'First "J-mission" with the Lunar Roving Vehicle (LRV). David Scott and James Irwin explored the base of Mons Hadley and the edge of sinuous Rima Hadley, recovering the famous "Genesis Rock" (anorthosite).',
    source: 'NASA History / NSSDC ID: 1971-063C',
  },
  {
    id: 'landing-apollo-16',
    name: 'Apollo 16 (Descartes Highlands)',
    type: 'landing-site',
    latitude: -8.9730,
    longitude: 15.5002,
    agency: 'NASA',
    date: '1972-04-21',
    status: 'Successful crewed soft landing',
    description: 'Exploration of the central lunar highlands by John Young and Charles Duke, proving that the Cayley Plains and Descartes formation were impact breccias rather than volcanic ash flows.',
    source: 'NASA History / NSSDC ID: 1972-031C',
  },
  {
    id: 'landing-apollo-17',
    name: 'Apollo 17 (Taurus-Littrow)',
    type: 'landing-site',
    latitude: 20.1908,
    longitude: 30.7717,
    agency: 'NASA',
    date: '1972-12-11',
    status: 'Successful crewed soft landing',
    description: 'Final crewed Apollo mission. Eugene Cernan and scientist-astronaut Harrison Schmitt traversed 35 km in the LRV, discovering volcanic orange soil beads at Shorty Crater.',
    source: 'NASA History / NSSDC ID: 1972-096C',
  },

  // ==========================================
  // HISTORIC ROBOTIC LANDERS
  // ==========================================
  {
    id: 'landing-luna-2',
    name: 'Luna 2',
    type: 'mission-site',
    latitude: 29.10,
    longitude: 0.00,
    agency: 'Soviet Union',
    date: '1959-09-14',
    status: 'First human artifact on the Moon (hard impact)',
    description: 'First human-made object to reach the surface of another celestial body, impacting Palus Putredinis east of Montes Apenninus.',
    source: 'NASA NSSDC ID: 1959-014A',
  },
  {
    id: 'landing-luna-9',
    name: 'Luna 9',
    type: 'mission-site',
    latitude: 7.08,
    longitude: -64.37,
    agency: 'Soviet Union',
    date: '1966-02-03',
    status: 'First successful robotic soft landing',
    description: 'First spacecraft to achieve a survivable soft landing on the Moon, transmitting the first close-up panoramic images from the lunar surface in Oceanus Procellarum.',
    source: 'NASA NSSDC ID: 1966-006A',
  },
  {
    id: 'landing-surveyor-1',
    name: 'Surveyor 1',
    type: 'mission-site',
    latitude: -2.474,
    longitude: -43.339,
    agency: 'NASA',
    date: '1966-06-02',
    status: 'First US robotic soft landing',
    description: 'First American soft landing on the Moon, proving that the lunar surface could support the weight of a crewed Apollo Lunar Module.',
    source: 'NASA NSSDC ID: 1966-045A',
  },
  {
    id: 'landing-surveyor-3',
    name: 'Surveyor 3',
    type: 'mission-site',
    latitude: -3.016,
    longitude: -23.418,
    agency: 'NASA',
    date: '1967-04-20',
    status: 'Successful robotic soft landing',
    description: 'Robotic lander with surface sampler scoop; later visited on foot by Apollo 12 astronauts in November 1969.',
    source: 'NASA NSSDC ID: 1967-035A',
  },
  {
    id: 'landing-luna-16',
    name: 'Luna 16',
    type: 'mission-site',
    latitude: -0.68,
    longitude: 56.30,
    agency: 'Soviet Union',
    date: '1970-09-20',
    status: 'First robotic lunar sample return',
    description: 'First automated robotic sample return mission, returning 101 grams of lunar core soil from Mare Fecunditatis back to Earth.',
    source: 'NASA NSSDC ID: 1970-072A',
  },

  // ==========================================
  // CONTEMPORARY 21ST CENTURY MISSIONS
  // ==========================================
  {
    id: 'landing-change-3',
    name: 'Chang\'e 3 (Yutu)',
    type: 'mission-site',
    latitude: 44.12,
    longitude: -19.51,
    agency: 'CNSA',
    date: '2013-12-14',
    status: 'Successful soft landing & rover deployment',
    description: 'First lunar soft landing since 1976. Deployed the Yutu rover in northern Mare Imbrium near a 450-meter-wide impact crater.',
    source: 'CNSA / NASA LROC',
  },
  {
    id: 'landing-change-4',
    name: 'Chang\'e 4 (Yutu-2)',
    type: 'mission-site',
    latitude: -45.44,
    longitude: 177.60,
    agency: 'CNSA',
    date: '2019-01-03',
    status: 'First soft landing on the lunar farside',
    description: 'Historic first soft landing on the lunar farside, touching down inside Von Kármán crater within the vast South Pole-Aitken basin using the Queqiao relay satellite.',
    source: 'CNSA / NASA LROC',
  },
  {
    id: 'landing-change-5',
    name: 'Chang\'e 5',
    type: 'mission-site',
    latitude: 43.06,
    longitude: -51.92,
    agency: 'CNSA',
    date: '2020-12-01',
    status: 'Successful sample return (1.73 kg)',
    description: 'Drilled and scooped young basaltic samples near Mons Rümker in northern Oceanus Procellarum, confirming lunar volcanism as recent as 2 billion years ago.',
    source: 'CNSA / NASA LROC',
  },
  {
    // CHANGED 2026-11-02: longitude 32.35 -> 32.32 and latitude refined to -69.3741, the value NASA's NSSDC table
    // of lunar spacecraft ("Chandrayaan 3 Lander 69.3741 S, 32.32 E"), based on LRO imaging, lists for the lander.
    id: 'landing-chandrayaan-3',
    name: 'Chandrayaan-3 (Vikram / Pragyan)',
    type: 'mission-site',
    latitude: -69.3741,
    longitude: 32.32,
    agency: 'ISRO',
    date: '2023-08-23',
    status: 'First landing near the lunar south pole',
    description: 'Historic first soft landing in the high southern latitudes between Manzinus C and Simpelius N craters (Shiv Shakti Point). Deployed Pragyan rover with ChaSTE thermal probe.',
    source: 'ISRO / NASA LROC / NASA NSSDC Table of Anthropogenic Impacts and Spacecraft on the Moon',
    sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html',
  },
  {
    id: 'landing-slim',
    name: 'SLIM (Smart Lander for Investigating Moon)',
    type: 'mission-site',
    latitude: -13.31,
    longitude: 25.25,
    agency: 'JAXA',
    date: '2024-01-19',
    status: 'Pinpoint soft landing (~55m accuracy)',
    description: 'Japanese "Moon Sniper" achieving unprecedented landing accuracy of ~55 meters near Shioli crater, deploying LEV-1 and LEV-2 (SORA-Q) micro-probes.',
    source: 'JAXA',
  },
  {
    id: 'landing-odysseus',
    name: 'Odysseus (IM-1 Nova-C)',
    type: 'clps-mission',
    latitude: -80.13,
    longitude: 1.44,
    agency: 'Intuitive Machines / NASA CLPS',
    date: '2024-02-22',
    status: 'First commercial lunar soft landing',
    description: 'NASA Commercial Lunar Payload Services (CLPS) mission landing at Malapert A, approximately 300 km from the lunar South Pole.',
    source: 'NASA CLPS / Intuitive Machines',
    sourceUrl: 'https://www.nasa.gov/missions/clps/clps-intuitive-machines-im-1/',
    isClps: true,
    taskOrder: 'TO 2-IM',
    provider: 'Intuitive Machines',
    lander: 'Nova-C (Odysseus)',
    locationType: 'confirmed',
    payloads: CLPS_SITE_FEATURES[0]?.payloads || [],
    objectives: CLPS_SITE_FEATURES[0]?.objectives || '',
  },
  // Full Manifest of NASA Commercial Lunar Payload Services (CLPS) Missions
  ...CLPS_SITE_FEATURES.filter((m) => m.id !== 'clps-im1-odysseus'),
  {
    id: 'landing-change-6',
    name: 'Chang\'e 6',
    type: 'mission-site',
    latitude: -41.64,
    longitude: -153.99,
    agency: 'CNSA',
    date: '2024-06-01',
    status: 'First farside sample return (1.93 kg)',
    description: 'Historic first sample return from the lunar farside, landing in southern Apollo crater inside the South Pole-Aitken basin and delivering 1,935 grams of pristine farside crust.',
    source: 'CNSA / NASA LROC',
  },
  {
    id: 'landing-lcross',
    name: 'LCROSS Impact (Cabeus Crater)',
    type: 'mission-site',
    latitude: -84.675,
    longitude: -48.725,
    agency: 'NASA',
    date: '2009-10-09',
    status: 'Water Ice Discovery Impact',
    description: 'Lunar Crater Observation and Sensing Satellite impacted Cabeus crater at 9,000 km/h, excavating ~350 metric tons of lunar regolith and confirming ~155 kg of water ice vapor.',
    source: 'NASA Ames / LCROSS Science Team',
  },
  {
    id: 'landing-artemis3-malapert',
    name: 'Artemis III Candidate: Malapert Massif',
    type: 'mission-site',
    latitude: -85.90,
    longitude: 0.00,
    agency: 'NASA Artemis',
    date: 'Target 2026+',
    status: 'Primary Crewed South Pole Candidate',
    description: 'Top-tier Artemis III candidate landing site. The high summit offers 90%+ annual solar illumination, direct line-of-sight to Earth ground stations, and direct access to shadowed ice traps.',
    source: 'NASA Artemis Program / LROC',
  },
  {
    // CHANGED 2026-11-02: old point (-89.70, 120.00) lies INSIDE Shackleton crater (21 km wide, floor ~4 km deep), which is why the computed
    // horizon was "enclosed" (17-27 deg in every direction). NASA's region is "Peak Near Shackleton", on the illuminated ridge outside the crater.
    // Representative point = 120 m crater at 89.0066 S, 132.0596 E inside the region (LPI Artemis III workshop abstract 2042).
    // The Peña-Asensio et al. (2025) top-ranked point in the same region is (-89.0051, 125.3093). Id kept so references still work.
    id: 'landing-artemis3-shackleton',
    name: 'Artemis III Candidate: Peak Near Shackleton',
    type: 'mission-site',
    latitude: -89.0066,
    longitude: 132.0596,
    agency: 'NASA Artemis',
    date: 'Candidate region (announced 2022-08-19)',
    status: 'Artemis III candidate region (representative point)',
    locationType: 'approximate',
    description: 'One of NASA\'s 13 Artemis III candidate landing regions (about 15 x 15 km), on the ridge outside Shackleton crater. Offers long sunlit periods next to permanently shadowed ground with water-ice signatures. Pin marks a documented 120 m crater inside the region.',
    source: 'NASA Artemis III candidate regions (2022); Syposs & Stopar, LPI Artemis III Candidate Landing Regions Workshop 2023, abstract 2042',
    sourceUrl: 'https://www.hou.usra.edu/meetings/Artemis_III_2023/pdf/2042.pdf',
  },
  {
    // CHANGED 2026-11-02: relabelled. "Mons Mouton" is NOT one of the 13 Artemis III regions NASA announced in Aug 2022
    // (Faustini Rim A, Peak Near Shackleton, Connecting Ridge, Connecting Ridge Extension, de Gerlache Rim 1/2, de Gerlache-Kocher Massif,
    // Haworth, Malapert Massif, Leibnitz Beta Plateau, Nobile Rim 1/2, Amundsen Rim). It is the IM-2 landing plateau and the Griffin-1 /
    // VIPER target area; LROC says the IM-2 intended site lies in the central part of an Artemis III potential region.
    // Coordinates unchanged (-84.5, 31.7); IM-2 actually landed at (-84.7906, 29.1958), ~11 km away on the same plateau.
    id: 'landing-artemis3-mouton',
    name: 'Mons Mouton Region (IM-2 landing / Griffin-1 / VIPER target)',
    type: 'mission-site',
    latitude: -84.50,
    longitude: 31.70,
    agency: 'NASA Artemis / CLPS',
    date: 'IM-2 landed 2025-03-06; Griffin-1 NET Nov 2026',
    status: 'Plateau & Ice Prospecting Zone',
    locationType: 'approximate',
    description: 'Plateau roughly 160 km from the south pole, adjacent to the western rim of Nobile crater. Site of the IM-2 landing and the target region for Griffin-1 and the (re-manifested) VIPER rover.',
    source: 'LROC (ASU) IM-2 Landing Region; NASA VIPER / CLPS pages; Astrobotic',
    sourceUrl: 'https://www.lroc.asu.edu/images/1401',
  },

  // ==========================================================================
  // ADDED 2026-11-02 - ARTEMIS III CANDIDATE REGIONS (south polar)
  // NASA announced 13 regions (~15 x 15 km each, all within 6 deg of the pole) on 2022-08-19 and published no single "centre" coordinate.
  // Each pin below is a REPRESENTATIVE POINT inside the region taken from peer-reviewed / LPI sources, so they are flagged "approximate".
  // Points from Peña-Asensio, Neira-Acosta & Sánchez-Lozano (2025), Acta Astronautica 226, 469-478 (open access, Table 3):
  //   the top-ranked location (TOPSIS) found inside each region. DMS converted to decimal degrees.
  // ==========================================================================
  {
    // ADDED: Faustini Rim A (region LM7). Point = unnamed crater inside the region (LPI abstract 2042; -88.0573, 89.1596).
    // The Peña-Asensio top-ranked point in the same region is (-88.0870, 98.3555).
    id: 'landing-artemis3-faustini-rim-a',
    name: 'Artemis III Candidate: Faustini Rim A',
    type: 'mission-site',
    latitude: -88.0573,
    longitude: 89.1596,
    agency: 'NASA Artemis',
    date: 'Candidate region (announced 2022-08-19)',
    status: 'Artemis III candidate region (representative point)',
    locationType: 'approximate',
    description: 'Candidate landing region (about 15 x 15 km) on the rim of Faustini crater. The pin marks an unnamed crater inside the region that is documented in the LPI Artemis III candidate-region workshop abstract.',
    source: 'NASA Artemis III candidate regions (2022); Syposs & Stopar, LPI Artemis III Workshop 2023, abstract 2042',
    sourceUrl: 'https://www.hou.usra.edu/meetings/Artemis_III_2023/pdf/2042.pdf',
  },
  {
    // ADDED: Nobile Rim 2 (site DM2). Peña-Asensio et al. 2025 best location overall: 84 12' 5.61" S, 60 41' 59.61" E.
    id: 'landing-artemis3-nobile-rim-2',
    name: 'Artemis III Candidate: Nobile Rim 2',
    type: 'mission-site',
    latitude: -84.2016,
    longitude: 60.6999,
    agency: 'NASA Artemis',
    date: 'Candidate region (announced 2022-08-19)',
    status: 'Artemis III candidate region (top-ranked point in published study)',
    locationType: 'approximate',
    description: 'Candidate landing region on the rim of Nobile crater. The pin is the location ranked highest inside this region by a 2025 multi-criteria landing-site study (Peña-Asensio et al.).',
    source: 'Peña-Asensio, Neira-Acosta & Sánchez-Lozano (2025), Acta Astronautica 226:469-478',
    sourceUrl: 'https://www.sciencedirect.com/science/article/pii/S0094576524006234',
  },
  {
    // ADDED: Amundsen Rim (site DM1). Peña-Asensio et al. 2025 Table 3, points 1121/1122: 84 11' 30.63" S, 67 13' 44.55" E.
    id: 'landing-artemis3-amundsen-rim',
    name: 'Artemis III Candidate: Amundsen Rim',
    type: 'mission-site',
    latitude: -84.1918,
    longitude: 67.2290,
    agency: 'NASA Artemis',
    date: 'Candidate region (announced 2022-08-19)',
    status: 'Artemis III candidate region (top-ranked point in published study)',
    locationType: 'approximate',
    description: 'Candidate landing region on the rim of Amundsen crater. The pin is a top-ranked location inside the region from a 2025 multi-criteria landing-site study (Peña-Asensio et al.).',
    source: 'Peña-Asensio, Neira-Acosta & Sánchez-Lozano (2025), Acta Astronautica 226:469-478',
    sourceUrl: 'https://www.sciencedirect.com/science/article/pii/S0094576524006234',
  },
  {
    // ADDED: de Gerlache Rim 2 (site SL2). Peña-Asensio et al. 2025 Table 3, point 726: 88 30' 56.38" S, 61 10' 2.35" W.
    id: 'landing-artemis3-de-gerlache-rim-2',
    name: 'Artemis III Candidate: de Gerlache Rim 2',
    type: 'mission-site',
    latitude: -88.5157,
    longitude: -61.1673,
    agency: 'NASA Artemis',
    date: 'Candidate region (announced 2022-08-19)',
    status: 'Artemis III candidate region (representative point)',
    locationType: 'approximate',
    description: 'Candidate landing region on the rim of de Gerlache crater. The pin is a candidate location inside the region from a 2025 landing-site study (site SL2).',
    source: 'Peña-Asensio, Neira-Acosta & Sánchez-Lozano (2025), Acta Astronautica 226; NASA Artemis III candidate regions (2022)',
    sourceUrl: 'https://www.sciencedirect.com/science/article/pii/S0094576524006234',
  },
  {
    // ADDED: "Site 004" - the only numbered candidate in the 2025 study that is NOT one of the 13 regions; NASA's LOLA 5 m DEM archive
    // labels it "Site04: Shackleton rim". Point = rank-13 location: 89 57' 33.08" S, 135 49' 6.44" E (a second one is 89 55' 18.86" S, 78 44' 15.06" E).
    id: 'landing-artemis3-site-004',
    name: 'Artemis Site 004 (Shackleton Rim)',
    type: 'mission-site',
    latitude: -89.9592,
    longitude: 135.8185,
    agency: 'NASA Artemis / LOLA site DEM',
    date: 'Study site',
    status: 'Numbered landing-site candidate (Site04)',
    locationType: 'approximate',
    description: 'Numbered candidate site on the rim of Shackleton crater, within a few kilometres of the south pole. It appears alongside the 13 regions in a published landing-site study and in NASA\'s 5 m LOLA site DEM set.',
    source: 'Peña-Asensio et al. (2025) Acta Astronautica 226; NASA PGDA South Pole Landing Site LOLA DEMs',
    sourceUrl: 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/',
  },
  {
    // ADDED: Connecting Ridge (region + "Site01" in the LOLA DEM set) - ridge joining Shackleton and de Gerlache rims.
    // ESTIMATE ONLY: mid-point between the Shackleton centre (-89.67, 129.78) and de Gerlache centre (-88.5, -87.1). ~89.4 S matches the
    // latitude quoted for the ridge. Replace with the centre of the 5 m "Site01" DEM when available. Same point as the Blue Moon MK1 pin.
    id: 'landing-artemis3-connecting-ridge',
    name: 'Shackleton Connecting Ridge (Artemis III region / Blue Moon MK1 target)',
    type: 'mission-site',
    latitude: -89.374,
    longitude: -96.204,
    agency: 'NASA Artemis / CLPS',
    date: 'Candidate region (2022); Blue Moon MK1 NET 2027',
    status: 'Artemis III candidate region (estimated position)',
    locationType: 'approximate',
    description: 'The ridge joining the rims of Shackleton and de Gerlache craters, known for long periods of sunlight, and the announced landing target of Blue Origin\'s Endurance lander. The position is an estimate between the two crater centres.',
    source: 'NASA Artemis III regions; NASA Moon Base: Blue Origin Blue Moon Mark 1; NASA PGDA LOLA site DEMs (Site01 Connecting Ridge)',
    sourceUrl: 'https://www.nasa.gov/event/clps-flight-blue-origins-blue-moon-mark-1/',
  },

  // ==========================================================================
  // ADDED 2026-11-02 - OTHER SOUTH-POLAR / HIGH-LATITUDE MISSION SITES
  // ==========================================================================
  {
    // ADDED: Chang'e 7 target = peak near the south-east ridge of Shackleton crater, 88 48' S, 123 24' E (-88.8, 123.4).
    // Launch was stood down on 2026-08-23; no new date announced as of the sources reviewed. Same area as the "Peak Near Shackleton" region.
    id: 'landing-change-7',
    name: "Chang'e 7 (planned south pole landing)",
    type: 'mission-site',
    latitude: -88.80,
    longitude: 123.40,
    agency: 'CNSA',
    date: 'Launch stood down 2026-08-23; no new date announced',
    status: 'Planned mission target',
    locationType: 'planned',
    description: 'Orbiter, lander, rover and hopping probe aimed at a sunlit peak near the south-east ridge of Shackleton crater to search for water ice in nearby shadowed craters.',
    source: 'Wikipedia: Chang\'e 7 (citing CNSA statements, 2026-08-23); Lunar Landers status tracker',
    sourceUrl: 'https://en.wikipedia.org/wiki/Chang%27e_7',
  },
  {
    // ADDED: Vikram (Chandrayaan-2) impact site, NASA NSSDC table: 70.8810 S, 22.7840 E. LRO showed the lander struck the rim of a small crater.
    id: 'landing-vikram-impact',
    name: 'Chandrayaan-2 (Vikram impact site)',
    type: 'mission-site',
    latitude: -70.8810,
    longitude: 22.7840,
    agency: 'ISRO',
    date: '2019-09-06',
    status: 'Failed landing (crashed)',
    locationType: 'confirmed',
    description: 'Vikram lost contact during the final descent. LRO later imaged the impact site, and NASA lists it at this position.',
    source: 'NASA NSSDC Table of Anthropogenic Impacts and Spacecraft on the Moon; NASA LRO imaging (Kornei, Eos 2023)',
    sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html',
  },
  {
    // ADDED: Luna 25 crash. LRO found a new ~10 m crater at 57.87 S, 61.36 E (inner rim of Pontecoulant G), ~400 km short of the intended
    // landing point (69.545 S, 43.544 E; the NSSDC table still lists the INTENDED point).
    id: 'landing-luna-25-impact',
    name: 'Luna 25 (impact site)',
    type: 'mission-site',
    latitude: -57.87,
    longitude: 61.36,
    agency: 'Roscosmos',
    date: '2023-08-19',
    status: 'Failed landing (impact)',
    locationType: 'confirmed',
    description: 'Russia\'s first lunar lander in nearly five decades crashed on the steep inner rim of Pontécoulant G crater, about 400 km from its intended south polar target (69.545 S, 43.544 E).',
    source: 'NASA LRO release "LRO Observes Crater Likely from Luna 25 Impact"; Jatan Mehta, Moon Monday #143 (coordinates)',
    sourceUrl: 'https://www.nasa.gov/?p=505500',
  },
  {
    // ADDED: Beresheet impact, NASA NSSDC table: 32.5956 N, 19.3496 E.
    id: 'landing-beresheet-impact',
    name: 'Beresheet (impact site)',
    type: 'mission-site',
    latitude: 32.5956,
    longitude: 19.3496,
    agency: 'SpaceIL / IAI',
    date: '2019-04-11',
    status: 'Failed landing (impact)',
    locationType: 'confirmed',
    description: 'First privately funded lunar landing attempt. An engine problem during descent led to a crash in Mare Serenitatis.',
    source: 'NASA NSSDC Table of Anthropogenic Impacts and Spacecraft on the Moon',
    sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html',
  },
  {
    // ADDED: Hakuto-R Mission 1 impact, NASA NSSDC table: 47.581 N, 44.094 E; imaged by LROC the day after (LROC image 1302).
    id: 'landing-hakuto-r-m1-impact',
    name: 'HAKUTO-R Mission 1 (impact site)',
    type: 'mission-site',
    latitude: 47.581,
    longitude: 44.094,
    agency: 'ispace',
    date: '2023-04-25',
    status: 'Failed landing (impact)',
    locationType: 'confirmed',
    description: 'ispace\'s first lander lost altitude knowledge near the end of descent and crashed in the Atlas crater area. LRO imaged the debris the next day.',
    source: 'NASA NSSDC Table of Anthropogenic Impacts and Spacecraft on the Moon; LROC (ASU) Impact Site of the HAKUTO-R Mission 1 Lunar Lander',
    sourceUrl: 'https://www.lroc.asu.edu/images/1302',
  }

  // --------------------------------------------------------------------------
  // TODO (not added - no published coordinates found; do not guess):
  //   Artemis III regions: Connecting Ridge Extension, de Gerlache Rim 1, de Gerlache-Kocher Massif, Leibnitz Beta Plateau, Nobile Rim 1.
  //   (Haworth and Malapert Massif are represented by crater-haworth and mons-malapert in lunarFeatures.js.)
  //   Best next source: NASA's 5 m "South Pole Landing Site LOLA DEMs" - Site01 Connecting Ridge, Site07 Peak Near Shackleton,
  //   Site11 de Gerlache rim, Site20 Leibnitz Beta Plateau, Site23 Malapert Massif: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/
  //   and NASA's per-region latitude/longitude grids on the Artemis III landing-region page.
  // --------------------------------------------------------------------------
];
