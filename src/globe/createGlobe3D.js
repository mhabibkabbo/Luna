/**
 * @file createGlobe3D.js
 * High-performance, interactive Three.js 3D Lunar Globe controller.
 * Renders an authentic 3D Moon sphere with NASA photographic textures, dynamic solar lighting,
 * compact elegant 3D pin glyphs for Mountains, Maria, and Valleys, and interactive camera navigation.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadHighResLunarTextures, createHighDefFallbackLunarCanvas } from './moonTextures.js';
import { LUNAR_FEATURES } from '../data/lunarFeatures.js';

const MOON_RADIUS = 5.0;
const BASE_PIN_SCALE = 0.28;
const HOVER_PIN_SCALE = 0.38;

/**
 * Converts selenographic coordinates (longitude, latitude in degrees)
 * to 3D Cartesian coordinates (x, y, z) on a sphere of given radius.
 * Longitude: -180 to +180, Latitude: -90 to +90.
 */
export function selenographicToCartesian(longitude, latitude, radius = MOON_RADIUS) {
  const phi = (latitude * Math.PI) / 180;
  const theta = ((longitude + 90) * Math.PI) / 180;

  const x = radius * Math.cos(phi) * Math.sin(theta);
  const y = radius * Math.sin(phi);
  const z = radius * Math.cos(phi) * Math.cos(theta);

  return new THREE.Vector3(x, y, z);
}

/**
 * Converts 3D point on unit sphere to selenographic coordinates (longitude, latitude).
 */
export function cartesianToSelenographic(vector3) {
  const normalized = vector3.clone().normalize();
  const latitude = Math.asin(normalized.y) * (180 / Math.PI);
  const theta = Math.atan2(normalized.x, normalized.z);
  let longitude = (theta * (180 / Math.PI)) - 90;
  if (longitude < -180) longitude += 360;
  if (longitude > 180) longitude -= 360;

  return { longitude, latitude };
}

/**
 * Creates a compact, high-DPI circular 3D billboard sprite pin.
 */
function createCompactPinSprite(feature, glyph, colorHex, bgColor, borderColor) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const center = size / 2;
  const radius = size * 0.40;

  // Outer glow shadow
  ctx.save();
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 10;

  // Circle background
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = bgColor || 'rgba(15, 23, 42, 0.92)';
  ctx.fill();
  ctx.restore();

  // Crisp border
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = borderColor || colorHex;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Glyph symbol in center
  ctx.fillStyle = colorHex;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, center, center + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(BASE_PIN_SCALE, BASE_PIN_SCALE, 1);
  return sprite;
}

/**
 * Initializes the 3D Three.js Lunar Globe in a container element.
 * 
 * @param {HTMLElement} container
 * @param {Object} callbacks
 * @param {Function} [callbacks.onPointerCoordinates]
 * @param {Function} [callbacks.onFeatureSelect]
 * @param {Function} [callbacks.onFeatureHover]
 * @returns {Object} Globe Controller API
 */
