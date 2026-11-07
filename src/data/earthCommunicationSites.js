/**
 * @file earthCommunicationSites.js
 * Curated Earth-based facilities important for communicating with spacecraft.
 *
 * Includes deep-space antenna dishes, tracking networks, and mission operations.
 * Sources:
 * - NASA Deep Space Network / Eyes on the DSN (https://eyes.nasa.gov/apps/dsn-now/dsn.html)
 * - ESA Estrack (https://esoc.esa.int/explore-our-ground-stations)
 * - ISRO / JAXA / Commercial Deep Space Ground Stations
 *
 * Scientific Source Verification Note:
 * Ground tracking station geometric elevations (elevationM above the WGS84 reference ellipsoid)
 * are planning estimates / geometric approximations rather than published survey-grade benchmarks.
 * Station elevation is formally classified as "Unable to Verify / Data Not Available" (defaulted to 0 m
 * in topocentric DTE LOS calculations).
 */

export const STATION_ELEVATION_STATUS = 'Unable to Verify / Data Not Available';

export const EARTH_COMMUNICATION_SITES = [
  {
    "id": "earth-comms-nasa-goldstone",
    "name": "Goldstone Deep Space Communications Complex",
    "type": "deep-space-communication",
    "latitude": 35.4266,
    "longitude": -116.89,
    "country": "United States",
    "agency": "NASA / JPL",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "One of NASA’s three globally distributed Deep Space Network complexes, located in California’s Mojave Desert.",
    "source": "NASA Deep Space Network",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-antenna-dsn-dss14",
    "name": "Goldstone DSS-14 \"Mars\" 70-meter Antenna",
    "type": "deep-space-communication",
    "latitude": 35.4259,
    "longitude": -116.8889,
    "country": "United States",
    "agency": "NASA / JPL",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "Massive 70-metre dish antenna capable of deep-space telecommunications, planetary radar, and high-power command uplinks for distant spacecraft and lunar missions.",
    "source": "NASA Eyes on the DSN",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-antenna-dsn-dss24",
    "name": "Goldstone DSS-24 34-meter Beam Waveguide",
    "type": "deep-space-communication",
    "latitude": 35.3399,
    "longitude": -116.8744,
    "country": "United States",
    "agency": "NASA / JPL",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "34-metre Beam Waveguide (BWG) antenna providing telemetry and command support in S and X bands.",
    "source": "NASA Eyes on the DSN",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-antenna-dsn-dss25",
    "name": "Goldstone DSS-25 34-meter Beam Waveguide",
    "type": "deep-space-communication",
    "latitude": 35.3376,
    "longitude": -116.8752,
    "country": "United States",
    "agency": "NASA / JPL",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "34-metre BWG antenna equipped with solar transmitter capabilities and high-rate Ka-band reception.",
    "source": "NASA Eyes on the DSN",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-antenna-dsn-dss26",
    "name": "Goldstone DSS-26 34-meter Beam Waveguide",
    "type": "deep-space-communication",
    "latitude": 35.335,
    "longitude": -116.873,
    "country": "United States",
    "agency": "NASA / JPL",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "Modernized 34-metre BWG antenna supporting Artemis lunar missions and outer-planet robotic explorers.",
    "source": "NASA Eyes on the DSN",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-nasa-madrid",
    "name": "Madrid Deep Space Communications Complex",
    "type": "deep-space-communication",
    "latitude": 40.4314,
    "longitude": -4.2486,
    "country": "Spain",
    "agency": "NASA / INTA",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "NASA DSN European complex in Robledo de Chavela, Spain. Its longitude ensures continuous contact with deep-space probes as the Earth rotates.",
    "source": "NASA Deep Space Network",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-antenna-dsn-dss63",
    "name": "Madrid DSS-63 70-meter Antenna",
    "type": "deep-space-communication",
    "latitude": 40.4314,
    "longitude": -4.248,
    "country": "Spain",
    "agency": "NASA / INTA",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "The European 70-metre giant dish of the Deep Space Network, commanding deep-space probes and tracking lunar spacecraft.",
    "source": "NASA Eyes on the DSN",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-antenna-dsn-dss65",
    "name": "Madrid DSS-65 34-meter HEF Antenna",
    "type": "deep-space-communication",
    "latitude": 40.4285,
    "longitude": -4.2505,
    "country": "Spain",
    "agency": "NASA / INTA",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "34-metre High Efficiency antenna utilized for robotic planetary missions and lunar exploration.",
    "source": "NASA Eyes on the DSN",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-antenna-dsn-dss56",
    "name": "Madrid DSS-56 34-meter \"All-in-One\" BWG Antenna",
    "type": "deep-space-communication",
    "latitude": 40.426,
    "longitude": -4.253,
    "country": "Spain",
    "agency": "NASA / INTA",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "State-of-the-art 34-metre Beam Waveguide antenna capable of communicating across all DSN frequency bands simultaneously.",
    "source": "NASA Eyes on the DSN",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-nasa-canberra",
    "name": "Canberra Deep Space Communication Complex",
    "type": "deep-space-communication",
    "latitude": -35.401,
    "longitude": 148.9819,
    "country": "Australia",
    "agency": "NASA / CSIRO",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "Southern hemisphere DSN complex in the Tidbinbilla Valley near Canberra, Australia.",
    "source": "NASA Deep Space Network",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-antenna-dsn-dss43",
    "name": "Canberra DSS-43 70-meter Antenna",
    "type": "deep-space-communication",
    "latitude": -35.4028,
    "longitude": 148.9813,
    "country": "Australia",
    "agency": "NASA / CSIRO",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "The largest steerable parabolic antenna in the Southern Hemisphere. The only dish capable of transmitting commands to Voyager 2 in the deep southern sky.",
    "source": "NASA Eyes on the DSN",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-antenna-dsn-dss34",
    "name": "Canberra DSS-34 34-meter Beam Waveguide",
    "type": "deep-space-communication",
    "latitude": -35.3985,
    "longitude": 148.9818,
    "country": "Australia",
    "agency": "NASA / CSIRO",
    "network": "NASA Deep Space Network (DSN)",
    "status": "Operational",
    "description": "34-metre BWG antenna supporting Artemis Orion spacecraft tracking and lunar robotic missions.",
    "source": "NASA Eyes on the DSN",
    "sourceUrl": "https://eyes.nasa.gov/apps/dsn-now/dsn.html",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-esa-new-norcia",
    "name": "New Norcia Deep Space Antenna (DSA 1)",
    "type": "deep-space-communication",
    "latitude": -31.0483,
    "longitude": 116.191,
    "country": "Australia",
    "agency": "European Space Agency (ESA)",
    "network": "ESA Estrack",
    "status": "Operational",
    "description": "ESA 35-metre deep-space antenna used for tracking, telemetry, telecommand and radiometric measurements for deep-space and lunar missions.",
    "source": "ESA Estrack",
    "sourceUrl": "https://esoc.esa.int/explore-our-ground-stations",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-esa-cebreros",
    "name": "Cebreros Deep Space Antenna (DSA 2)",
    "type": "deep-space-communication",
    "latitude": 40.4528,
    "longitude": -4.3676,
    "country": "Spain",
    "agency": "European Space Agency (ESA)",
    "network": "ESA Estrack",
    "status": "Operational",
    "description": "ESA 35-metre deep-space station in Ávila, Spain, supporting interplanetary spacecraft tracking and precise radio science.",
    "source": "ESA Estrack",
    "sourceUrl": "https://esoc.esa.int/explore-our-ground-stations",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-esa-malargue",
    "name": "Malargüe Deep Space Antenna (DSA 3)",
    "type": "deep-space-communication",
    "latitude": -35.7767,
    "longitude": -69.3987,
    "country": "Argentina",
    "agency": "European Space Agency (ESA)",
    "network": "ESA Estrack",
    "status": "Operational",
    "description": "ESA 35-metre deep-space antenna in Mendoza, Argentina, providing complete 360° longitudinal coverage alongside New Norcia and Cebreros.",
    "source": "ESA Estrack",
    "sourceUrl": "https://esoc.esa.int/explore-our-ground-stations",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-isro-byalalu",
    "name": "Indian Deep Space Network (IDSN), Byalalu",
    "type": "deep-space-communication",
    "latitude": 12.9067,
    "longitude": 77.3683,
    "country": "India",
    "agency": "Indian Space Research Organisation (ISRO)",
    "network": "Indian Deep Space Network",
    "status": "Operational",
    "description": "Houses India’s 32-metre and 18-metre deep space communication antennas, which operated the Chandrayaan-1, 2, and 3 lunar missions and Mangalyaan Mars probe.",
    "source": "ISRO",
    "sourceUrl": "https://www.isro.gov.in/",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-jaxa-usuda",
    "name": "Usuda Deep Space Center 64m Antenna",
    "type": "deep-space-communication",
    "latitude": 36.1333,
    "longitude": 138.3667,
    "country": "Japan",
    "agency": "Japan Aerospace Exploration Agency (JAXA)",
    "network": "JAXA deep-space communications",
    "status": "Operational",
    "description": "Historic 64-metre antenna nestled in Nagano Prefecture used to communicate with Halley’s Comet probes, Hayabusa asteroids sample returns, and lunar spacecraft.",
    "source": "JAXA",
    "sourceUrl": "https://global.jaxa.jp/",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-jaxa-misasa",
    "name": "Misasa Deep Space Station 54m Antenna",
    "type": "deep-space-communication",
    "latitude": 36.155,
    "longitude": 138.375,
    "country": "Japan",
    "agency": "Japan Aerospace Exploration Agency (JAXA)",
    "network": "GREAT (Ground Station for Deep Space Exploration)",
    "status": "Operational",
    "description": "JAXA’s newest 54-metre high-precision antenna designed for lunar and deep-space missions with Ka-band reception.",
    "source": "JAXA",
    "sourceUrl": "https://global.jaxa.jp/",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-goonhilly-ghy6",
    "name": "Goonhilly Earth Station (GHY-6 Merlin)",
    "type": "deep-space-communication",
    "latitude": 50.0486,
    "longitude": -5.1822,
    "country": "United Kingdom",
    "agency": "Goonhilly Earth Station / ESA / NASA",
    "network": "Commercial Deep Space Network",
    "status": "Operational",
    "description": "World’s first privately owned commercial deep space ground station. Upgraded 32-metre parabolic dish communicating with lunar CLPS landers and Mars orbiters.",
    "source": "Goonhilly Earth Station",
    "sourceUrl": "https://www.goonhilly.org/",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-svalbard-svalsat",
    "name": "Svalbard Satellite Station (SvalSat)",
    "type": "spacecraft-tracking",
    "latitude": 78.2306,
    "longitude": 15.39,
    "country": "Norway (Svalbard)",
    "agency": "Kongsberg Satellite Services (KSAT)",
    "network": "KSAT Global Polar Network",
    "status": "Operational",
    "description": "World’s largest commercial ground station at 78° North, providing all 14 daily passes for polar orbiting spacecraft and lunar transfer tracking.",
    "source": "KSAT",
    "sourceUrl": "https://www.ksat.no/",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-esa-kourou",
    "name": "ESA Kourou Ground Station",
    "type": "spacecraft-tracking",
    "latitude": 5.16,
    "longitude": -52.65,
    "country": "French Guiana",
    "agency": "European Space Agency (ESA)",
    "network": "ESA Estrack",
    "status": "Operational",
    "description": "15-metre ground station used for Earth-orbiting spacecraft operations and launch/early-orbit support near Europe’s Spaceport.",
    "source": "ESA Ground Stations",
    "sourceUrl": "https://www.esa.int/Enabling_Support/Operations/ESA_Ground_Stations",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-esa-kiruna",
    "name": "ESA Kiruna Ground Station",
    "type": "spacecraft-tracking",
    "latitude": 67.8571,
    "longitude": 20.9643,
    "country": "Sweden",
    "agency": "European Space Agency (ESA)",
    "network": "ESA Estrack",
    "status": "Operational",
    "description": "High-latitude station used to communicate with and track Earth-orbiting and polar spacecraft.",
    "source": "ESA Ground Stations",
    "sourceUrl": "https://www.esa.int/Enabling_Support/Operations/ESA_Ground_Stations",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-esa-santa-maria",
    "name": "ESA Santa Maria Tracking Station",
    "type": "launch-tracking",
    "latitude": 36.997,
    "longitude": -25.135,
    "country": "Portugal (Azores)",
    "agency": "European Space Agency (ESA)",
    "network": "ESA Estrack",
    "status": "Operational",
    "description": "Supports tracking of launch vehicles and spacecraft during launch and early orbit operations across the Atlantic corridor.",
    "source": "ESA Ground Stations",
    "sourceUrl": "https://www.esa.int/Enabling_Support/Operations/ESA_Ground_Stations",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-nasa-white-sands",
    "name": "White Sands Ground Terminal",
    "type": "relay-communications",
    "latitude": 32.5,
    "longitude": -106.6,
    "country": "United States",
    "agency": "NASA",
    "network": "Near Space Network / TDRSS",
    "status": "Operational",
    "description": "Hub of NASA’s Tracking and Data Relay Satellite System (TDRSS), providing near-continuous relay communication with human spaceflight and Earth observation satellites.",
    "source": "NASA SCaN",
    "sourceUrl": "https://www.nasa.gov/communicating-with-missions/",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  },
  {
    "id": "earth-comms-nasa-jpl",
    "name": "Jet Propulsion Laboratory (Mission Operations)",
    "type": "mission-operations",
    "latitude": 34.2007,
    "longitude": -118.171,
    "country": "United States",
    "agency": "NASA / Caltech",
    "network": "Deep Space Network Operations",
    "status": "Operational",
    "description": "The Space Flight Operations Facility (SFOF), the central hub coordinating DSN tracking and planetary missions.",
    "source": "NASA / JPL",
    "sourceUrl": "https://www.jpl.nasa.gov/missions/dsn/",
    "elevationM": null,
    "elevationStatus": "Unable to Verify / Data Not Available"
  }
];

/**
 * Filter Earth communication locations by type, country, network, or keyword.
 * @internal Test & communication station filter utility.
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

/**
 * Resolves station elevation metadata and verification status.
 * @internal Test & station elevation query utility.
 * @param {object} station
 * @returns {{ elevationM: number|null, status: string }}
 */
export function getStationElevation(station) {
  return {
    elevationM: station?.elevationM ?? null,
    status: station?.elevationStatus ?? STATION_ELEVATION_STATUS,
  };
}
