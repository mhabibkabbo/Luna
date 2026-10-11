import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const LUNAR_TEXTURES = [
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/lunar_surface.jpg',
  'https://unpkg.com/three-globe@2.31.0/example/img/lunar_surface.jpg',
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/moon_1024.jpg',
];

const LUNAR_BUMP_TEXTURES = [
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/lunar_bump.jpg',
  'https://unpkg.com/three-globe@2.31.0/example/img/lunar_bump.jpg',
];

/**
 * Procedural fallback canvas generator with realistic lunar craters and basaltic maria.
 */
function createProceduralMoonCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Anorthositic lunar highland base
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Volcanic basaltic maria (dark plains)
  const maria = [
    { x: 380, y: 190, rx: 110, ry: 75, color: '#334155' }, // Imbrium
    { x: 540, y: 220, rx: 70, ry: 60, color: '#334155' },  // Serenitatis
    { x: 620, y: 240, rx: 65, ry: 55, color: '#334155' },  // Tranquillitatis
    { x: 700, y: 220, rx: 55, ry: 45, color: '#2d3748' },  // Crisium
    { x: 260, y: 250, rx: 150, ry: 100, color: '#384252' }, // Oceanus Procellarum
    { x: 420, y: 310, rx: 70, ry: 45, color: '#334155' },  // Nubium
    { x: 500, y: 410, rx: 100, ry: 50, color: '#252e3d' }, // South Pole-Aitken
  ];

  maria.forEach((m) => {
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.filter = 'blur(16px)';
    ctx.fill();
  });
  ctx.filter = 'none';

  // Major crater ray systems (Tycho, Copernicus)
  const drawCrater = (cx, cy, r, rays = false) => {
    if (rays) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 18; i++) {
        const angle = (i * Math.PI) / 9;
        const len = r * (6 + (i % 3) * 3);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke();
      }
    }
    // Rim highlight
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    // Inner shadow floor
    ctx.beginPath();
    ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
  };

  drawCrater(460, 360, 14, true); // Tycho
  drawCrater(340, 210, 11, true); // Copernicus
  drawCrater(300, 220, 8, false); // Kepler
  drawCrater(510, 480, 7, false); // Malapert / South Pole

  return canvas;
}

/**
 * Three.js 3D Lunar Orb for Hero section.
 * Features realistic lunar photographic texture, bump mapping, sun terminator grazing light,
 * subtle orbital rotation, and gentle interaction.
 */
export default function HeroMoonCanvas({ onLaunchExplorer }) {
  const mountRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 2.65;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // Subtle star field in background
    const starCount = 300;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 15;
      starPositions[i + 1] = (Math.random() - 0.5) * 15;
      starPositions[i + 2] = -4 - Math.random() * 6;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.025,
      transparent: true,
      opacity: 0.65,
    });
    const starPoints = new THREE.Points(starGeometry, starMaterial);
    scene.add(starPoints);

    // Group for moon and markers
    const moonGroup = new THREE.Group();
    moonGroup.rotation.x = 0.08;
    moonGroup.rotation.y = 0.45;
    scene.add(moonGroup);

    // Sphere geometry
    const geometry = new THREE.SphereGeometry(1.0, 64, 64);

    // Texture Loader with fallback
    const textureLoader = new THREE.TextureLoader();
    let texture = null;
    let bumpTexture = null;

    const fallbackCanvas = createProceduralMoonCanvas();
    const fallbackTexture = new THREE.CanvasTexture(fallbackCanvas);

    // Create material initially with fallback canvas
    const material = new THREE.MeshStandardMaterial({
      map: fallbackTexture,
      roughness: 0.92,
      metalness: 0.02,
    });

    const moonMesh = new THREE.Mesh(geometry, material);
    moonGroup.add(moonMesh);

    // Attempt high-res texture load with fallback cascade
    const loadTextureWithFallback = (urls, onLoad) => {
      let index = 0;
      const tryNext = () => {
        if (index >= urls.length) return;
        textureLoader.load(
          urls[index],
          (loadedTex) => {
            loadedTex.colorSpace = THREE.SRGBColorSpace;
            loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
            onLoad(loadedTex);
            setIsLoaded(true);
          },
          undefined,
          () => {
            index++;
            tryNext();
          }
        );
      };
      tryNext();
    };

    loadTextureWithFallback(LUNAR_TEXTURES, (tex) => {
      material.map = tex;
      material.needsUpdate = true;
    });

    loadTextureWithFallback(LUNAR_BUMP_TEXTURES, (bTex) => {
      material.bumpMap = bTex;
      material.bumpScale = 0.04;
      material.needsUpdate = true;
    });

    // Landing site glowing markers on the Moon sphere
    // Coordinates: lat, lon -> 3D position
    const latLonToVector3 = (lat, lon, radius) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    };

    const markersData = [
      { name: 'IM-1 Odysseus', lat: -80.13, lon: 1.44, color: 0x06b6d4 },
      { name: 'Blue Ghost 1', lat: 18.56, lon: 61.81, color: 0x38bdf8 },
      { name: 'IM-2 PRIME-1', lat: -89.4, lon: 0.0, color: 0x22d3ee },
      { name: 'Apollo 11', lat: 0.67, lon: 23.47, color: 0xf59e0b },
    ];

    const markerGroup = new THREE.Group();
    moonMesh.add(markerGroup);

    markersData.forEach((m) => {
      const pos = latLonToVector3(m.lat, m.lon, 1.015);
      const dotGeo = new THREE.SphereGeometry(0.016, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: m.color });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      markerGroup.add(dot);

      // Ring pulse
      const ringGeo = new THREE.RingGeometry(0.022, 0.03, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: m.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos.clone().multiplyScalar(1.002));
      ring.lookAt(pos.clone().multiplyScalar(2));
      markerGroup.add(ring);
    });

    // Lighting: Sun directional light creating dramatic terminator shadows
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
    sunLight.position.set(3.5, 1.2, 2.5);
    scene.add(sunLight);

    // Subtle earthshine backfill
    const earthshine = new THREE.DirectionalLight(0x38bdf8, 0.25);
    earthshine.position.set(-3.5, -0.8, -1.0);
    scene.add(earthshine);

    // Ambient space light
    const ambientLight = new THREE.AmbientLight(0x0f172a, 0.35);
    scene.add(ambientLight);

    // Mouse interaction parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0.08;
    let targetRotationY = 0.45;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseX = x * 0.35;
      mouseY = y * 0.2;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Slow orbital rotation if motion allowed
      if (!prefersReducedMotion) {
        moonMesh.rotation.y += 0.0012;
      }

      // Parallax easing
      moonGroup.rotation.y += (targetRotationY + mouseX - moonGroup.rotation.y) * 0.04;
      moonGroup.rotation.x += (targetRotationX - mouseY - moonGroup.rotation.x) * 0.04;

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
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
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
      {/* 3D Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        title="Interactive 3D Moon - Drag or hover to explore"
      />

      {/* Atmospheric Glow Backdrop */}
      <div
        className="absolute inset-0 pointer-events-none -z-10 bg-radial-gradient from-cyan-500/10 via-transparent to-transparent blur-3xl opacity-60"
        style={{
          background:
            'radial-gradient(circle at 55% 48%, rgba(6, 182, 212, 0.12) 0%, rgba(15, 23, 42, 0.05) 50%, transparent 70%)',
        }}
      />
    </div>
  );
}
