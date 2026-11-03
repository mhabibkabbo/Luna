Tiles: {base}/v1/{level}/{x}/{y}.bin.gz   little-endian int16, 256x256, row-major, gzip
Height (m) = value * 0.5 ; nodata = -32768 ; heights relative to the 1737400 m sphere
Level L pixel size = baseRes * 2^L ; levels 0..3 ; downsample with MAX of each block
meta.json: { version, radiusM, tileSize, heightScale, originX, originY (meters, top-left),
             levels:[{level,resM,cols,rows}], projection:"polar-stereographic-south" }
Projection (sphere, true at pole): rho = 2R*tan(pi/4 + lat/2); x = rho*sin(lon); y = rho*cos(lon)
Pixel: col = (x - originX)/resM ; row = (originY - y)/resM     (VERIFY with test_vectors.json)
Level by distance: <2.5 km L0, <10 km L1, <20 km L2, else L3
Horizon angle: atan2((R+h)cos(t) - (R+h0+hobs), (R+h) sin(t)), t = d/R ; max over distances per azimuth
Output: { horizon: Float32Array(360), dem, coverage, quality }   (off-raster/nodata = -90, never blocks)