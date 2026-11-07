/**
 * @file clpsMissions.js
 * Verified NASA Commercial Lunar Payload Services (CLPS) mission dataset.
 * Sourced directly from official NASA CLPS task orders, NASA NSSDC Master Catalog,
 * and mission provider declarations (Intuitive Machines, Astrobotic, Firefly Aerospace,
 * Draper Laboratory, Blue Origin).
 */

/**
 * CHANGE LOG (2026-11-02) - every edited/added entry below also carries an inline
 * "CHANGED" or "ADDED" comment that says why. Sources are listed in docs/lunar-sites-sources.md.
 *
 *  CHANGED  clps-im2-athena        landed 2025-03-06 at Mons Mouton (was a planned pin at 89.7 S)
 *  CHANGED  clps-firefly-bgm1      landed 2025-03-02 (was "planned")
 *  CHANGED  clps-griffin-gm1       schedule + target wording (Nobile crater region near Mons Mouton)
 *  CHANGED  clps-im3-vertex        schedule slipped to early 2027
 *  CHANGED  clps-firefly-cp21      CP-21 is Blue Ghost Mission 3 (Gruithuisen Domes), not the far-side mission
 *  ADDED    clps-firefly-bgm2      Blue Ghost Mission 2 (CS-3/CS-4, far side); placeholder position only
 *  CHANGED  clps-blueorigin-cp22   Blue Moon Mark 1 "Endurance" -> Shackleton Connecting Ridge
 *  REVIEW   clps-draper-cp12       coordinates verified as Schroedinger basin centre; dates not re-verified
 */

/**
 * @typedef {Object} ClpsPayload
 * @property {string} name - Instrument acronym
 * @property {string} fullName - Full instrument title
 * @property {string} agency - Leading organization (e.g. NASA GSFC, NASA LaRC, ESA)
 * @property {string} purpose - Scientific or technological objective
 */

/**
 * @typedef {Object} ClpsMission
 * @property {string} id - Unique identifier
 * @property {string} name - Mission name
 * @property {string} taskOrder - Official NASA CLPS Task Order identifier
 * @property {string} provider - Commercial lander provider
 * @property {string} lander - Spacecraft lander vehicle model
 * @property {'completed'|'planned'|'failed'|'in-progress'|'postponed'} missionStatus - Verified status
 * @property {'confirmed'|'planned'|'approximate'|'placeholder'} locationType - Landing coordinate fidelity
 * @property {number} latitude - Selenographic latitude (-90 to +90)
 * @property {number} longitude - Selenographic longitude (-180 to +180)
 * @property {string} landingSiteName - Named lunar geographical site
 * @property {'South Pole'|'Nearside Oceanus Procellarum'|'Nearside Eastern Basin'|'Farside SPA Basin'|'Equatorial Nearside'} targetRegion - Broad lunar region
 * @property {string} launchDate - Launch date or target window
 * @property {string=} landingDate - Landing date (if landed)
 * @property {string} launchVehicle - Rocket booster
 * @property {string} objectives - Scientific & mission objectives
 * @property {Array<ClpsPayload>} payloads - Manifested NASA & commercial instruments
 * @property {string} sourceUrl - Official NASA reference URL
 * @property {boolean=} horizonEligible - false when the coordinates are only a display placeholder (skip horizon / Earth-visibility analysis)
 * @property {string=} positionNote - Free-text note on how reliable the coordinates are
 * @property {string} source - Catalog / Contract reference
 * @property {string} description - Comprehensive verified summary
 */

