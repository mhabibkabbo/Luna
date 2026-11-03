import React from 'react';

/**
 * Standardized Luna Brand Wordmark & Studio Emblem.
 * Styled after Hamol Studio & Two-Do warm editorial aesthetic.
 */
export default function LunaBrandLogo({
  asButton = false,
  onClick,
  className = '',
  title = 'Luna — Spatial Lunar Mission & Site Studio',
}) {
  const content = (
    <div className={`flex items-center gap-2.5 shrink-0 group ${className}`}>
      <div className="w-8 h-8 rounded-xl bg-[#0D1726] border border-[#16283C] flex items-center justify-center group-hover:border-[#00D2C4]/60 transition-colors duration-200">
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 12 3 A 9 9 0 1 0 18.5 18 A 8 8 0 1 1 12 3 Z"
            className="fill-[#F1F5F9] group-hover:fill-[#00D2C4] transition-colors duration-200"
          />
          <circle cx="8" cy="11.5" r="0.85" className="fill-[#34D399]" />
          <path
            d="M 3.5 19 C 5 11, 14 7, 19.5 9"
            stroke="#00D2C4"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <circle cx="19.5" cy="9" r="1.2" className="fill-[#34D399]" />
        </svg>
      </div>

      <div className="flex flex-col leading-none text-left">
        <span className="text-lg font-bold tracking-tight text-[#F1F5F9] group-hover:text-white transition-colors whitespace-nowrap">
          luna<span className="font-editorial italic font-normal text-[#00D2C4] ml-0.5">studio</span>
        </span>
      </div>
    </div>
  );

  if (asButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="group flex items-center h-9 px-2 rounded-xl border border-transparent hover:border-[#16283C] hover:bg-[#0D1726]/80 focus:outline-none transition-all active:scale-[0.98]"
      >
        {content}
      </button>
    );
  }

  return content;
}
