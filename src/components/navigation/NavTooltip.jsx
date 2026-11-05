import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Animated, accessible tooltip pill for navigation buttons.
 * When hovered, emerges smoothly to the right of the button.
 * Uses createPortal into document.body with exact viewport coordinates so it escapes
 * any ancestor backdrop-filter/transform containing blocks and aligns perfectly with the button.
 */
export default function NavTooltip({
  children,
  label,
  shortcut,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);

const updateCoords = () => {
    if (!triggerRef.current) return;

    // Measure the actual button (first child) to ignore any wrapper stretching
    const targetElement = triggerRef.current.firstElementChild || triggerRef.current;
    const rect = targetElement.getBoundingClientRect();

    setCoords({
      top: rect.top + rect.height / 2 -15,
      left: rect.right + 10,
    });
  };

  const handleOpen = () => {
    updateCoords();
    setIsVisible(true);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    if (!isVisible) return;

    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);

    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isVisible]);

  const tooltipPortal =
    isVisible && label && coords && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            // Changed z-100 (invalid Tailwind) to z-[100]
            className="fixed -translate-y-1/2 z-[100] pointer-events-none rounded-xl bg-[#080E18]/95 border border-[#16283C] shadow-[0_8px_25px_rgba(0,0,0,0.85),0_0_12px_rgba(0,210,196,0.18)] backdrop-blur-xl px-2.5 py-1.5 flex items-center gap-2 whitespace-nowrap animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-100 ease-out"
          >
            {/* Subtle pointer arrow pointing back to the button */}
            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#080E18] border-l border-b border-[#16283C] rotate-45 pointer-events-none" />

            {/* Label name */}
            <span className="text-xs font-semibold font-sans text-white tracking-tight">
              {label}
            </span>

            {/* Optional keyboard shortcut */}
            {shortcut && (
              <kbd className="px-1.5 py-0.5 rounded bg-[#0D1726] border border-[#16283C] text-[#00D2C4] text-[9.5px] font-mono font-bold leading-none shrink-0 shadow-inner">
                {shortcut}
              </kbd>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={triggerRef}
      // Changed 'flex' to 'inline-flex' so the wrapper shrinks to exactly fit the button
      className="relative inline-flex items-center justify-center"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
    >
      {children}
      {tooltipPortal}
    </div>
  );
}
