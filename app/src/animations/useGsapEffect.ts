import { useEffect, useRef } from 'react';

import { revealOnScroll } from './gsap';

/**
 * Runs an animation setup on mount and always tears it down on unmount.
 *
 * The callback receives the container element and may return a cleanup function.
 * GSAP contexts must be reverted when React unmounts, otherwise ScrollTriggers
 * keep references to detached nodes and leak.
 */
export function useGsapEffect(
  setup: (container: HTMLElement) => (() => void) | void,
  deps: React.DependencyList = [],
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    return setup(element) ?? undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

/** Convenience wrapper for the common "reveal children on scroll" case. */
export function useReveal(options: { stagger?: number; start?: string } = {}) {
  return useGsapEffect(
    (container) => revealOnScroll(container, options),
    [options.stagger, options.start],
  );
}