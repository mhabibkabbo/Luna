import React, { useState, useEffect, useRef } from 'react';

/**
 * Full-screen cinematic "L U N A" intro animation shown when the user first visits the page,
 * prior to revealing the Landing Page.
 *
 * Strictly silent (no audio). Combines the silent reference video asset with a pixel-matched
 * vector SVG stencil + lunar crater regolith texture + left-to-right solar terminator sweep
 * so the animation renders identically across all browsers and headless environments.
 */
export default function LunaIntroAnimation({ onComplete }) {
  const [phase, setPhase] = useState('playing'); // 'playing' | 'fading' | 'done'
  const [videoActive, setVideoActive] = useState(false);
  const [progress, setProgress] = useState(0); // 0.0 -> 1.0 over 3100ms
  const videoRef = useRef(null);
  const completedRef = useRef(false);

  const finishIntro = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase('fading');
    setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, 650);
  };

  useEffect(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.muted = true;
      vid.volume = 0;
      const playPromise = vid.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Fallback SVG animation continues seamlessly if video autoplay or codec is unavailable
        });
      }
    }

    const durationMs = 3120;
    const startTime = performance.now();
    let rafId = null;

    const tick = (now) => {
      const elapsed = now - startTime;
      const p = Math.min(1, Math.max(0, elapsed / durationMs));
      setProgress(p);
      if (elapsed < durationMs) {
        rafId = requestAnimationFrame(tick);
      } else {
        finishIntro();
      }
    };

    rafId = requestAnimationFrame(tick);

    const safetyTimer = setTimeout(() => {
      finishIntro();
    }, durationMs + 150);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(safetyTimer);
    };
  }, []);

  if (phase === 'done') return null;

  // Compute solar terminator sweep position from progress [0..1]
  // Matches the exact illumination curve of Luna_Intro_44a2585c.mp4:
  // 0.00 - 0.14: Deep lunar penumbra (slate-shadow stencil)
  // 0.14 - 0.82: Left-to-right solar terminator sweep across L -> U -> N -> A
  // 0.82 - 1.00: Gentle dusk attenuation before dissolving to Landing Page
  const sweepNorm = Math.min(1, Math.max(0, (progress - 0.1) / 0.72));
  const sweepCenterX = -80 + sweepNorm * 640; // across viewBox width 484

  // Overall sunlit intensity envelope (ramps up 0.08 -> 0.82, then dims 0.82 -> 1.00)
  const duskDimming =
    progress > 0.82 ? Math.max(0.28, 1 - ((progress - 0.82) / 0.18) * 0.68) : 1;
  const dawnRamp = Math.min(1, Math.max(0.08, (progress - 0.05) / 0.22));
  const sunlitOpacity = dawnRamp * duskDimming;

  return (
    <div
      role="presentation"
      aria-hidden="true"
      onClick={finishIntro}
      className={`fixed inset-0 z-[120] bg-black flex items-center justify-center overflow-hidden select-none transition-opacity duration-700 ease-out ${
        phase === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 1. Native Silent Video Layer (Strictly Muted, Zero Audio) */}
      <video
        ref={videoRef}
        src="/assets/aistudio/Luna_Intro_44a2585c.mp4"
        muted
        playsInline
        autoPlay
        preload="auto"
        onLoadedMetadata={(e) => {
          e.currentTarget.muted = true;
          e.currentTarget.volume = 0;
        }}
        onVolumeChange={(e) => {
          if (!e.currentTarget.muted || e.currentTarget.volume !== 0) {
            e.currentTarget.muted = true;
            e.currentTarget.volume = 0;
          }
        }}
        onPlaying={() => setVideoActive(true)}
        onError={() => setVideoActive(false)}
        onEnded={finishIntro}
        className={`w-full max-w-[1280px] h-auto max-h-screen object-contain pointer-events-none transition-opacity duration-150 ${
          videoActive ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          mixBlendMode: 'lighten',
          filter: 'contrast(1.06)',
        }}
      />

      {/* 2. Pixel-Matched Vector Stencil & Lunar Terminator Sweep Animation */}
      <div
        className={`absolute inset-0 flex items-center justify-center px-6 pointer-events-none transition-opacity duration-150 ${
          videoActive ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <svg
          viewBox="0 0 484 102"
          className="w-[74vw] max-w-[484px] h-auto overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Primary Sunlit Stencil Paths (L, U, N, A) matching Luna_Intro_44a2585c.mp4 */}
            <clipPath id="luna-intro-stencil-primary">
              {/* L: Vertical stem with 45° bottom bevel + horizontal base with 45° left bevel */}
              <path d="M 2 1 L 20 1 L 20 61 L 2 79 Z" />
              <path d="M 18 85 L 70 85 L 70 101 L 2 101 Z" />

              {/* U: Left vertical stem curving into rounded base and lower-right stem */}
              <path d="M 122 1 L 140 1 L 140 60 A 26 23 0 0 0 192 60 L 192 58 L 210 58 L 210 62 A 44 39 0 0 1 122 62 Z" />

              {/* N: Diagonal bar + right vertical stem with 45° bottom bevel */}
              <path d="M 245 16 L 245 41 L 311 98 L 311 1 L 293 1 L 293 58 Z" />

              {/* A: Chevron apex + left leg + upper-right leg + stencil-separated lower-right foot */}
              <path d="M 435 1 L 440 1 L 469 65 L 450 65 L 436 33 L 406 101 L 387 101 Z" />
              <path d="M 458 84 L 477 84 L 484 101 L 465 101 Z" />
            </clipPath>

            {/* Secondary Penumbra Stencil Stems (faintly visible in lunar night shadow) */}
            <clipPath id="luna-intro-stencil-penumbra">
              {/* U upper-right stem */}
              <path d="M 192 1 L 210 1 L 210 52 L 192 52 Z" />
              {/* N lower-left stem */}
              <path d="M 245 48 L 263 63 L 263 101 L 245 101 Z" />
            </clipPath>

            {/* Sweeping Solar Terminator Mask */}
            <linearGradient
              id="luna-terminator-gradient"
              gradientUnits="userSpaceOnUse"
              x1={sweepCenterX - 160}
              y1="0"
              x2={sweepCenterX + 95}
              y2="18"
            >
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="82%" stopColor="#8892A0" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>

            <mask id="luna-solar-sweep-mask">
              <rect x="-100" y="-20" width="700" height="150" fill="url(#luna-terminator-gradient)" />
            </mask>

            {/* Specular Glint Gradient at the Leading Edge of the Solar Terminator */}
            <linearGradient
              id="luna-terminator-glint"
              gradientUnits="userSpaceOnUse"
              x1={sweepCenterX - 35}
              y1="0"
              x2={sweepCenterX + 45}
              y2="0"
            >
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="50%" stopColor="#F8FAFC" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>

            {/* High-Contrast Lunar Crater Filter */}
            <filter id="luna-regolith-contrast" x="-5%" y="-5%" width="110%" height="110%">
              <feColorMatrix
                type="matrix"
                values="0.38 0.38 0.38 0 -0.06
                        0.37 0.37 0.37 0 -0.05
                        0.36 0.36 0.36 0 -0.04
                        0    0    0    1  0"
              />
            </filter>
          </defs>

          {/* Layer A: Deep Lunar Night Base (Cold Slate Penumbra across all letterforms) */}
          <g clipPath="url(#luna-intro-stencil-penumbra)" opacity={0.42 * duskDimming}>
            <rect x="0" y="0" width="484" height="102" fill="#0E131B" />
          </g>

          <g clipPath="url(#luna-intro-stencil-primary)">
            {/* Cold Bluish-Slate Earthshine Base */}
            <rect x="0" y="0" width="484" height="102" fill="#131923" opacity={0.85 * duskDimming} />
            <image
              href="/pictures/shackleton-polar-ridge.jpg"
              x="-20"
              y="-60"
              width="540"
              height="240"
              preserveAspectRatio="xMidYMid slice"
              opacity={0.14 * duskDimming}
              filter="url(#luna-regolith-contrast)"
            />

            {/* Layer B: Sunlit Lunar Surface Revealed by Sweeping Terminator */}
            <g mask="url(#luna-solar-sweep-mask)" opacity={sunlitOpacity}>
              <rect x="0" y="0" width="484" height="102" fill="#BCC1C8" />
              <image
                href="/pictures/shackleton-polar-ridge.jpg"
                x="-20"
                y="-60"
                width="540"
                height="240"
                preserveAspectRatio="xMidYMid slice"
                opacity="0.92"
                filter="url(#luna-regolith-contrast)"
              />
              {/* Specular Ridge Rim Glint */}
              <rect x="0" y="0" width="484" height="102" fill="url(#luna-terminator-glint)" />
            </g>
          </g>

          {/* Subtle Inner Edge Bevel Highlights on the Stencil Letters */}
          <g
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="0.65"
            opacity={0.28 * duskDimming}
          >
            <path d="M 2 1 L 20 1 L 20 61 L 2 79 Z" />
            <path d="M 18 85 L 70 85 L 70 101 L 2 101 Z" />
            <path d="M 122 1 L 140 1 L 140 60 A 26 23 0 0 0 192 60 L 192 58 L 210 58 L 210 62 A 44 39 0 0 1 122 62 Z" />
            <path d="M 245 16 L 245 41 L 311 98 L 311 1 L 293 1 L 293 58 Z" />
            <path d="M 435 1 L 440 1 L 469 65 L 450 65 L 436 33 L 406 101 L 387 101 Z" />
            <path d="M 458 84 L 477 84 L 484 101 L 465 101 Z" />
          </g>
        </svg>
      </div>
    </div>
  );
}
