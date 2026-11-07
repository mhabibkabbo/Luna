import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { ArrowUpRight } from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { HERO_ORBITAL_MISSIONS } from '../../data/heroMissions.js';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

export { HERO_ORBITAL_MISSIONS };

// Reliable CDN endpoint for NASA LRO photographic lunar texture
const NASA_LUNAR_COLOR_URLS = [
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/moon_1024.jpg',
];

/**
 * Creates high-precision procedural lunar basemap canvas with warm regolith tone.
 */
function createScientificLunarCanvas(width = 1024, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Warm highland anorthosite regolith base
  ctx.fillStyle = '#787266';
  ctx.fillRect(0, 0, width, height);

  // 2. Regolith grain noise
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 34;
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
    grad.addColorStop(0, 'rgba(34, 31, 24, 0.92)');
    grad.addColorStop(0.65, 'rgba(52, 48, 39, 0.82)');
    grad.addColorStop(0.9, 'rgba(82, 76, 65, 0.35)');
    grad.addColorStop(1, 'rgba(120, 114, 102, 0)');

    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 4. Prominent impact crater ray systems
  const craters = [
    { lon: -11.36, lat: -43.31, r: 10, rays: true, rayLen: 160 }, // Tycho
    { lon: -20.08, lat: 9.62, r: 11, rays: true, rayLen: 110 },   // Copernicus
    { lon: -47.49, lat: 23.73, r: 7, rays: true, rayLen: 70 },    // Aristarchus
    { lon: -38.01, lat: 8.12, r: 6, rays: false },                // Kepler
    { lon: -9.38, lat: 51.62, r: 9, rays: false },                // Plato
    { lon: 0.0, lat: -89.4, r: 6, rays: false },                  // Shackleton / South Pole
  ];

  craters.forEach(({ lon, lat, r, rays, rayLen }) => {
    const { x, y } = toXY(lon, lat);

    if (rays && rayLen) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 239, 230, 0.24)';
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

    ctx.save();
    ctx.fillStyle = 'rgba(24, 22, 17, 0.95)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(244, 239, 230, 0.82)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  });

  return canvas;
}

function selenographicToVector3(lat, lon, radius = 1.0) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export default function RealisticMoon({
  onLaunchExplorer,
  selectedMissionIndex = 0,
  onSelectMissionIndex,
  onOpenMission,
}) {
  const mountRef = useRef(null);
  const pinDomRefs = useRef([]);
  const rotationTargetRef = useRef({ y: 0.35, x: 0.14, manualOverride: false });
  const [activePin, setActivePin] = useState(null);

  const verifiedPins = useMemo(() => HERO_ORBITAL_MISSIONS, []);

  // Rotate Moon toward the active mission index when user switches via the 01/05 controls
  useEffect(() => {
    const activeMission = verifiedPins[selectedMissionIndex];
    if (!activeMission) return;
    // Compute approximate target Y/X rotation to bring pin toward front hemisphere
    const lonRad = (activeMission.lon * Math.PI) / 180;
    const latRad = (activeMission.lat * Math.PI) / 180;
    rotationTargetRef.current.y = -lonRad + 0.35;
    rotationTargetRef.current.x = Math.max(-0.52, Math.min(0.52, -latRad * 0.32));
    rotationTargetRef.current.manualOverride = true;
    const timer = setTimeout(() => {
      rotationTargetRef.current.manualOverride = false;
    }, 3200);
    return () => clearTimeout(timer);
  }, [selectedMissionIndex, verifiedPins]);

  const handleLaunchToPin = (pin, idx) => {
    if (onSelectMissionIndex && typeof idx === 'number') {
      onSelectMissionIndex(idx);
    }
    if (onOpenMission) {
      onOpenMission(pin);
      return;
    }
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
    const width = container.clientWidth || 520;
    const height = container.clientHeight || 520;
    const isMobile = width < 480;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.02, 3.65);

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.appendChild(renderer.domElement);

    // 3. Astronomical Starfield
    const starCount = 620;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 24;
      starPositions[i + 1] = (Math.random() - 0.5) * 24;
      starPositions[i + 2] = -3.5 - Math.random() * 12;

      const spectral = Math.random();
      if (spectral > 0.78) {
        starColors[i] = 0.85; starColors[i + 1] = 0.88; starColors[i + 2] = 0.94;
      } else if (spectral < 0.22) {
        starColors[i] = 0.75; starColors[i + 1] = 0.80; starColors[i + 2] = 0.88;
      } else {
        starColors[i] = 0.96; starColors[i + 1] = 0.97; starColors[i + 2] = 0.99;
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
    });
    const starPoints = new THREE.Points(starGeometry, starMaterial);
    scene.add(starPoints);

    // 4. Moon Group
    const moonGroup = new THREE.Group();
    moonGroup.rotation.x = 0.14;
    moonGroup.rotation.y = 0.35;
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
      roughness: 0.91,
      metalness: 0.04,
      color: new THREE.Color('#e2e8f0'),
    });

    const moonMesh = new THREE.Mesh(sphereGeometry, moonMaterial);
    moonGroup.add(moonMesh);

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
      moonMaterial.bumpMap = tex;
      moonMaterial.bumpScale = 0.038;
      moonMaterial.needsUpdate = true;
    });

    // 6. South-Pole Target Highlight (80°S - 90°S)
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
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.45,
    });
    const southPoleRing = new THREE.Line(southPoleRingGeo, southPoleRingMat);
    moonMesh.add(southPoleRing);

    // Polar center crosshair pin (Shackleton South Pole 90°S)
    const spCenterGeo = new THREE.SphereGeometry(0.014, 12, 12);
    const spCenterMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const spCenterMesh = new THREE.Mesh(spCenterGeo, spCenterMat);
    spCenterMesh.position.set(0, -1.012, 0);
    moonMesh.add(spCenterMesh);

    // 7. Orbital Telemetry Arcs
    const lroOrbitGeo = new THREE.BufferGeometry();
    const lroPoints = [];
    const lroRadiusX = 1.24;
    const lroRadiusY = 1.19;
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * Math.PI * 2;
      lroPoints.push(
        new THREE.Vector3(
          Math.sin(t) * 0.09,
          Math.cos(t) * lroRadiusY,
          Math.sin(t) * lroRadiusX
        )
      );
    }
    lroOrbitGeo.setFromPoints(lroPoints);
    const lroOrbitMat = new THREE.LineBasicMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.25,
    });
    const lroOrbitLine = new THREE.Line(lroOrbitGeo, lroOrbitMat);
    moonGroup.add(lroOrbitLine);

    const lroBeaconGeo = new THREE.SphereGeometry(0.014, 10, 10);
    const lroBeaconMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const lroBeacon = new THREE.Mesh(lroBeaconGeo, lroBeaconMat);
    moonGroup.add(lroBeacon);

    // Arc B: CLPS Translunar Transfer Trajectory
    const clpsOrbitGeo = new THREE.BufferGeometry();
    const clpsPoints = [];
    const clpsSemiA = 1.36;
    const clpsSemiB = 1.14;
    for (let i = 0; i <= 90; i++) {
      const t = (i / 90) * Math.PI * 2;
      const x = Math.cos(t) * clpsSemiA;
      const y = Math.sin(t) * Math.sin(0.38) * clpsSemiB;
      const z = Math.sin(t) * Math.cos(0.38) * clpsSemiB;
      clpsPoints.push(new THREE.Vector3(x, y, z));
    }
    clpsOrbitGeo.setFromPoints(clpsPoints);
    const clpsOrbitMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.18,
    });
    const clpsOrbitLine = new THREE.Line(clpsOrbitGeo, clpsOrbitMat);
    moonGroup.add(clpsOrbitLine);

    // 8. 3D Verified Mission Markers on Surface
    const markerMeshes = [];
    verifiedPins.forEach((pin, idx) => {
      const pos = selenographicToVector3(pin.lat, pin.lon, 1.016);

      const dotGeo = new THREE.SphereGeometry(0.017, 14, 14);
      const dotMat = new THREE.MeshBasicMaterial({ color: pin.color });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(pos);
      moonMesh.add(dotMesh);

      const ringGeo = new THREE.RingGeometry(0.026, 0.036, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: pin.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(pos.clone().multiplyScalar(1.003));
      ringMesh.lookAt(pos.clone().multiplyScalar(2));
      moonMesh.add(ringMesh);

      markerMeshes.push({
        pin,
        idx,
        dotMesh,
        ringMesh,
        worldPosition: pos,
      });
    });

    // 9. Grazing Solar Terminator & Cool Moonlight Rim Lighting
    const sunLight = new THREE.DirectionalLight(0xf8fafc, 3.1);
    sunLight.position.set(3.4, 0.95, 2.3);
    scene.add(sunLight);

    const earthshine = new THREE.DirectionalLight(0x94a3b8, 0.25);
    earthshine.position.set(-3.4, -0.6, -1.2);
    scene.add(earthshine);

    const coolRimLight = new THREE.DirectionalLight(0xcbd5e1, 0.24);
    coolRimLight.position.set(0.5, -2.8, -1.8);
    scene.add(coolRimLight);

    const ambientLight = new THREE.AmbientLight(0x181a20, 0.28);
    scene.add(ambientLight);

    // 10. Interactive Drag & Touch Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

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

      rotationTargetRef.current.y += deltaX * 0.006;
      rotationTargetRef.current.x = Math.max(
        -0.65,
        Math.min(0.65, rotationTargetRef.current.x + deltaY * 0.005)
      );
    };

    const onMouseUp = () => {
      isDragging = false;
    };

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

        rotationTargetRef.current.y += deltaX * 0.007;
        rotationTargetRef.current.x = Math.max(
          -0.65,
          Math.min(0.65, rotationTargetRef.current.x + deltaY * 0.006)
        );
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    domElement.addEventListener('touchmove', onTouchMove, { passive: true });

    // 11. Animation Loop
    let animationFrameId;
    let lroAngle = 0;
    const tempV = new THREE.Vector3();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!prefersReducedMotion && !isDragging && !rotationTargetRef.current.manualOverride) {
        rotationTargetRef.current.y += 0.00085;
      }

      moonMesh.rotation.y += (rotationTargetRef.current.y - moonMesh.rotation.y) * 0.075;
      moonGroup.rotation.x += (rotationTargetRef.current.x - moonGroup.rotation.x) * 0.075;

      lroAngle += 0.004;
      lroBeacon.position.set(
        Math.sin(lroAngle) * 0.09,
        Math.cos(lroAngle) * lroRadiusY,
        Math.sin(lroAngle) * lroRadiusX
      );

      const cameraDir = camera.getWorldDirection(new THREE.Vector3());
      const curW = container.clientWidth || width;
      const curH = container.clientHeight || height;

      markerMeshes.forEach(({ idx, dotMesh }) => {
        const el = pinDomRefs.current[idx];
        if (!el) return;
        dotMesh.getWorldPosition(tempV);
        const normal = tempV
          .clone()
          .sub(moonMesh.getWorldPosition(new THREE.Vector3()))
          .normalize();
        const isFacing = normal.dot(cameraDir) < -0.05;

        tempV.project(camera);
        const x = ((tempV.x + 1) * curW) / 2;
        const y = ((-tempV.y + 1) * curH) / 2;
        const visible = isFacing && tempV.z < 1.0;

        el.style.display = visible ? 'block' : 'none';
        if (visible) {
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

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
    <div
      role="region"
      aria-label="Interactive 3D Moon visualization"
      className="relative flex items-center justify-center select-none w-full max-w-[300px] sm:max-w-[360px] lg:max-w-[420px] xl:max-w-[460px] aspect-square mx-auto"
    >
      {/* Subtle Moonlight Horizon Glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(circle at 52% 46%, rgba(186, 204, 235, 0.14) 0%, rgba(148, 163, 184, 0.06) 44%, transparent 72%)',
          filter: 'blur(42px)',
        }}
      />

      {/* WebGL 3D Globe Canvas */}
      <div
        ref={mountRef}
        className="relative w-full h-full cursor-grab active:cursor-grabbing rounded-full overflow-visible"
        title="Interactive 3D Moon — Drag to rotate, click orbital nodes to open"
      />

      {/* Screen-Space Orbital Mission Nodes */}
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {verifiedPins.map((pin, idx) => {
          const isSelected = idx === selectedMissionIndex;
          const isHovered = activePin?.id === pin.id || isSelected;

          return (
            <div
              key={pin.id}
              ref={(el) => {
                pinDomRefs.current[idx] = el;
              }}
              role="button"
              tabIndex={0}
              aria-label={`Explore mission ${pin.name} at ${pin.siteName}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleLaunchToPin(pin, idx);
                }
              }}
              style={{ display: 'none', left: '50%', top: '50%' }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full"
              onMouseEnter={() => setActivePin(pin)}
              onMouseLeave={() => setActivePin(null)}
              onClick={() => handleLaunchToPin(pin, idx)}
            >
              {/* Crisp Orbital Fiducial Node */}
              <div className="relative flex items-center justify-center p-2 group">
                <span
                  className="absolute w-3.5 h-3.5 rounded-full animate-ping opacity-40"
                  style={{ backgroundColor: pin.accentHex }}
                />
                <span
                  className="relative w-2 h-2 rounded-full border border-[#050507] shadow-sm transition-transform group-hover:scale-125"
                  style={{ backgroundColor: pin.accentHex }}
                />

                {/* Editorial Node Pill */}
                <span
                  className={`hidden sm:inline-flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full bg-[#08090C]/90 border text-[10px] font-mono whitespace-nowrap transition-all ${
                    isSelected
                      ? 'border-white/50 text-white opacity-100 shadow-[0_4px_16px_rgba(0,0,0,0.6)]'
                      : 'border-white/[0.12] text-[#8E95A5] opacity-85 group-hover:opacity-100 group-hover:border-white/30 group-hover:text-white'
                  }`}
                >
                  <span className="text-white/70">{pin.indexLabel}</span>
                  <span>{pin.name}</span>
                </span>
              </div>

              {/* Editorial Telemetry Popover */}
              {isHovered && (
                <div
                  className="absolute bottom-7 left-1/2 -translate-x-1/2 w-56 p-3.5 rounded-2xl bg-[#0A0B0E]/95 border border-white/[0.16] backdrop-blur-xl shadow-2xl text-left pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-150"
                  style={{ transformOrigin: 'bottom center' }}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-white font-medium">
                      {pin.indexLabel} · {pin.taskOrder}
                    </span>
                    <span className="text-[#8E95A5] tabular-nums">
                      {formatLunarCoordinates(pin.lon, pin.lat).combined}
                    </span>
                  </div>

                  <div className="font-sans font-semibold text-sm text-white leading-tight mb-0.5">
                    {pin.name}
                  </div>

                  <div className="text-[11px] text-[#8E95A5] leading-snug mb-2">
                    {pin.siteName} · {pin.region}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] text-[9.5px] font-mono text-[#CBD5E1]">
                    <span>{pin.status}</span>
                    <ArrowUpRight className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
