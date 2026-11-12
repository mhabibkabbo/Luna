import { useEffect, useId, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(', ');

/**
 * Shared accessibility hook for modal dialogs: manages focus trapping,
 * initial focus, Escape dismissal, and restoring prior focus on close.
 */
export function useDialogA11y({ isOpen, onClose, containerRef, restoreFocus = true }) {
  const titleId = useId();
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const rafId = requestAnimationFrame(() => {
      const container = containerRef?.current;
      if (!container) return;
      if (!container.contains(document.activeElement)) {
        container.focus({ preventScroll: true });
      }
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (e.key !== 'Tab') return;
      const container = containerRef?.current;
      if (!container) return;

      const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el instanceof HTMLElement && (el.offsetParent !== null || el === document.activeElement)
      );

      if (focusables.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = container.contains(active);

      if (e.shiftKey) {
        if (!inside || active === first || active === container) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown, true);
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (restoreFocus && prev && prev.isConnected) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [isOpen, containerRef, restoreFocus]);

  return { titleId };
}
