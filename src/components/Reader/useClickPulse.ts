import { useCallback, useRef } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const DURATION_MS = 110;
const PEAK_OPACITY = 0.05;

/**
 * The Reader has no visible buttons, so every click answers with a very short
 * screen dim. Driven by the Web Animations API so repeated taps restart cleanly.
 */
export function useClickPulse(): {
  pulseRef: React.RefObject<HTMLDivElement | null>;
  pulse: () => void;
} {
  const pulseRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const pulse = useCallback(() => {
    const element = pulseRef.current;
    if (element === null || reducedMotion || typeof element.animate !== 'function') return;
    element.animate([{ opacity: 0 }, { opacity: PEAK_OPACITY }, { opacity: 0 }], {
      duration: DURATION_MS,
      easing: 'ease-out',
    });
  }, [reducedMotion]);

  return { pulseRef, pulse };
}
