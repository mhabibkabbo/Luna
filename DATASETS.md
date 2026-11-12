# Datasets & Data Provenance

This document catalogs all geospatial rasters, vector layers, remote tile services, live telemetry feeds, curated mission/site catalogs, and analytical models used in **Luna**.

---

## 1. Provenance & Confidence Taxonomy

Data across the application is classified using two complementary taxonomies defined in [`src/data/nasaProvenance.js`](src/data/nasaProvenance.js) and [`docs/lunar-sites-sources.md`](docs/lunar-sites-sources.md):

| Provenance Tag | Meaning |
| :--- | :--- |
| `NASA_MEASURED` | Direct orbital instrument data or controlled mosaics from NASA LRO / PDS archives. |
| `NASA_DERIVED` | Cartographic or topographic products derived directly from NASA LOLA / LROC / Diviner products. |
| `APP_CALCULATED` | Computed at runtime via 360° DEM ray-marching, analytical ephemeris, or radiative balance models. |
| `ESTIMATED` | Analytical model or regional literature baseline where local high-density polar DEM/volatile rasters are not loaded. |

Coordinate entries in site and mission catalogs also carry a `locationType` fidelity label:
- **`confirmed`** — Published coordinate for the actual landing site or feature center.
- **`planned`** — Published target coordinate for an upcoming mission.
- **`approximate`** — Representative point inside a broader announced region (indicative only for horizon analysis).
- **`estimate`** — Computed from published points (e.g., crater-center midpoint).
- **`placeholder`** — Display-only coordinate where no landing site has been published (`horizonEligible: false`).

---

## 2. Local Raster & Vector Datasets (`public/data/` & `public/assets/`)

### 2.1 South Pole Elevation DEM

| Property | Value |
| :--- | :--- |
| **File** | [`public/data/lola_sp_80s_int16.bin`](public/data/lola_sp_80s_int16.bin) (`4,620,800` bytes) |
| **Source Product** | NASA PDS `LRO-L-LOLA-4-GDR-V1.0` (`LDEM_80S_400M`, Lunar Orbiter Laser Altimeter) |
| **Coverage** | Lunar South Pole (`80.0°S` to `90.0°S`), `[-304,000 m, +304,000 m]` in X and Y |
| **Projection & Datum** | South Polar Stereographic (`+proj=stere +lat_0=-90 +lon_0=0 +k=1 +a=1737400 +b=1737400 +units=m`), Sphere $R_0 = 1,737,400.0\text{ m}$ |
| **Dimensions & Resolution** | `1520 × 1520` pixels at `400 m/pixel` |
| **Encoding** | Signed 16-bit Little-Endian (`int16`), scale `0.5 m/DN`, NoData = `-32768` |
| **Elevation Range** | `-7,273.5 m` to `+7,020.0 m` relative to $R_0$ (per [`topo_manifest.json`](public/data/topo/topo_manifest.json)) |
| **Runtime Consumers** | [`src/workers/lolaTileWorker.js`](src/workers/lolaTileWorker.js), [`src/utils/horizons.js`](src/utils/horizons.js), [`src/utils/routePlanner.js`](src/utils/routePlanner.js) |

> **Note:** [`src/data/nasaProvenance.js`](src/data/nasaProvenance.js) lists `2048×2048` / `±409.6 km` in a descriptive UI label, while the actual binary raster on disk and all runtime/preprocessing consumers (`topo_manifest.json`, `lolaTileWorker.js`, `horizons.js`, `routePlanner.js`, `scripts/generate_lola_contours.js`) operate on the `1520 × 1520` (`±304,000 m`) grid.

### 2.2 Topographic Vector & Manifest Layers (`public/data/topo/`)

Generated from `lola_sp_80s_int16.bin` via [`scripts/generate_lola_contours.js`](scripts/generate_lola_contours.js) and documented in [`scripts/README.md`](scripts/README.md):

