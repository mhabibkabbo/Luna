import React, { useState, useEffect, useRef } from 'react';

export default function LunaIntroAnimation({ onComplete }) {
  const [phase, setPhase] = useState('playing'); // 'playing' | 'fading' | 'done'
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);
  const fadeTimerRef = useRef(null);

  const finishIntro = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase('fading');
    fadeTimerRef.current = setTimeout(() => {
      setPhase('done');
      onComplete?.();
    }, 700);
  };

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      completedRef.current = true;
      setPhase('done');
      onComplete?.();
      return undefined;
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

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        finishIntro();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const safetyTimer = setTimeout(() => {
      finishIntro();
    }, durationMs + 150);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(safetyTimer);
      clearTimeout(fadeTimerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (phase === 'done') return null;

  const sweepNorm = Math.min(1, Math.max(0, (progress - 0.1) / 0.72));
  const sweepCenterX = -80 + sweepNorm * 640;

  const duskDimming =
    progress > 0.82 ? Math.max(0.28, 1 - ((progress - 0.82) / 0.18) * 0.68) : 1;
  const dawnRamp = Math.min(1, Math.max(0.08, (progress - 0.05) / 0.22));
  const sunlitOpacity = dawnRamp * duskDimming;

  return (
    <div
      onClick={finishIntro}
      className={`fixed inset-0 z-[120] bg-black flex items-center justify-center overflow-hidden transition-opacity duration-700 ease-out ${
        phase === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          finishIntro();
        }}
        className="absolute bottom-6 right-6 z-10 px-3.5 py-1.5 rounded-full border border-white/20 bg-white/[0.06] hover:bg-white/[0.14] text-xs font-mono text-slate-200 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        Skip Intro
      </button>

      <div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none"
      >
        <svg
          viewBox="0 0 484 102"
          className="w-[74vw] max-w-[484px] h-auto overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id="luna-intro-stencil-primary">
              <path d="M 2 1 L 20 1 L 20 61 L 2 79 Z" />
              <path d="M 18 85 L 70 85 L 70 101 L 2 101 Z" />

              <path d="M 122 1 L 140 1 L 140 60 A 26 23 0 0 0 192 60 L 192 58 L 210 58 L 210 62 A 44 39 0 0 1 122 62 Z" />

              <path d="M 245 16 L 245 41 L 311 98 L 311 1 L 293 1 L 293 58 Z" />

              <path d="M 435 1 L 440 1 L 469 65 L 450 65 L 436 33 L 406 101 L 387 101 Z" />
              <path d="M 458 84 L 477 84 L 484 101 L 465 101 Z" />
            </clipPath>

            <clipPath id="luna-intro-stencil-penumbra">
              <path d="M 192 1 L 210 1 L 210 52 L 192 52 Z" />
              <path d="M 245 48 L 263 63 L 263 101 L 245 101 Z" />
            </clipPath>

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

          <g clipPath="url(#luna-intro-stencil-penumbra)" opacity={0.42 * duskDimming}>
            <rect x="0" y="0" width="484" height="102" fill="#0E131B" />
          </g>

          <g clipPath="url(#luna-intro-stencil-primary)">
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
              <rect x="0" y="0" width="484" height="102" fill="url(#luna-terminator-glint)" />
            </g>
          </g>

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
