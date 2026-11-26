import { useEffect, useRef } from 'react';

/** `modus-wc-modal` renders a native <dialog> whose id is the `modalId` prop. */
export function getDialog(modalId) {
  return document.getElementById(modalId);
}

/**
 * Run `onClose` for every dismiss path (close button, Escape, backdrop click, `.close()`).
 * The native `close` event does not bubble, so listen in the capture phase on the document.
 * That also works before Stencil has rendered the inner <dialog>, unlike getElementById + addEventListener.
 */
export function useDialogClose(modalId, onClose) {
  const handlerRef = useRef(onClose);

  useEffect(() => {
    handlerRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const listener = (event) => {
      if (event.target?.id === modalId) handlerRef.current?.(event);
    };
    document.addEventListener('close', listener, true);
    return () => document.removeEventListener('close', listener, true);
  }, [modalId]);
}

/**
 * Call `showModal()` as soon as the inner <dialog> exists (Stencil upgrades the element lazily).
 * Returns a cancel function for effect cleanup.
 */
export function showDialogWhenReady(modalId, onShown) {
  let frame = 0;
  let attempts = 0;
  const tryOpen = () => {
    const dialog = getDialog(modalId);
    if (dialog && typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
      onShown?.(dialog);
      return;
    }
    attempts += 1;
    if (attempts < 120) frame = window.requestAnimationFrame(tryOpen);
  };
  tryOpen();
  return () => window.cancelAnimationFrame(frame);
}
