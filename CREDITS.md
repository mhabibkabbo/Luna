# References & Credits

This document credits all third-party libraries, fonts, planetary datasets, live APIs, scientific literature, and visual media used in **Luna**.

---

## 1. Third-Party Libraries & Dependencies

### Runtime Dependencies (`package.json`)

| Package | Version | Purpose |
| :--- | :--- | :--- |
| [React](https://react.dev/) (`react`, `react-dom`) | `^18.3.1` | Component UI framework |
| [CesiumJS](https://cesium.com/platform/cesiumjs/) (`cesium`) | `^1.145.0` | 3D Moon & Earth planetary globes and WMTS/WMS imagery rendering |
| [Three.js](https://threejs.org/) (`three`) | `^0.186.0` | Landing-page 3D Moon showcase and 3D cislunar transfer orbit viewport |
| [Leaflet](https://leafletjs.com/) (`leaflet`) | `^1.9.4` | 2D South Pole polar-stereographic topographic map |
| [Proj4js](http://proj4js.org/) (`proj4`, `proj4leaflet`) | `^2.22.0` / `^1.0.2` | South Polar Stereographic CRS projection support |
| [D3.js](https://d3js.org/) (`d3`) | `^7.9.1` | Contour extraction, horizon/signal charts, and data visualization |
| [Astronomy Engine](https://github.com/cosinekitty/astronomy) (`astronomy-engine`) | `^2.1.19` | Offline VSOP87/DE421-fitted solar, Earth, and lunar ephemerides |
| [jsPDF](https://github.com/parallax/jsPDF) (`jspdf`, `jspdf-autotable`) | `^4.2.1` / `^5.0.9` | Multi-page site comparison trade-study PDF export |
| [Lucide React](https://lucide.dev/) (`lucide-react`) | `^0.468.0` | Vector UI iconography |
| [`y`](https://www.npmjs.com/package/y) | `^0.3.2` | Listed dependency in `package.json` |

### Build, Styling & Offline Script Dependencies

- **Frontend Tooling (`package.json`):** [Vite](https://vite.dev/) (`^6.4.3`), `@vitejs/plugin-react` (`^4.3.4`), `vite-plugin-cesium` (`^1.2.23`), [Tailwind CSS](https://tailwindcss.com/) (`^3.4.19`), PostCSS (`^8.4.49`), Autoprefixer (`^10.4.20`), and TypeScript (`^5.9.3`, used via `tsc --noEmit` for JS type checking).
- **Python Offline DEM Pipeline ([`scripts/compute_horizons.py`](scripts/compute_horizons.py)):** `rasterio`, `pyproj`, and `numpy`.

---

## 2. Typography & UI Design

- **Google Fonts** (loaded in [`index.html`](index.html)):
  - **Inter** — Body and interface copy
  - **Space Grotesk** — Display headings
  - **Plus Jakarta Sans** — Subheadings and UI accents
  - **JetBrains Mono** — Tabular telemetry, coordinates, and technical readouts
- **Templates:** Built from scratch with custom React and Tailwind CSS components; no third-party site template was used.

---

## 3. Planetary Datasets, Tile Services & Live APIs

Detailed technical specifications, file sizes, and record counts are documented in [`DATASETS.md`](DATASETS.md) and [`docs/lunar-sites-sources.md`](docs/lunar-sites-sources.md).

- **NASA LRO LOLA (Lunar Orbiter Laser Altimeter):** PDS `LRO-L-LOLA-4-GDR-V1.0` (`LDEM_80S_400M` South Pole DEM and global/polar GeoTIFF DEMs used to precompute [`src/data/horizons.json`](src/data/horizons.json)); NASA GSFC / LOLA Science Team & SVS 5127.
- **NASA Moon Trek WMTS (`trek.nasa.gov`):**
  - `LRO_WAC_Mosaic_Global_303ppd_v02` (NASA / GSFC / Arizona State University LROC Team)
  - `LRO_LOLA_Shade_Global_128ppd_v04` & `LRO_LOLA_ClrShade_Global_128ppd_v04` (NASA GSFC / LOLA Science Team)
- **USGS Astrogeology Science Center WMS (`planetarymaps.usgs.gov`):**
  - `LOLA_steel` (NASA / UCLA / JPL Diviner & USGS Astrogeology)
  - `KaguyaTC_Ortho` (JAXA / ISAS / SELENE Team / USGS)
  - `uv_warp` — Clementine 5-band UVVIS (NASA / USGS Astrogeology Science Center)
- **NASA / JPL Solar System Dynamics:** [JPL Horizons API](https://ssd.jpl.nasa.gov/api/horizons.api) and NAIF SPICE / DE421–DE440 references.
- **NOAA Space Weather Prediction Center (SWPC):** Real-time L1 solar wind plasma and IMF magnetic field JSON feeds (`services.swpc.noaa.gov`).
- **Site, Feature & Infrastructure Catalogs:**
  - IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology)
  - NASA NSSDC Master Catalog & NASA History Office
  - NASA CLPS Press Kits (`NP-2025-01-001`, `NP-2025-02-005`), NASA Moon Base & Artemis III candidate region publications
  - NASA Deep Space Network (Eyes on the DSN), ESA, ISRO, and JAXA tracking station records
  - The Space Devs / Launch Library 2 (`lldev.thespacedevs.com`) and agency launch complex records

---

## 4. Scientific & Engineering References

- **Polar Illumination & PSR Methodology:**
  - Mazarico, E., et al. (2011). *Illumination conditions of the lunar polar regions using LOLA topography*. Icarus, 211(2), 1066–1081.
  - Gläser, P., et al. (2018). *Illumination conditions at the lunar poles: Implications for future exploration*. Planetary and Space Science, 162, 170–178.
  - Bussey, D. B. J., et al. (2010). *Illumination conditions of the south pole of the Moon derived using Kaguya topography*. Icarus, 208(2), 558–564.
  - Speyerer, E. J., & Robinson, M. S. (2013). *Persistently illuminated regions at the lunar poles: Ideal sites for future exploration*. Icarus, 222(1), 122–136.
  - Barker, M. K., et al. (2021). *Improved LOLA elevation maps for south pole landing sites*. Planetary and Space Science, 203.
- **Thermal, Volatiles & Landing Sites:**
  - Vasavada, A. R., et al. (2012). *Lunar equatorial surface temperatures and regolith properties from the Diviner Lunar Radiometer Experiment*. JGR Planets, 117(E12).
  - Paige, D. A., et al. (2010). *Diviner Lunar Radiometer observations of cold traps in the Moon's south polar region*. Science, 330(6003), 479–482.
  - Hayne, P. O., et al. (2017). *Global regolith thermophysical properties of the Moon from the Diviner Lunar Radiometer Experiment*. JGR Planets, 122(12), 2371–2400.
  - Colaprete, A., et al. (2010). *Detection of water in the LCROSS ejecta plume*. Science, 330(6003), 463–468.
  - Sanin, A. B., et al. (2017). *Hydrogen distribution in the lunar polar regions*. Icarus, 283, 20–30.
  - Peña-Asensio, E., Neira-Acosta, A., & Sánchez-Lozano, J. M. (2025). *Acta Astronautica*, 226, 469–478.
  - Syposs, M., & Stopar, J. (2023). *LPI Artemis III Candidate Landing Regions Workshop*, Abstract 2042.
- **Geodesy, Terrain Slope & Telecommunications:**
  - Archinal, B. A., et al. (2011). *Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2009* (WGCCRE rotation/libration parameters).
  - Horn, B. K. P. (1981). *Hill shading and the reflectance map*. Proceedings of the IEEE, 69(1), 14–47.
  - ITU-R Recommendation P.618 (atmospheric propagation) & NASA DSN Telecommunications Link Design Handbook (`810-005`).

---

## 5. Media, Textures & Stock Imagery Credits

### Planetary & 3D Globe Textures

| Asset / Source | Credit | Usage |
| :--- | :--- | :--- |
| [`public/assets/earth-blue-marble.jpg`](public/assets/earth-blue-marble.jpg) | NASA Blue Marble / Visible Earth | Cesium 3D Earth globe base texture ([`earthGlobe.js`](src/cesium/earth/earthGlobe.js)) |
| `moon_1024.jpg` (via `cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/moon_1024.jpg`) | Three.js examples / NASA–USGS lunar mosaic | 3D landing-page Moon sphere texture with procedural canvas fallback ([`RealisticMoon.jsx`](src/components/landing/RealisticMoon.jsx)) |

### Lunar Surface Reference Photographs (`public/pictures/`, [`src/utils/photoMap.js`](src/utils/photoMap.js))

| File | Credit |
| :--- | :--- |
| [`odysseus-malapert-landing.jpg`](public/pictures/odysseus-malapert-landing.jpg) | NASA / Intuitive Machines / LROC |
| [`blue-ghost-mare-crisium.jpg`](public/pictures/blue-ghost-mare-crisium.jpg) | NASA / Firefly Aerospace |
| [`shackleton-polar-ridge.jpg`](public/pictures/shackleton-polar-ridge.jpg) | NASA LRO LOLA Altimetry |
| [`lunar-south-pole-horizon.jpg`](public/pictures/lunar-south-pole-horizon.jpg) | NASA LROC WFC / Goddard |
| [`earth-blue-marble.jpg`](public/pictures/earth-blue-marble.jpg) | NASA Apollo 17 / DSN Network |

### Mission Gallery Imagery (`public/images/missions/`)

Attributed per mission in [`src/data/clpsMissions.js`](src/data/clpsMissions.js) and [`src/components/missions/MissionsPage.jsx`](src/components/missions/MissionsPage.jsx):

| Image File(s) | Mission(s) | Attribution / Credit |
| :--- | :--- | :--- |
| `clps-im2-athena.webp` | IM-2 (Athena) | NASA / Intuitive Machines |
| `clps-im3-vertex.webp` | IM-3 (Lunar Vertex) | NASA / Intuitive Machines / JHU APL |
| `clps-griffin-gm1.webp` | Griffin Mission 1 | NASA / Astrobotic Technology |
| `clps-firefly-cp21.webp` | Blue Ghost Mission 3 (CP-21) | NASA / Firefly Aerospace |
| `clps-blueorigin-cp22.webp` | Blue Moon Mark 1 ("Endurance") | NASA / Blue Origin |
| `clps-im1-odysseus.webp`, `clps-firefly-bgm1.webp`, `clps-draper-cp12.webp`, `clps-firefly-bgm2.webp`, `historic-slim.webp` | IM-1, Blue Ghost 1, Draper CP-12, Blue Ghost 2, SLIM | Space.com |
| `clps-peregrine-pm1.webp`, `historic-change-6.webp` | Peregrine Mission One, Chang'e 6 | Wikipedia |
| `historic-chandrayaan-3.webp` | Chandrayaan-3 | NASA / Chandrayaan-3 (ISRO) |
| `historic-apollo-12.webp`, `-14.webp`, `-15.webp`, `-16.webp`, `-17.webp` | Apollo 12, 14, 15, 16, 17 | NASA (Alan Bean, Alan Shepard, James Irwin, Charles Duke, Gene Cernan) |
| `historic-apollo-11.webp` | Apollo 11 | Getty Images |
| `historic-apollo-13.webp`, `home.webp` | Apollo 13 & Mission Library Hero | Bundled mission gallery assets ([`missionImageCache.js`](src/utils/missionImageCache.js)) |
