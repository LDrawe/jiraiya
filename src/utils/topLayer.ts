let supportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.CSS?.supports?.('overlay', 'auto')) &&
    canTransitionDisplay()
  );
}

/**
 * Animates closing a native `<dialog>` safely across browsers, falling back to
 * `data-closing` + `getAnimations()` when discrete `display`/`overlay` transitions
 * are unavailable (e.g. Firefox / older Safari).
 */
export async function closeDialogSmoothly(dialog: HTMLDialogElement): Promise<void> {
  if (!dialog.open) return;

  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }

  if (dialog.open) {
    dialog.close();
  }
}

/**
 * Fallback for `<dialog closedby="any">` in browsers that do not implement `HTMLDialogElement.closedBy`.
 * Checks pointerdown + pointerup outside the dialog bounding rect so text-selection drags never dismiss accidentally.
 */
export function attachDialogBackdropFallback(
  dialog: HTMLDialogElement,
  onRequestClose: () => void
): () => void {
  if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) {
    return () => {};
  }

  let pressedOutside = false;

  const isOutside = (e: PointerEvent): boolean => {
    const r = dialog.getBoundingClientRect();
    return (
      e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    );
  };

  const handlePointerDown = (e: PointerEvent): void => {
    pressedOutside = isOutside(e);
  };

  const handlePointerUp = (e: PointerEvent): void => {
    if (pressedOutside && isOutside(e)) {
      onRequestClose();
    }
    pressedOutside = false;
  };

  dialog.addEventListener('pointerdown', handlePointerDown);
  dialog.addEventListener('pointerup', handlePointerUp);

  return () => {
    dialog.removeEventListener('pointerdown', handlePointerDown);
    dialog.removeEventListener('pointerup', handlePointerUp);
  };
}

/**
 * Positions a dropdown panel relative to a trigger button while clamping strictly
 * inside the viewport edges (fallback when CSS Anchor Positioning `position-area` is unsupported).
 */
export function computeViewportSafeDropdownPosition(
  trigger: HTMLElement,
  panelWidth: number,
  panelEstimatedHeight = 320,
  alignEnd = true
): { top: number; left: number } {
  const rect = trigger.getBoundingClientRect();
  const margin = 12;
  const gap = 8;

  let left = alignEnd ? rect.right - panelWidth : rect.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

  let top = rect.bottom + gap;
  if (top + panelEstimatedHeight > window.innerHeight - margin && rect.top - gap - panelEstimatedHeight >= margin) {
    top = rect.top - panelEstimatedHeight - gap;
  }

  return { top, left };
}
