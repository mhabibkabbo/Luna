#!/usr/bin/env python3
"""
Sanity-check the LOLA DEM files before running compute_horizons.py.

Save as  Luna/scripts/check_dems.py  and run from anywhere:
    python scripts/check_dems.py      (from Luna/)
    python check_dems.py              (from Luna/scripts/)

It looks for the DEMs in  Luna/scripts/dem/  (falls back to Luna/dem/), no matter where you start Python.
Requires: pip install rasterio numpy
"""

import sys
from pathlib import Path

import rasterio

HERE = Path(__file__).resolve().parent
DEM_DIR = next((d for d in (HERE / "dem", HERE.parent / "dem") if d.is_dir()), HERE / "dem")
FILES = [
    "LDEM_80S_20MPP_ADJ.TIF",
    "LDEM_75S_30MPP_ADJ.TIF",
    "LDEM_60S_60MPP_ADJ.TIF",
    "LDEM_128.tif",  # created from LDEM_128.LBL with gdal_translate (step 4); reported as missing until then
]
TARGET_PIXELS = 1000  # decimate so even a 2.7 GB file is checked in seconds


def verdict(lo, hi):
    biggest = max(abs(lo), abs(hi))
    if biggest > 1_000_000:
        return "LOOKS LIKE RADII (values near 1,737,400). Reconvert/offset by -1737400 before using."
    if biggest > 15_000:
        return "TOO LARGE for meters. Probably raw 0.5 m units: add -a_scale 0.5 (or fix the file's scale tag)."
    return "OK: plausible heights in meters."


def main():
    print("DEM folder:", DEM_DIR)
    if not DEM_DIR.is_dir():
        print("Folder not found. Expected Luna/scripts/dem (or Luna/dem).")
        sys.exit(1)
    found = sorted(p.name for p in DEM_DIR.iterdir())
    print("Files found:", ", ".join(found) if found else "(none)")

    for name in FILES:
        path = DEM_DIR / name
        print("\n" + "=" * 70)
        if not path.exists():
            print(f"[missing] {name}")
            continue
        with rasterio.open(path) as ds:
            step = max(1, max(ds.height, ds.width) // TARGET_PIXELS)
            shape = (max(1, ds.height // step), max(1, ds.width // step))
            data = ds.read(1, masked=True, out_shape=shape)
            scale = ds.scales[0] if ds.scales and ds.scales[0] else 1.0
            offset = ds.offsets[0] if ds.offsets and ds.offsets[0] else 0.0
            lo = float(data.min()) * scale + offset
            hi = float(data.max()) * scale + offset
            kind = "geographic" if ds.crs and ds.crs.is_geographic else "projected"
            print(f"{name}")
            print(f"  size       : {ds.width} x {ds.height} px, dtype {ds.dtypes[0]}, pixel size {ds.res}")
            print(f"  CRS        : {kind if ds.crs else 'NONE (compute_horizons.py will fail)'}")
            print(f"  scale/off  : {ds.scales[0]} / {ds.offsets[0]}   nodata: {ds.nodata}")
            print(f"  height m   : {lo:,.0f} .. {hi:,.0f}  (sampled at 1/{step} resolution)")
            print(f"  verdict    : {verdict(lo, hi)}")


if __name__ == "__main__":
    main()