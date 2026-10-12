import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { ArrowRight, Compass, Orbit, Sparkles } from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

// Reliable CDN mirrors for NASA LRO photographic color and LOLA topographic bump maps
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
 * Creates high-precision procedural lunar basemap canvas.
 * Draws volcanic basaltic maria, major crater ray systems, and regolith noise.
 * Ensures the Moon renders instantly with authentic scientific surface features
 * even while high-res textures are loading or offline.
 */
function createScientificLunarCanvas(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Highland anorthosite base (lunar grey)
  ctx.fillStyle = '#676d79';
  ctx.fillRect(0, 0, width, height);

  // 2. Regolith grain noise
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 36;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  const toXY = (lon, lat) => ({
    x: ((lon + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  });

  // 3. Basaltic volcanic maria (nearside plains)
  const maria = [
    { lon: -17, lat: 33, rx: 90, ry: 65 },  // Imbrium
    { lon: -56, lat: 18, rx: 130, ry: 95 }, // Oceanus Procellarum
    { lon: 18, lat: 28, rx: 70, ry: 50 },  // Serenitatis
    { lon: 31, lat: 12, rx: 65, ry: 45 },  // Tranquillitatis
    { lon: 59, lat: 17, rx: 50, ry: 40 },  // Crisium
    { lon: 35, lat: -19, rx: 60, ry: 45 }, // Fecunditatis
    { lon: 20, lat: -13, rx: 55, ry: 40 }, // Nectaris
    { lon: -20, lat: -15, rx: 70, ry: 50 }, // Nubium
    { lon: -38, lat: -25, rx: 50, ry: 38 }, // Humorum
    { lon: 0, lat: -70, rx: 80, ry: 40 },  // South Pole-Aitken edge
  ];

  maria.forEach(({ lon, lat, rx, ry }) => {
    const { x, y } = toXY(lon, lat);
    const grad = ctx.createRadialGradient(x, y, 2, x, y, Math.max(rx, ry));
    grad.addColorStop(0, 'rgba(28, 32, 40, 0.94)');
    grad.addColorStop(0.65, 'rgba(42, 48, 58, 0.85)');
    grad.addColorStop(0.9, 'rgba(70, 78, 90, 0.35)');
    grad.addColorStop(1, 'rgba(103, 109, 121, 0)');

    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 4. Prominent impact crater ray systems (Tycho, Copernicus, Kepler, Aristarchus)
  const craters = [
    { lon: -11.36, lat: -43.31, r: 10, rays: true, rayLen: 160 }, // Tycho (distinctive south rays)
    { lon: -20.08, lat: 9.62, r: 11, rays: true, rayLen: 110 },   // Copernicus
    { lon: -47.49, lat: 23.73, r: 7, rays: true, rayLen: 70 },    // Aristarchus
    { lon: -38.01, lat: 8.12, r: 6, rays: false },                // Kepler
    { lon: -9.38, lat: 51.62, r: 9, rays: false },                // Plato (dark flooded floor)
    { lon: 0.0, lat: -89.4, r: 6, rays: false },                  // Shackleton / South Pole
  ];

  craters.forEach(({ lon, lat, r, rays, rayLen }) => {
    const { x, y } = toXY(lon, lat);

    if (rays && rayLen) {
      ctx.save();
      ctx.strokeStyle = 'rgba(235, 240, 248, 0.22)';
      ctx.lineWidth = 1.0;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        const len = rayLen * (0.65 + Math.random() * 0.35);
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Crater Rim
    ctx.save();
    ctx.fillStyle = 'rgba(18, 22, 28, 0.95)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(230, 235, 245, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  });

  return canvas;
}

/**
 * Converts selenographic spherical coordinates to 3D Cartesian vectors
 * according to IAU lunar orientation standards.
 * @param {number} lat - Selenographic latitude in degrees (-90 to +90)
 * @param {number} lon - Selenographic longitude in degrees (-180 to +180)
 * @param {number} radius - Sphere radius
 * @returns {THREE.Vector3}
 */
function selenographicToVector3(lat, lon, radius = 1.0) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

/**
 * Premium Realistic 3D Lunar Globe for LUNA Landing Hero.
 * Features:
 * - Three.js 3D sphere with crater relief and LOLA bump mapping
 * - Realistic grazing solar terminator directional lighting
 * - Subtle Earthshine backfill on night limb
 * - Delicate Lunar South Pole 80°-90°S target highlight
 * - Sparse, low-contrast orbital arcs (LRO 50 km polar orbit & CLPS transfer ellipse)
 * - Verified NASA CLPS mission markers with interactive annotations
 * - Restrained astronomical starfield & exosphere limb depth
 * - Full reduced-motion and touch accessibility support
 */
export default function RealisticMoon({ onLaunchExplorer }) {
  const mountRef = useRef(null);
  const [activePin, setActivePin] = useState(null);
  const [pinScreenCoords, setPinScreenCoords] = useState([]);
  const [isRotating, setIsRotating] = useState(true);
  const [subsolarCoordinates, setSubsolarCoordinates] = useState('0.0° N, 0.0° E');

  // Verified Missions Catalog for 3D Globe Pins
  const verifiedPins = useMemo(
    () => [
      {
        id: 'clps-im1-odysseus',
        name: 'IM-1 Odysseus',
        taskOrder: 'TO 2-IM',
        provider: 'Intuitive Machines',
        lat: -80.13,
        lon: 1.44,
        siteName: 'Malapert A Rim',
        region: 'Lunar South Pole',
        status: 'Completed soft landing',
        color: 0x22d3ee,
        payloadCount: 7,
      },
      {
        id: 'clps-firefly-blueghost1',
        name: 'Blue Ghost 1',
        taskOrder: 'TO 19D',
        provider: 'Firefly Aerospace',
        lat: 18.56,
        lon: 61.81,
        siteName: 'Mare Crisium Basin',
        region: 'Eastern Nearside',
        status: 'Planned landing window',
        color: 0x38bdf8,
        payloadCount: 10,
      },
      {
        id: 'clps-im2-prime1',
        name: 'IM-2 PRIME-1',
        taskOrder: 'TO PRIME-1',
        provider: 'Intuitive Machines',
        lat: -89.4,
        lon: 0.0,
        siteName: 'Shackleton Ridge',
        region: 'Lunar South Pole',
        status: 'Polar volatile ice drill',
        color: 0x22d3ee,
        payloadCount: 3,
      },
      {
        id: 'apollo-11',
        name: 'Apollo 11',
        taskOrder: 'NASA Historic',
        provider: 'NASA Apollo Program',
        lat: 0.67,
        lon: 23.47,
        siteName: 'Tranquility Base',
        region: 'Mare Tranquillitatis',
        status: 'Historic crewed soft landing (1969)',
        color: 0xf59e0b,
        payloadCount: 2,
        isApollo: true,
      },
      {
        id: 'clps-astrobotic-griffin1',
        name: 'Griffin Mission 1',
        taskOrder: 'TO 20A',
        provider: 'Astrobotic',
        lat: -84.5,
        lon: 31.7,
        siteName: 'Mons Mouton Plateau',
        region: 'Lunar South Pole',
        status: 'Medium-class polar lander',
        color: 0x38bdf8,
        payloadCount: 4,
      },
    ],
    []
  );

  const handleLaunchToPin = (pin) => {
    const mission = CLPS_MISSIONS.find((m) => m.id === pin.id);
    if (mission) {
      onLaunchExplorer({
        selectedMission: mission,
        missionId: mission.id,
        lon: mission.longitude,
        lat: mission.latitude,
        zoom: 5.2,
      });
    } else {
      onLaunchExplorer({
        lon: pin.lon,
        lat: pin.lat,
        zoom: pin.isApollo ? 4.5 : 5.0,
      });
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsRotating(false);
    }

    const width = container.clientWidth || 480;
    const height = container.clientHeight || 480;
    const isMobile = width < 480;

    // 1. Scene & Camera (calibrated so Moon sphere and orbital arcs float fully within frustum with no clipping)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.35);

    // 2. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    // 3. Crisp Astronomical Starfield (750 multi-depth points with spectral tints)
    const starCount = 750;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      // Distribute widely in background with natural depth
      const spreadX = (Math.random() - 0.5) * 24;
      const spreadY = (Math.random() - 0.5) * 24;
      const spreadZ = -3.5 - Math.random() * 12;

      starPositions[i] = spreadX;
      starPositions[i + 1] = spreadY;
      starPositions[i + 2] = spreadZ;

      // Realistic stellar spectral temperatures (blue-white, white, warm amber)
      const spectral = Math.random();
      if (spectral > 0.85) {
        starColors[i] = 0.75; starColors[i + 1] = 0.88; starColors[i + 2] = 1.0; // Class B/A (cool blue)
      } else if (spectral < 0.12) {
        starColors[i] = 1.0; starColors[i + 1] = 0.92; starColors[i + 2] = 0.72; // Class K/G (warm amber)
      } else {
        starColors[i] = 0.96; starColors[i + 1] = 0.97; starColors[i + 2] = 1.0; // Class F (crisp white)
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.032,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
    });
    const starPoints = new THREE.Points(starGeometry, starMaterial);
    scene.add(starPoints);

    // 4. Moon Group (contains sphere, markers, South Pole ring, orbital arcs)
    const moonGroup = new THREE.Group();
    moonGroup.rotation.x = 0.12; // Slight polar tilt toward camera to emphasize South Pole
    moonGroup.rotation.y = 0.35; // Default orientation showcasing nearside maria
    scene.add(moonGroup);

    // 5. Lunar Sphere Mesh with Crater Geometry & Bump Relief
    const sphereSegments = isMobile ? 48 : 64;
    const sphereGeometry = new THREE.SphereGeometry(1.0, sphereSegments, sphereSegments);

    const proceduralCanvas = createScientificLunarCanvas(1024, 512);
    const proceduralTexture = new THREE.CanvasTexture(proceduralCanvas);
    proceduralTexture.colorSpace = THREE.SRGBColorSpace;
    proceduralTexture.minFilter = THREE.LinearMipmapLinearFilter;

    const moonMaterial = new THREE.MeshStandardMaterial({
      map: proceduralTexture,
      roughness: 0.94,
      metalness: 0.02,
    });

    const moonMesh = new THREE.Mesh(sphereGeometry, moonMaterial);
    moonGroup.add(moonMesh);

    // Load NASA LRO high-res photographic basemap with fallback cascade
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const tryLoadTexture = (urls, callback) => {
      let idx = 0;
      const attempt = () => {
        if (idx >= urls.length) return;
        textureLoader.load(
          urls[idx],
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.generateMipmaps = true;
            callback(tex);
          },
          undefined,
          () => {
            idx++;
            attempt();
          }
        );
      };
      attempt();
    };

    tryLoadTexture(NASA_LUNAR_COLOR_URLS, (tex) => {
      moonMaterial.map = tex;
      moonMaterial.needsUpdate = true;
    });

    tryLoadTexture(NASA_LUNAR_BUMP_URLS, (bumpTex) => {
      moonMaterial.bumpMap = bumpTex;
      moonMaterial.bumpScale = 0.038;
      moonMaterial.needsUpdate = true;
    });

    // 6. Subtle South-Pole Target Highlight (80°S - 90°S)
    // Delicate polar latitude targeting ring at 80°S latitude
    const southPoleRingGeo = new THREE.BufferGeometry();
    const ringPoints = [];
    const polarLatRad = (-80 * Math.PI) / 180;
    const polarY = Math.sin(polarLatRad) * 1.006;
    const polarRadius = Math.cos(polarLatRad) * 1.006;
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      ringPoints.push(
        new THREE.Vector3(
          Math.cos(angle) * polarRadius,
          polarY,
          Math.sin(angle) * polarRadius
        )
      );
    }
    southPoleRingGeo.setFromPoints(ringPoints);
    const southPoleRingMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.45,
      linewidth: 1,
    });
    const southPoleRing = new THREE.Line(southPoleRingGeo, southPoleRingMat);
    moonMesh.add(southPoleRing);

    // Polar center crosshair pin (Shackleton South Pole 90°S)
    const spCenterPos = new THREE.Vector3(0, -1.012, 0);
    const spCenterGeo = new THREE.SphereGeometry(0.012, 12, 12);
    const spCenterMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const spCenterMesh = new THREE.Mesh(spCenterGeo, spCenterMat);
    spCenterMesh.position.copy(spCenterPos);
    moonMesh.add(spCenterMesh);

    // 7. Sparse, Low-Contrast Orbital Arcs (Scientific & Minimalist)
    // Arc A: LRO 50 km Polar Mapping Orbit
    const lroOrbitGeo = new THREE.BufferGeometry();
    const lroPoints = [];
    const lroRadiusX = 1.22;
    const lroRadiusY = 1.18;
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * Math.PI * 2;
      // Ellipse tilted near 90 degrees (polar)
      lroPoints.push(
        new THREE.Vector3(
          Math.sin(t) * 0.08,
          Math.cos(t) * lroRadiusY,
          Math.sin(t) * lroRadiusX
        )
      );
    }
    lroOrbitGeo.setFromPoints(lroPoints);
    const lroOrbitMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
    });
    const lroOrbitLine = new THREE.Line(lroOrbitGeo, lroOrbitMat);
    moonGroup.add(lroOrbitLine);

    // Tiny LRO Spacecraft Beacon
    const lroBeaconGeo = new THREE.SphereGeometry(0.012, 8, 8);
    const lroBeaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const lroBeacon = new THREE.Mesh(lroBeaconGeo, lroBeaconMat);
    moonGroup.add(lroBeacon);

    // Arc B: Low-Contrast CLPS Translunar Transfer Trajectory
    const clpsOrbitGeo = new THREE.BufferGeometry();
    const clpsPoints = [];
    const clpsSemiA = 1.34;
    const clpsSemiB = 1.12;
    for (let i = 0; i <= 90; i++) {
      const t = (i / 90) * Math.PI * 2;
      // Inclined orbit (~22 degrees)
      const x = Math.cos(t) * clpsSemiA;
      const y = Math.sin(t) * Math.sin(0.38) * clpsSemiB;
      const z = Math.sin(t) * Math.cos(0.38) * clpsSemiB;
      clpsPoints.push(new THREE.Vector3(x, y, z));
    }
    clpsOrbitGeo.setFromPoints(clpsPoints);
    const clpsOrbitMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.14,
    });
    const clpsOrbitLine = new THREE.Line(clpsOrbitGeo, clpsOrbitMat);
    moonGroup.add(clpsOrbitLine);

    // 8. 3D Verified Mission Markers on Surface
    const markerMeshes = [];
    verifiedPins.forEach((pin) => {
      const pos = selenographicToVector3(pin.lat, pin.lon, 1.014);

      // Core fiducial dot
      const dotGeo = new THREE.SphereGeometry(0.016, 14, 14);
      const dotMat = new THREE.MeshBasicMaterial({ color: pin.color });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(pos);
      moonMesh.add(dotMesh);

      // Target fiducial ring
      const ringGeo = new THREE.RingGeometry(0.024, 0.032, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: pin.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos.clone().multiplyScalar(1.002));
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      moonMesh.add(ringMesh);

      markerMeshes.push({
        pin,
        dotMesh,
        ringMesh,
        worldPosition: pos,
      });
    });

    // 9. Directional Lighting (Grazing Solar Terminator + Earthshine)
    // Sunlight: Low grazing angle creating deep crater shadow relief along the terminator
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.9);
    sunLight.position.set(3.4, 0.9, 2.3);
    scene.add(sunLight);

    // Earthshine: Faint cool backfill revealing basalt maria on the dark limb
    const earthshine = new THREE.DirectionalLight(0x38bdf8, 0.22);
    earthshine.position.set(-3.4, -0.6, -1.2);
    scene.add(earthshine);

    // Ambient space light: deep cosmic darkness
    const ambientLight = new THREE.AmbientLight(0x0a0f1d, 0.16);
    scene.add(ambientLight);

    // 10. Interactive Drag & Mouse Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotY = 0.35;
    let targetRotX = 0.12;

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetRotY += deltaX * 0.006;
      targetRotX = Math.max(-0.65, Math.min(0.65, targetRotX + deltaY * 0.005));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // Touch events for mobile phones & tablets
    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;

        targetRotY += deltaX * 0.007;
        targetRotX = Math.max(-0.65, Math.min(0.65, targetRotX + deltaY * 0.006));
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    domElement.addEventListener('touchmove', onTouchMove, { passive: true });

    // 11. Animation Loop & Screen Projection for Interactive Pins
    let animationFrameId;
    let lroAngle = 0;

    const tempV = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Orbital rotation if enabled and not currently dragging
      if (!prefersReducedMotion && !isDragging) {
        targetRotY += 0.0009;
      }

      // Smooth damping interpolation
      moonMesh.rotation.y += (targetRotY - moonMesh.rotation.y) * 0.08;
      moonGroup.rotation.x += (targetRotX - moonGroup.rotation.x) * 0.08;

      // Animate LRO beacon along polar orbit
      lroAngle += 0.004;
      lroBeacon.position.set(
        Math.sin(lroAngle) * 0.08,
        Math.cos(lroAngle) * lroRadiusY,
        Math.sin(lroAngle) * lroRadiusX
      );

      // Project 3D pins to 2D screen coordinates for crisp HTML annotations
      const screenCoords = [];
      const cameraDir = camera.getWorldDirection(new THREE.Vector3());

      markerMeshes.forEach(({ pin, dotMesh }) => {
        dotMesh.getWorldPosition(tempV);

        // Check if marker is on the front-facing hemisphere visible to camera
        const toMarker = tempV.clone().sub(camera.position).normalize();
        const normal = tempV.clone().sub(moonMesh.getWorldPosition(new THREE.Vector3())).normalize();
        const isFacing = normal.dot(cameraDir) < -0.05;

        tempV.project(camera);
        const x = ((tempV.x + 1) * width) / 2;
        const y = ((-tempV.y + 1) * height) / 2;

        screenCoords.push({
          pin,
          x,
          y,
          visible: isFacing && tempV.z < 1.0,
        });
      });

      setPinScreenCoords(screenCoords);

      renderer.render(scene, camera);
    };

    animate();

    // 12. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // 13. Resource Cleanup on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('touchstart', onTouchStart);
      domElement.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', handleResize);

      if (domElement && container.contains(domElement)) {
        container.removeChild(domElement);
      }

      sphereGeometry.dispose();
      moonMaterial.dispose();
      proceduralTexture.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      lroOrbitGeo.dispose();
      lroOrbitMat.dispose();
      clpsOrbitGeo.dispose();
      clpsOrbitMat.dispose();
      southPoleRingGeo.dispose();
      southPoleRingMat.dispose();
      renderer.dispose();
    };
  }, [verifiedPins]);

  return (
    <div className="relative flex items-center justify-center select-none w-full max-w-[340px] sm:max-w-[460px] lg:max-w-[560px] xl:max-w-[600px] aspect-square mx-auto">
      {/* 1. Subtle Space Depth & Forward Limb Light (No generic sci-fi glow) */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(circle at 48% 46%, rgba(34, 211, 238, 0.08) 0%, rgba(15, 23, 42, 0.03) 48%, transparent 70%)',
          filter: 'blur(36px)',
        }}
      />

      {/* 2. WebGL 3D Globe Canvas Container */}
      <div
        ref={mountRef}
        className="relative w-full h-full cursor-grab active:cursor-grabbing rounded-full overflow-visible"
        title="Interactive 3D Moon - Drag to rotate, hover markers for telemetry"
      />

      {/* 3. Screen-Space Scientific Mission Marker Overlays */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {pinScreenCoords.map(({ pin, x, y, visible }) => {
          if (!visible) return null;
          const isHovered = activePin?.id === pin.id;

          return (
            <div
              key={pin.id}
              style={{ left: `${x}px`, top: `${y}px` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
              onMouseEnter={() => setActivePin(pin)}
              onMouseLeave={() => setActivePin(null)}
              onClick={() => handleLaunchToPin(pin)}
            >
              {/* Crisp vector fiducial pin */}
              <div className="relative flex items-center justify-center p-2 group">
                <span
                  className={`absolute w-3.5 h-3.5 rounded-full animate-ping opacity-60 ${
                    pin.isApollo ? 'bg-amber-400' : 'bg-cyan-400'
                  }`}
                />
                <span
                  className={`relative w-2 h-2 rounded-full border border-black shadow-sm ${
                    pin.isApollo ? 'bg-amber-300' : 'bg-cyan-300'
                  }`}
                />

                {/* Subtle label next to pin */}
                <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 rounded bg-[#030611]/85 border border-slate-800 text-[10px] font-mono text-slate-300 whitespace-nowrap opacity-75 group-hover:opacity-100 group-hover:border-cyan-500/40 transition-opacity">
                  {pin.name}
                </span>
              </div>

              {/* Scientific Annotation Popover on Hover */}
              {isHovered && (
                <div
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-52 p-3 rounded-xl bg-[#040713]/95 border border-cyan-500/50 backdrop-blur-xl shadow-2xl text-left pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-150"
                  style={{ transformOrigin: 'bottom center' }}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-cyan-300 font-semibold">{pin.name}</span>
                    <span className="text-slate-400 font-mono tabular-nums">
                      {formatLunarCoordinates(pin.lon, pin.lat).combined}
                    </span>
                  </div>

                  <div className="text-[11px] text-white font-medium mb-1">
                    {pin.siteName}
                  </div>

                  <div className="text-[10px] text-slate-400 leading-tight mb-2">
                    {pin.provider} · {pin.region}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[9px] font-mono text-cyan-400">
                    <span>{pin.status}</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Polar Annotation & Selenographic Datum Indicator */}
      {/* <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] font-mono text-slate-500 tracking-wider uppercase pointer-events-none whitespace-nowrap">
        <span>0.00° N, 0.00° E · Subsolar Datum</span>
        <span className="text-slate-700">•</span>
        <span className="text-cyan-400/90">South Pole Highlight: 80°–90°S</span>
      </div> */}
    </div>
  );
}
