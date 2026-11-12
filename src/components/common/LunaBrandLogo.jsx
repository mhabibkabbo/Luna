import React from 'react';

export function LunaStencilWordmark({ className = 'h-4 w-auto fill-white' }) {
  return (
    <svg
      viewBox="0 0 380 102"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M 2 1 L 20 1 L 20 61 L 2 79 Z" />
      <path d="M 18 85 L 70 85 L 70 101 L 2 101 Z" />

      <path d="M 90 1 L 108 1 L 108 60 A 26 23 0 0 0 160 60 L 160 58 L 178 58 L 178 62 A 44 39 0 0 1 90 62 Z" />
      <path d="M 160 1 L 178 1 L 178 52 L 160 52 Z" />

      <path d="M 197 16 L 197 41 L 263 98 L 263 1 L 245 1 L 245 58 Z" />
      <path d="M 197 48 L 215 63 L 215 101 L 197 101 Z" />

      <path d="M 329 1 L 334 1 L 363 65 L 344 65 L 330 33 L 300 101 L 281 101 Z" />
      <path d="M 352 84 L 371 84 L 378 101 L 359 101 Z" />
    </svg>
  );
}

export default function LunaBrandLogo({
  asButton = false,
  onClick,
  className = '',
  title = 'Luna — Spatial Lunar Mission & Site Studio',
  transparent = true,
  variant = 'studio', // 'studio' | 'stencil'
}) {
  const content = variant === 'stencil' ? (
    <div className={`flex items-center gap-2 shrink-0 group ${className}`}>
      <LunaStencilWordmark className="h-4 w-auto fill-white group-hover:fill-cyan-300 transition-colors" />
    </div>
  ) : (
    <div className={`flex items-center gap-2.5 shrink-0 group ${className}`}>
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${
          transparent
            ? 'bg-transparent border border-white/[0.14] group-hover:border-white/40 group-hover:bg-white/[0.04]'
            : 'bg-[#0C0D12] border border-white/[0.1] group-hover:border-white/30'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 12 3 A 9 9 0 1 0 18.5 18 A 8 8 0 1 1 12 3 Z"
            className="fill-white transition-colors duration-200"
          />
          <circle cx="8" cy="11.5" r="0.85" className="fill-[#94A3B8]" />
          <path
            d="M 3.5 19 C 5 11, 14 7, 19.5 9"
            stroke="#94A3B8"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <circle cx="19.5" cy="9" r="1.2" className="fill-white" />
        </svg>
      </div>

      <div className="flex flex-col leading-none text-left">
        <span className="text-base font-semibold tracking-[-0.02em] text-white group-hover:text-white transition-colors whitespace-nowrap">
          luna<span className="font-normal text-[#8E95A5] ml-1">studio</span>
        </span>
      </div>
    </div>
  );

  if (asButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        title={title}
        className="group flex items-center h-9 px-2 rounded-xl bg-transparent hover:bg-white/5 border border-transparent hover:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-all active:scale-[0.98]"
      >
        {content}
      </button>
    );
  }

  return content;
}
