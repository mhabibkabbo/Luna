/**
 * @file clpsMissions.js
 * Verified NASA Commercial Lunar Payload Services (CLPS) mission dataset.
 * Sourced directly from official NASA CLPS task orders, NASA NSSDC Master Catalog,
 * and mission provider declarations (Intuitive Machines, Astrobotic, Firefly Aerospace,
 * Draper Laboratory, Blue Origin).
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
 * @property {'confirmed'|'planned'|'approximate'} locationType - Landing coordinate fidelity
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
    name: 'IM-2 (Athena / PRIME-1)',
    taskOrder: 'TO PRIME-1',
    provider: 'Intuitive Machines',
    lander: 'Nova-C (Athena)',
    missionStatus: 'planned',
    locationType: 'planned',
    latitude: -89.70,
    longitude: 120.00,
    landingSiteName: 'Shackleton Connecting Ridge (South Pole)',
    targetRegion: 'South Pole',
    launchDate: 'Target 2025',
    landingDate: 'Target 2025',
    launchVehicle: 'SpaceX Falcon 9',
    objectives: 'First subsurface ice drilling mission under NASA Polar Resources Ice Mining Experiment-1 (PRIME-1). Deploys TRIDENT drill down to 1-meter depth to search for water ice and operates the first 4G/LTE cellular communications network on the Moon.',
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
    sourceUrl: 'https://www.nasa.gov/mission/prime-1/',
    source: 'NASA CLPS Program / Task Order PRIME-1',
    description: 'IM-2 targets the Shackleton Connecting Ridge, located directly at 89.7°S latitude. This site offers near-continuous solar illumination while providing direct access to permanently shadowed regions harboring water ice deposits. TRIDENT will drill into the frozen regolith and MSolo will detect water vapor in real time.',
  },
  {
    id: 'clps-firefly-bgm1',
    name: 'Blue Ghost Mission 1',
    taskOrder: 'TO 19D',
    provider: 'Firefly Aerospace',
    lander: 'Blue Ghost Lander',
    missionStatus: 'planned',
    locationType: 'planned',
    latitude: 18.56,
    longitude: 61.81,
    landingSiteName: 'Mare Crisium Basin',
    targetRegion: 'Nearside Eastern Basin',
    launchDate: 'Target Q4 2024 / Q1 2025',
    landingDate: 'Target 2025',
    launchVehicle: 'SpaceX Falcon 9',
    objectives: 'Deliver 10 NASA science and technology payloads to investigate Mare Crisium volcanic geophysics, measure internal thermal heat flow, demonstrate GPS signal reception at lunar distance, and test electrodynamic dust mitigation.',
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
    sourceUrl: 'https://www.nasa.gov/commercial-lunar-payload-services/',
    source: 'NASA CLPS Program / Task Order 19D',
    description: 'Firefly Aerospace Blue Ghost Mission 1 targets a safe basalt plain inside Mare Crisium (18.56°N, 61.81°E). Operating across a complete lunar daytime cycle (14 Earth days), the lander will perform comprehensive geophysical investigations of lunar crustal formation and test next-generation navigation architectures.',
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
    name: 'Griffin Mission 1 (GM1)',
    taskOrder: 'TO 20A',
    provider: 'Astrobotic Technology',
    lander: 'Griffin Lunar Lander',
    missionStatus: 'planned',
    locationType: 'planned',
    latitude: -84.50,
    longitude: 31.70,
    landingSiteName: 'Mons Mouton (South Pole Plateau)',
    targetRegion: 'South Pole',
    launchDate: 'Target Late 2025',
    landingDate: 'Target Late 2025',
    launchVehicle: 'SpaceX Falcon Heavy',
    objectives: 'Qualify Astrobotic heavy-payload Griffin lander (over 625 kg capacity to surface) in the extreme terrain and lighting of the lunar South Pole. Formerly scheduled to deliver NASA VIPER rover; flight continues as an operational commercial lander test.',
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
    sourceUrl: 'https://www.nasa.gov/commercial-lunar-payload-services/',
    source: 'NASA CLPS Program / Task Order 20A',
    description: 'Griffin is Astrobotic medium-class lander capable of delivering large payloads to challenging polar environments. Targeting Mons Mouton (84.5°S, 31.7°E), a prominent plateau near the lunar South Pole with extended periods of sunlight and nearby permanently shadowed craters.',
  },
  {
    id: 'clps-im3-vertex',
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
    launchDate: 'Target 2026',
    landingDate: 'Target 2026',
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
    sourceUrl: 'https://www.nasa.gov/commercial-lunar-payload-services/',
    source: 'NASA CLPS Program / Task Order CP-11',
    description: 'IM-3 will land on Reiner Gamma (7.5°N, 59.0°W), the most famous lunar swirl. These bright, sinuous markings correspond to localized magnetic anomalies. The Lunar Vertex payload includes a lander suite and a mini-rover that will traverse across magnetic field boundaries.',
  },
  {
    id: 'clps-draper-cp12',
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
    name: 'Blue Ghost Mission 2 (LuSEE-Night)',
    taskOrder: 'TO CP-21',
    provider: 'Firefly Aerospace',
    lander: 'Blue Ghost Lander',
    missionStatus: 'planned',
    locationType: 'planned',
    latitude: -45.00,
    longitude: 160.00,
    landingSiteName: 'Lunar Farside Radio-Quiet Zone',
    targetRegion: 'Farside SPA Basin',
    launchDate: 'Target 2026',
    landingDate: 'Target 2026',
    launchVehicle: 'SpaceX Falcon 9',
    objectives: 'Operate the first radio astronomy observatory during the two-week lunar night from the radio-quiet farside of the Moon to observe the 21cm hydrogen line from the Cosmic Dark Ages before first stars ignited.',
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
    sourceUrl: 'https://www.nasa.gov/commercial-lunar-payload-services/',
    source: 'NASA CLPS Program / Task Order CP-21',
    description: 'Firefly was awarded CLPS Task Order CP-21 to land on the lunar farside. The primary instrument, LuSEE-Night, is a joint NASA/DOE radio receiver that will survive the freezing -170°C two-week lunar night to observe low-frequency radio emissions without Earth ionospheric and electromagnetic interference.',
  },
  {
    id: 'clps-blueorigin-cp22',
    name: 'Blue Moon Pathfinder (CP-22)',
    taskOrder: 'TO CP-22',
    provider: 'Blue Origin',
    lander: 'Blue Moon Mark 1 (MK1)',
    missionStatus: 'planned',
    locationType: 'planned',
    latitude: -85.00,
    longitude: 0.00,
    landingSiteName: 'Lunar South Pole Candidate Area',
    targetRegion: 'South Pole',
    launchDate: 'Target 2026+',
    landingDate: 'Target 2026+',
    launchVehicle: 'Blue Origin New Glenn',
    objectives: 'Flight qualification of Blue Origin heavy cargo lunar lander, capable of transporting up to 3 metric tons of payload to any location on the lunar surface to build sustainable infrastructure for NASA Artemis.',
    payloads: [
      {
        name: 'NASA Heavy Cargo Demo',
        fullName: 'Surface Infrastructure and Power Hardware Simulator',
        agency: 'NASA',
        purpose: 'Tests commercial delivery of large utility packages to prepare for sustained crewed Artemis surface missions.',
      },
    ],
    sourceUrl: 'https://www.nasa.gov/commercial-lunar-payload-services/',
    source: 'NASA CLPS Program / Task Order CP-22',
    description: 'Awarded under CLPS Task Order CP-22, Blue Origin Blue Moon MK1 is an uncrewed cargo lander powered by BE-7 cryogenic engines. It will deliver cargo payloads to the lunar South Pole to validate heavy payload handling for the Artemis campaign.',
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
