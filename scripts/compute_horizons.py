#!/usr/bin/env python3
"""
Precompute terrain horizon profiles for lunar sites from NASA LRO/LOLA DEMs.

For each site, casts 360 rays (1 degree azimuth steps) across the DEM and records the
highest terrain elevation angle seen from the site, including the Moon's curvature.
The app compares the Sun's elevation against this profile.

Typical use (run from <repo>/scripts, after `node export_sites.mjs`):

  python compute_horizons.py \
      --sites sites.json \
      --dem LDEM_80S_20M.tif \
      --dem LDEM_64.tif \
      --overrides site_overrides.json \
      --out ../src/data/horizons.json --merge

  --dem can be repeated. List the best resolution first; for each site the first DEM that
  covers the whole 40 km neighbourhood is used, otherwise the best-covering one.
  --only id1,id2     recompute just those sites (combine with --merge)
  --overrides        JSON like {"some-site-id": {"lat": -89.9, "lon": 0.0}} to correct a
                     site's coordinates without touching the app data

Requires: pip install rasterio pyproj numpy
"""

import argparse
import json
import os
import sys

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import Window

R = 1_737_400.0              # Moon reference sphere radius (m), the datum LOLA heights use
OBSERVER_HEIGHT_M = 2.0      # mast height above the local terrain
N_AZ = 360                   # 1 degree steps
MAX_BLOCK_PIXELS = 150_000_000
FULL_COVERAGE = 0.98


def make_distances(max_dist_m):
    """Dense sampling near the observer (small obstacles), coarser far away."""
    near = np.arange(20.0, 2000.0, 20.0)
    far = np.arange(2000.0, max_dist_m + 1.0, 100.0)
    return np.concatenate([near, far])


def destination(lat, lon, az, dist):
    """Great-circle destination on a sphere. Radians in, radians out."""
    d = dist / R
    lat2 = np.arcsin(np.sin(lat) * np.cos(d) + np.cos(lat) * np.sin(d) * np.cos(az))
    lon2 = lon + np.arctan2(
        np.sin(az) * np.sin(d) * np.cos(lat),
        np.cos(d) - np.sin(lat) * np.sin(lat2),
    )
    return lat2, lon2


class Dem:
    def __init__(self, path):
        self.path = path
        self.name = os.path.basename(path)
        self.ds = rasterio.open(path)
        ds = self.ds
        self.crs = CRS.from_wkt(ds.crs.to_wkt())
        self.geographic = bool(ds.crs.is_geographic)
        self.to_xy = None
        if not self.geographic:
            self.to_xy = Transformer.from_crs(self.crs.geodetic_crs, self.crs, always_xy=True)
        self.scale = ds.scales[0] if ds.scales and ds.scales[0] else 1.0
        self.offset = ds.offsets[0] if ds.offsets and ds.offsets[0] else 0.0
        self.nodata = ds.nodata
        self.W, self.H = ds.width, ds.height
        self.left, self.top = ds.transform.c, ds.transform.f
        self.px, self.py = ds.transform.a, -ds.transform.e
        self.wrap = self.geographic and abs(self.W * self.px - 360.0) < 1.0
        self._warned_units = False
        print(
            f"[dem] {self.name}: {self.W}x{self.H}px, "
            f"{'geographic' if self.geographic else 'projected'}"
            f"{' (global, wraps in longitude)' if self.wrap else ''}, "
            f"scale={self.scale}, offset={self.offset}, nodata={self.nodata}"
        )

    def to_colrow(self, lon_deg, lat_deg, lon0_deg):
        """Fractional pixel coordinates. Geographic longitudes are unwrapped around lon0."""
        if self.geographic:
            x0 = ((lon0_deg - self.left) % 360.0) + self.left
            delta = ((lon_deg - lon0_deg + 180.0) % 360.0) - 180.0
            cols = (x0 + delta - self.left) / self.px
            rows = (self.top - lat_deg) / self.py
            return cols, rows
        xs, ys = self.to_xy.transform(lon_deg, lat_deg)
        cols, rows = ~self.ds.transform * (np.asarray(xs), np.asarray(ys))
        return cols, rows

    def read_block(self, c0, c1, r0, r1):
        if not self.wrap:
            return self.ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0)).astype(np.float32)
        parts, c = [], c0
        while c < c1:
            cm = c % self.W
            take = min(c1 - c, self.W - cm)
            parts.append(self.ds.read(1, window=Window(cm, r0, take, r1 - r0)))
            c += take
        return np.hstack(parts).astype(np.float32)

    def horizon(self, lat_deg, lon_deg, dists, scale=None, offset=None):
        """Returns {'profile', 'coverage', 'dem'} or None if this DEM can't serve the site."""
        scale = self.scale if scale is None else scale
        offset = self.offset if offset is None else offset

        lat0, lon0 = np.radians(lat_deg), np.radians(lon_deg)
        az = np.radians(np.arange(N_AZ))[:, None]
        d = dists[None, :]
        lat2, lon2 = destination(lat0, lon0, az, d)

        cols_f, rows_f = self.to_colrow(np.degrees(lon2), np.degrees(lat2), lon_deg)
        ocol_f, orow_f = self.to_colrow(np.array([lon_deg]), np.array([lat_deg]), lon_deg)
        cols = np.floor(cols_f).astype(np.int64)
        rows = np.floor(rows_f).astype(np.int64)
        ocol, orow = int(np.floor(ocol_f[0])), int(np.floor(orow_f[0]))

        if not (0 <= orow < self.H):
            return None
        if not self.wrap and not (0 <= ocol < self.W):
            return None

        row_ok = (rows >= 0) & (rows < self.H)
        col_ok = np.ones_like(row_ok) if self.wrap else ((cols >= 0) & (cols < self.W))
        ok = row_ok & col_ok
        coverage = float(ok.mean())
        if coverage == 0.0:
            return None

        c_all = np.concatenate([cols[ok], [ocol]])
        r_all = np.concatenate([rows[ok], [orow]])
        c0, c1 = int(c_all.min()), int(c_all.max()) + 1
        r0, r1 = int(r_all.min()), int(r_all.max()) + 1
        if (c1 - c0) * (r1 - r0) > MAX_BLOCK_PIXELS:
            print(f"      {self.name}: window too large for ({lat_deg}, {lon_deg}), skipping")
            return None

        raw = self.read_block(c0, c1, r0, r1)
        heights = raw.astype(np.float64) * scale + offset
        if self.nodata is not None:
            heights[raw == self.nodata] = np.nan

        if not self._warned_units and np.isfinite(heights).any():
            if np.nanmax(np.abs(heights)) > 30000:
                self._warned_units = True
                print(
                    f"      WARNING {self.name}: heights reach {np.nanmax(np.abs(heights)):.0f} m. "
                    "Values look like radii, not elevations. Re-run with --offset -1737400 "
                    "(or fix --scale).",
                    file=sys.stderr,
                )

        h0 = heights[orow - r0, ocol - c0]
        if np.isnan(h0):
            return None

        hs = np.full(cols.shape, np.nan, dtype=np.float64)
        hs[ok] = heights[rows[ok] - r0, cols[ok] - c0]

        theta = d / R
        ang = np.degrees(
            np.arctan2(
                (R + hs) * np.cos(theta) - (R + h0 + OBSERVER_HEIGHT_M),
                (R + hs) * np.sin(theta),
            )
        )
        ang[np.isnan(hs)] = -90.0  # off-raster or nodata never blocks
        profile = np.round(ang.max(axis=1), 1).tolist()
        return {"profile": profile, "coverage": coverage, "dem": self.name}