export function createLunarGlobe3D(container, callbacks = {}) {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050811);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 2, 14);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  controls.minDistance = 6.0;
  controls.maxDistance = 28.0;
  controls.enablePan = false;

  // Starfield background
  const starsGeometry = new THREE.BufferGeometry();
  const starCount = 800;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i += 3) {
    const r = 80 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i + 2] = r * Math.cos(phi);
  }
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.8, transparent: true, opacity: 0.6 });
  const starField = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(starField);

  // Ambient & Sun Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
  sunLight.position.set(20, 8, 16);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
  fillLight.position.set(-15, -10, -10);
  scene.add(fillLight);

  // Moon Sphere Geometry & Material
  const moonGeometry = new THREE.SphereGeometry(MOON_RADIUS, 128, 128);
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  // Create immediate high-DPI canvas texture
  const initialCanvas = createHighDefFallbackLunarCanvas(2048, 1024);
  const initialTexture = new THREE.CanvasTexture(initialCanvas);
  initialTexture.colorSpace = THREE.SRGBColorSpace;
  initialTexture.minFilter = THREE.LinearMipmapLinearFilter;
  initialTexture.magFilter = THREE.LinearFilter;
  initialTexture.anisotropy = maxAnisotropy;
  initialTexture.needsUpdate = true;

  const moonMaterial = new THREE.MeshStandardMaterial({
    map: initialTexture,
    roughness: 0.90,
    metalness: 0.02,
    bumpScale: 0.08,
  });

  const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
  scene.add(moonMesh);

  // Load NASA Photographic high-res map and LOLA bump map
  loadHighResLunarTextures(maxAnisotropy).then(({ surfaceMap, bumpMap }) => {
    if (surfaceMap) {
      moonMaterial.map = surfaceMap;
    }
    if (bumpMap) {
      moonMaterial.bumpMap = bumpMap;
      moonMaterial.bumpScale = 0.08;
    }
    moonMaterial.needsUpdate = true;
  });

  // South Pole Ring/Highlight marker
  const southPolePos = selenographicToCartesian(0, -90, MOON_RADIUS * 1.01);
  const poleRingGeo = new THREE.RingGeometry(0.08, 0.22, 32);
  const poleRingMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const poleRing = new THREE.Mesh(poleRingGeo, poleRingMat);
  poleRing.position.copy(southPolePos);
  poleRing.rotation.x = Math.PI / 2;
  scene.add(poleRing);

  // South Pole Pin Sprite
  const southPoleFeature = {
    id: 'south-pole',
    name: 'Lunar South Pole (90°S)',
    type: 'south_pole',
    latitude: -90,
    longitude: 0,
    description: 'Permanently shadowed craters (PSRs) harboring volatile water ice deposits. Prime exploration zone for NASA Artemis and CLPS landers.',
  };
  const southPoleSprite = createCompactPinSprite(southPoleFeature, '🎯', '#06b6d4', 'rgba(8, 51, 68, 0.95)', '#22d3ee');
  southPoleSprite.position.copy(selenographicToCartesian(0, -90, MOON_RADIUS * 1.03));
  southPoleSprite.userData = { feature: southPoleFeature, category: 'south_pole', isPin: true };
  scene.add(southPoleSprite);

  // Marker Groups for interactive 3D Pins
  const pinsGroup = new THREE.Group();
  scene.add(pinsGroup);

  const featureSprites = [southPoleSprite];

  // Filter features to user-specified: Mountains, Maria, Valleys & Rilles
  const activeFeatures = LUNAR_FEATURES.filter(
    (f) => f.type === 'mountain' || f.type === 'mare' || f.type === 'valley' || f.type === 'rille'
  );

  activeFeatures.forEach((feat) => {
    let glyph = '▲';
    let color = '#fbbf24';
    let bgColor = 'rgba(69, 26, 3, 0.92)';
    let borderColor = '#f59e0b';
    let category = 'lunar-mountains';

    if (feat.type === 'mare') {
      glyph = '🌊';
      color = '#38bdf8';
      bgColor = 'rgba(8, 47, 73, 0.92)';
      borderColor = '#0ea5e9';
      category = 'lunar-maria';
    } else if (feat.type === 'valley' || feat.type === 'rille') {
      glyph = '◆';
      color = '#c084fc';
      bgColor = 'rgba(59, 7, 100, 0.92)';
      borderColor = '#a855f7';
      category = 'lunar-valleys';
    }

    const sprite = createCompactPinSprite(feat, glyph, color, bgColor, borderColor);
    const pos = selenographicToCartesian(feat.longitude, feat.latitude, MOON_RADIUS * 1.03);
    sprite.position.copy(pos);
    sprite.userData = { feature: feat, category, isPin: true };
    pinsGroup.add(sprite);
    featureSprites.push(sprite);
  });

  // Raycaster for mouse interaction
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let hoveredSprite = null;

  // Animation camera target tracking
  let isAnimatingCamera = false;
  let targetCameraPos = new THREE.Vector3();
  let targetLookAt = new THREE.Vector3(0, 0, 0);
  let animationStart = 0;
  let animationDuration = 1000;
  let startCameraPos = new THREE.Vector3();
  let startLookAt = new THREE.Vector3();

  // Pointer move handler (tracking coordinates & hover)
  const onPointerMove = (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(moonMesh);

    if (intersects.length > 0) {
      const hitPoint = intersects[0].point;
      const { longitude, latitude } = cartesianToSelenographic(hitPoint);
      if (callbacks.onPointerCoordinates) {
        callbacks.onPointerCoordinates(longitude, latitude);
      }
    }

    // Pin hover detection & subtle scale-up
    const activeSprites = featureSprites.filter((s) => s.visible && s.material.opacity > 0.3);
    const pinHits = raycaster.intersectObjects(activeSprites);

    if (pinHits.length > 0) {
      const hit = pinHits[0].object;
      renderer.domElement.style.cursor = 'pointer';

      if (hoveredSprite !== hit) {
        if (hoveredSprite) {
          hoveredSprite.scale.set(BASE_PIN_SCALE, BASE_PIN_SCALE, 1);
        }
        hoveredSprite = hit;
        hoveredSprite.scale.set(HOVER_PIN_SCALE, HOVER_PIN_SCALE, 1);
      }

      if (callbacks.onFeatureHover) {
        callbacks.onFeatureHover(hit.userData.feature, e.clientX, e.clientY);
      }
    } else {
      renderer.domElement.style.cursor = 'grab';
      if (hoveredSprite) {
        hoveredSprite.scale.set(BASE_PIN_SCALE, BASE_PIN_SCALE, 1);
        hoveredSprite = null;
      }
      if (callbacks.onFeatureHover) {
        callbacks.onFeatureHover(null, 0, 0);
      }
    }
  };

  const onPointerLeave = () => {
    if (hoveredSprite) {
      hoveredSprite.scale.set(BASE_PIN_SCALE, BASE_PIN_SCALE, 1);
      hoveredSprite = null;
    }
    if (callbacks.onFeatureHover) {
      callbacks.onFeatureHover(null, 0, 0);
    }
  };

  // Click handler (feature selection)
  const onClick = (e) => {
    if (isAnimatingCamera) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const activeSprites = featureSprites.filter((s) => s.visible && s.material.opacity > 0.3);
    const pinHits = raycaster.intersectObjects(activeSprites);

    if (pinHits.length > 0) {
      const selected = pinHits[0].object.userData.feature;
      if (selected && callbacks.onFeatureSelect) {
        callbacks.onFeatureSelect(selected);
        flyToCoordinate(selected.longitude, selected.latitude, 9.0);
      }
    }
  };

  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('click', onClick);

  // Resize handler
  const handleResize = () => {
    if (!container) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', handleResize);

  /**
   * Smoothly animates the camera to a given selenographic coordinate.
   */
  const flyToCoordinate = (lon, lat, distance = 9.5, duration = 1200) => {
    const targetSurface = selenographicToCartesian(lon, lat, MOON_RADIUS);
    const targetCam = selenographicToCartesian(lon, lat, distance);

    startCameraPos.copy(camera.position);
    startLookAt.copy(controls.target);

    targetCameraPos.copy(targetCam);
    targetLookAt.copy(targetSurface.clone().multiplyScalar(0.2));

    animationStart = performance.now();
    animationDuration = duration;
    isAnimatingCamera = true;
    controls.enabled = false;
  };

  /**
   * Flies camera directly to South Pole (90°S).
   */
  const flyToSouthPole = () => {
    flyToCoordinate(0, -90, 8.8, 1400);
  };

  /**
   * Resets camera to standard overview.
   */
  const resetOverview = () => {
    flyToCoordinate(0, 0, 14.0, 1000);
  };

  /**
   * Layer visibility toggling for 3D pins.
   */
  const setLayerVisibility = (layerId, isVisible) => {
    featureSprites.forEach((sprite) => {
      if (sprite.userData.category === layerId) {
        sprite.visible = isVisible;
      }
    });
  };

  // Auto rotation state
  let autoRotate = false;

  // Main Render Animation Loop
  let reqId;
  const animate = (time) => {
    reqId = requestAnimationFrame(animate);

    if (isAnimatingCamera) {
      const elapsed = time - animationStart;
      const progress = Math.min(1.0, elapsed / animationDuration);
      const t = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startCameraPos, targetCameraPos, t);
      controls.target.lerpVectors(startLookAt, targetLookAt, t);

      if (progress >= 1.0) {
        isAnimatingCamera = false;
        controls.enabled = true;
      }
    } else if (autoRotate) {
      moonMesh.rotation.y += 0.0012;
      pinsGroup.rotation.y += 0.0012;
    }

    // Horizon Culling: fade pins on the back side of the Moon
    const camPos = camera.position;
    featureSprites.forEach((sprite) => {
      const pinWorldPos = sprite.position.clone();
      const dot = pinWorldPos.dot(camPos);
      if (dot < 0.5) {
        sprite.material.opacity = Math.max(0, (dot + 0.2) / 0.7);
      } else {
        sprite.material.opacity = 1.0;
      }
    });

    controls.update();
    renderer.render(scene, camera);
  };

  reqId = requestAnimationFrame(animate);

  // Destruction / cleanup
  const destroy = () => {
    cancelAnimationFrame(reqId);
    window.removeEventListener('resize', handleResize);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    renderer.domElement.removeEventListener('click', onClick);
    controls.dispose();
    moonGeometry.dispose();
    moonMaterial.dispose();
    starsGeometry.dispose();
    starsMaterial.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };

  return {
    flyToCoordinate,
    flyToSouthPole,
    resetOverview,
    setLayerVisibility,
    zoomIn: () => {
      camera.position.multiplyScalar(0.85);
    },
    zoomOut: () => {
      camera.position.multiplyScalar(1.15);
    },
    toggleAutoRotate: () => {
      autoRotate = !autoRotate;
      return autoRotate;
    },
    setSunLighting: (mode) => {
      if (mode === 'overhead') {
        sunLight.position.set(0, 0, 20);
        ambientLight.intensity = 0.7;
      } else if (mode === 'polar') {
        sunLight.position.set(0, -10, 20);
        ambientLight.intensity = 0.35;
      } else {
        sunLight.position.set(20, 8, 16);
        ambientLight.intensity = 0.45;
      }
    },
    destroy,
  };
}
