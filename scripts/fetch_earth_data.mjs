#!/usr/bin/env node

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const launchSitesPath = join(rootDir, 'src', 'data', 'earthLaunchSites.js');
const commSitesPath = join(rootDir, 'src', 'data', 'earthCommunicationSites.js');

function num(val, fallback = 0) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? Number(n.toFixed(4)) : fallback;
}

const COUNTRY_MAP = {
  USA: 'United States',
  GUF: 'French Guiana (France / ESA)',
  RUS: 'Russian Federation',
  KAZ: 'Kazakhstan',
  CHN: "People's Republic of China",
  JPN: 'Japan',
  IND: 'India',
  NZL: 'New Zealand',
  ISR: 'Israel',
  IRN: 'Iran',
  PRK: "North Korea",
  KOR: 'South Korea',
  NOR: 'Norway',
  SWE: 'Sweden',
  GBR: 'United Kingdom',
  AUS: 'Australia',
  ESP: 'Spain',
  ARG: 'Argentina',
};

const CURATED_LAUNCH_SITES = [
  {
    id: 'earth-pad-ksc-lc39a',
    name: 'Kennedy Space Center LC-39A',
    type: 'launch-site',
    latitude: 28.6083,
    longitude: -80.6041,
    country: 'United States',
    agency: 'NASA / SpaceX',
    network: 'Kennedy Space Center',
    status: 'Operational',
    description: 'Historic Apollo 11 and Space Shuttle pad. Currently launches SpaceX Falcon 9, Falcon Heavy, Dragon crewed missions, and lunar CLPS payloads.',
    source: 'The Space Devs / NASA',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-ksc-lc39b',
    name: 'Kennedy Space Center LC-39B',
    type: 'launch-site',
    latitude: 28.6272,
    longitude: -80.6208,
    country: 'United States',
    agency: 'NASA',
    network: 'Kennedy Space Center',
    status: 'Operational',
    description: 'Dedicated launch pad for NASA’s Space Launch System (SLS) and Orion spacecraft for the Artemis lunar missions.',
    source: 'The Space Devs / NASA',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-cc-slc40',
    name: 'Cape Canaveral SLC-40',
    type: 'launch-site',
    latitude: 28.5620,
    longitude: -80.5772,
    country: 'United States',
    agency: 'SpaceX / USSF',
    network: 'Cape Canaveral Space Force Station',
    status: 'Operational',
    description: 'Primary high-cadence SpaceX orbital launch pad supporting Starlink, commercial satellite, and lunar lander missions.',
    source: 'The Space Devs / USSF',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-cc-slc41',
    name: 'Cape Canaveral SLC-41',
    type: 'launch-site',
    latitude: 28.5835,
    longitude: -80.5830,
    country: 'United States',
    agency: 'United Launch Alliance (ULA)',
    network: 'Cape Canaveral Space Force Station',
    status: 'Operational',
    description: 'United Launch Alliance pad launching Atlas V and the next-generation Vulcan Centaur rocket (launched Astrobotic Peregrine lunar lander).',
    source: 'The Space Devs / ULA',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-starbase-olp1',
    name: 'Starbase Orbital Launch Pad 1',
    type: 'launch-site',
    latitude: 25.9962,
    longitude: -97.1544,
    country: 'United States',
    agency: 'SpaceX',
    network: 'Starbase Boca Chica',
    status: 'Operational',
    description: 'SpaceX facility in Boca Chica, Texas, built for Starship and Super Heavy test flights and the NASA Artemis Human Landing System (HLS).',
    source: 'SpaceX / The Space Devs',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-vsfb-slc4e',
    name: 'Vandenberg SFB SLC-4E',
    type: 'launch-site',
    latitude: 34.6321,
    longitude: -120.6106,
    country: 'United States',
    agency: 'SpaceX / USSF',
    network: 'Vandenberg Space Force Base',
    status: 'Operational',
    description: 'West coast pad for SpaceX Falcon 9 polar and retrograde orbital launches, Earth observation satellites, and planetary missions.',
    source: 'The Space Devs / USSF',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-wallops-pad0a',
    name: 'Wallops Flight Facility LP-0A',
    type: 'launch-site',
    latitude: 37.8337,
    longitude: -75.4881,
    country: 'United States',
    agency: 'Northrop Grumman / NASA',
    network: 'Mid-Atlantic Regional Spaceport (MARS)',
    status: 'Operational',
    description: 'Launch complex for Northrop Grumman Antares and Firefly rockets, supplying cargo to the International Space Station.',
    source: 'The Space Devs / NASA',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },

  {
    id: 'earth-pad-csg-ela4',
    name: 'Guiana Space Centre ELA-4',
    type: 'launch-site',
    latitude: 5.2390,
    longitude: -52.7680,
    country: 'French Guiana (France / ESA)',
    agency: 'ESA / Arianespace / CNES',
    network: "Europe's Spaceport (CSG)",
    status: 'Operational',
    description: 'State-of-the-art launch complex designed specifically for Ariane 6, launching European science probes, navigation constellations, and lunar missions.',
    source: 'The Space Devs / ESA',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-csg-ela3',
    name: 'Guiana Space Centre ELA-3',
    type: 'launch-site',
    latitude: 5.2360,
    longitude: -52.7750,
    country: 'French Guiana (France / ESA)',
    agency: 'ESA / Arianespace',
    network: "Europe's Spaceport (CSG)",
    status: 'Retired / Historic',
    description: 'Historic launch pad for 117 Ariane 5 missions, including the launch of the James Webb Space Telescope and BepiColombo.',
    source: 'The Space Devs / ESA',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },

  {
    id: 'earth-pad-baikonur-site31',
    name: 'Baikonur Cosmodrome Site 31/6',
    type: 'launch-site',
    latitude: 45.9960,
    longitude: 63.5641,
    country: 'Kazakhstan',
    agency: 'Roscosmos',
    network: 'Baikonur Cosmodrome',
    status: 'Operational',
    description: 'Active Soyuz-2 launch pad supporting crewed flights to the International Space Station and scientific satellite missions.',
    source: 'The Space Devs / Roscosmos',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-baikonur-site1',
    name: 'Baikonur Site 1/5 ("Gagarin’s Start")',
    type: 'launch-site',
    latitude: 45.9203,
    longitude: 63.3422,
    country: 'Kazakhstan',
    agency: 'Roscosmos',
    network: 'Baikonur Cosmodrome',
    status: 'Historic / Inactive',
    description: 'The world’s first spaceport pad. Launched Sputnik 1 in 1957, Yuri Gagarin aboard Vostok 1 in 1961, and early lunar Luna probes.',
    source: 'The Space Devs / Roscosmos',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-vostochny-site1s',
    name: 'Vostochny Cosmodrome Site 1S',
    type: 'launch-site',
    latitude: 51.8844,
    longitude: 128.3339,
    country: 'Russian Federation',
    agency: 'Roscosmos',
    network: 'Vostochny Cosmodrome',
    status: 'Operational',
    description: 'Modern Russian spaceport in the Amur Oblast, launching Soyuz-2 and Angara-A5 rockets (including the Luna 25 mission).',
    source: 'The Space Devs / Roscosmos',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },

  {
    id: 'earth-pad-wenchang-lc101',
    name: 'Wenchang Space Launch Site LC-101',
    type: 'launch-site',
    latitude: 19.6145,
    longitude: 110.9510,
    country: "People's Republic of China",
    agency: 'CNSA',
    network: 'Wenchang Space Launch Site',
    status: 'Operational',
    description: 'China’s coastal cryogenic launch complex on Hainan Island, launching Long March 5 rockets for Chang’e lunar sample return and Tianwen Mars missions.',
    source: 'The Space Devs / CNSA',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-jiuquan-sls1',
    name: 'Jiuquan Satellite Launch Center SLS-1',
    type: 'launch-site',
    latitude: 40.9606,
    longitude: 100.2983,
    country: "People's Republic of China",
    agency: 'CNSA',
    network: 'Jiuquan Satellite Launch Center',
    status: 'Operational',
    description: 'China’s primary crewed spaceflight launch complex in the Gobi Desert, launching Shenzhou crew missions to the Tiangong Space Station.',
    source: 'The Space Devs / CNSA',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-sriharikota-slp',
    name: 'Satish Dhawan Space Centre (SDSC) SLP',
    type: 'launch-site',
    latitude: 13.7199,
    longitude: 80.2304,
    country: 'India',
    agency: 'ISRO',
    network: 'Satish Dhawan Space Centre',
    status: 'Operational',
    description: 'Second Launch Pad at Sriharikota, which launched Chandrayaan-2 and the historic Chandrayaan-3 lunar south pole landing mission aboard the LVM3.',
    source: 'The Space Devs / ISRO',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-tanegashima-lp1',
    name: 'Tanegashima Space Center Yoshinobu LP-1',
    type: 'launch-site',
    latitude: 30.4009,
    longitude: 130.9754,
    country: 'Japan',
    agency: 'JAXA / MHI',
    network: 'Tanegashima Space Center',
    status: 'Operational',
    description: 'JAXA’s scenic oceanside pad launching H-IIA and the new H3 flagship rocket, which launched the SLIM lunar pinpoint lander and Kaguya.',
    source: 'The Space Devs / JAXA',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-mahia-lc1',
    name: 'Rocket Lab Launch Complex 1',
    type: 'launch-site',
    latitude: -39.2615,
    longitude: 177.8649,
    country: 'New Zealand',
    agency: 'Rocket Lab',
    network: 'Mahia Peninsula Spaceport',
    status: 'Operational',
    description: 'First privately operated orbital launch range, launching Electron rockets including NASA’s CAPSTONE lunar pathfinder satellite.',
    source: 'The Space Devs / Rocket Lab',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-esrange-complex3',
    name: 'Esrange Space Center Spaceport Complex',
    type: 'launch-site',
    latitude: 67.8933,
    longitude: 21.1069,
    country: 'Sweden',
    agency: 'Swedish Space Corporation (SSC)',
    network: 'Esrange Space Center',
    status: 'Operational',
    description: 'First orbital launch complex inaugurated on mainland European Union soil, situated near Kiruna above the Arctic Circle.',
    source: 'The Space Devs / SSC',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
  {
    id: 'earth-pad-andoya-spaceport',
    name: 'Andøya Spaceport',
    type: 'launch-site',
    latitude: 69.2944,
    longitude: 16.0306,
    country: 'Norway',
    agency: 'Andøya Space',
    network: 'Andøya Spaceport',
    status: 'Operational',
    description: 'Norwegian commercial orbital spaceport on the island of Andøya, supporting polar and Sun-synchronous satellite launches.',
    source: 'The Space Devs / Andøya Space',
    sourceUrl: 'https://lldev.thespacedevs.com/2.2.0/pad/',
  },
];

async function fetchLivePadsFromApi() {
  console.log('Fetching live launch pads from The Space Devs API...');
  try {
    const res = await fetch('https://lldev.thespacedevs.com/2.2.0/pad/?limit=100');
    if (!res.ok) {
      console.warn(`Space Devs API responded with status ${res.status}. Falling back to curated dataset.`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data.results)) return null;

    const pads = [];
    for (const p of data.results) {
      const lat = parseFloat(p.latitude);
      const lon = parseFloat(p.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !p.location) continue;

      const slugName = (p.name || 'pad')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const slugLoc = (p.location.name || 'loc')
        .toLowerCase()
        .slice(0, 12)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      pads.push({
        id: `earth-pad-${slugLoc}-${slugName}-${p.id}`,
        name: `${p.location.name ? p.location.name.split(',')[0] + ' · ' : ''}${p.name}`,
        type: 'launch-site',
        latitude: num(lat),
        longitude: num(lon),
        country: COUNTRY_MAP[p.country_code || p.location.country_code] || p.country_code || 'International',
        agency: p.agency_id ? `Agency ID ${p.agency_id}` : p.location.name?.split(',')[0] || 'Space Launch Facility',
        network: p.location.name || 'Launch Range',
        status: p.total_launch_count > 0 ? 'Operational' : 'Active / Experimental',
        description: p.description || p.location.description?.slice(0, 300) || `Launch pad located at ${p.location.name}. Total launches: ${p.total_launch_count || 0}.`,
        source: 'The Space Devs / Launch Library 2',
        sourceUrl: p.wiki_url || p.map_url || 'https://lldev.thespacedevs.com/2.2.0/pad/',
        totalLaunches: p.total_launch_count || 0,
      });
    }

    const byCoords = new Set();
    const merged = [...CURATED_LAUNCH_SITES];
    merged.forEach(s => byCoords.add(`${s.latitude.toFixed(2)},${s.longitude.toFixed(2)}`));

    for (const p of pads) {
      const coordKey = `${p.latitude.toFixed(2)},${p.longitude.toFixed(2)}`;
      if (!byCoords.has(coordKey)) {
        byCoords.add(coordKey);
        merged.push(p);
      }
    }
    return merged;
  } catch (err) {
    console.warn(`Could not reach The Space Devs API: ${err.message}. Using curated dataset.`);
    return null;
  }
}

const CURATED_COMMUNICATION_SITES = [
  {
    id: 'earth-comms-nasa-goldstone',
    name: 'Goldstone Deep Space Communications Complex',
    type: 'deep-space-communication',
    latitude: 35.4266,
    longitude: -116.8900,
    country: 'United States',
    agency: 'NASA / JPL',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: 'One of NASA’s three globally distributed Deep Space Network complexes, located in California’s Mojave Desert.',
    source: 'NASA Deep Space Network',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },
  {
    id: 'earth-antenna-dsn-dss14',
    name: 'Goldstone DSS-14 "Mars" 70-meter Antenna',
    type: 'deep-space-communication',
    latitude: 35.4259,
    longitude: -116.8889,
    country: 'United States',
    agency: 'NASA / JPL',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: 'Massive 70-metre dish antenna capable of deep-space telecommunications, planetary radar, and high-power command uplinks for distant spacecraft and lunar missions.',
    source: 'NASA Eyes on the DSN',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },
  {
    id: 'earth-antenna-dsn-dss24',
    name: 'Goldstone DSS-24 34-meter Beam Waveguide',
    type: 'deep-space-communication',
    latitude: 35.3399,
    longitude: -116.8744,
    country: 'United States',
    agency: 'NASA / JPL',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: '34-metre Beam Waveguide (BWG) antenna providing telemetry and command support in S and X bands.',
    source: 'NASA Eyes on the DSN',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },
  {
    id: 'earth-antenna-dsn-dss25',
    name: 'Goldstone DSS-25 34-meter Beam Waveguide',
    type: 'deep-space-communication',
    latitude: 35.3376,
    longitude: -116.8752,
    country: 'United States',
    agency: 'NASA / JPL',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: '34-metre BWG antenna equipped with solar transmitter capabilities and high-rate Ka-band reception.',
    source: 'NASA Eyes on the DSN',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },
  {
    id: 'earth-antenna-dsn-dss26',
    name: 'Goldstone DSS-26 34-meter Beam Waveguide',
    type: 'deep-space-communication',
    latitude: 35.3350,
    longitude: -116.8730,
    country: 'United States',
    agency: 'NASA / JPL',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: 'Modernized 34-metre BWG antenna supporting Artemis lunar missions and outer-planet robotic explorers.',
    source: 'NASA Eyes on the DSN',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },

  {
    id: 'earth-comms-nasa-madrid',
    name: 'Madrid Deep Space Communications Complex',
    type: 'deep-space-communication',
    latitude: 40.4314,
    longitude: -4.2486,
    country: 'Spain',
    agency: 'NASA / INTA',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: 'NASA DSN European complex in Robledo de Chavela, Spain. Its longitude ensures continuous contact with deep-space probes as the Earth rotates.',
    source: 'NASA Deep Space Network',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },
  {
    id: 'earth-antenna-dsn-dss63',
    name: 'Madrid DSS-63 70-meter Antenna',
    type: 'deep-space-communication',
    latitude: 40.4314,
    longitude: -4.2480,
    country: 'Spain',
    agency: 'NASA / INTA',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: 'The European 70-metre giant dish of the Deep Space Network, commanding deep-space probes and tracking lunar spacecraft.',
    source: 'NASA Eyes on the DSN',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },
  {
    id: 'earth-antenna-dsn-dss65',
    name: 'Madrid DSS-65 34-meter HEF Antenna',
    type: 'deep-space-communication',
    latitude: 40.4285,
    longitude: -4.2505,
    country: 'Spain',
    agency: 'NASA / INTA',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: '34-metre High Efficiency antenna utilized for robotic planetary missions and lunar exploration.',
    source: 'NASA Eyes on the DSN',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },
  {
    id: 'earth-antenna-dsn-dss56',
    name: 'Madrid DSS-56 34-meter "All-in-One" BWG Antenna',
    type: 'deep-space-communication',
    latitude: 40.4260,
    longitude: -4.2530,
    country: 'Spain',
    agency: 'NASA / INTA',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: 'State-of-the-art 34-metre Beam Waveguide antenna capable of communicating across all DSN frequency bands simultaneously.',
    source: 'NASA Eyes on the DSN',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },

  {
    id: 'earth-comms-nasa-canberra',
    name: 'Canberra Deep Space Communication Complex',
    type: 'deep-space-communication',
    latitude: -35.4010,
    longitude: 148.9819,
    country: 'Australia',
    agency: 'NASA / CSIRO',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: 'Southern hemisphere DSN complex in the Tidbinbilla Valley near Canberra, Australia.',
    source: 'NASA Deep Space Network',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },
  {
    id: 'earth-antenna-dsn-dss43',
    name: 'Canberra DSS-43 70-meter Antenna',
    type: 'deep-space-communication',
    latitude: -35.4028,
    longitude: 148.9813,
    country: 'Australia',
    agency: 'NASA / CSIRO',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: 'The largest steerable parabolic antenna in the Southern Hemisphere. The only dish capable of transmitting commands to Voyager 2 in the deep southern sky.',
    source: 'NASA Eyes on the DSN',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },
  {
    id: 'earth-antenna-dsn-dss34',
    name: 'Canberra DSS-34 34-meter Beam Waveguide',
    type: 'deep-space-communication',
    latitude: -35.3985,
    longitude: 148.9818,
    country: 'Australia',
    agency: 'NASA / CSIRO',
    network: 'NASA Deep Space Network (DSN)',
    status: 'Operational',
    description: '34-metre BWG antenna supporting Artemis Orion spacecraft tracking and lunar robotic missions.',
    source: 'NASA Eyes on the DSN',
    sourceUrl: 'https://eyes.nasa.gov/apps/dsn-now/dsn.html',
  },

  {
    id: 'earth-comms-esa-new-norcia',
    name: 'New Norcia Deep Space Antenna (DSA 1)',
    type: 'deep-space-communication',
    latitude: -31.0483,
    longitude: 116.1910,
    country: 'Australia',
    agency: 'European Space Agency (ESA)',
    network: 'ESA Estrack',
    status: 'Operational',
    description: 'ESA 35-metre deep-space antenna used for tracking, telemetry, telecommand and radiometric measurements for deep-space and lunar missions.',
    source: 'ESA Estrack',
    sourceUrl: 'https://esoc.esa.int/explore-our-ground-stations',
  },
  {
    id: 'earth-comms-esa-cebreros',
    name: 'Cebreros Deep Space Antenna (DSA 2)',
    type: 'deep-space-communication',
    latitude: 40.4528,
    longitude: -4.3676,
    country: 'Spain',
    agency: 'European Space Agency (ESA)',
    network: 'ESA Estrack',
    status: 'Operational',
    description: 'ESA 35-metre deep-space station in Ávila, Spain, supporting interplanetary spacecraft tracking and precise radio science.',
    source: 'ESA Estrack',
    sourceUrl: 'https://esoc.esa.int/explore-our-ground-stations',
  },
  {
    id: 'earth-comms-esa-malargue',
    name: 'Malargüe Deep Space Antenna (DSA 3)',
    type: 'deep-space-communication',
    latitude: -35.7767,
    longitude: -69.3987,
    country: 'Argentina',
    agency: 'European Space Agency (ESA)',
    network: 'ESA Estrack',
    status: 'Operational',
    description: 'ESA 35-metre deep-space antenna in Mendoza, Argentina, providing complete 360° longitudinal coverage alongside New Norcia and Cebreros.',
    source: 'ESA Estrack',
    sourceUrl: 'https://esoc.esa.int/explore-our-ground-stations',
  },

  {
    id: 'earth-comms-isro-byalalu',
    name: 'Indian Deep Space Network (IDSN), Byalalu',
    type: 'deep-space-communication',
    latitude: 12.9067,
    longitude: 77.3683,
    country: 'India',
    agency: 'Indian Space Research Organisation (ISRO)',
    network: 'Indian Deep Space Network',
    status: 'Operational',
    description: 'Houses India’s 32-metre and 18-metre deep space communication antennas, which operated the Chandrayaan-1, 2, and 3 lunar missions and Mangalyaan Mars probe.',
    source: 'ISRO',
    sourceUrl: 'https://www.isro.gov.in/',
  },
  {
    id: 'earth-comms-jaxa-usuda',
    name: 'Usuda Deep Space Center 64m Antenna',
    type: 'deep-space-communication',
    latitude: 36.1333,
    longitude: 138.3667,
    country: 'Japan',
    agency: 'Japan Aerospace Exploration Agency (JAXA)',
    network: 'JAXA deep-space communications',
    status: 'Operational',
    description: 'Historic 64-metre antenna nestled in Nagano Prefecture used to communicate with Halley’s Comet probes, Hayabusa asteroids sample returns, and lunar spacecraft.',
    source: 'JAXA',
    sourceUrl: 'https://global.jaxa.jp/',
  },
  {
    id: 'earth-comms-jaxa-misasa',
    name: 'Misasa Deep Space Station 54m Antenna',
    type: 'deep-space-communication',
    latitude: 36.1550,
    longitude: 138.3750,
    country: 'Japan',
    agency: 'Japan Aerospace Exploration Agency (JAXA)',
    network: 'GREAT (Ground Station for Deep Space Exploration)',
    status: 'Operational',
    description: 'JAXA’s newest 54-metre high-precision antenna designed for lunar and deep-space missions with Ka-band reception.',
    source: 'JAXA',
    sourceUrl: 'https://global.jaxa.jp/',
  },

  {
    id: 'earth-comms-goonhilly-ghy6',
    name: 'Goonhilly Earth Station (GHY-6 Merlin)',
    type: 'deep-space-communication',
    latitude: 50.0486,
    longitude: -5.1822,
    country: 'United Kingdom',
    agency: 'Goonhilly Earth Station / ESA / NASA',
    network: 'Commercial Deep Space Network',
    status: 'Operational',
    description: 'World’s first privately owned commercial deep space ground station. Upgraded 32-metre parabolic dish communicating with lunar CLPS landers and Mars orbiters.',
    source: 'Goonhilly Earth Station',
    sourceUrl: 'https://www.goonhilly.org/',
  },
  {
    id: 'earth-comms-svalbard-svalsat',
    name: 'Svalbard Satellite Station (SvalSat)',
    type: 'spacecraft-tracking',
    latitude: 78.2306,
    longitude: 15.3900,
    country: 'Norway (Svalbard)',
    agency: 'Kongsberg Satellite Services (KSAT)',
    network: 'KSAT Global Polar Network',
    status: 'Operational',
    description: 'World’s largest commercial ground station at 78° North, providing all 14 daily passes for polar orbiting spacecraft and lunar transfer tracking.',
    source: 'KSAT',
    sourceUrl: 'https://www.ksat.no/',
  },

  {
    id: 'earth-comms-esa-kourou',
    name: 'ESA Kourou Ground Station',
    type: 'spacecraft-tracking',
    latitude: 5.1600,
    longitude: -52.6500,
    country: 'French Guiana',
    agency: 'European Space Agency (ESA)',
    network: 'ESA Estrack',
    status: 'Operational',
    description: '15-metre ground station used for Earth-orbiting spacecraft operations and launch/early-orbit support near Europe’s Spaceport.',
    source: 'ESA Ground Stations',
    sourceUrl: 'https://www.esa.int/Enabling_Support/Operations/ESA_Ground_Stations',
  },
  {
    id: 'earth-comms-esa-kiruna',
    name: 'ESA Kiruna Ground Station',
    type: 'spacecraft-tracking',
    latitude: 67.8571,
    longitude: 20.9643,
    country: 'Sweden',
    agency: 'European Space Agency (ESA)',
    network: 'ESA Estrack',
    status: 'Operational',
    description: 'High-latitude station used to communicate with and track Earth-orbiting and polar spacecraft.',
    source: 'ESA Ground Stations',
    sourceUrl: 'https://www.esa.int/Enabling_Support/Operations/ESA_Ground_Stations',
  },
  {
    id: 'earth-comms-esa-santa-maria',
    name: 'ESA Santa Maria Tracking Station',
    type: 'launch-tracking',
    latitude: 36.9970,
    longitude: -25.1350,
    country: 'Portugal (Azores)',
    agency: 'European Space Agency (ESA)',
    network: 'ESA Estrack',
    status: 'Operational',
    description: 'Supports tracking of launch vehicles and spacecraft during launch and early orbit operations across the Atlantic corridor.',
    source: 'ESA Ground Stations',
    sourceUrl: 'https://www.esa.int/Enabling_Support/Operations/ESA_Ground_Stations',
  },
  {
    id: 'earth-comms-nasa-white-sands',
    name: 'White Sands Ground Terminal',
    type: 'relay-communications',
    latitude: 32.5000,
    longitude: -106.6000,
    country: 'United States',
    agency: 'NASA',
    network: 'Near Space Network / TDRSS',
    status: 'Operational',
    description: 'Hub of NASA’s Tracking and Data Relay Satellite System (TDRSS), providing near-continuous relay communication with human spaceflight and Earth observation satellites.',
    source: 'NASA SCaN',
    sourceUrl: 'https://www.nasa.gov/communicating-with-missions/',
  },
  {
    id: 'earth-comms-nasa-jpl',
    name: 'Jet Propulsion Laboratory (Mission Operations)',
    type: 'mission-operations',
    latitude: 34.2007,
    longitude: -118.1710,
    country: 'United States',
    agency: 'NASA / Caltech',
    network: 'Deep Space Network Operations',
    status: 'Operational',
    description: 'The Space Flight Operations Facility (SFOF), the central hub coordinating DSN tracking and planetary missions.',
    source: 'NASA / JPL',
    sourceUrl: 'https://www.jpl.nasa.gov/missions/dsn/',
  },
];

function writeLaunchSitesFile(sites) {
  const content = `/**
 * @file earthLaunchSites.js
 * Curated and verified global rocket launch sites, spaceports, and pads.
 * Sources:
 * - The Space Devs / Launch Library 2 (https://lldev.thespacedevs.com/2.2.0/pad/)
 * - NASA / Space Force / ESA / Roscosmos / CNSA / ISRO / JAXA
 *
 * Generated automatically by scripts/fetch_earth_data.mjs
 */

export const EARTH_LAUNCH_SITES = ${JSON.stringify(sites, null, 2)};

/**
 * Filter Earth launch locations by country, network, or keyword.
 */
export function filterEarthLaunchSites({
  country,
  network,
  query,
} = {}) {
  const q = query?.trim().toLowerCase();

  return EARTH_LAUNCH_SITES.filter((site) => {
    if (country && country !== 'all' && site.country !== country) return false;
    if (network && network !== 'all' && site.network !== network) return false;

    if (q) {
      const searchable = [
        site.name,
        site.type,
        site.country,
        site.agency,
        site.network,
        site.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(q)) return false;
    }

    return true;
  });
}
`;
  writeFileSync(launchSitesPath, content, 'utf8');
  console.log(`[OK] Wrote ${sites.length} launch sites to ${launchSitesPath}`);
}

function writeCommunicationSitesFile(sites) {
  const content = `/**
 * @file earthCommunicationSites.js
 * Curated Earth-based facilities important for communicating with spacecraft.
 *
 * Includes deep-space antenna dishes, tracking networks, and mission operations.
 * Sources:
 * - NASA Deep Space Network / Eyes on the DSN (https://eyes.nasa.gov/apps/dsn-now/dsn.html)
 * - ESA Estrack (https://esoc.esa.int/explore-our-ground-stations)
 * - ISRO / JAXA / Commercial Deep Space Ground Stations
 *
 * Generated automatically by scripts/fetch_earth_data.mjs
 */

export const EARTH_COMMUNICATION_SITES = ${JSON.stringify(sites, null, 2)};

/**
 * Filter Earth communication locations by type, country, network, or keyword.
 */
export function filterEarthCommunicationSites({
  type,
  country,
  network,
  query,
} = {}) {
  const q = query?.trim().toLowerCase();

  return EARTH_COMMUNICATION_SITES.filter((site) => {
    if (type && type !== 'all' && site.type !== type) return false;
    if (country && country !== 'all' && site.country !== country) return false;
    if (network && network !== 'all' && site.network !== network) return false;

    if (q) {
      const searchable = [
        site.name,
        site.type,
        site.country,
        site.agency,
        site.network,
        site.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(q)) return false;
    }

    return true;
  });
}
`;
  writeFileSync(commSitesPath, content, 'utf8');
  console.log(`[OK] Wrote ${sites.length} antenna & communication stations to ${commSitesPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  const doLaunchSites = args.includes('--launch-sites') || args.includes('--all') || args.length === 0;
  const doAntennas = args.includes('--antennas') || args.includes('--all') || args.length === 0;

  console.log('=== Luna Earth Sites Data Generator ===');

  if (doLaunchSites) {
    console.log('\n--- Processing Launch Sites ---');
    const livePads = await fetchLivePadsFromApi();
    const sitesToSave = livePads && livePads.length > 0 ? livePads : CURATED_LAUNCH_SITES;
    writeLaunchSitesFile(sitesToSave);
  }

  if (doAntennas) {
    console.log('\n--- Processing Antenna & Communication Stations ---');
    writeCommunicationSitesFile(CURATED_COMMUNICATION_SITES);
  }

  console.log('\n[Done] All requested datasets processed successfully.');
}

main().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
