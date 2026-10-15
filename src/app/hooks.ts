import { useEffect, useState } from 'react';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Counts from 0 to `target` over ~600ms when `animate` is true; otherwise returns the number. */
export function useCountUp(target: number, animate: boolean): number {
  const run = animate && !prefersReducedMotion();
  const [tick, setTick] = useState<{ target: number; value: number } | null>(null);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      setTick({ target, value: Math.round(target * (1 - (1 - k) ** 3)) });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  if (!run) return target;
  return tick && tick.target === target ? tick.value : 0;
}
