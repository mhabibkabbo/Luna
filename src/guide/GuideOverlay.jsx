/**
 * @file GuideOverlay.jsx
 * Spotlight coachmark tour overlay.
 * Renders a darkened backdrop with a transparent cut-out spotlight hole around the active UI target,
 * an anchored popover with smart placement flipping, step controls, and a mobile bottom sheet.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Compass,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import {
  guideStore,
  nextGuideStep,
  prevGuideStep,
  skipGuide,
  startGuide,
  dismissPrompt,
} from './guideStore.js';

const PADDING = 8;
const BORDER_RADIUS = 8;

export default function GuideOverlay({
  context = {},
  isOtherModalOpen = false,
  isTourActive = false,
}) {
  const [guideState, setGuideState] = useState(() => guideStore.get());
  const [targetRect, setTargetRect] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isWaitingForTarget, setIsWaitingForTarget] = useState(false);
  const popoverRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Subscribe to guideStore
  useEffect(() => {
    return guideStore.subscribe((state) => {
      setGuideState(state);
    });
  }, []);

  // Screen size check for mobile layout (< 640px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const activeStep =
    guideState.isActive && guideState.steps.length > 0
      ? guideState.steps[guideState.activeStepIndex]
      : null;

  // Measure target and recompute position
  const updateTargetRect = useCallback(() => {
    if (!activeStep || !activeStep.target) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(activeStep.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      // Verify rect is visible in viewport
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect({
          top: Math.max(0, rect.top - PADDING),
          left: Math.max(0, rect.left - PADDING),
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
          rawTop: rect.top,
          rawLeft: rect.left,
          rawBottom: rect.bottom,
          rawRight: rect.right,
          rawWidth: rect.width,
          rawHeight: rect.height,
        });
        return;
      }
    }
    setTargetRect(null);
  }, [activeStep]);

  // Handle step activation, before() actions, and missing element resilience
  useEffect(() => {
    if (!guideState.isActive || !activeStep) {
      setTargetRect(null);
      return;
    }

    // Check prerequisites
    if (activeStep.requires && !activeStep.requires(context)) {
      // Step requires condition not met yet, attempt before() or skip
    }

    let isCancelled = false;

    const setupStep = async () => {
      // Run before() if declared
      if (typeof activeStep.before === 'function') {
        try {
          await activeStep.before(context);
        } catch (err) {
          console.warn('[Guide] Error running before() hook:', err);
        }
      }

      if (isCancelled) return;

      if (!activeStep.target) {
        // Text-only step, center modal
        setTargetRect(null);
        setIsWaitingForTarget(false);
        return;
      }

      // Check for target element in DOM with a retry timeout up to ~500ms
      const el = document.querySelector(activeStep.target);
      if (el) {
        updateTargetRect();
        setIsWaitingForTarget(false);
      } else {
        setIsWaitingForTarget(true);
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (isCancelled) {
            clearInterval(checkInterval);
            return;
          }
          const found = document.querySelector(activeStep.target);
          if (found) {
            clearInterval(checkInterval);
            setIsWaitingForTarget(false);
            updateTargetRect();
          } else if (Date.now() - startTime > 500) {
            clearInterval(checkInterval);
            setIsWaitingForTarget(false);
            // Element not found after 500ms, skip silently to prevent breaking UI
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `[Guide dev check] Target '${activeStep.target}' for step '${activeStep.id}' was not found after 500ms. Skipping step.`
              );
            }
            nextGuideStep();
          }
        }, 50);
      }
    };

    setupStep();

    return () => {
      isCancelled = true;
    };
  }, [guideState.isActive, activeStep, context, updateTargetRect]);

  // Observe target element resizing and window resize / scroll
  useEffect(() => {
    if (!guideState.isActive || !activeStep || !activeStep.target) return;

    const el = document.querySelector(activeStep.target);
    if (!el) return;

    if (window.ResizeObserver) {
      resizeObserverRef.current = new ResizeObserver(() => {
        updateTargetRect();
      });
      resizeObserverRef.current.observe(el);
    }

    const handleScrollOrResize = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [guideState.isActive, activeStep, updateTargetRect]);

  // Keyboard navigation when guide is active
  useEffect(() => {
    if (!guideState.isActive) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        skipGuide();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        nextGuideStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        prevGuideStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Capture phase to prevent app handler
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [guideState.isActive]);

  // If another modal or tour is active, suppress overlay
  if (isTourActive || isOtherModalOpen) return null;

  // 1. First-Visit Prompt Modal ("Take the tour / Skip")
  if (guideState.isPromptOpen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-welcome-title"
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      >
        <div className="bg-[#070b14] border border-cyan-500/40 rounded-2xl max-w-md w-full p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-4 text-white animate-in zoom-in-95 duration-150">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 id="guide-welcome-title" className="text-base font-bold tracking-tight text-white">
                Welcome to Luna Mission Platform
              </h3>
              <p className="text-xs text-slate-400">
                NASA Lunar Landing Site Exploration & Telemetry
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Would you like a quick spotlight walkthrough of the key operational controls, 3D/2D GIS
            maps, and mission analysis tools?
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => dismissPrompt(guideState.activeView)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => startGuide(guideState.activeView)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-[0_0_12px_rgba(6,182,212,0.4)] flex items-center gap-1.5"
            >
              Take the tour
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!guideState.isActive || !activeStep) return null;

  // Calculate Popover Position & Smart Viewport Flipping
  const getPopoverStyle = () => {
    if (isMobile) {
      return {}; // Handled by bottom sheet CSS
    }

    if (!targetRect) {
      // Centered modal
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const { rawTop, rawLeft, rawBottom, rawRight, rawWidth, rawHeight } = targetRect;
    const placement = activeStep.placement || 'bottom';
    const popoverWidth = 320;
    const popoverHeight = 180;
    const margin = 12;

    let computedTop = 0;
    let computedLeft = 0;

    switch (placement) {
      case 'bottom': {
        computedTop = rawBottom + margin;
        computedLeft = rawLeft + rawWidth / 2 - popoverWidth / 2;
        // Flip to top if overflowing bottom
        if (computedTop + popoverHeight > window.innerHeight) {
          computedTop = Math.max(margin, rawTop - popoverHeight - margin);
        }
        break;
      }
      case 'top': {
        computedTop = rawTop - popoverHeight - margin;
        computedLeft = rawLeft + rawWidth / 2 - popoverWidth / 2;
        // Flip to bottom if overflowing top
        if (computedTop < margin) {
          computedTop = rawBottom + margin;
        }
        break;
      }
      case 'right': {
        computedLeft = rawRight + margin;
        computedTop = rawTop + rawHeight / 2 - popoverHeight / 2;
        // Flip to left if overflowing right
        if (computedLeft + popoverWidth > window.innerWidth) {
          computedLeft = Math.max(margin, rawLeft - popoverWidth - margin);
        }
        break;
      }
      case 'left': {
        computedLeft = rawLeft - popoverWidth - margin;
        computedTop = rawTop + rawHeight / 2 - popoverHeight / 2;
        // Flip to right if overflowing left
        if (computedLeft < margin) {
          computedLeft = rawRight + margin;
        }
        break;
      }
      default: {
        computedTop = rawBottom + margin;
        computedLeft = rawLeft;
      }
    }

    // Clamp horizontally to stay inside viewport
    computedLeft = Math.max(margin, Math.min(window.innerWidth - popoverWidth - margin, computedLeft));
    computedTop = Math.max(margin, Math.min(window.innerHeight - popoverHeight - margin, computedTop));

    return {
      top: `${computedTop}px`,
      left: `${computedLeft}px`,
    };
  };

  const isLastStep = guideState.activeStepIndex === guideState.steps.length - 1;
  const isFirstStep = guideState.activeStepIndex === 0;

  return (
    <div
      role="region"
      aria-label="Coachmark Guide"
      className="fixed inset-0 z-[60] pointer-events-auto select-none overflow-hidden"
    >
      {/* 2. Full-Screen Backdrop with Spotlight Cut-Out */}
      {targetRect ? (
        <div
          data-testid="spotlight-hole"
          className="fixed transition-all duration-300 ease-out pointer-events-none"
          style={{
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
            borderRadius: `${BORDER_RADIUS}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.72)',
            border: '2px solid rgba(0, 210, 196, 0.85)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity duration-200" />
      )}

      {/* 3. Popover Card or Mobile Bottom Sheet */}
      <div
        ref={popoverRef}
        className={`fixed z-[61] ${
          isMobile
            ? 'bottom-0 left-0 right-0 rounded-t-2xl p-4 bg-[#070b14] border-t border-cyan-500/40 shadow-2xl animate-in slide-in-from-bottom duration-200'
            : 'w-80 rounded-xl p-4 bg-[#070b14]/95 backdrop-blur-md border border-cyan-500/50 shadow-[0_16px_40px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200'
        } text-white`}
        style={getPopoverStyle()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
              {guideState.mode === 'whats-new' ? "What's New" : 'Guide'}{' '}
              <span className="text-slate-400 font-normal">
                ({guideState.activeStepIndex + 1}/{guideState.steps.length})
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={skipGuide}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/60 transition-colors"
            title="Skip tour [Esc]"
            aria-label="Skip tour"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Title & Body */}
        <div className="mb-3">
          <h4 className="text-sm font-bold text-white tracking-tight mb-1">
            {activeStep.title}
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {activeStep.body}
          </p>
        </div>

        {/* Step Dots & Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          {/* Step Dots */}
          <div className="flex items-center gap-1">
            {guideState.steps.map((step, idx) => (
              <span
                key={step.id}
                className={`h-1.5 rounded-full transition-all ${
                  idx === guideState.activeStepIndex
                    ? 'w-4 bg-cyan-400'
                    : idx < guideState.activeStepIndex
                    ? 'w-1.5 bg-cyan-600/60'
                    : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1.5">
            {!isFirstStep && (
              <button
                type="button"
                onClick={prevGuideStep}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
                title="Previous step [←]"
              >
                <ChevronLeft className="w-3 h-3" />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={nextGuideStep}
              className="px-3 py-1 rounded-md text-[11px] font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-[0_0_8px_rgba(6,182,212,0.3)] flex items-center gap-1"
              title={isLastStep ? 'Finish tour [Enter]' : 'Next step [→]'}
            >
              {isLastStep ? 'Got it' : 'Next'}
              {!isLastStep && <ChevronRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
