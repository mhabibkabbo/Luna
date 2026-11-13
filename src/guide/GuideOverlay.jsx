import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import { useDialogA11y } from '../hooks/useDialogA11y.js';

const PADDING = 8;
const BORDER_RADIUS = 8;
const COMPACT_VIEWPORT_BREAKPOINT = 1024;

export default function GuideOverlay({
  context = {},
  isOtherModalOpen = false,
}) {
  const [guideState, setGuideState] = useState(() => guideStore.get());
  const [targetRect, setTargetRect] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isWaitingForTarget, setIsWaitingForTarget] = useState(false);
  const [popoverHeight, setPopoverHeight] = useState(210);
  const popoverRef = useRef(null);
  const welcomeDialogRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const handleDismissPrompt = useCallback(() => {
    dismissPrompt(guideState.activeView);
  }, [guideState.activeView]);

  useDialogA11y({
    isOpen: !isOtherModalOpen && Boolean(guideState.isPromptOpen),
    onClose: handleDismissPrompt,
    containerRef: welcomeDialogRef,
  });

  useEffect(() => {
    if (isOtherModalOpen || !guideState.isActive) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipGuide();
      } else if (e.key === 'ArrowRight') {
        nextGuideStep();
      } else if (e.key === 'ArrowLeft' && guideState.activeStepIndex > 0) {
        prevGuideStep();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOtherModalOpen, guideState.isActive, guideState.activeStepIndex]);

  useLayoutEffect(() => {
    if (!guideState.isActive || !popoverRef.current) return;
    const measured = popoverRef.current.offsetHeight;
    if (measured > 0) setPopoverHeight(measured);
  }, [guideState.isActive, guideState.activeStepIndex, isMobile]);

  useEffect(() => {
    return guideStore.subscribe((state) => {
      setGuideState(state);
    });
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < COMPACT_VIEWPORT_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const activeStep =
    guideState.isActive && guideState.steps.length > 0
      ? guideState.steps[guideState.activeStepIndex]
      : null;
  const targetSelector =
    isMobile && activeStep?.mobileTarget ? activeStep.mobileTarget : activeStep?.target;
  const stepBody =
    activeStep?.bodyByViewMode?.[context.viewMode] || activeStep?.body;

  const updateTargetRect = useCallback(() => {
    if (!activeStep || !targetSelector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const left = Math.max(0, rect.left - PADDING);
        const top = Math.max(0, rect.top - PADDING);
        const right = Math.min(window.innerWidth, rect.right + PADDING);
        const bottom = Math.min(window.innerHeight, rect.bottom + PADDING);
        if (right <= left || bottom <= top) {
          setTargetRect(null);
          return;
        }
        setTargetRect({
          top,
          left,
          width: right - left,
          height: bottom - top,
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
  }, [activeStep, targetSelector]);

  useEffect(() => {
    if (!guideState.isActive || !activeStep) {
      setTargetRect(null);
      return;
    }

    context.setMobileToolbarOpen?.(Boolean(isMobile && activeStep.mobileToolbar));

    if (activeStep.requires && !activeStep.requires(context)) {
      // Step requires condition not met yet, attempt before() or skip
    }

    let isCancelled = false;

    const setupStep = async () => {
      if (typeof activeStep.before === 'function') {
        try {
          await activeStep.before(context);
        } catch (err) {
          console.warn('[Guide] Error running before() hook:', err);
        }
      }

      if (isCancelled) return;

      if (isMobile && activeStep.mobileToolbar) {
        const toolbarSelector = '[aria-label="Mobile visualization toolbar"]';
        const deadline = Date.now() + 500;
        let toolbar = document.querySelector(toolbarSelector);
        while (!toolbar && Date.now() < deadline && !isCancelled) {
          await new Promise((resolve) => setTimeout(resolve, 25));
          toolbar = document.querySelector(toolbarSelector);
        }
        if (toolbar) {
          const entranceAnimations = toolbar
            .getAnimations()
            .filter((animation) => animation.playState === 'running');
          await Promise.all(entranceAnimations.map((animation) => animation.finished.catch(() => {})));
        }
      }

      if (isCancelled) return;

      if (!targetSelector) {
        setTargetRect(null);
        setIsWaitingForTarget(false);
        return;
      }

      const el = document.querySelector(targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (
          isMobile &&
          window.getComputedStyle(el).position !== 'fixed' &&
          (rect.top < 0 || rect.bottom > window.innerHeight)
        ) {
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
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
          const found = document.querySelector(targetSelector);
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
                `[Guide dev check] Target '${targetSelector}' for step '${activeStep.id}' was not found after 500ms. Skipping step.`
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
  }, [guideState.isActive, activeStep, context, isMobile, targetSelector, updateTargetRect]);

  useEffect(() => {
    if (!guideState.isActive) {
      context.setMobileToolbarOpen?.(false);
    }
  }, [guideState.isActive]);

  useEffect(() => {
    if (!guideState.isActive || !activeStep || !targetSelector) return;

    const el = document.querySelector(targetSelector);
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
  }, [guideState.isActive, activeStep, targetSelector, updateTargetRect]);

  if (isOtherModalOpen) return null;

  if (guideState.isPromptOpen) {
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          ref={welcomeDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-welcome-title"
          tabIndex={-1}
          className="bg-[#0A0B0E] border border-white/[0.14] rounded-2xl max-w-md w-full max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-4 text-white animate-in zoom-in-95 duration-150 focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.14] flex items-center justify-center text-white shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 id="guide-welcome-title" className="text-base font-semibold tracking-tight text-white">
                Welcome to Luna Mission Platform
              </h3>
              <p className="text-xs text-[#8E95A5]">
                NASA Lunar Landing Site Exploration & Telemetry
              </p>
            </div>
          </div>

          <p className="text-xs text-[#CBD5E1] leading-relaxed">
            Would you like a quick spotlight walkthrough of the key operational controls, 3D/2D GIS
            maps, and mission analysis tools?
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={() => dismissPrompt(guideState.activeView)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#8E95A5] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={() => startGuide(guideState.activeView)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-[#E2E8F0] text-[#050507] transition-all flex items-center gap-1.5"
            >
              Take the tour
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!guideState.isActive || !activeStep) return null;

  // Calculate Popover Position & Smart Viewport Flipping
  const getPopoverStyle = () => {
    if (isMobile) {
      return {};
    }

    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const { rawTop, rawLeft, rawBottom, rawRight, rawWidth, rawHeight } = targetRect;
    const placement = activeStep.placement || 'bottom';
    const popoverWidth = 320;
    const measuredHeight = popoverHeight || 210;
    const margin = 12;

    let computedTop = 0;
    let computedLeft = 0;

    switch (placement) {
      case 'bottom': {
        computedTop = rawBottom + margin;
        computedLeft = rawLeft + rawWidth / 2 - popoverWidth / 2;
        if (computedTop + measuredHeight > window.innerHeight) {
          computedTop = Math.max(margin, rawTop - measuredHeight - margin);
        }
        break;
      }
      case 'top': {
        computedTop = rawTop - measuredHeight - margin;
        computedLeft = rawLeft + rawWidth / 2 - popoverWidth / 2;
        if (computedTop < margin) {
          computedTop = rawBottom + margin;
        }
        break;
      }
      case 'right': {
        computedLeft = rawRight + margin;
        computedTop = rawTop + rawHeight / 2 - measuredHeight / 2;
        if (computedLeft + popoverWidth > window.innerWidth) {
          computedLeft = Math.max(margin, rawLeft - popoverWidth - margin);
        }
        break;
      }
      case 'left': {
        computedLeft = rawLeft - popoverWidth - margin;
        computedTop = rawTop + rawHeight / 2 - measuredHeight / 2;
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
    computedTop = Math.max(margin, Math.min(window.innerHeight - measuredHeight - margin, computedTop));

    return {
      top: `${computedTop}px`,
      left: `${computedLeft}px`,
    };
  };

  const isLastStep = guideState.activeStepIndex === guideState.steps.length - 1;
  const isFirstStep = guideState.activeStepIndex === 0;
  const isMobilePopoverAtTop =
    isMobile &&
    ((activeStep.mobilePlacement === 'top' ||
      (targetRect && targetRect.rawTop + targetRect.rawHeight / 2 > window.innerHeight / 2)) && !activeStep.forceBottom);

  return createPortal(
    <div
      role="region"
      aria-label="Coachmark Guide"
      className="fixed inset-0 z-[60] pointer-events-none select-none overflow-hidden"
      style={{ height: '100dvh' }}
    >
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
            border: '2px solid rgba(248, 250, 252, 0.75)',
          }}
        />
      ) : (
        <div
          className={`fixed inset-0 pointer-events-none transition-opacity duration-200 ${
            activeStep.interactive ? 'bg-black/10' : 'bg-black/70 backdrop-blur-[2px]'
          }`}
        />
      )}

      <div
        ref={popoverRef}
        className={`fixed z-[61] ${
          isMobile
            ? `${isMobilePopoverAtTop ? 'top-0 left-0 right-0 max-h-[55dvh] rounded-b-2xl border animate-in slide-in-from-top' : 'bottom-0 left-0 right-0 max-h-[55dvh] rounded-t-2xl border-t animate-in slide-in-from-bottom'} overflow-y-auto overscroll-contain custom-scrollbar p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] bg-[#0A0B0E] border-white/[0.14] shadow-2xl duration-200`
            : 'w-80 rounded-xl p-4 bg-[#0A0B0E]/95 backdrop-blur-md border border-white/[0.16] shadow-[0_16px_40px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200'
        } pointer-events-auto text-white`}
        style={getPopoverStyle()}
        onPointerDown={(event) => event.stopPropagation()}
        data-guide-popover
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-white font-semibold">
              {guideState.mode === 'whats-new' ? "What's New" : 'Guide'}{' '}
              <span className="text-[#8E95A5] font-normal">
                ({guideState.activeStepIndex + 1}/{guideState.steps.length})
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={skipGuide}
            className="text-[#8E95A5] hover:text-white p-1 rounded hover:bg-white/[0.06] transition-colors"
            title="Skip tour"
            aria-label="Skip tour"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mb-3">
          <h4 className="text-sm font-semibold text-white tracking-tight mb-1">
            {activeStep.title}
          </h4>
          <p className="text-xs text-[#CBD5E1] leading-relaxed font-sans">
            {stepBody}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
          <div className="flex items-center gap-1">
            {guideState.steps.map((step, idx) => (
              <span
                key={step.id}
                className={`h-1.5 rounded-full transition-all ${
                  idx === guideState.activeStepIndex
                    ? 'w-4 bg-white'
                    : idx < guideState.activeStepIndex
                    ? 'w-1.5 bg-white/50'
                    : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {!isFirstStep && (
              <button
                type="button"
                onClick={prevGuideStep}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-[#CBD5E1] hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1"
                title="Previous step"
              >
                <ChevronLeft className="w-3 h-3" />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={nextGuideStep}
              className="px-3 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-[#E2E8F0] text-[#050507] transition-all flex items-center gap-1"
              title={isLastStep ? 'Finish tour' : 'Next step'}
            >
              {isLastStep ? 'Got it' : 'Next'}
              {!isLastStep && <ChevronRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
