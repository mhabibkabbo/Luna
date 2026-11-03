/**
 * @file moonTextures.js
 * Loads high-resolution NASA Lunar Reconnaissance Orbiter (LRO) photographic basemaps
 * and LOLA topographic bump maps with maximum anisotropic filtering.
 */

import * as THREE from 'three';

// High-resolution NASA LRO photographic texture endpoints with reliable CDN mirrors
const NASA_LUNAR_COLOR_URLS = [
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/lunar_surface.jpg',
  'https://unpkg.com/three-globe@2.31.0/example/img/lunar_surface.jpg',
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/moon_1024.jpg',
];

const NASA_LUNAR_BUMP_URLS = [
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/lunar_bump.jpg',
  'https://unpkg.com/three-globe@2.31.0/example/img/lunar_bump.jpg',
];

/**
 * Creates an ultra-detailed procedural fallback canvas with crisp crater rings and volcanic maria.
 * @returns {HTMLCanvasElement}
 */
export function createHighDefFallbackLunarCanvas(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Fill base highland grey
  ctx.fillStyle = '#787d87';
  ctx.fillRect(0, 0, width, height);

  // Regolith grain noise
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  const toXY = (lon, lat) => ({
    x: ((lon + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  });

  // Draw Maria Basalt Plains (Nearside)
  const mariaPlains = [
    { lon: -17, lat: 33, rx: 170, ry: 120 }, // Imbrium
    { lon: -56, lat: 18, rx: 240, ry: 190 }, // Oceanus Procellarum
    { lon: 18, lat: 28, rx: 130, ry: 100 }, // Serenitatis
    { lon: 31, lat: 12, rx: 120, ry: 90 },  // Tranquillitatis
    { lon: 59, lat: 17, rx: 90, ry: 70 },   // Crisium
    { lon: 35, lat: -19, rx: 110, ry: 80 }, // Fecunditatis
    { lon: 20, lat: -13, rx: 100, ry: 75 }, // Nectaris
    { lon: -20, lat: -15, rx: 130, ry: 90 }, // Nubium
    { lon: -38, lat: -25, rx: 90, ry: 70 },  // Humorum
    { lon: -92, lat: -19, rx: 100, ry: 70 }, // Orientale
  ];

  mariaPlains.forEach(({ lon, lat, rx, ry }) => {
    const { x, y } = toXY(lon, lat);
    const grad = ctx.createRadialGradient(x, y, 4, x, y, Math.max(rx, ry));
    grad.addColorStop(0, 'rgba(24, 28, 34, 0.95)');
    grad.addColorStop(0.65, 'rgba(38, 44, 52, 0.85)');
    grad.addColorStop(0.9, 'rgba(65, 72, 82, 0.4)');
    grad.addColorStop(1, 'rgba(120, 125, 135, 0)');

    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Draw prominent impact craters with bright ray ejecta
  const majorCraters = [
    { lon: -11.36, lat: -43.31, r: 18, rayLen: 240 }, // Tycho
    { lon: -20.08, lat: 9.62, r: 20, rayLen: 180 },   // Copernicus
    { lon: -47.49, lat: 23.73, r: 12, rayLen: 120 },  // Aristarchus
    { lon: -5.13, lat: 40.73, r: 16, rayLen: 90 },    // Plato
    { lon: 0, lat: -90, r: 14, rayLen: 80 },          // South Pole / Shackleton
  ];

  majorCraters.forEach(({ lon, lat, r, rayLen }) => {
    const { x, y } = toXY(lon, lat);

    // Ejecta rays
    if (rayLen > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 247, 250, 0.25)';
      ctx.lineWidth = 1.2;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle) * (rayLen * (0.6 + Math.random() * 0.4)), y + Math.sin(angle) * (rayLen * (0.6 + Math.random() * 0.4)));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Crater Rim
    ctx.save();
    ctx.fillStyle = 'rgba(15, 20, 26, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(241, 245, 249, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  });

  return canvas;
}

/**
 * Loads a texture from an array of URL mirrors with fallback.
 */
function loadTextureWithFallbacks(urls, maxAnisotropy = 16) {
  return new Promise((resolve) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    let currentIdx = 0;

    function tryNext() {
      if (currentIdx >= urls.length) {
        resolve(null);
        return;
      }

      const url = urls[currentIdx++];
      textureLoader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = true;
          tex.anisotropy = maxAnisotropy;
          tex.needsUpdate = true;
          resolve(tex);
        },
        undefined,
        () => {
          tryNext();
        }
      );
    }

    tryNext();
  });
}

/**
 * Loads high-resolution NASA Lunar Reconnaissance Orbiter (LRO) photographic surface map
 * and LOLA topographic elevation bump map.
 * 
 * @param {number} maxAnisotropy
 * @returns {Promise<{ surfaceMap: THREE.Texture, bumpMap: THREE.Texture }>}
 */
export async function loadHighResLunarTextures(maxAnisotropy = 16) {
  // 1. Create immediate high-DPI canvas texture
  const fallbackCanvas = createHighDefFallbackLunarCanvas(2048, 1024);
  const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas);
  fallbackTexture.colorSpace = THREE.SRGBColorSpace;
  fallbackTexture.minFilter = THREE.LinearMipmapLinearFilter;
  fallbackTexture.magFilter = THREE.LinearFilter;
  fallbackTexture.anisotropy = maxAnisotropy;
  fallbackTexture.needsUpdate = true;

  // 2. Load photographic NASA LRO map and LOLA bump map in parallel
  const [nasaSurface, nasaBump] = await Promise.all([
    loadTextureWithFallbacks(NASA_LUNAR_COLOR_URLS, maxAnisotropy),
    loadTextureWithFallbacks(NASA_LUNAR_BUMP_URLS, maxAnisotropy),
  ]);

  return {
    surfaceMap: nasaSurface || fallbackTexture,
    bumpMap: nasaBump,
  };
}
