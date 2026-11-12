import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

export default function NavTooltip({
  children,
  label,
  shortcut,
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const tooltipId = useId();

  const updateCoords = () => {
    if (!triggerRef.current || typeof window === 'undefined') return;

    const targetElement = triggerRef.current.firstElementChild || triggerRef.current;
    const rect = targetElement.getBoundingClientRect();
    const clampedTop = Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height / 2));
    const clampedLeft = Math.min(window.innerWidth - 180, rect.right + 10);

    setCoords({
      top: clampedTop,
      left: clampedLeft,
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

    const handleKey = (e) => {
      if (e.key === 'Escape') setIsVisible(false);
    };

    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isVisible]);

  const tooltipPortal =
    isVisible && label && coords && typeof document !== 'undefined'
      ? createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className="fixed z-[100] -translate-y-1/2 pointer-events-none"
          >
            <div className="relative flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.12] bg-[#0A0B0E]/95 px-2.5 py-1.5 shadow-[0_8px_25px_rgba(0,0,0,0.85)] backdrop-blur-xl animate-in fade-in zoom-in-95 slide-in-from-left-2 duration-100 ease-out">
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#0A0B0E] border-l border-b border-white/[0.12] rotate-45 pointer-events-none" />

              <span className="text-xs font-medium font-sans text-white tracking-tight">
                {label}
              </span>

              {shortcut && (
                <kbd className="px-1.5 py-0.5 rounded bg-[#050507] border border-white/[0.1] text-[#CBD5E1] text-[9.5px] font-mono font-medium leading-none shrink-0">
                  {shortcut}
                </kbd>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  const enhancedChild =
    label && React.isValidElement(children)
      ? React.cloneElement(children, {
          'aria-describedby': isVisible ? tooltipId : children.props['aria-describedby'],
        })
      : children;

  return (
    <div
      ref={triggerRef}
      // Changed 'flex' to 'inline-flex' so the wrapper shrinks to exactly fit the button
      className="relative inline-flex items-center justify-center"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
      onClick={handleClose}
    >
      {enhancedChild}
      {tooltipPortal}
    </div>
  );
}
