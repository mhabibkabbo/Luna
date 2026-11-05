import React, { useState } from 'react';

/**
 * Accessible tooltip wrapper for compact navigation icons.
 * Shows tooltip on hover and keyboard focus without clipping.
 */
export default function NavTooltip({ children, label, shortcut, side = 'right' }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && label && (
        <div
          role="tooltip"
          className={`absolute z-50 pointer-events-none px-2.5 py-1 rounded-lg bg-[#0A1220]/95 border border-[#16283C] text-[11px] font-mono text-[#F1F5F9] whitespace-nowrap shadow-[0_4px_20px_rgba(0,0,0,0.8)] backdrop-blur-md animate-in fade-in duration-150 flex items-center gap-1.5 ${
            side === 'right'
              ? 'left-full ml-2.5 top-1/2 -translate-y-1/2'
              : side === 'bottom'
              ? 'top-full mt-2 left-1/2 -translate-x-1/2'
              : 'bottom-full mb-2 left-1/2 -translate-x-1/2'
          }`}
        >
          <span>{label}</span>
          {shortcut && (
            <kbd className="px-1.5 py-0.2 rounded bg-[#16283C] text-[#00D2C4] text-[9.5px] font-bold">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
}