| File | Format / Geometry | Features | Size | Description |
| :--- | :--- | :---: | :---: | :--- |
| [`topo_manifest.json`](public/data/topo/topo_manifest.json) | JSON metadata | — | 1.6 KB | Projection, bounds, zoom-level contour intervals (`500 m`, `200 m`, `100 m`, plus dynamic worker `50 m`/`20 m`), elevation stats |
| [`contours_500m.geojson`](public/data/topo/contours_500m.geojson) | GeoJSON `LineString` | 853 | 1.97 MB | 500 m elevation contours (2,500 m index) for zoom levels 0–1 |
| [`contours_200m.geojson`](public/data/topo/contours_200m.geojson) | GeoJSON `LineString` | 2,122 | 4.91 MB | 200 m elevation contours (1,000 m index) for zoom level 2 |
| [`contours_100m.geojson`](public/data/topo/contours_100m.geojson) | GeoJSON `LineString` | 4,253 | 9.79 MB | 100 m elevation contours (500 m index) for zoom level 3 |
| [`slope_hazard_15deg.geojson`](public/data/topo/slope_hazard_15deg.geojson) | GeoJSON `LineString` | 410 | 266 KB | Hazard boundary contours where Horn slope $\ge 15.0^\circ$ |
| [`psr_footprints.geojson`](public/data/topo/psr_footprints.geojson) | GeoJSON `LineString` | 98 | 289 KB | Permanently Shadowed Region footprints derived via 16-azimuth LOLA horizon ray-marching (max solar declination $1.5424^\circ$) |
| [`ridges_and_rims.geojson`](public/data/topo/ridges_and_rims.geojson) | GeoJSON `LineString` | 4 | 7.6 KB | Major crater rims (e.g., Shackleton) and polar topographic ridges |
| [`planned_traverses.geojson`](public/data/topo/planned_traverses.geojson) | GeoJSON `LineString` | 3 | 2.5 KB | Candidate Artemis III / VIPER traverse lines (e.g., Shackleton–De Gerlache Connecting Ridge) |

### 2.3 Earth Reference Texture

- [`public/assets/earth-blue-marble.jpg`](public/assets/earth-blue-marble.jpg) (`1,461,877` bytes; mirrored at [`public/pictures/earth-blue-marble.jpg`](public/pictures/earth-blue-marble.jpg)) — Global equirectangular Earth texture (`4096 × 2048` single-tile provider on Cesium `Ellipsoid.WGS84`, configured in [`src/cesium/earth/earthGlobe.js`](src/cesium/earth/earthGlobe.js)).

---

## 3. Remote Planetary Imagery & Map Services

Configured in [`src/services/nasa/layers.js`](src/services/nasa/layers.js) (`LUNAR_LAYERS_CATALOG`) and mounted on the 3D Moon globe in [`src/cesium/moon/moonGlobe.js`](src/cesium/moon/moonGlobe.js):

| Layer ID | Display Name | Protocol & Endpoint | Source Layer / ID | Max Zoom | Attribution |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `lro-wac-morphology` | Photo Basemap (LRO WAC) | NASA Moon Trek WMTS (`trek.nasa.gov/tiles/Moon/EQ/...`, JPG) | `LRO_WAC_Mosaic_Global_303ppd_v02` | 8 | NASA / GSFC / ASU (LROC Team) |
| `lola-shaded-relief` | 3D Terrain Relief (LOLA Hillshade) | NASA Moon Trek WMTS (`trek.nasa.gov/tiles/Moon/EQ/...`, PNG) | `LRO_LOLA_Shade_Global_128ppd_v04` | 7 | NASA GSFC / LOLA Science Team |
| `lola-color-dem` | Color Elevation DEM (LOLA Topography) | NASA Moon Trek WMTS (`trek.nasa.gov/tiles/Moon/EQ/...`, PNG) | `LRO_LOLA_ClrShade_Global_128ppd_v04` | 7 | NASA GSFC / LOLA Science Team |
| `diviner-rock-abundance` | Rock Abundance (LRO Diviner) | USGS Astrogeology WMS (`planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map`, JPG) | `LOLA_steel` (WMTS fallback ref: `LRO_LOLA_Shade_Global_128ppd_v04`) | 7 | NASA / UCLA / JPL Diviner & USGS Astrogeology |
| `kaguya-tc-ortho` | Kaguya TC Ortho Mosaic | USGS Astrogeology WMS (`planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map`, JPG) | `KaguyaTC_Ortho` | 7 | JAXA / ISAS / SELENE Team / USGS |
| `clementine-uvvis` | Mineralogy UVVIS (Clementine) | USGS Astrogeology WMS (`planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map`, JPG) | `uv_warp` | 7 | NASA / USGS Astrogeology Science Center |

---