def best_profile(dems, lat, lon, dists, scale, offset):
    best = None
    for dem in dems:
        r = dem.horizon(lat, lon, dists, scale, offset)
        if r is None:
            continue
        if r["coverage"] >= FULL_COVERAGE:
            return r
        if best is None or r["coverage"] > best["coverage"]:
            best = r
    return best


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--sites", required=True, help="sites.json from export_sites.mjs")
    ap.add_argument("--dem", action="append", required=True, help="DEM GeoTIFF (repeatable, best first)")
    ap.add_argument("--overrides", help="JSON of coordinate corrections by site id")
    ap.add_argument("--out", default="../src/data/horizons.json")
    ap.add_argument("--merge", action="store_true", help="update the existing output instead of replacing it")
    ap.add_argument("--only", help="comma-separated site ids to (re)compute")
    ap.add_argument("--max-km", type=float, default=40.0)
    ap.add_argument("--scale", type=float, help="override DEM scale factor")
    ap.add_argument("--offset", type=float, help="override DEM offset")
    args = ap.parse_args()

    with open(args.sites) as f:
        sites = json.load(f)
    overrides = {}
    if args.overrides:
        with open(args.overrides) as f:
            overrides = json.load(f)
    only = set(args.only.split(",")) if args.only else None

    dems = [Dem(p) for p in args.dem]
    dists = make_distances(args.max_km * 1000.0)

    out = {}
    if args.merge and os.path.exists(args.out):
        with open(args.out) as f:
            out = json.load(f)

    cache = {}
    skipped, flagged = [], []

    for s in sites:
        sid = s["id"]
        if only and sid not in only:
            continue
        lat = overrides.get(sid, {}).get("lat", s["lat"])
        lon = overrides.get(sid, {}).get("lon", s["lon"])
        key = (round(lat, 4), round(lon, 4))
        if key not in cache:
            cache[key] = best_profile(dems, lat, lon, dists, args.scale, args.offset)
        res = cache[key]

        if res is None:
            skipped.append(sid)
            print(f"[skip]  {sid}: ({lat:.3f}, {lon:.3f}) is outside every DEM")
            continue

        profile = res["profile"]
        quality = "ok"
        if res["coverage"] < FULL_COVERAGE:
            quality = "partial"
        if min(profile) > 5.0:
            quality = "enclosed"  # horizon above 5 deg in every direction

        out[sid] = {
            "step_deg": 1,
            "maxDistKm": args.max_km,
            "horizon": profile,
            "dem": res["dem"],
            "coverage": round(res["coverage"], 3),
            "quality": quality,
        }
        tag = "" if quality == "ok" else f"  <-- {quality.upper()}"
        if quality != "ok":
            flagged.append((sid, quality))
        print(
            f"[ok]    {sid}: horizon {min(profile):+.1f}..{max(profile):+.1f} deg "
            f"({res['dem']}, coverage {res['coverage']:.0%}){tag}"
        )

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))

    print(f"\nWrote {len(out)} sites to {args.out}")
    if flagged:
        print("Check these:")
        for sid, q in flagged:
            if q == "enclosed":
                print(f"  {sid}: horizon > 5 deg everywhere. The coordinates probably sit inside a crater or pit.")
            else:
                print(f"  {sid}: DEM does not cover the full 40 km radius. Add a DEM that covers it.")
    if skipped:
        print(f"{len(skipped)} site(s) not covered by any DEM: {', '.join(skipped)}")


if __name__ == "__main__":
    main()
