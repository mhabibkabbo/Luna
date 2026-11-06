import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  Globe2,
  Moon,
  Rocket,
  Compass,
  Radio,
  Flame,
  Camera,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import {
  SCALE_3D,
  latLonToSphere3D,
  getInterpolatedStateAtFrac,
} from '../../utils/transferOrbit.js';

// Procedural texture generators for zero-dependency high-fidelity rendering
function createEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
  oceanGrad.addColorStop(0, '#0d2238');
  oceanGrad.addColorStop(0.5, '#0a3d6e');
  oceanGrad.addColorStop(1, '#0d2238');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 1024, 512);

  const toXY = (lon, lat) => ({
    x: ((lon + 180) / 360) * 1024,
    y: ((90 - lat) / 180) * 512,
  });

  const landmasses = [
    { lon: -100, lat: 45, rx: 95, ry: 65, col: '#1e5438' },
    { lon: -60, lat: -15, rx: 55, ry: 80, col: '#1e5438' },
    { lon: 60, lat: 50, rx: 180, ry: 80, col: '#265c3b' },
    { lon: 20, lat: 5, rx: 70, ry: 90, col: '#45582f' },
    { lon: 135, lat: -25, rx: 50, ry: 40, col: '#5c542b' },
    { lon: 0, lat: -82, rx: 360, ry: 35, col: '#c8d6e5' },
    { lon: -40, lat: 72, rx: 45, ry: 35, col: '#b8c9d9' },
  ];

  landmasses.forEach(({ lon, lat, rx, ry, col }) => {
    const { x, y } = toXY(lon, lat);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Soft atmospheric cloud swirls
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  for (let i = 0; i < 45; i++) {
    const cx = (i * 24) % 1024;
    const cy = 110 + Math.sin(i * 1.5) * 190;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 38 + (i % 22), 14 + (i % 8), 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function createMoonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#838891';
  ctx.fillRect(0, 0, 1024, 512);

  const imgData = ctx.getImageData(0, 0, 1024, 512);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * 36;
    d[i] = Math.min(255, Math.max(0, d[i] + noise));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const toXY = (lon, lat) => ({
    x: ((lon + 180) / 360) * 1024,
    y: ((90 - lat) / 180) * 512,
  });

  const maria = [
    { lon: -17, lat: 33, rx: 80, ry: 60 },
    { lon: -56, lat: 18, rx: 110, ry: 85 },
    { lon: 18, lat: 28, rx: 65, ry: 45 },
    { lon: 31, lat: 12, rx: 60, ry: 42 },
    { lon: 59, lat: 17, rx: 45, ry: 35 },
  ];

  maria.forEach(({ lon, lat, rx, ry }) => {
    const { x, y } = toXY(lon, lat);
    const grad = ctx.createRadialGradient(x, y, 4, x, y, Math.max(rx, ry));
    grad.addColorStop(0, 'rgba(38, 42, 50, 0.9)');
    grad.addColorStop(0.7, 'rgba(60, 66, 78, 0.7)');
    grad.addColorStop(1, 'rgba(131, 136, 145, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export default function TransferOrbit3DViewport({
  orbitPlan,
  simProgress,
  launchSite,
  moonTarget,
  jplEphemeris,
  cameraMode: externalCameraMode,
  cameraFocusSeq,
  onCameraModeChange,
  hideEmbeddedControls = false,
}) {
  const mountRef = useRef(null);
  const [internalCameraMode, setInternalCameraMode] = useState('overview'); // 'overview' | 'chase' | 'earth' | 'moon'
  const cameraMode = externalCameraMode !== undefined ? externalCameraMode : internalCameraMode;
  const setCameraMode = (mode) => {
    setInternalCameraMode(mode);
    onCameraModeChange?.(mode);
  };

  const isBlt = orbitPlan?.profile?.id === 'low-energy';

  // Ref objects for 3D state
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const spacecraftRef = useRef(null);
  const beaconDiamondRef = useRef(null);
  const thrusterPlumeRef = useRef(null);
  const ionGlowRef = useRef(null);
  const craftLightRef = useRef(null);
  const trajectoryTubeRef = useRef(null);
  const moonGroupRef = useRef(null);
  const moonOrbitGroupRef = useRef(null);
  const wsbHelperGroupRef = useRef(null);
  const earthPadMarkerRef = useRef(null);
  const moonTargetMarkerRef = useRef(null);

  const cameraModeRef = useRef(cameraMode);
  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  const cameraTransitionRef = useRef(null);

  const startCameraTransition = (targetCamPos, targetControlsPos, durationMs = 600) => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraTransitionRef.current = {
      startCam: cameraRef.current.position.clone(),
      endCam: targetCamPos.clone(),
      startTarget: controlsRef.current.target.clone(),
      endTarget: targetControlsPos.clone(),
      startTime: performance.now(),
      duration: durationMs,
    };
  };

  // Interpolated craft state
  const currentState = useMemo(() => {
    return getInterpolatedStateAtFrac(orbitPlan.waypoints, simProgress);
  }, [orbitPlan.waypoints, simProgress]);

  const currentStateRef = useRef(currentState);
  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  // Target Moon 3D center (Mission frame: Earth on the left at (0,0,0), Moon on the right at +X)
  const moonCenter3d = useMemo(() => {
    if (jplEphemeris && jplEphemeris.rangeKm) {
      const scaleDist = SCALE_3D.DISTANCE * (jplEphemeris.rangeKm / 384400);
      const yMoon = scaleDist * (jplEphemeris.zKm / jplEphemeris.rangeKm);
      const zMoon = scaleDist * (jplEphemeris.yKm / jplEphemeris.rangeKm) * 0.2;
      const xMoon = Math.sqrt(Math.max(10, scaleDist * scaleDist - yMoon * yMoon - zMoon * zMoon));
      return new THREE.Vector3(xMoon, yMoon, zMoon);
    }
    return new THREE.Vector3(
      SCALE_3D.DISTANCE * Math.cos(0.09),
      SCALE_3D.DISTANCE * Math.sin(0.09) * 0.4,
      SCALE_3D.DISTANCE * Math.sin(0.09) * 0.8
    );
  }, [jplEphemeris]);

  // ── Overview System Framing Coordinates ──────────────────────────────────
  // For Direct / Free-Return: Earth on the left at (0, 0, 0), Moon on the right at X=75. Center is at X=36.
  // For Low-Energy (BLT): Trajectory extends ~1.45M km (X ≈ 275). Auto-adjust view bounds to 135.
  const OVERVIEW_TARGET = useMemo(
    () => (isBlt ? new THREE.Vector3(135.0, 15.0, 0.0) : new THREE.Vector3(SCALE_3D.DISTANCE * 0.48, 0.0, 0.0)),
    [isBlt]
  );
  const OVERVIEW_CAM_POS = useMemo(
    () => (isBlt ? new THREE.Vector3(135.0, 75.0, 360.0) : new THREE.Vector3(SCALE_3D.DISTANCE * 0.48, 12.0, 88.0)),
    [isBlt]
  );

  // ── Three.js Lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 840;
    const height = container.clientHeight || 460;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
    // Initialize directly looking at the centered midpoint of the Earth-Moon trajectory!
    camera.position.copy(OVERVIEW_CAM_POS);
    cameraRef.current = camera;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = isBlt ? 1400 : 350;
    controls.minDistance = 2;
    controls.target.copy(OVERVIEW_TARGET);
    controls.update();
    controlsRef.current = controls;

    // Listen to manual interaction to cancel automatic camera transitions
    controls.addEventListener('start', () => {
      cameraTransitionRef.current = null;
      if (cameraModeRef.current === 'chase') {
        setCameraMode('overview');
      }
    });

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x334455, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(20, 50, 100);
    scene.add(sunLight);

    // Subtle rim light from opposite side
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    rimLight.position.set(60, -30, -60);
    scene.add(rimLight);

    // 5. Starfield Background
    const starCount = 1400;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCols = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 450;
      starPos[i + 1] = (Math.random() - 0.5) * 450;
      starPos[i + 2] = (Math.random() - 0.5) * 450;

      const spectral = Math.random();
      if (spectral > 0.82) {
        starCols[i] = 0.65; starCols[i + 1] = 0.85; starCols[i + 2] = 1.0;
      } else if (spectral > 0.65) {
        starCols[i] = 1.0; starCols[i + 1] = 0.92; starCols[i + 2] = 0.75;
      } else {
        starCols[i] = 0.95; starCols[i + 1] = 0.95; starCols[i + 2] = 0.95;
      }
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCols, 3));
    const starMat = new THREE.PointsMaterial({ size: 1.3, vertexColors: true, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // 6. Earth Sphere (at Origin)
    const earthGeo = new THREE.SphereGeometry(SCALE_3D.EARTH_RADIUS, 48, 48);
    const earthTex = createEarthTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.6,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Earth Atmosphere Glow
    const atmosGeo = new THREE.SphereGeometry(SCALE_3D.EARTH_RADIUS * 1.07, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // Earth LEO Parking Orbit Ring (radius 3.2)
    const leoCurve = new THREE.EllipseCurve(0, 0, SCALE_3D.PARKING_RADIUS, SCALE_3D.PARKING_RADIUS, 0, 2 * Math.PI, false, 0);
    const leoPoints = leoCurve.getPoints(64).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const leoGeo = new THREE.BufferGeometry().setFromPoints(leoPoints);
    const leoMat = new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.6, gapSize: 0.3, transparent: true, opacity: 0.6 });
    const leoLine = new THREE.Line(leoGeo, leoMat);
    leoLine.computeLineDistances();
    scene.add(leoLine);

    // Earth Launch Pad Marker Pin
    const padPinGeo = new THREE.ConeGeometry(0.3, 1.0, 12);
    const padPinMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const padPin = new THREE.Mesh(padPinGeo, padPinMat);
    earthPadMarkerRef.current = padPin;
    scene.add(padPin);

    // 7. Moon Group (Moon + SOI + Markers)
    const moonGroup = new THREE.Group();
    moonGroupRef.current = moonGroup;
    scene.add(moonGroup);

    const moonGeo = new THREE.SphereGeometry(SCALE_3D.MOON_RADIUS, 40, 40);
    const moonTex = createMoonTexture();
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);

    // Glowing Moon Atmosphere / Exosphere Halo
    const moonHaloGeo = new THREE.SphereGeometry(SCALE_3D.MOON_RADIUS * 1.08, 32, 32);
    const moonHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00d2c4,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
    });
    const moonHalo = new THREE.Mesh(moonHaloGeo, moonHaloMat);
    moonGroup.add(moonHalo);

    // High-Visibility Moon Reticle / Marker Ring (visible from far overview)
    const moonBeaconRingGeo = new THREE.RingGeometry(1.4, 1.6, 32);
    const moonBeaconRingMat = new THREE.MeshBasicMaterial({
      color: 0x00d2c4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const moonBeaconRing = new THREE.Mesh(moonBeaconRingGeo, moonBeaconRingMat);
    moonBeaconRing.rotation.x = Math.PI / 2;
    moonGroup.add(moonBeaconRing);

    // Moon Orbit Ring
    const lunarOrbCurve = new THREE.EllipseCurve(0, 0, SCALE_3D.LUNAR_ORBIT_RADIUS, SCALE_3D.LUNAR_ORBIT_RADIUS, 0, 2 * Math.PI, false, 0);
    const lunarOrbPoints = lunarOrbCurve.getPoints(48).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const lunarOrbGeo = new THREE.BufferGeometry().setFromPoints(lunarOrbPoints);
    const lunarOrbMat = new THREE.LineDashedMaterial({ color: 0x00d2c4, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.7 });
    const lunarOrbLine = new THREE.Line(lunarOrbGeo, lunarOrbMat);
    lunarOrbLine.computeLineDistances();
    moonGroup.add(lunarOrbLine);

    // Moon SOI (Sphere of Influence) Translucent Halo
    const soiGeo = new THREE.SphereGeometry(12.5, 24, 24);
    const soiMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    const soiMesh = new THREE.Mesh(soiGeo, soiMat);
    moonGroup.add(soiMesh);

    // Moon Landing Target Marker Pin
    const targetPinGeo = new THREE.ConeGeometry(0.25, 0.8, 12);
    const targetPinMat = new THREE.MeshBasicMaterial({ color: 0x00d2c4 });
    const targetPin = new THREE.Mesh(targetPinGeo, targetPinMat);
    moonTargetMarkerRef.current = targetPin;
    moonGroup.add(targetPin);

    // 7b. Moon 27.3-Day Complete Orbital Ellipse Reference Guide around Earth (radius 75.0 units)
    const moonOrbitGroup = new THREE.Group();
    moonOrbitGroupRef.current = moonOrbitGroup;
    scene.add(moonOrbitGroup);

    const moonOrbitCurve = new THREE.EllipseCurve(0, 0, SCALE_3D.DISTANCE, SCALE_3D.DISTANCE, 0, 2 * Math.PI, false, 0);
    const moonOrbitPts = moonOrbitCurve.getPoints(128).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonOrbitPts);
    const moonOrbitMat = new THREE.LineDashedMaterial({
      color: 0x00d2c4,
      dashSize: 1.5,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.35,
    });
    const moonOrbitLine = new THREE.Line(moonOrbitGeo, moonOrbitMat);
    moonOrbitLine.computeLineDistances();
    moonOrbitGroup.add(moonOrbitLine);

    // 7c. Weak Stability Boundary (WSB) Helpers Group (L1, L2, Moon Capture Marker)
    const wsbGroup = new THREE.Group();
    wsbHelperGroupRef.current = wsbGroup;
    wsbGroup.visible = isBlt;
    scene.add(wsbGroup);

    // Glowing Moon Capture Intercept Marker on Orbit at (75, 0, 0)
    const interceptRingGeo = new THREE.RingGeometry(1.6, 2.0, 32);
    const interceptRingMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const interceptRing = new THREE.Mesh(interceptRingGeo, interceptRingMat);
    interceptRing.position.set(SCALE_3D.DISTANCE, 0, 0);
    interceptRing.rotation.x = Math.PI / 2;
    wsbGroup.add(interceptRing);

    // Sun-Earth L1 Marker (~1.5M km towards Sun)
    const l1DiamondGeo = new THREE.OctahedronGeometry(2.0);
    const l1DiamondMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true });
    const l1Diamond = new THREE.Mesh(l1DiamondGeo, l1DiamondMat);
    l1Diamond.position.set(-60, 0, 0);
    wsbGroup.add(l1Diamond);

    // Sun-Earth L2 / WSB Apex (~1.5M km away from Sun)
    const l2DiamondGeo = new THREE.OctahedronGeometry(2.5);
    const l2DiamondMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, wireframe: true });
    const l2Diamond = new THREE.Mesh(l2DiamondGeo, l2DiamondMat);
    l2Diamond.position.set(272, 25, 0);
    wsbGroup.add(l2Diamond);

    // ── 8. Enhanced Highly-Visible 3D Spacecraft Model ───────────────────────
    // Substantially enlarged so it is unmistakably visible in the cislunar scene
    const craftGroup = new THREE.Group();
    spacecraftRef.current = craftGroup;

    // Command & Service Fuselage (Length 2.6, Radius 0.45)
    const craftBodyGeo = new THREE.CylinderGeometry(0.4, 0.48, 2.6, 16);
    const craftBodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.4,
      roughness: 0.2,
      emissive: 0x1e293b,
      emissiveIntensity: 0.2,
    });
    const craftBody = new THREE.Mesh(craftBodyGeo, craftBodyMat);
    craftBody.rotation.z = Math.PI / 2;
    craftGroup.add(craftBody);

    // Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.4, 0.8, 16);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(1.7, 0, 0);
    nose.rotation.z = -Math.PI / 2;
    craftGroup.add(nose);

    // High-Span Dual Solar Arrays (Span 5.4 units)
    const panelGeo = new THREE.BoxGeometry(0.08, 1.1, 5.4);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.5,
      metalness: 0.7,
      roughness: 0.2,
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    craftGroup.add(panel);

    // Parabolic High-Gain Antenna Dish
    const dishGeo = new THREE.ConeGeometry(0.5, 0.2, 16);
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.6 });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0.6, 0.6, 0);
    dish.rotation.z = -Math.PI / 3;
    craftGroup.add(dish);

    // Engine Nozzle Ring
    const nozzleGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.5, 14);
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.1 });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.set(-1.5, 0, 0);
    nozzle.rotation.z = Math.PI / 2;
    craftGroup.add(nozzle);

    // Luminous Locator Reticle Ring (Pulses to highlight rocket location from any zoom)
    const reticleGeo = new THREE.RingGeometry(2.0, 2.2, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.rotation.y = Math.PI / 2;
    craftGroup.add(reticle);

    // Floating 3D Beacon Diamond above Craft
    const diamondGeo = new THREE.OctahedronGeometry(0.35);
    const diamondMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    diamond.position.set(0, 1.8, 0);
    beaconDiamondRef.current = diamond;
    craftGroup.add(diamond);

    // On-Craft Point Light (Illuminates the spacecraft hull and solar arrays!)
    const craftLight = new THREE.PointLight(0x38bdf8, 3.0, 20);
    craftLight.position.set(0, 1.2, 0);
    craftLightRef.current = craftLight;
    craftGroup.add(craftLight);

    // Main Rocket Thruster Flame (active during burns)
    const plumeGroup = new THREE.Group();
    // Inner bright core
    const plumeCoreGeo = new THREE.ConeGeometry(0.35, 2.2, 16);
    const plumeCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    const plumeCore = new THREE.Mesh(plumeCoreGeo, plumeCoreMat);
    plumeCore.position.set(-2.5, 0, 0);
    plumeCore.rotation.z = Math.PI / 2;
    plumeGroup.add(plumeCore);
    // Outer fiery plasma cone
    const plumeOuterGeo = new THREE.ConeGeometry(0.65, 3.2, 16);
    const plumeOuterMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85 });
    const plumeOuter = new THREE.Mesh(plumeOuterGeo, plumeOuterMat);
    plumeOuter.position.set(-3.0, 0, 0);
    plumeOuter.rotation.z = Math.PI / 2;
    plumeGroup.add(plumeOuter);

    thrusterPlumeRef.current = plumeGroup;
    craftGroup.add(plumeGroup);

    // Subtle blue ion engine glow (active during coast)
    const ionGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const ionMat = new THREE.MeshBasicMaterial({ color: 0x00d2c4, transparent: true, opacity: 0.6 });
    const ionGlow = new THREE.Mesh(ionGeo, ionMat);
    ionGlow.position.set(-1.8, 0, 0);
    ionGlowRef.current = ionGlow;
    craftGroup.add(ionGlow);

    scene.add(craftGroup);

    // 9. Resize Observer for dynamic, zero-lag viewport scaling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // 10. Animation Render Loop
    let animId;
    let clock = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      clock += 0.05;

      // Rotate Earth slowly
      earthMesh.rotation.y += 0.0008;

      // Animate beacon diamond bobbing & spinning
      if (beaconDiamondRef.current) {
        beaconDiamondRef.current.rotation.y += 0.04;
        beaconDiamondRef.current.position.y = 1.8 + Math.sin(clock * 2) * 0.15;
      }

      // Smooth camera transition (one-shot, non-fighting)
      if (cameraTransitionRef.current) {
        const tr = cameraTransitionRef.current;
        const elapsed = performance.now() - tr.startTime;
        const p = Math.min(1.0, elapsed / tr.duration);
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        camera.position.lerpVectors(tr.startCam, tr.endCam, ease);
        controls.target.lerpVectors(tr.startTarget, tr.endTarget, ease);
        if (p >= 1.0) {
          cameraTransitionRef.current = null;
        }
      } else if (cameraModeRef.current === 'chase' && currentStateRef.current) {
        // Rocket chase mode tracking
        const cur = currentStateRef.current;
        const craftPos = new THREE.Vector3(cur.x3d, cur.y3d, cur.z3d);
        const offset = new THREE.Vector3(-10, 4, 6);
        if (cur.dir3d) {
          const forward = new THREE.Vector3(cur.dir3d.x, cur.dir3d.y, cur.dir3d.z).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), forward);
          offset.applyQuaternion(q);
        }
        camera.position.lerp(new THREE.Vector3().addVectors(craftPos, offset), 0.12);
        controls.target.lerp(craftPos, 0.12);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      earthTex.dispose();
      moonTex.dispose();
      earthGeo.dispose();
      moonGeo.dispose();
      starGeo.dispose();
    };
  }, []);

  // ── Update Moon Position & Surface Markers ─────────────────────────────────
  useEffect(() => {
    if (moonGroupRef.current) {
      moonGroupRef.current.position.copy(moonCenter3d);
    }

    if (earthPadMarkerRef.current && launchSite) {
      const padPos = latLonToSphere3D(launchSite.latitude, launchSite.longitude, SCALE_3D.EARTH_RADIUS);
      earthPadMarkerRef.current.position.set(padPos.x, padPos.y, padPos.z);
      earthPadMarkerRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(padPos.x, padPos.y, padPos.z).normalize()
      );
    }

    if (moonTargetMarkerRef.current && moonTarget) {
      const targetPos = latLonToSphere3D(moonTarget.latitude, moonTarget.longitude, SCALE_3D.MOON_RADIUS);
      moonTargetMarkerRef.current.position.set(targetPos.x, targetPos.y, targetPos.z);
      moonTargetMarkerRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z).normalize()
      );
    }
  }, [moonCenter3d, launchSite, moonTarget]);

  // ── Update 3D Trajectory Spline Tube ───────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !orbitPlan.waypoints) return;

    if (trajectoryTubeRef.current) {
      scene.remove(trajectoryTubeRef.current);
      trajectoryTubeRef.current.geometry.dispose();
      trajectoryTubeRef.current = null;
    }

    const pathPoints = orbitPlan.waypoints
      .filter(
        (p) =>
          p.phase === 'tli' ||
          p.phase === 'coast' ||
          p.phase === 'lunar-approach' ||
          p.phase === 'return' ||
          p.phase === 'loi' ||
          p.phase === 'descent'
      )
      .map((p) => new THREE.Vector3(p.x3d, p.y3d, p.z3d));

    if (pathPoints.length > 2) {
      const curve = new THREE.CatmullRomCurve3(pathPoints);
      // Substantially thicker, luminous neon tube (radius 0.28 instead of 0.12)
      const tubeGeo = new THREE.TubeGeometry(curve, 120, 0.28, 10, false);
      const isFreeReturn = orbitPlan.profile.id === 'free-return';
      const isLowEnergy = orbitPlan.profile.id === 'low-energy';
      const tubeMat = new THREE.MeshStandardMaterial({
        color: isFreeReturn ? 0xa78bfa : isLowEnergy ? 0xfbbf24 : 0x22d3ee,
        emissive: isFreeReturn ? 0x8b5cf6 : isLowEnergy ? 0xd97706 : 0x06b6d4,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      trajectoryTubeRef.current = tubeMesh;
      scene.add(tubeMesh);
    }
  }, [orbitPlan]);

  // ── Dynamic Re-Framing when Flight Profile Changes ─────────────────────────
  useEffect(() => {
    if (wsbHelperGroupRef.current) {
      wsbHelperGroupRef.current.visible = isBlt;
    }
    if (controlsRef.current) {
      controlsRef.current.maxDistance = isBlt ? 1400 : 350;
    }
    if (cameraModeRef.current === 'overview') {
      startCameraTransition(OVERVIEW_CAM_POS, OVERVIEW_TARGET, 600);
    }
  }, [isBlt, OVERVIEW_TARGET, OVERVIEW_CAM_POS]);

  // ── Update Spacecraft Position & Flame ─────────────────────────────────────
  useEffect(() => {
    if (!spacecraftRef.current || !currentState) return;

    const craft = spacecraftRef.current;
    craft.position.set(currentState.x3d, currentState.y3d, currentState.z3d);

    // Align spacecraft orientation along velocity vector
    if (currentState.dir3d) {
      const forward = new THREE.Vector3(currentState.dir3d.x, currentState.dir3d.y, currentState.dir3d.z).normalize();
      craft.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), forward);
    }

    // Toggle thruster flame / ion glow
    const isBurning = currentState.phase === 'tli' || currentState.phase === 'loi';
    if (thrusterPlumeRef.current) {
      thrusterPlumeRef.current.visible = isBurning;
      if (isBurning) {
        const flicker = 0.9 + Math.random() * 0.3;
        thrusterPlumeRef.current.scale.set(flicker, flicker, flicker);
      }
    }
    if (ionGlowRef.current) {
      ionGlowRef.current.visible = !isBurning;
    }
  }, [currentState]);

  // Camera Mode Click Handlers (One-shot smooth transitions with full zoom/pan freedom)
  const handleRecenter = () => {
    setCameraMode('overview');
    startCameraTransition(OVERVIEW_CAM_POS, OVERVIEW_TARGET, 600);
  };

  const handleFollowRocket = () => {
    setCameraMode('chase');
    cameraTransitionRef.current = null;
  };

  const handleZoomEarth = () => {
    setCameraMode('earth');
    startCameraTransition(new THREE.Vector3(-4, 3, 11), new THREE.Vector3(0, 0, 0), 600);
  };

  const handleZoomMoon = () => {
    setCameraMode('moon');
    const moonCam = moonCenter3d.clone().add(new THREE.Vector3(-3.5, 2.2, 5.5));
    startCameraTransition(moonCam, moonCenter3d, 600);
  };

  useEffect(() => {
    if (cameraFocusSeq === undefined || cameraFocusSeq === 0) return;
    if (cameraMode === 'overview') {
      handleRecenter();
    } else if (cameraMode === 'chase') {
      handleFollowRocket();
    } else if (cameraMode === 'earth') {
      handleZoomEarth();
    } else if (cameraMode === 'moon') {
      handleZoomMoon();
    }
  }, [cameraMode, cameraFocusSeq]);

  return (
    <div className="relative w-full h-full min-h-0 bg-gradient-to-b from-[#050507] via-[#050507] to-[#050507] rounded-2xl overflow-hidden border border-[#1E2028]">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Camera Mode Toolbar (Pills) */}
      {!hideEmbeddedControls && (
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 flex items-center gap-1.5 bg-[#050507]/90 backdrop-blur-md border border-[#1E2028] rounded-xl p-1 text-[11px] font-mono shadow-xl">
          <button
            type="button"
            onClick={handleRecenter}
            className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              cameraMode === 'overview'
                ? 'bg-[#38BDF8] text-[#050507] font-bold shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#14161D]'
            }`}
            title="Center Full Trajectory (Earth to Moon)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Full Trajectory</span>
          </button>

          <button
            type="button"
            onClick={handleFollowRocket}
            className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              cameraMode === 'chase'
                ? 'bg-[#A78BFA] text-[#050507] font-bold shadow-[0_0_12px_rgba(167,139,250,0.5)]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#14161D]'
            }`}
            title="Lock Camera on Rocket Spacecraft"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Follow Rocket</span>
          </button>

          <button
            type="button"
            onClick={handleZoomEarth}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              cameraMode === 'earth'
                ? 'bg-[#38BDF8] text-[#050507] font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#14161D]'
            }`}
            title="Zoom to Earth Departure"
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>Earth</span>
          </button>

          <button
            type="button"
            onClick={handleZoomMoon}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
              cameraMode === 'moon'
                ? 'bg-white text-[#050507] font-bold'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#14161D]'
            }`}
            title="Zoom to Moon Arrival"
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Moon</span>
          </button>
        </div>
      )}

      {/* NASA JPL Horizons Live Ephemeris Badge */}
      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10 flex items-center gap-2">
        {jplEphemeris && (
          <div className="bg-[#050507]/90 backdrop-blur-md border border-[#1E2028] rounded-xl px-3 py-1 text-[10px] font-mono text-[#94A3B8] flex items-center gap-2 shadow-xl">
            <Radio className={`w-3.5 h-3.5 ${jplEphemeris.isLive ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`} />
            <span className="text-white font-medium">
              {jplEphemeris.isLive ? 'NASA JPL Horizons Ephemeris' : 'IAU Ephemeris'}
            </span>
            <span className="text-[#38BDF8] font-bold">
              {Math.round(jplEphemeris.rangeKm).toLocaleString()} km
            </span>
          </div>
        )}
      </div>

      {/* Rocket Active Locator HUD pill */}
      <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-2 bg-[#050507]/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#1E2028] text-[11px] font-mono text-white shadow-xl">
        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
        <span className="text-[#94A3B8]">Craft:</span>
        <span className="font-semibold text-[#38BDF8]">{orbitPlan.profile.name} Vehicle</span>
        <span>&middot;</span>
        <span className="text-amber-400 font-bold">{currentState?.velocityKmS != null ? `${currentState.velocityKmS.toFixed(2)} km/s` : ''}</span>
      </div>

      {/* Instructions pill at bottom right */}
      <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none hidden sm:flex items-center gap-2 text-[10px] font-mono text-[#64748B] bg-[#050507]/70 px-2.5 py-1 rounded-lg border border-[#1E2028]/70">
        <span>Drag: Orbit</span>
        <span>&middot;</span>
        <span>Right-click: Pan</span>
        <span>&middot;</span>
        <span>Scroll: Zoom</span>
      </div>
    </div>
  );
}