## 4. Precomputed Horizons, Ephemerides & Live Telemetry

### 4.1 Precomputed Terrain Horizon Profiles (`src/data/horizons.json`)

- **File:** [`src/data/horizons.json`](src/data/horizons.json) (`116` lunar sites)
- **Format:** 360-azimuth ($1^\circ$ step) horizon elevation angles (degrees) with curvature drop, computed at a `2.0 m` observer mast height above `R₀ = 1,737,400 m` using [`scripts/compute_horizons.py`](scripts/compute_horizons.py).
- **Source DEMs Recorded per Site:**
  - `LDEM_80S_20MPP_ADJ.TIF` (`20 m/px`, 80°S–90°S): **34** sites
  - `LDEM_75S_30MPP_ADJ.TIF` (`30 m/px`, 75°S–90°S): **7** sites
  - `LDEM_60S_60MPP_ADJ.TIF` (`60 m/px`, 60°S–90°S): **4** sites
  - `LDEM_128.tif` (global LOLA 128 ppd): **71** sites
- **Runtime Augmentation:** For arbitrary user clicks or pins inside `80°S–90°S`, [`src/utils/horizons.js`](src/utils/horizons.js) performs real-time 360° ray-marching directly on `public/data/lola_sp_80s_int16.bin`.

### 4.2 Planetary Ephemerides & State Vectors

- **Live API:** NASA JPL Horizons Web Service (`https://ssd.jpl.nasa.gov/api/horizons.api`) queried by [`src/utils/jplHorizons.js`](src/utils/jplHorizons.js) for Moon state vectors (position, velocity, range, light-time).
- **Local / Offline Ephemeris:** `astronomy-engine` (`^2.1.19`, VSOP87 / DE421 fitted) paired with the IAU/IAG WGCCRE 2009/2015 13-argument lunar orientation and libration series in [`src/utils/lunarEphemeris.js`](src/utils/lunarEphemeris.js).

### 4.3 Live Space Weather Feed (`src/services/spaceWeather.js`)

Polled on demand with a 5-minute in-memory cache (`CACHE_TTL_MS = 300,000 ms`) across NOAA Space Weather Prediction Center (SWPC) JSON feeds:
- Propagated solar wind: `services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json` (fallback: `propagated-solar-wind.json`)
- Real-time L1 solar wind (DSCOVR/ACE): `rtsw/rtsw_wind_1m.json` and `rtsw/rtsw_mag_1m.json`
- Operational summaries: `products/summary/solar-wind-speed.json` and `solar-wind-mag-field.json`
- **Offline Behavior:** Returns an explicit unavailable fallback state (`isFallback: true`, `isUnavailable: true`, `null` telemetry values) rather than synthetic readings.

---

## 5. Curated Lunar & Earth Catalogs (`src/data/`)

