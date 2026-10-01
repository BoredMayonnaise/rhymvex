"use client";

import { useEffect, useRef, useState } from "react";
import { RvMark } from "@/components/RvMark";

const PHRASES = [
  "Build with rhythm.",
  "Patterns, solved.",
  "Design. Systems. Impact.",
] as const;

/** Seconds of travel per pixel of phrase, so speed stays constant at any width. */
const SECONDS_PER_PX = 0.048;

/**
 * Enough copies rendered before measurement runs, so the first paint is never
 * short on wide screens. The effect trims this to the minimum that covers.
 */
const SAFE_COPIES = 6;

/**
 * One copy of the phrase set. The separator (mark + trailing gap) lives inside
 * the unit, so the gap between the last phrase of one copy and the first mark
 * of the next is identical to every other gap — no jump at the loop point.
 */
function Copy() {
  return (
    <>
      {PHRASES.map((phrase) => (
        <span key={phrase} className="flex shrink-0 items-center gap-10 pe-10">
          <RvMark className="size-5 shrink-0 opacity-50" label={null} />
          <span className="whitespace-nowrap font-display text-base text-rhymvex-white/45">
            {phrase}
          </span>
        </span>
      ))}
    </>
  );
}

/**
 * Slow brand ticker.
 *
 * Copies are rendered to cover the viewport plus one, then the track slides by
 * exactly one copy width (calc(-100% / copies)) rather than -50%. Shifting by
 * 50% is only seamless with exactly two copies — on a wide screen the right
 * edge runs out of track and the band visibly empties.
 *
 * Edges fade via a mask so phrases dissolve instead of being sliced mid-word.
 */
export function Marquee() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(SAFE_COPIES);
  const [seconds, setSeconds] = useState(36);

  useEffect(() => {
    const wrap = wrapRef.current;
    const probe = probeRef.current;
    if (!wrap || !probe) return;

    const measure = () => {
      const unit = probe.getBoundingClientRect().width;
      if (!unit) return;
      setCopies(Math.max(2, Math.ceil(wrap.clientWidth / unit) + 1));
      setSeconds(Number((unit * SECONDS_PER_PX).toFixed(2)));
    };

    measure();

    // Observe the probe, not just the container: when the display webfont
    // swaps in, the phrases change width and the copy count and duration have
    // to be recomputed, but the container width never changes.
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    observer.observe(probe);

    document.fonts?.ready.then(measure).catch(() => {});

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="rv-marquee-mask overflow-hidden border-y border-rhymvex-white/10 bg-rhymvex-slate/40 py-5"
      aria-hidden="true"
    >
      {/* Off-screen probe: one copy, measured, never painted. Must mirror the
          real copy wrapper exactly or it measures a different width. */}
      <div
        ref={probeRef}
        className="pointer-events-none absolute flex h-0 w-max items-center overflow-hidden opacity-0"
        aria-hidden="true"
      >
        <Copy />
      </div>

      <div
        className="rv-marquee-track flex w-max items-center"
        style={
          {
            "--rv-marquee-copies": copies,
            "--rv-marquee-duration": `${seconds}s`,
          } as React.CSSProperties
        }
      >
        {Array.from({ length: copies }).map((_, i) => (
          <div key={i} className="flex shrink-0 items-center">
            <Copy />
          </div>
        ))}
      </div>
    </div>
  );
}
