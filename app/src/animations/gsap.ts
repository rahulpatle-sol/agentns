/**
 * GSAP setup, shared by every animated section.
 *
 * Two rules govern everything here:
 *   1. Motion is progressive enhancement. If GSAP fails to load, or the visitor
 *      has asked for reduced motion, content renders fully visible and static.
 *   2. Nothing animates *into* a hidden state that a failure could strand it in.
 *      The CSS baseline is "visible"; GSAP sets the start values on mount.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/** True when the visitor has asked the OS to reduce motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Reveal-on-scroll for a container's `[data-reveal]` children.
 *
 * Each child starts 18px low and fully transparent, then lifts and fades in as
 * it enters the viewport. `stagger` spaces siblings so a list cascades.
 *
 * Returns a cleanup function; safe to call even when animations are skipped.
 */
export function revealOnScroll(
  container: HTMLElement,
  options: { stagger?: number; start?: string; once?: boolean } = {},
): () => void {
  if (prefersReducedMotion()) return () => {};

  const targets = container.querySelectorAll('[data-reveal]');
  if (targets.length === 0) return () => {};

  const context = gsap.context(() => {
    gsap.fromTo(
      targets,
      { autoAlpha: 0, y: 18 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: options.stagger ?? 0.08,
        scrollTrigger: {
          trigger: container,
          start: options.start ?? 'top 82%',
          once: options.once ?? true,
        },
      },
    );
  }, container);

  return () => context.revert();
}

/**
 * Splits a headline into per-line masked reveals for the hero.
 *
 * Lines are wrapped in an overflow-hidden mask so text slides up from behind a
 * hard edge — the effect the reference uses — without a paid splitting plugin.
 */
export function heroLineReveal(container: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};

  const lines = container.querySelectorAll<HTMLElement>('[data-line]');
  if (lines.length === 0) return () => {};

  const context = gsap.context(() => {
    lines.forEach((line, index) => {
      const inner = line.firstElementChild;
      if (!inner) return;
      gsap.fromTo(
        inner,
        { yPercent: 112 },
        {
          yPercent: 0,
          duration: 1,
          ease: 'power4.out',
          delay: 0.12 + index * 0.09,
        },
      );
    });

    gsap.fromTo(
      container.querySelectorAll('[data-hero-fade]'),
      { autoAlpha: 0, y: 14 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.09,
        delay: 0.42,
      },
    );
  }, container);

  return () => context.revert();
}

/**
 * Horizontal marquee that loops seamlessly.
 *
 * The track holds two identical copies of the content and is translated by
 * exactly -50%, so the moment the first copy leaves, the second is in its place.
 * There is no visible jump and no duplicated DOM is read twice by a screen
 * reader (the clone is aria-hidden).
 */
export function marqueeLoop(track: HTMLElement, speedSeconds = 28): () => void {
  if (prefersReducedMotion()) return () => {};

  const context = gsap.context(() => {
    const half = track.scrollWidth / 2;
    if (half <= 0) return;

    const tween = gsap.to(track, {
      x: -half,
      duration: speedSeconds,
      ease: 'none',
      repeat: -1,
    });

    // Pause while off-screen so background tabs are not animating.
    ScrollTrigger.create({
      trigger: track,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? tween.play() : tween.pause()),
    });
  }, track);

  return () => context.revert();
}

/** Subtle parallax drift for the hero visual. Disabled under reduced motion. */
export function parallax(
  element: HTMLElement,
  strength = 40,
): () => void {
  if (prefersReducedMotion()) return () => {};

  const context = gsap.context(() => {
    gsap.to(element, {
      y: -strength,
      ease: 'none',
      scrollTrigger: {
        trigger: element.parentElement ?? element,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
      },
    });
  }, element);

  return () => context.revert();
}