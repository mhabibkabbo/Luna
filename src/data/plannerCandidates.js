/**
 * @file plannerCandidates.js
 * Curated lunar landing candidate sites for the Landing Window Planner.
 * Terrain metrics (elevationM, slopeDeg, roughnessM) are never hardcoded here;
 * they are sampled dynamically from the NASA LRO LOLA South Pole DEM (80°S–90°S)
 * or reported as null ("Not present in loaded dataset") outside 80°S–90°S.
 */

export const PLANNER_CANDIDATES = [
  // =========================================================================
  // 1. SOUTH POLE ARTEMIS EXPLORATION ZONE (80°S - 90°S — LOLA DEM Measured)
  // =========================================================================
  {
    id: 'landing-artemis3-malapert',
    name: 'Malapert Massif',
    region: 'south-pole',
    regionLabel: 'South Pole Peak (85.90°S, 0.00°E)',
    lat: -85.90,
    lon: 0.00,
    latitude: -85.90,
    longitude: 0.00,
<<<<<<< Updated upstream
    elevationM: 5020,
    slopeDeg: 5.4,
    geology: 'Pre-Nectarian highland massif rising 5 km above surrounding polar terrain.',
=======
    geology: 'Pre-Nectarian highland massif rising above surrounding polar terrain.',
>>>>>>> Stashed changes
    scienceTarget: 'Long-duration solar insolation, permanent cryogenic cold traps in adjacent Haworth crater.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-artemis3-shackleton',
    name: 'Shackleton Connecting Ridge',
    region: 'south-pole',
<<<<<<< Updated upstream
    regionLabel: 'South Pole Ridge (89.70°S, 120.00°E)',
    lat: -89.70,
    lon: 120.00,
    latitude: -89.70,
    longitude: 120.00,
    elevationM: 4150,
    slopeDeg: 11.2,
    geology: 'Narrow elevated ridge connecting Shackleton crater rim to de Gerlache mountain.',
=======
    regionLabel: 'South Pole Ridge (89.0066°S, 132.0596°E)',
    lat: -89.0066,
    lon: 132.0596,
    latitude: -89.0066,
    longitude: 132.0596,
    geology: 'Elevated ridge outside Shackleton crater rim (LPI Artemis III workshop abstract 2042).',
>>>>>>> Stashed changes
    scienceTarget: 'Subsurface water ice prospecting with direct access to Shackleton crater interior (<40 K).',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-artemis3-mouton',
    name: 'Mons Mouton Plateau',
    region: 'south-pole',
    regionLabel: 'South Pole Highland (84.50°S, 31.70°E)',
    lat: -84.50,
    lon: 31.70,
    latitude: -84.50,
    longitude: 31.70,
<<<<<<< Updated upstream
    elevationM: 6050,
    slopeDeg: 4.2,
=======
>>>>>>> Stashed changes
    geology: 'Broad, flat elevated plateau spanning ~100 km² with low rock abundance.',
    scienceTarget: 'NASA VIPER & Griffin prospecting zone for volatile deposits across multiple micro-environments.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-candidate-haworth-rim',
    name: 'Haworth Crater Rim',
    region: 'south-pole',
    regionLabel: 'South Pole Rim (87.40°S, 5.10°W)',
    lat: -87.40,
    lon: -5.10,
    latitude: -87.40,
    longitude: -5.10,
<<<<<<< Updated upstream
    elevationM: 3200,
    slopeDeg: 8.7,
=======
>>>>>>> Stashed changes
    geology: 'Degraded crater rim overlooking one of the largest cold traps in the south polar region.',
    scienceTarget: 'Direct sampling of volatile frost on shadowed scarps within 2 km of sunlit rim.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-artemis3-faustini-rim-a',
    name: 'Faustini Crater Rim A',
    region: 'south-pole',
<<<<<<< Updated upstream
    regionLabel: 'South Pole High Rim (87.10°S, 77.00°E)',
    lat: -87.10,
    lon: 77.00,
    latitude: -87.10,
    longitude: 77.00,
    elevationM: 3620,
    slopeDeg: 7.8,
    geology: 'Smooth crest along eastern Faustini rim with extensive line-of-sight to Earth.',
=======
    regionLabel: 'South Pole High Rim (88.0573°S, 89.1596°E)',
    lat: -88.0573,
    lon: 89.1596,
    latitude: -88.0573,
    longitude: 89.1596,
    geology: 'Crest along Faustini rim documented in LPI Artemis III workshop abstract 2042.',
>>>>>>> Stashed changes
    scienceTarget: 'Characterization of ancient South Pole-Aitken basin impact melt sheet.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-artemis3-nobile-rim-2',
    name: 'Nobile Rim 2',
    region: 'south-pole',
<<<<<<< Updated upstream
    regionLabel: 'South Pole Moderate Plateau (85.20°S, 53.30°E)',
    lat: -85.20,
    lon: 53.30,
    latitude: -85.20,
    longitude: 53.30,
    elevationM: 3880,
    slopeDeg: 6.5,
    geology: 'Extensive highland terrain with intercrater plains suitable for rover traverses.',
=======
    regionLabel: 'South Pole Moderate Plateau (84.2016°S, 60.6999°E)',
    lat: -84.2016,
    lon: 60.6999,
    latitude: -84.2016,
    longitude: 60.6999,
    geology: 'Extensive highland terrain on Nobile crater rim (Peña-Asensio et al. 2025 site DM2).',
>>>>>>> Stashed changes
    scienceTarget: 'Subsurface hydrogen concentrations confirmed by neutron spectrometer mapping.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-artemis3-de-gerlache-rim-2',
    name: 'de Gerlache Rim 2',
    region: 'south-pole',
<<<<<<< Updated upstream
    regionLabel: 'Near-Polar Peak (88.50°S, 272.00°E)',
    lat: -88.50,
    lon: -88.00,
    latitude: -88.50,
    longitude: -88.00,
    elevationM: 3410,
    slopeDeg: 9.9,
    geology: 'Steep-walled impact crater rim adjacent to Shackleton.',
=======
    regionLabel: 'Near-Polar Peak (88.5157°S, 61.1673°W)',
    lat: -88.5157,
    lon: -61.1673,
    latitude: -88.5157,
    longitude: -61.1673,
    geology: 'Steep-walled impact crater rim adjacent to Shackleton (Peña-Asensio et al. 2025 site SL2).',
>>>>>>> Stashed changes
    scienceTarget: 'Dual-illumination regime with quasi-permanent sunlight during southern summer solstice.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-artemis3-amundsen-rim',
    name: 'Amundsen Crater Rim',
    region: 'south-pole',
<<<<<<< Updated upstream
    regionLabel: 'South Polar Highland (84.30°S, 85.60°E)',
    lat: -84.30,
    lon: 85.60,
    latitude: -84.30,
    longitude: 85.60,
    elevationM: 2950,
    slopeDeg: 12.4,
    geology: 'Complex terraced crater rim with sharp topographical relief.',
=======
    regionLabel: 'South Polar Highland (84.1918°S, 67.2290°E)',
    lat: -84.1918,
    lon: 67.2290,
    latitude: -84.1918,
    longitude: 67.2290,
    geology: 'Complex terraced crater rim (Peña-Asensio et al. 2025 site DM1).',
>>>>>>> Stashed changes
    scienceTarget: 'Exposed central peak stratigraphy and deep crustal composition.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-candidate-slater-plain',
    name: 'Slater Plain',
    region: 'south-pole',
    regionLabel: 'South Polar Intercrater (88.10°S, 111.00°E)',
    lat: -88.10,
    lon: 111.00,
    latitude: -88.10,
    longitude: 111.00,
<<<<<<< Updated upstream
    elevationM: 2600,
    slopeDeg: 4.8,
=======
>>>>>>> Stashed changes
    geology: 'Gently rolling highland plain sheltered by surrounding massifs.',
    scienceTarget: 'Low-slope polar terrain minimizing touchdown hazard for autonomous heavy landers.',
    isFarSide: false,
    hasRelayRequired: false,
  },

  // =========================================================================
  // 2. NEARSIDE EQUATORIAL & MID-LATITUDE BASINS (Outside 80°S–90°S LOLA DEM)
  // =========================================================================
  {
    id: 'landing-apollo-11',
    name: 'Mare Tranquillitatis (Tranquility Base)',
    region: 'equatorial-mare',
    regionLabel: 'Nearside Equatorial Mare (0.67°N, 23.47°E)',
    lat: 0.67,
    lon: 23.47,
    latitude: 0.67,
    longitude: 23.47,
<<<<<<< Updated upstream
    elevationM: -1420,
    slopeDeg: 1.8,
    geology: 'High-titanium basaltic mare plain with low crater density and gentle slopes.',
=======
    geology: 'High-titanium basaltic mare plain.',
>>>>>>> Stashed changes
    scienceTarget: 'Apollo 11 heritage site, ilmenite-rich regolith for ISRU oxygen extraction.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-apollo-12',
    name: 'Oceanus Procellarum (Apollo 12 / Surveyor 3)',
    region: 'equatorial-mare',
    regionLabel: 'Ocean of Storms (3.01°S, 23.42°W)',
    lat: -3.01,
    lon: -23.42,
    latitude: -3.01,
    longitude: -23.42,
<<<<<<< Updated upstream
    elevationM: -2150,
    slopeDeg: 2.1,
=======
>>>>>>> Stashed changes
    geology: 'Vast low-relief volcanic flood basalt basin with thin regolith cover.',
    scienceTarget: 'Young basalt chronometry and 55+ year material degradation benchmark.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-clps-firefly-crisium',
    name: 'Mare Crisium Basin (Blue Ghost 1)',
    region: 'equatorial-mare',
    regionLabel: 'Isolated Nearside Basin (18.56°N, 61.81°E)',
    lat: 18.56,
    lon: 61.81,
    latitude: 18.56,
    longitude: 61.81,
<<<<<<< Updated upstream
    elevationM: -3600,
    slopeDeg: 2.9,
=======
>>>>>>> Stashed changes
    geology: 'Circular impact basin filled with multiple successive flood basalt episodes.',
    scienceTarget: 'Planetary heat flow measurements and regolith electrostatic levitation study.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-clps-reiner-gamma',
    name: 'Reiner Gamma Swirl (IM-3 Lunar Vertex)',
    region: 'equatorial-mare',
    regionLabel: 'Magnetic Anomaly (7.50°N, 59.00°W)',
    lat: 7.50,
    lon: -59.00,
    latitude: 7.50,
    longitude: -59.00,
<<<<<<< Updated upstream
    elevationM: -2420,
    slopeDeg: 2.0,
=======
>>>>>>> Stashed changes
    geology: 'High-albedo curvilinear surface swirl overlying strong crustal magnetic anomaly.',
    scienceTarget: 'Mini-magnetosphere solar wind shielding and autonomous CADRE micro-rover swarm deployment.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-apollo-17',
    name: 'Taurus-Littrow Valley',
    region: 'equatorial-mare',
    regionLabel: 'Nearside Highland Ring (20.19°N, 30.77°E)',
    lat: 20.19,
    lon: 30.77,
    latitude: 20.19,
    longitude: 30.77,
<<<<<<< Updated upstream
    elevationM: -2500,
    slopeDeg: 7.6,
=======
>>>>>>> Stashed changes
    geology: 'Steep-walled graben valley bounded by North and South Massifs.',
    scienceTarget: 'Volcanic pyroclastic orange glass beads and deep mantle xenoliths.',
    isFarSide: false,
    hasRelayRequired: false,
  },
  {
    id: 'landing-marius-hills',
    name: 'Marius Hills Pit & Skylight',
    region: 'equatorial-mare',
    regionLabel: 'Volcanic Complex (14.10°N, 56.70°W)',
    lat: 14.10,
    lon: -56.70,
    latitude: 14.10,
    longitude: -56.70,
<<<<<<< Updated upstream
    elevationM: -2550,
    slopeDeg: 5.6,
=======
>>>>>>> Stashed changes
    geology: 'Dense complex of volcanic domes and sinuous rilles containing a 65m open lava tube pit.',
    scienceTarget: 'Subsurface lava tube habitat qualification and natural radiation/micrometeorite shielding.',
    isFarSide: false,
    hasRelayRequired: false,
  },

  // =========================================================================
  // 3. LUNAR FARSIDE BASINS & RELAY TARGETS (Outside 80°S–90°S LOLA DEM)
  // =========================================================================
  {
    id: 'landing-change-4',
    name: 'Von Kármán Crater (Chang\'e 4)',
    region: 'farside',
    regionLabel: 'Farside SPA Basin (45.44°S, 177.60°E)',
    lat: -45.44,
    lon: 177.60,
    latitude: -45.44,
    longitude: 177.60,
<<<<<<< Updated upstream
    elevationM: -5930,
    slopeDeg: 3.8,
=======
>>>>>>> Stashed changes
    geology: 'Floor of ancient 180 km impact crater flooded by subsequent mare basalt within South Pole-Aitken basin.',
    scienceTarget: 'Low-frequency radio astronomy free from Earth ionospheric noise; deep SPA mantle composition.',
    isFarSide: true,
    hasRelayRequired: true,
  },
  {
    id: 'landing-change-6',
    name: 'Apollo Basin (Chang\'e 6 Sample Return)',
    region: 'farside',
    regionLabel: 'Farside Southern Ring (41.64°S, 153.99°W)',
    lat: -41.64,
    lon: -153.99,
    latitude: -41.64,
    longitude: -153.99,
<<<<<<< Updated upstream
    elevationM: -5210,
    slopeDeg: 4.5,
=======
>>>>>>> Stashed changes
    geology: 'Multi-ring impact basin exposing deepest excavated farside lower crust.',
    scienceTarget: 'Pristine farside mantle sample analysis and lunar hemispheric dichotomy resolution.',
    isFarSide: true,
    hasRelayRequired: true,
  },
  {
    id: 'landing-draper-schrodinger',
    name: 'Schrödinger Basin (Draper APEX 1.0)',
    region: 'farside',
    regionLabel: 'Farside Polar Ring (75.00°S, 132.40°E)',
    lat: -75.00,
    lon: 132.40,
    latitude: -75.00,
    longitude: 132.40,
<<<<<<< Updated upstream
    elevationM: -4520,
    slopeDeg: 6.2,
=======
>>>>>>> Stashed changes
    geology: 'Intact two-ring peak basin containing young volcanic vents and pyroclastics.',
    scienceTarget: 'Farside seismic observatory, magnetotelluric sounding, and subsurface geothermal flux.',
    isFarSide: true,
    hasRelayRequired: true,
  },
  {
    id: 'landing-tsiolkovskiy',
    name: 'Tsiolkovskiy Crater',
    region: 'farside',
    regionLabel: 'Farside Prominent Mare (20.40°S, 129.10°E)',
    lat: -20.40,
    lon: 129.10,
    latitude: -20.40,
    longitude: 129.10,
<<<<<<< Updated upstream
    elevationM: -3850,
    slopeDeg: 4.9,
=======
>>>>>>> Stashed changes
    geology: 'Striking dark mare floor enclosed by dramatic 4 km high terraced crater walls.',
    scienceTarget: 'Isolated farside volcanism and pristine impact melt deposits.',
    isFarSide: true,
    hasRelayRequired: true,
  },
];