| File | Export | Records | Scope & Breakdown | Primary Sources |
| :--- | :--- | :---: | :--- | :--- |
| [`lunarCanonicalCatalog.js`](src/data/lunarCanonicalCatalog.js) | `CANONICAL_POLAR_LANDMARKS` | 13 | Authoritative South Pole coordinates, LOLA DEM elevations, PSR areas, and H₂O estimates (`getSiteVolatileMetadata`) | LRO LOLA DEM, LEND, Diviner, LCROSS, IAU Gazetteer |
| [`lunarFeatures.js`](src/data/lunarFeatures.js) | `LUNAR_FEATURES` | 74 | 42 craters, 14 mountains/massifs, 11 maria, 4 valleys, 2 rilles, 1 south pole reference | IAU Gazetteer of Planetary Nomenclature, NASA LROC / USGS |
| [`landingSites.js`](src/data/landingSites.js) | `LANDING_SITES` | 42 | 26 historic/international/Artemis III mission sites, 10 CLPS features (`CLPS_SITE_FEATURES`), 6 Apollo landing sites | NASA NSSDC Master Catalog, LROC, LPI Artemis III abstracts, Peña-Asensio et al. (2025) |
| [`clpsMissions.js`](src/data/clpsMissions.js) | `CLPS_MISSIONS` | 10 | CLPS task orders (1 completed, 2 partial, 2 failed, 5 planned; fidelity: 3 confirmed, 3 planned, 3 approximate, 1 placeholder `clps-firefly-bgm2`) | NASA CLPS press kits (NP-2025-01-001, NP-2025-02-005), provider releases |
| [`missions.js`](src/data/missions.js) | `MISSION_SCHEDULES` | 12 | Normalized mission status, outcome categories (`success`, `partial`, `failure`, `planned`), and launch/landing schedule metadata | NASA CLPS & agency mission logs |
| [`heroMissions.js`](src/data/heroMissions.js) | `HERO_ORBITAL_MISSIONS` | 5 | Featured missions for the landing showcase (IM-1, Blue Ghost 1, IM-2, Apollo 11, Griffin-1) | Derived from `CLPS_MISSIONS` & Apollo 11 |
| [`plannerCandidates.js`](src/data/plannerCandidates.js) | `PLANNER_CANDIDATES` | 19 | Candidate landing sites across South Pole, equatorial mare, and farside regions for suitability ranking | NASA Artemis III regions, Apollo/CLPS targets, LROC |
| [`slipSites.js`](src/data/slipSites.js) | `SITES_TO_ANALYZE` | 6 | South Pole candidate sites pre-parameterized for SLIP terrain/elevation simulation | LRO LOLA DEM |
| [`earthCommunicationSites.js`](src/data/earthCommunicationSites.js) | `EARTH_COMMUNICATION_SITES` | 25 | 19 deep-space comm complexes/antennas, 3 spacecraft tracking, 1 launch tracking, 1 relay comms, 1 mission ops (`elevationM` marked unavailable) | NASA Eyes on the DSN, ESA, ISRO, JAXA |
| [`earthLaunchSites.js`](src/data/earthLaunchSites.js) | `EARTH_LAUNCH_SITES` | 94 | Global orbital launch pads/spaceports (84 Operational, 8 Active/Experimental, 1 Retired/Historic, 1 Historic/Inactive) | The Space Devs / Launch Library 2, NASA, ESA, Roscosmos, CNSA |
| [`nasaProvenance.js`](src/data/nasaProvenance.js) | `NASA_DATASETS_REGISTRY`, `SOUTH_POLE_SCIENTIFIC_LAYERS`, `LOLA_VALIDATION_BENCHMARKS` | 4 / 9 / 3 | Dataset registry, 9 South Pole map layer definitions, 3 peer-reviewed LOLA validation benchmarks, scoring pillar metadata | Mazarico et al. (2011), Gläser et al. (2018), Bussey et al. (2010), Barker et al. (2021) |

Launch vehicle reference specifications (`LUNAR_ROCKETS`, 6 vehicles: SLS Block 1, Saturn V, Starship, Falcon Heavy, Vulcan Centaur, Ariane 64) are defined in [`src/utils/jplHorizons.js`](src/utils/jplHorizons.js).

---

## 6. Runtime Analytical & Derived Models

Several scientific outputs in Luna are computed analytically in-app rather than loaded from gridded PDS rasters:

- **9 South Pole Dynamic Map Layers** ([`src/workers/lolaTileWorker.js`](src/workers/lolaTileWorker.js), [`src/data/nasaProvenance.js`](src/data/nasaProvenance.js)): Hypsometric elevation, Horn 3×3 slope, 1.2 km RMS roughness, hillshade relief, vector features/contours, instantaneous solar illumination, 16-azimuth PSR mask, Direct-to-Earth (DTE) libration visibility, and composite mission risk.
- **Surface Thermal Model** ([`src/utils/lunarThermal.js`](src/utils/lunarThermal.js)): Radiative equilibrium $T(\cos\theta)^{1/4}$ ($T_{\max} = 390\text{ K}$) in sunlight, exponential regolith cooldown ($\tau = 42\text{ h}$) toward $100\text{ K}$ in night shadow, and $40\text{ K}$ floor in PSRs, parameterized from Vasavada et al. (2012), Paige et al. (2010), and Hayne et al. (2017) — **no gridded Diviner TBol raster is bundled**.
- **Landing Suitability Scoring** ([`src/utils/suitabilityScoring.js`](src/utils/suitabilityScoring.js)): Weighted linear index — **Solar Illumination (35%)**, **DTE Comms (30%)**, **Terrain Slope & Roughness (20%)**, **Thermal Survivability (15%)**.
- **DTE Link Budget** ([`src/utils/communication.js`](src/utils/communication.js), [`src/utils/communicationAnalysis.js`](src/utils/communicationAnalysis.js)): Analytical Friis transmission, ITU-R P.618 atmospheric attenuation, and NASA DSN 810-005 station geometry.
- **Cislunar Trajectories** ([`src/utils/transferOrbit.js`](src/utils/transferOrbit.js)): Analytic two-body Keplerian model for Direct TLI; cubic Bézier schematic approximations (`isSchematic: true`) for Free-Return and Low-Energy WSB/BLT profiles.
- **EVA / Rover A\* Route Planner** ([`src/utils/routePlanner.js`](src/utils/routePlanner.js), [`src/workers/routePlanner.worker.js`](src/workers/routePlanner.worker.js)): Cost-minimizing pathfinding over `lola_sp_80s_int16.bin` with a $15^\circ$ slope hazard limit and optional PSR avoidance.