export const CLPS_MISSIONS = [
  {
    id: 'clps-im1-odysseus',
    name: 'IM-1 (Odysseus / Nova-C)',
    taskOrder: 'TO 2-IM',
    provider: 'Intuitive Machines',
    lander: 'Nova-C (Odysseus)',
    missionStatus: 'completed',
    locationType: 'confirmed',
    latitude: -80.13,
    longitude: 1.44,
    elevationMeters: 2617,
    landingSiteName: 'Malapert A Rim (South Pole)',
    targetRegion: 'South Pole',
    launchDate: '2024-02-15',
    landingDate: '2024-02-22',
    launchVehicle: 'SpaceX Falcon 9',
    objectives: 'First commercial spacecraft in history to achieve a lunar soft landing. Executed scientific observations of radio astronomy, descent engine plume-surface interaction, cryogenic propellant management, and surface autonomous navigation.',
    payloads: [
      {
        name: 'ROLSES',
        fullName: 'Radio Observations of the Lunar Surface Quasi-Thermal Noise and Solar Radio Bursts',
        agency: 'NASA GSFC',
        purpose: 'Radio astronomy from the lunar surface to observe photoelectron sheath and solar radio bursts.',
      },
      {
        name: 'LRA',
        fullName: 'Laser Retroreflector Array',
        agency: 'NASA GSFC',
        purpose: 'Permanent passive optical fiducial marker for orbital laser-ranging measurement.',
      },
      {
        name: 'NDL',
        fullName: 'Navigation Doppler Lidar for Precise Velocity and Range Sensing',
        agency: 'NASA LaRC',
        purpose: 'High-precision descent speed and distance laser-sensor for planetary landings.',
      },
      {
        name: 'SCALPENS',
        fullName: 'Stereo Cameras for Lunar Plume-Surface Studies',
        agency: 'NASA LaRC',
        purpose: 'Photogrammetric camera array monitoring rocket exhaust plume scouring regolith.',
      },
      {
        name: 'LN-1',
        fullName: 'Lunar Node 1 Navigation Demonstrator',
        agency: 'NASA MSFC',
        purpose: 'Autonomous positioning beacon testing decentralized lunar navigation network.',
      },
      {
        name: 'RFMG',
        fullName: 'Radio Frequency Mass Gauge',
        agency: 'NASA GRC',
        purpose: 'Cryogenic propellant gauging measurement using radio frequency resonance in low-g.',
      },
      {
        name: 'ILO-X',
        fullName: 'International Lunar Observatory Precursor',
        agency: 'ILO Association',
        purpose: 'First commercial optical camera to photograph the Milky Way galaxy center from the Moon.',
      },
    ],
    sourceUrl: 'https://www.nasa.gov/missions/clps/clps-intuitive-machines-im-1/',
    source: 'NASA CLPS Program / NSSDC ID: 2024-030A / LROC Observation',
    description: 'On February 22, 2024, Intuitive Machines became the first commercial company to land on the Moon. Odysseus touched down within 1.5 km of its intended target at Malapert A, approximately 300 km from the lunar South Pole. Confirmed by NASA Lunar Reconnaissance Orbiter (LROC) imagery at 80.13°S, 1.44°E, the mission operated for 7 days transmitting telemetry and scientific data.',
  },
  {
    id: 'clps-im2-athena',
    // CHANGED 2026-11-02: was a planned pin at (-89.70, 120.00) = "Shackleton Connecting Ridge". That point lies INSIDE Shackleton crater
    // (horizon came back "enclosed", 17-27 deg everywhere). The mission was re-targeted to Mons Mouton and landed on 2025-03-06.
    // Coordinates 84 47' 26" S, 29 11' 45" E = (-84.7906, 29.1958) are the actual landing site (Wikipedia IM-2 infobox);
    // LROC lists the INTENDED site as (-84.78, 29.13), ~250 m away, which matches Intuitive Machines' statement.
    // Horizon entry for this id in horizons.json was removed because it was computed for the old point - recompute.
    name: 'IM-2 (Athena / PRIME-1)',
    taskOrder: 'TO PRIME-1',
    provider: 'Intuitive Machines',
    lander: 'Nova-C (Athena)',
    missionStatus: 'completed',
    locationType: 'confirmed',
    latitude: -84.7906,
    longitude: 29.1958,
    elevationMeters: 5325,
    landingSiteName: 'Mons Mouton (South Pole Plateau)',
    targetRegion: 'South Pole',
    launchDate: '2025-02-27',
    landingDate: '2025-03-06',
    launchVehicle: 'SpaceX Falcon 9',
    objectives: 'Deliver NASA\'s PRIME-1 (TRIDENT drill and MSolo mass spectrometer) and a Nokia 4G/LTE network demonstration to the south polar region. The lander ended up on its side after touchdown, which sharply limited operations.',
    payloads: [
      {
        name: 'TRIDENT',
        fullName: 'The Regolith and Ice Drill for Exploring New Terrain',
        agency: 'NASA / Honeybee Robotics',
        purpose: '1-meter rotary percussive drill designed to extract subsurface ice and volatile-bearing regolith cores.',
      },
      {
        name: 'MSolo',
        fullName: 'Mass Spectrometer observing lunar operations',
        agency: 'NASA KSC',
        purpose: 'Modified commercial mass spectrometer analyzing volatile gases sublimating from drill cuttings.',
      },
      {
        name: 'Nokia 4G/LTE',
        fullName: 'Lunar Surface LTE Cellular Network',
        agency: 'NASA / Nokia Bell Labs',
        purpose: 'First cellular data communications network operating on the lunar surface.',
      },
      {
        name: 'Micro-Nova (μNova)',
        fullName: 'Extreme Lunar Surface Hopper Drone',
        agency: 'Intuitive Machines',
        purpose: 'Rocket-propelled hopping drone designed to fly into permanently shadowed craters.',
      },
      {
        name: 'M1 Rover',
        fullName: 'Mobile Autonomous Prospecting System',
        agency: 'Lunar Outpost',
        purpose: 'Lightweight autonomous rover traversing polar slopes to characterize volatile distribution.',
      },
    ],
    sourceUrl: 'https://www.lroc.asu.edu/images/1401',
    source: 'LROC (ASU) IM-2 Landing Region; Intuitive Machines release 2025-03-07; NASA CLPS press kit NP-2025-02-005',
    description: 'IM-2 (Athena) touched down on 6 March 2025 inside a crater on Mons Mouton, about 250 m from its intended site and roughly 160 km from the south pole - the southernmost landing ever achieved. The lander ended up on its side, so the power and communication geometry of the site mattered a great deal. The original plan was the Shackleton Connecting Ridge near 89.7 S; the target was moved to Mons Mouton before launch.',
  },
  {
    id: 'clps-firefly-bgm1',
    // CHANGED 2026-11-02: status "planned" -> "completed". Launched 2025-01-15, landed 2025-03-02. Coordinates unchanged (18.56 N, 61.81 E).
    // LROC places the lander ~4 km from the centre of Mons Latreille.
    name: 'Blue Ghost Mission 1',
    taskOrder: 'TO 19D',
    provider: 'Firefly Aerospace',
    lander: 'Blue Ghost Lander',
    missionStatus: 'completed',
    locationType: 'confirmed',
    latitude: 18.56,
    longitude: 61.81,
    landingSiteName: 'Mare Crisium Basin',
    targetRegion: 'Nearside Eastern Basin',
    launchDate: '2025-01-15',
    landingDate: '2025-03-02',
    launchVehicle: 'SpaceX Falcon 9',
    objectives: 'Delivered 10 NASA science and technology payloads to Mare Crisium: volcanic geophysics, lunar heat flow, GPS reception at lunar distance, and electrodynamic dust mitigation.',
    payloads: [
      {
        name: 'LISTER',
        fullName: 'Lunar Instrumentation for Subsurface Thermal Exploration with Rapidity',
        agency: 'NASA / Texas Tech Univ.',
        purpose: 'Pneumatically drills a thermal sensor string up to 3 meters into regolith to measure lunar heat flow.',
      },
      {
        name: 'LuGRE',
        fullName: 'Lunar GNSS Receiver Experiment',
        agency: 'NASA / ASI (Italy)',
        purpose: 'Receives and processes Earth GPS and European Galileo signals to demonstrate lunar navigation.',
      },
      {
        name: 'NGLR',
        fullName: 'Next Generation Lunar Retroreflector',
        agency: 'NASA / Univ. of Maryland',
        purpose: 'Advanced single-aperture corner cube retroreflector enabling millimeter-accuracy Earth laser ranging.',
      },
      {
        name: 'LEXI',
        fullName: 'Lunar Environment heliospheric X-ray Imager',
        agency: 'NASA / Boston Univ.',
        purpose: 'Wide-field X-ray telescope capturing continuous global images of Earth magnetopause reconnection.',
      },
      {
        name: 'EDS',
        fullName: 'Electrodynamic Dust Shield',
        agency: 'NASA KSC',
        purpose: 'Dynamic electrostatic wave electrodes to lift and clear abrasive lunar dust from optical surfaces.',
      },
      {
        name: 'SCALPENS',
        fullName: 'Stereo Cameras for Lunar Plume-Surface Studies',
        agency: 'NASA LaRC',
        purpose: 'High-speed stereoscopic imaging of rocket exhaust interacting with Mare Crisium basalts.',
      },
      {
        name: 'RAC',
        fullName: 'Regolith Adherence Characterization',
        agency: 'NASA GRC',
        purpose: 'Exposes diverse aerospace materials to determine regolith binding and abrasive rates.',
      },
      {
        name: 'RadPC',
        fullName: 'Radiation Tolerant Computer',
        agency: 'NASA / Montana State Univ.',
        purpose: 'FPGA-based self-healing computer architecture evaluating radiation-induced single-event upsets.',
      },
      {
        name: 'LRA',
        fullName: 'Laser Retroreflector Array',
        agency: 'NASA GSFC',
        purpose: 'Permanent passive optical fiducial marker on the Crisium basin floor.',
      },
      {
        name: 'LP-EDP',
        fullName: 'Lunar Planetological Electrostatic Dust Probe',
        agency: 'NASA',
        purpose: 'Measures electrostatic potential and electric fields that cause natural dust levitation.',
      },
    ],
    sourceUrl: 'https://lroc.im-ldi.com/image_tags/Robotic%20Spacecraft',
    source: 'NASA CLPS press kit NP-2025-01-001 (TO 19D); LROC (ASU) Blue Ghost landing region; NASA CLPS tracker',
    description: 'Firefly Aerospace Blue Ghost Mission 1 soft-landed upright in Mare Crisium on 2 March 2025 (18.56 N, 61.81 E), about 4 km from the centre of the volcanic cone Mons Latreille, and operated through a full lunar day (~14 Earth days). It was the first fully successful CLPS landing.',
  },
  {
    id: 'clps-peregrine-pm1',
    name: 'Peregrine Mission 1 (PM-1)',
    taskOrder: 'TO 2-AB',
    provider: 'Astrobotic Technology',
    lander: 'Peregrine Lunar Lander',
    missionStatus: 'failed',
    locationType: 'planned',
    latitude: 35.25,
    longitude: -40.99,
    landingSiteName: 'Sinus Viscositatis (near Gruithuisen Domes)',
    targetRegion: 'Nearside Oceanus Procellarum',
    launchDate: '2024-01-08',
    landingDate: 'None (Controlled Earth Re-entry Jan 18, 2024)',
    launchVehicle: 'ULA Vulcan Centaur',
    objectives: 'First flight of Astrobotic Peregrine lander intended to deliver 5 NASA scientific instruments to the silicic volcanic Gruithuisen Domes region to study exospheric volatiles, radiation environment, and regolith hydration.',
    payloads: [
      {
        name: 'NSS',
        fullName: 'Neutron Spectrometer System',
        agency: 'NASA ARC',
        purpose: 'Search for hydrogen-bearing compounds and quantify regolith water equivalent hydrogen.',
      },
      {
        name: 'LETS',
        fullName: 'Linear Energy Transfer Spectrometer',
        agency: 'NASA JSC',
        purpose: 'Measures high-energy ionizing radiation dosage and linear energy transfer spectra.',
      },
      {
        name: 'NIRVSS',
        fullName: 'Near-Infrared Volatile Spectrometer System',
        agency: 'NASA ARC',
        purpose: 'Spectroscopic measurement of surface mineralogy and volatile absorption bands at 3-4 microns.',
      },
      {
        name: 'MSolo',
        fullName: 'Mass Spectrometer observing lunar operations',
        agency: 'NASA KSC',
        purpose: 'Quadrupole mass spectrometer analyzing volatile chemical species released during landing.',
      },
      {
        name: 'PITMS',
        fullName: 'Peregrine Ion-Trap Mass Spectrometer',
        agency: 'NASA GSFC / ESA',
        purpose: 'Measures low-mass ions and neutral molecules in the tenuous lunar exosphere.',
      },
    ],
    sourceUrl: 'https://www.nasa.gov/commercial-lunar-payload-services/',
    source: 'NASA CLPS Program / NSSDC ID: 2024-006A',
    description: 'Launched on January 8, 2024, Peregrine encountered a propulsion oxidizer valve anomaly that ruptured the fuel tank in translunar transit. While unable to perform a soft landing, Astrobotic activated all powered NASA instruments in cislunar space, successfully collecting space radiation data for 10 days before safely directing the spacecraft into Earth atmosphere on January 18, 2024.',
  },
  {
    id: 'clps-griffin-gm1',
    // CHANGED 2026-11-02: schedule updated ("Target Late 2025" is stale; now NET Nov 2026) and target wording changed to
    // "Nobile Crater region near Mons Mouton" as used by NASA/Astrobotic. VIPER's earlier planned site was the WESTERN RIM of Nobile crater, adjacent to Mons Mouton.
    // Coordinates KEPT at the Mons Mouton feature position (-84.5, 31.7) but flagged "approximate": no published landing coordinates were found.
    // Same coordinates as mons-mouton / landing-artemis3-mouton, so the horizon is computed once.
    name: 'Griffin Mission 1 (GM1)',
    taskOrder: 'TO 20A',
    provider: 'Astrobotic Technology',
    lander: 'Griffin Lunar Lander',
    missionStatus: 'planned',
    locationType: 'approximate',
    latitude: -84.50,
    longitude: 31.70,
    elevationMeters: 5234,
    landingSiteName: 'Nobile Crater region near Mons Mouton (South Pole)',
    targetRegion: 'South Pole',
    launchDate: 'NET November 2026 (NASA, Sep 2026)',
    landingDate: 'TBD (after NET Nov 2026 launch)',
    launchVehicle: 'SpaceX Falcon Heavy',
    objectives: 'Deliver Astrolab\'s FLIP rover and payloads to the south polar Nobile region and qualify Astrobotic\'s large Griffin lander. The mission was originally built around NASA\'s VIPER rover.',
    payloads: [
      {
        name: 'LRA',
        fullName: 'Laser Retroreflector Array',
        agency: 'NASA GSFC',
        purpose: 'Permanent optical target for orbiters and lunar ranging stations.',
      },
      {
        name: 'Griffin Core Avionics',
        fullName: 'Autonomous Hazard Detection and Avoidance (HDA)',
        agency: 'Astrobotic',
        purpose: 'Optical and lidar terrain-relative navigation for precision touchdowns in high-shadow polar terrain.',
      },
    ],
    sourceUrl: 'https://www.nasa.gov/moonbase-phases/',
    source: 'NASA Moon Base phases; NASA CLPS providers page (TO 20A); Astrobotic releases',
    description: 'Astrobotic\'s Griffin Mission One targets the Nobile Crater region near Mons Mouton at the lunar south pole, carrying Astrolab\'s FLIP rover. NASA schedule sources dated September 2026 list it as no earlier than November 2026. The exact touchdown point has not been published, so the pin marks the Mons Mouton plateau.',
  },
  {
    id: 'clps-im3-vertex',
    // CHANGED 2026-11-02: "Target 2026" is stale. Sources dated Sep-Oct 2026 place IM-3 in the first part of 2027.
    // Reiner Gamma (7.5 N, 59.0 W) coordinates unchanged.
    name: 'IM-3 (Nova-C / Lunar Vertex)',
    taskOrder: 'TO CP-11',
    provider: 'Intuitive Machines',
    lander: 'Nova-C',
    missionStatus: 'planned',
    locationType: 'planned',
    latitude: 7.50,
    longitude: -59.00,
    landingSiteName: 'Reiner Gamma Lunar Swirl',
    targetRegion: 'Nearside Oceanus Procellarum',
    launchDate: 'NET first half of 2027 (NASA, Sep 2026)',
    landingDate: 'TBD (2027)',
    launchVehicle: 'SpaceX Falcon 9',
    objectives: 'Investigate the enigmatic Reiner Gamma magnetic swirl. Deploys the Lunar Vertex suite and JPL CADRE autonomous swarm rovers to study miniature magnetosphere dynamics and solar wind deflection.',
    payloads: [
      {
        name: 'Lunar Vertex',
        fullName: 'PRISM-1 Magnetometer & Multispectral Rover Suite',
        agency: 'NASA / JHUAPL',
        purpose: 'Conducts in-situ magnetic field and plasma measurements directly within a lunar crustal magnetic anomaly.',
      },
      {
        name: 'CADRE',
        fullName: 'Cooperative Autonomous Distributed Robotic Exploration',
        agency: 'NASA JPL',
        purpose: 'Trio of shoe-box sized autonomous rovers conducting cooperative distributed mapping and navigation.',
      },
      {
        name: 'LRA',
        fullName: 'Laser Retroreflector Array',
        agency: 'NASA GSFC',
        purpose: 'Precision laser-ranging target on the western nearside basalt plain.',
      },
    ],
    sourceUrl: 'https://www.nasa.gov/moonbase-phases/',
    source: 'NASA CLPS press kit NP-2025-02-005 (TO CP-11, Reiner Gamma); NASA Moon Base phases; CLPS schedule tracker (Sep 2026)',
    description: 'IM-3 will land on Reiner Gamma (7.5°N, 59.0°W), the most famous lunar swirl. These bright, sinuous markings correspond to localized magnetic anomalies. The Lunar Vertex payload includes a lander suite and a mini-rover that will traverse across magnetic field boundaries.',
  },
  {
    id: 'clps-draper-cp12',
    // REVIEW 2026-11-02: coordinates (-75.0, 132.4) = Schroedinger basin centre (IAU) - kept. NASA press kit NP-2025-02-005 confirms
    // Team Draper / ispace-U.S. APEX 1.0 -> Schroedinger Basin (TO CP-12). Launch/landing "Target 2026" could not be re-verified - check NASA CLPS page.
    name: 'Draper CP-12 (APEX 1.0)',
    taskOrder: 'TO CP-12',
    provider: 'Draper Laboratory',
    lander: 'APEX 1.0 (ispace US)',
    missionStatus: 'planned',
    locationType: 'planned',
    latitude: -75.00,
    longitude: 132.40,
    landingSiteName: 'Schrödinger Basin (Farside)',
    targetRegion: 'Farside SPA Basin',
    launchDate: 'Target 2026',
    landingDate: 'Target 2026',
    launchVehicle: 'Commercial Launcher',
    objectives: 'First dedicated seismic and geothermal observatory on the lunar farside. Places seismometers inside the pristine peak-ring Schrödinger impact basin to record farside moonquakes and deep mantle structure.',
    payloads: [
      {
        name: 'FSS',
        fullName: 'Farside Seismic Suite',
        agency: 'NASA JPL',
        purpose: 'Dual ultra-sensitive seismometers to measure farside moonquakes and meteorite impact vibrations.',
      },
      {
        name: 'LITMS',
        fullName: 'Lunar Interior Temperature and Materials Suite',
        agency: 'NASA / SwRI',
        purpose: 'Instruments measuring electrical conductivity and geothermal heat flow inside Schrödinger basin.',
      },
      {
        name: 'LuSEE-Lite',
        fullName: 'Lunar Surface Electromagnetics Experiment',
        agency: 'NASA / UC Berkeley',
        purpose: 'Electromagnetic field sensor and solar wind plasma probe observing the lunar plasma sheath.',
      },
    ],
    sourceUrl: 'https://www.nasa.gov/commercial-lunar-payload-services/',
    source: 'NASA CLPS Program / Task Order CP-12',
    description: 'Draper was selected under CLPS Task Order CP-12 to deliver science to the Schrödinger Basin on the lunar farside. Because the farside cannot communicate directly with Earth, the mission uses orbiting communication relay satellites to transmit seismic data back to Earth.',
  },
  {
    id: 'clps-firefly-cp21',
    // CHANGED 2026-11-02: this id used to be "Blue Ghost Mission 2 (LuSEE-Night)" at a far-side placeholder (-45, 160).
    // NASA's press kit shows CP-21 = Blue Ghost Mission 3 -> Gruithuisen Domes. The far-side mission is now clps-firefly-bgm2.
    // The id is kept so existing references keep working. Coordinates (36.6 N, 40.5 W) are APPROXIMATE (domes area), not a published landing point.
    name: 'Blue Ghost Mission 3 (Gruithuisen Domes)',
    taskOrder: 'TO CP-21',
    provider: 'Firefly Aerospace',
    lander: 'Blue Ghost Lander',
    missionStatus: 'planned',
    locationType: 'approximate',
    positionNote: 'Approximate centre of the Gruithuisen Domes area (about 36-37 N, 40 W); NASA gives no site coordinates. Verify against the IAU Gazetteer before using for horizon analysis.',
    latitude: 36.6,
    longitude: -40.5,
    landingSiteName: 'Gruithuisen Domes (Nearside)',
    targetRegion: 'Nearside Oceanus Procellarum',
    launchDate: '2028 (NASA award, Dec 2024)',
    landingDate: 'TBD (2028)',
    launchVehicle: 'SpaceX Falcon 9',
    objectives: 'Investigate the Gruithuisen Domes, silica-rich volcanic constructs unlike the basaltic maria around them.',
    payloads: [],  // payload manifest not verified for BGM3
    sourceUrl: 'https://www.nasa.gov/wp-content/uploads/2025/02/np-2025-02-005-jsc-clps-intuitive-machines-press-kit-508-2-25-25.pdf',
    source: 'NASA CLPS press kit NP-2025-02-005 (Blue Ghost Mission 3 = TO CP-21, Gruithuisen Domes); NASA CLPS task-order award Dec 2024',
    description: 'NASA task order CP-21 sends Firefly\'s third Blue Ghost lander to the Gruithuisen Domes on the nearside, silica-rich volcanic features unlike the basaltic maria around them. NASA has not published landing coordinates; the pin marks the general area of the domes.',
  },
  {
    id: 'clps-firefly-bgm2',
    // ADDED 2026-11-02: Blue Ghost Mission 2 was previously mis-filed under id "clps-firefly-cp21" with a far-side placeholder.
    // NASA's press kit shows BGM2 = task orders CS-3/CS-4 (far side) and CP-21 = Blue Ghost Mission 3 (Gruithuisen Domes).
    // The latitude/longitude (-45, 160) is the OLD PLACEHOLDER, kept only so the mission stays visible on the globe.
    // horizonEligible=false -> export_sites.mjs skips it; do not use it for Sun/Earth analysis.
    name: 'Blue Ghost Mission 2 (LuSEE-Night)',
    taskOrder: 'TO CS-3 / CS-4',
    provider: 'Firefly Aerospace',
    lander: 'Blue Ghost Lander',
    missionStatus: 'planned',
    locationType: 'placeholder',
    horizonEligible: false,
    positionNote: 'Display placeholder only; the real far-side landing coordinates are not public.',
    latitude: -45.00,
    longitude: 160.00,
    landingSiteName: 'Lunar far side (specific site not published)',
    targetRegion: 'Farside SPA Basin',
    launchDate: 'NET later in 2027 (NASA, Sep 2026)',
    landingDate: 'TBD (2027)',
    launchVehicle: 'SpaceX Falcon 9',
    objectives: 'Deliver NASA/DOE LuSEE-Night, a radio telescope that listens from the radio-quiet far side, plus an Elytra Dark orbiter that relays communications. Far-side sites have no direct line of sight to Earth.',
    payloads: [
      {
        name: 'LuSEE-Night',
        fullName: 'Lunar Surface Electromagnetics Experiment - Night',
        agency: 'NASA / DOE / Brookhaven National Lab',
        purpose: 'Low-frequency radio telescope measuring Cosmic Dark Ages radio signatures shielded from Earth radio noise.',
      },
      {
        name: 'LCRS',
        fullName: 'Lunar Communications Relay Satellite',
        agency: 'Firefly Aerospace',
        purpose: 'Dedicated lunar orbit relay for high-throughput farside telemetry transmissions to Earth.',
      },
    ],
    sourceUrl: 'https://science.nasa.gov/lunar-discovery/deliveries/cs-3',
    source: 'NASA CLPS press kit NP-2025-02-005 (Blue Ghost Mission 2 = TO CS-3 and CS-4, "Lunar Farside and Orbit"); NASA CS-3 page',
    description: 'Firefly Blue Ghost Mission 2 will land on the lunar far side and operate LuSEE-Night through the lunar night. Because the far side never faces Earth, all data must flow through the Elytra Dark relay satellite - a clear example of why Earth visibility drives site selection. NASA and Firefly have not published landing coordinates.',
  },
  {
    id: 'clps-blueorigin-cp22',
    // CHANGED 2026-11-02: was (-85.0, 0.0) "South Pole candidate area" (a point on Malapert massif, nowhere near the target).
    // NASA names the target "Shackleton Connecting Ridge". Coordinates (-89.374, -96.204) are an ESTIMATE: the great-circle mid-point between the
    // Shackleton crater centre (-89.67, 129.78) and the de Gerlache crater centre (-88.5, -87.1). Replace with the centre of the LOLA 5 m
    // "Site01 Connecting Ridge" DEM (pgda.gsfc.nasa.gov/data/LOLA_5mpp/) when available. Task order per NASA press kit NP-2025-01-001 is CT-3
    // (the old "CP-22" label conflicts between sources). Horizon entry for this id in horizons.json was removed - recompute.
    name: 'Blue Moon Mark 1 "Endurance" (Moon Base I)',
    taskOrder: 'TO CT-3',
    provider: 'Blue Origin',
    lander: 'Blue Moon Mark 1 (MK1 pathfinder "Endurance")',
    missionStatus: 'planned',
    locationType: 'approximate',
    latitude: -89.374,
    longitude: -96.204,
    elevationMeters: 103,
    landingSiteName: 'Shackleton Connecting Ridge (South Pole)',
    targetRegion: 'South Pole',
    launchDate: 'NET Q1 2027 (NASA lists Jan 2027)',
    landingDate: 'TBD (2027)',
    launchVehicle: 'Blue Origin New Glenn',
    objectives: 'Demonstrate Blue Origin\'s Blue Moon Mark 1 lander (cryogenic propulsion and precision landing technologies) ahead of crewed Artemis landings, carrying NASA payloads including the SCALPSS cameras.',
    payloads: [
      {
        name: 'NASA Heavy Cargo Demo',
        fullName: 'Surface Infrastructure and Power Hardware Simulator',
        agency: 'NASA',
        purpose: 'Tests commercial delivery of large utility packages to prepare for sustained crewed Artemis surface missions.',
      },
    ],
    sourceUrl: 'https://www.nasa.gov/event/clps-flight-blue-origins-blue-moon-mark-1/',
    source: 'NASA Moon Base: Blue Origin Blue Moon Mark 1; NASA CLPS press kit NP-2025-01-001 (MK1 pathfinder, award CT-3); Blue Origin statements',
    description: 'Blue Origin\'s first Blue Moon Mark 1 lander, named Endurance, targets the Shackleton Connecting Ridge between Shackleton and de Gerlache craters, a ridge known for long periods of sunlight beside permanently shadowed ground. NASA does not publish touchdown coordinates, so the pin sits at an estimated mid-point of the ridge.',
  },
];

