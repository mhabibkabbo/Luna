# NASA LRO LOLA South Pole Topographic Preprocessing Pipeline

This directory contains the geospatial preprocessing tools for the **Lunar Orienteering / Paper Topographic Map** mode in Luna Studio.

---

## 1. Overview & Data Provenance

- **Product**: NASA PDS `LRO-L-LOLA-4-GDR-V1.0` (Lunar Orbiter Laser Altimeter Gridded Data Record)
- **Coverage**: 80.0°S to 90.0°S (Lunar South Polar Cap)
- **Projection**: South Polar Stereographic
  - `+proj=stere +lat_0=-90 +lon_0=0 +k=1 +a=1737400 +b=1737400 +units=m +no_defs`
- **Datum Reference**: IAU Lunar Sphere with radius $R_0 = 1,737,400.0\text{ m}$
- **Raster Dimensions**: $1520 \times 1520$ pixels
- **Resolution**: $400\text{ m/pixel}$ gridded sample of the $20\text{ m/pixel}$ base pyramid
- **Extent**: $[-304,000\text{ m}, -304,000\text{ m}]$ to $[+304,000\text{ m}, +304,000\text{ m}]$
- **Sample Format**: Signed 16-bit Little-Endian Integer (`int16`), Scaling Factor = $0.5\text{ m/DN}$, NoData = `-32768`

---

## 2. Generating Contours & Topographic Layers

### Method A: Built-in Node.js Pipeline (Zero External GIS Dependencies)

Run the automated Node.js preprocessing script:

```bash
node scripts/generate_lola_contours.js
```

**Operations Performed:**
1. Decodes raw binary int16 into elevations relative to $1,737,400\text{ m}$.
2. Applies a Gaussian spatial filter ($\sigma \approx 1.0\text{ px}$) to suppress high-frequency altimeter shot noise while preserving crater rims.
3. Computes the 2D slope field via Horn's gradient operator to identify slope-hazard zones ($\ge 15.0^\circ$).
4. Emits `public/data/topo/topo_manifest.json`, `planned_traverses.geojson`, and `ridges_and_rims.geojson`.

---

### Method B: Standard Production GIS Pipeline (GDAL / QGIS)

For offline cartographic production using GDAL:

```bash
# 1. Create a GDAL Virtual Raster header for the raw binary DEM
gdal_translate \
  -of VRT \
  -ot Int16 \
  -unscale \
  -scale 0 1 0 0.5 \
  -a_srs "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +a=1737400 +b=1737400 +units=m" \
  -a_ullr -304000 304000 304000 -304000 \
  public/data/lola_sp_80s_int16.bin \
  public/data/topo/lola_dem.vrt

# 2. Extract 500m index and intermediate contours
gdal_contour \
  -a elev_m \
  -i 100 \
  -snodata -32768 \
  public/data/topo/lola_dem.vrt \
  public/data/topo/lola_contours_100m.shp

# 3. Compute Slope Hazard Grid (threshold >= 15 degrees)
gdaldem slope \
  public/data/topo/lola_dem.vrt \
  public/data/topo/lola_slope.tif \
  -s 1.0

# 4. Filter slope hazards >= 15 degrees
gdal_calc.py \
  -A public/data/topo/lola_slope.tif \
  --calc="A >= 15" \
  --outfile=public/data/topo/lola_hazard_15deg.tif \
  --NoDataValue=0
```

---

## 3. Cartographic Output Structure

Generated files are placed in `public/data/topo/`:
- `topo_manifest.json`: Complete mathematical parameters, bounding extents, and elevation statistics.
- `contours_500m.geojson`: Decoded 500 m elevation contours (Index: 2,500 m) for zoom levels 0–1.
- `contours_200m.geojson`: Decoded 200 m elevation contours (Index: 1,000 m) for zoom level 2.
- `contours_100m.geojson`: Decoded 100 m elevation contours (Index: 500 m) for zoom level 3.
- `slope_hazard_15deg.geojson`: Vector boundary polygons where slope gradient $\ge 15.0^\circ$.
- `planned_traverses.geojson`: Vector lines for candidate Artemis III & VIPER lunar surface traverses.
- `ridges_and_rims.geojson`: Crater rims (Shackleton, Haworth) and major topographic ridge lines derived from LOLA.