---

## 7. Static Imagery Assets

- **Mission Thumbnails** ([`public/images/missions/`](public/images/missions/)): 21 `.webp` images covering 10 CLPS missions, 7 Apollo missions (`apollo-11` through `apollo-17`), `chandrayaan-3`, `change-6`, `slim`, and `home.webp`.
- **Surface Reference Photos** ([`public/pictures/`](public/pictures/)): 5 `.jpg` reference images (`blue-ghost-mare-crisium.jpg`, `earth-blue-marble.jpg`, `lunar-south-pole-horizon.jpg`, `odysseus-malapert-landing.jpg`, `shackleton-polar-ridge.jpg`).

---

## 8. Data Pipeline & Verification Scripts (`scripts/`)

| Script | Purpose |
| :--- | :--- |
| [`scripts/generate_lola_contours.js`](scripts/generate_lola_contours.js) | Reads `public/data/lola_sp_80s_int16.bin` and generates `topo_manifest.json`, contours (`500m`/`200m`/`100m`), `slope_hazard_15deg.geojson`, `ridges_and_rims.geojson`, and `planned_traverses.geojson`. |
| [`scripts/export_sites.mjs`](scripts/export_sites.mjs) | Exports all eligible lunar pins (`CLPS_MISSIONS`, `LANDING_SITES`, `LUNAR_FEATURES`, `south-pole`) to `scripts/sites.json`, skipping placeholder entries (`horizonEligible: false`). |
| [`scripts/compute_horizons.py`](scripts/compute_horizons.py) | Casts 360 rays across external LOLA GeoTIFF DEMs (`rasterio`/`pyproj`/`numpy`) to generate `src/data/horizons.json`. |
| [`scripts/fetch_earth_data.mjs`](scripts/fetch_earth_data.mjs) | Builds/updates `src/data/earthLaunchSites.js` and `src/data/earthCommunicationSites.js`. |
| [`scripts/audit_catalogs.mjs`](scripts/audit_catalogs.mjs) | Audits coordinate and elevation consistency across `SouthPoleTopoMap.jsx`, `coordinates.js`, `horizons.js`, `sites.json`, and `lola_sp_80s_int16.bin`. |
| [`scripts/check_dems.py`](scripts/check_dems.py) | Inspects external LOLA GeoTIFF DEM metadata prior to horizon computation. |

---

## 9. Known Limitations & Caveats

1. **80°S–90°S Polar DEM Boundary:** High-resolution (`400 m/px`) local elevation, slope, roughness, and runtime ray-marched horizons only exist south of `80°S`. Sub-400 m boulders, micro-craters, and narrow knife-edge rim spires (e.g., Shackleton rim crest) are smoothed at `400 m/px`.
2. **Provisional / Approximate Coordinates:** 15 exported lunar sites have `approximate` or `planned` coordinates (detailed in [`docs/lunar-sites-sources.md`](docs/lunar-sites-sources.md)); `clps-firefly-bgm2` uses a placeholder farside point and is excluded from horizon computation (`horizonEligible: false`).
3. **Volatile & Rock Abundance Data:** Local gridded Diviner thermal/rock-abundance or LEND neutron rasters are not bundled; volatile ppm estimates in `lunarCanonicalCatalog.js` are literature-attributed per-site values or regional baselines.
4. **Network Dependency for Base Maps & Live Feeds:** Remote WMTS/WMS imagery (NASA Moon Trek / USGS) and NOAA SWPC / JPL Horizons APIs require internet access; offline mode falls back to local `astronomy-engine` ephemerides and `lola_sp_80s_int16.bin`.