/**
 * Retrieves a CLPS mission by its unique ID or task order string.
 * @param {string} idOrTaskOrder
 * @returns {ClpsMission|undefined}
 */
export function getClpsMission(idOrTaskOrder) {
  if (!idOrTaskOrder) return undefined;
  const query = idOrTaskOrder.toLowerCase();
  return CLPS_MISSIONS.find(
    (m) =>
      m.id.toLowerCase() === query ||
      m.taskOrder.toLowerCase() === query ||
      m.name.toLowerCase().includes(query)
  );
}

/**
 * Filter CLPS missions by status, provider, region, or keyword.
 * @param {{
 *   status?: string,
 *   provider?: string,
 *   region?: string,
 *   query?: string
 * }} filters
 * @returns {Array<ClpsMission>}
 */
export function filterClpsMissions({ status, provider, region, query } = {}) {
  return CLPS_MISSIONS.filter((m) => {
    if (status && status !== 'all' && m.missionStatus !== status) return false;
    if (provider && provider !== 'all' && m.provider !== provider) return false;
    if (region && region !== 'all' && m.targetRegion !== region) return false;
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const inName = m.name.toLowerCase().includes(q);
      const inTask = m.taskOrder.toLowerCase().includes(q);
      const inProv = m.provider.toLowerCase().includes(q);
      const inLander = m.lander.toLowerCase().includes(q);
      const inSite = m.landingSiteName.toLowerCase().includes(q);
      const inPayloads = m.payloads.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.fullName.toLowerCase().includes(q) ||
          p.purpose.toLowerCase().includes(q)
      );
      if (!inName && !inTask && !inProv && !inLander && !inSite && !inPayloads) {
        return false;
      }
    }
    return true;
  });
}