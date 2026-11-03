/**
 * @file earthCommunicationSites.js
 * Curated Earth-based facilities important for communicating with spacecraft.
 *
 * Coordinates are approximate facility locations for globe markers, not antenna
 * pointing coordinates. The catalog emphasizes deep-space/lunar communications,
 * with selected additional tracking and mission-support facilities.
 *
 * Sources:
 * - NASA Deep Space Network: https://www.nasa.gov/communicating-with-missions/dsn/
 * - ESA Estrack: https://www.esa.int/Enabling_Support/Operations/ESA_Ground_Stations/Estrack_ESA_s_global_ground_station_network
 * - ESA ground stations: https://esoc.esa.int/explore-our-ground-stations
 * - ISRO: https://www.isro.gov.in/
 * - JAXA: https://global.jaxa.jp/
 */

export const EARTH_COMMUNICATION_SITES = [
  // =========================================================
  // PRIMARY DEEP-SPACE NETWORKS
  // These stations support communication with spacecraft at
  // the Moon and beyond, including command, telemetry and data.
  // =========================================================
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
    description:
      'One of NASA’s three globally distributed Deep Space Network complexes. Supports spacecraft command, telemetry, tracking, radio science and planetary radar.',
    source: 'NASA Deep Space Network',
    sourceUrl: 'https://www.nasa.gov/communicating-with-missions/dsn/',
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
    description:
      'One of NASA’s three Deep Space Network complexes. Its longitude helps maintain spacecraft contact as Earth rotates.',
    source: 'NASA Deep Space Network',
    sourceUrl: 'https://www.nasa.gov/communicating-with-missions/dsn/',
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
    description:
      'One of NASA’s three Deep Space Network complexes. Supports tracking, commanding and receiving data from lunar and interplanetary spacecraft.',
    source: 'NASA Deep Space Network',
    sourceUrl: 'https://www.nasa.gov/communicating-with-missions/dsn/',
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
    description:
      'ESA 35-metre deep-space antenna used for tracking, telemetry, telecommand and radiometric measurements for deep-space missions.',
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
    description:
      'ESA 35-metre deep-space station supporting spacecraft tracking, telemetry, telecommand and precise radio measurements.',
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
    description:
      'ESA 35-metre deep-space antenna. Its location in South America complements ESA’s stations in Europe and Australia.',
    source: 'ESA Estrack',
    sourceUrl: 'https://esoc.esa.int/explore-our-ground-stations',
  },
  {
    id: 'earth-comms-isro-byalalu',
    name: 'Indian Deep Space Network (IDSN), Byalalu',
    type: 'deep-space-communication',
    latitude: 13.0000,
    longitude: 77.0000,
    country: 'India',
    agency: 'Indian Space Research Organisation (ISRO)',
    network: 'Indian Deep Space Network',
    status: 'Operational',
    description:
      'India’s deep-space communication facility near Bengaluru, supporting tracking and communication for missions such as Chandrayaan and other interplanetary spacecraft.',
    source: 'ISRO',
    sourceUrl: 'https://www.isro.gov.in/',
  },
  {
    id: 'earth-comms-jaxa-usuda',
    name: 'Usuda Deep Space Center',
    type: 'deep-space-communication',
    latitude: 36.1333,
    longitude: 138.3667,
    country: 'Japan',
    agency: 'Japan Aerospace Exploration Agency (JAXA)',
    network: 'JAXA deep-space communications',
    status: 'Operational',
    description:
      'Japanese deep-space communication facility historically used to communicate with interplanetary probes. Check current mission/station assignments before relying on it for operational status details.',
    source: 'JAXA',
    sourceUrl: 'https://global.jaxa.jp/',
  },

  // =========================================================
  // IMPORTANT NEAR-EARTH / LAUNCH TRACKING GROUND STATIONS
  // These help acquire, track and communicate with spacecraft
  // around launch and in Earth orbit; they are not all deep-space
  // stations and do not all provide continuous lunar coverage.
  // =========================================================
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
    description:
      'Ground station used for Earth-orbiting spacecraft operations and launch/early-orbit support, near Europe’s Spaceport.',
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
    description:
      'High-latitude station used to communicate with and track Earth-orbiting spacecraft, including Earth-observation missions.',
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
    description:
      'Supports tracking of launch vehicles and spacecraft during launch and early orbit operations.',
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
    network: 'Near Space Network / Tracking and Data Relay Satellite System support',
    status: 'Operational',
    description:
      'Part of NASA’s near-Earth communications infrastructure, supporting relay services for spacecraft and missions in Earth orbit. It is not a primary direct-to-Earth deep-space antenna complex.',
    source: 'NASA Space Communications and Navigation (SCaN)',
    sourceUrl: 'https://www.nasa.gov/communicating-with-missions/',
  },
  {
    id: 'earth-comms-nasa-jpl',
    name: 'Jet Propulsion Laboratory (mission operations)',
    type: 'mission-operations',
    latitude: 34.2007,
    longitude: -118.1710,
    country: 'United States',
    agency: 'NASA / Caltech',
    network: 'Deep Space Network operations',
    status: 'Operational',
    description:
      'Mission operations and network coordination hub for many NASA robotic missions. Included as an operations location, not as a primary large ground antenna complex.',
    source: 'NASA / JPL',
    sourceUrl: 'https://www.jpl.nasa.gov/missions/dsn/',
  },
];

/**
 * Filter Earth communication locations by type, country, network, or keyword.
 *
 * @param {{
 *   type?: string,
 *   country?: string,
 *   network?: string,
 *   query?: string
 * }} filters
 * @returns {Array}
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
