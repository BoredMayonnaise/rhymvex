"use client";

import { useEffect, useRef, useState } from "react";

/**
 * LoopVideo
 *
 * A muted, looping, decorative video that lives inside a bounded frame. It
 * replaces the scroll-scrubbed runways the home page used to have: the footage
 * stays, the page stops hijacking the scroll to show it.
 *
 *   - Plays only while on screen, and pauses when it leaves, so an off-screen
 *     reel never costs a decode.
 *   - Under `prefers-reduced-motion` it never plays: the poster is the frame.
 *   - `preload="none"` until it is near the viewport, so the first paint of the
 *     page does not wait on a couple of megabytes of video.
 *
 * Always decorative. It carries no information, so it is hidden from assistive
 * technology and has no controls.
 */
export function LoopVideo({
  mp4Src,
  webmSrc,
  posterSrc,
  className = "",
}: {
  mp4Src: string;
  webmSrc?: string;
  posterSrc: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setNear(true);
            if (!reduce.matches) video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(video);

    const onChange = () => {
      if (reduce.matches) video.pause();
    };
    reduce.addEventListener("change", onChange);

    return () => {
      observer.disconnect();
      reduce.removeEventListener("change", onChange);
    };
  }, []);

  return (
    <video
      ref={ref}
      aria-hidden="true"
      tabIndex={-1}
      muted
      loop
      playsInline
      preload={near ? "auto" : "none"}
      poster={posterSrc}
      className={`pointer-events-none h-full w-full object-cover ${className}`}
    >
      {webmSrc && <source src={webmSrc} type="video/webm" />}
      <source src={mp4Src} type="video/mp4" />
    </video>
  );
}
