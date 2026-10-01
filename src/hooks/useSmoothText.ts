import { useEffect, useRef, useState } from 'react';

/**
 * Revela o texto que chega em pedaços (stream) de forma contínua, letra a letra,
 * acelerando quando fica para trás. Sem saltos quando um pedaço grande chega.
 */
export function useSmoothText(target: string, live: boolean): string {
  const [shown, setShown] = useState(live ? '' : target);
  const pos = useRef(live ? 0 : target.length);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (!live) {
      pos.current = target.length;
      setShown(target);
    }
  }, [live, target]);

  useEffect(() => {
    if (!live) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const t = targetRef.current;
      if (pos.current > t.length) pos.current = t.length;
      const behind = t.length - pos.current;
      if (behind > 0) {
        // ~60 letras/s base; quanto mais atrasado, mais rápido (recupera em ~0,6 s).
        const speed = reduce ? Infinity : Math.max(60, behind / 0.6);
        pos.current = Math.min(t.length, pos.current + Math.max(1, Math.round((speed * dt) / 1000)));
        setShown(t.slice(0, pos.current));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live]);

  return shown;
}
