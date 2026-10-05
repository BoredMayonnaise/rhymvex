"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll state for a sticky brand header: whether it has passed the condense
 * threshold, and the reading-progress ratio for the volt line along its bottom
 * edge.
 *
 * One rAF-throttled listener drives both, because two listeners on the same
 * scroll event is one too many. The ratio is written straight to the DOM through
 * the returned ref rather than held in state, so tracking reading position
 * never re-renders the header or anything below it.
 *
 * Lives here rather than in either header so the site bar and the intake bar
 * cannot drift apart again — they are meant to be the same bar.
 */
export function useScrollProgress() {
  const progressRef = useRef<HTMLSpanElement>(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setCondensed(y > 12);

      const bar = progressRef.current;
      if (!bar) return;
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const ratio =
        scrollable > 0 ? Math.min(1, Math.max(0, y / scrollable)) : 0;
      bar.style.transform = `scaleX(${ratio})`;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return { progressRef, condensed };
}
