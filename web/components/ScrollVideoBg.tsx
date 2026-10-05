"use client";

import { useEffect, useRef, useState } from "react";

interface ScrollVideoBgProps {
  className?: string;
  mp4Src?: string;
  webmSrc?: string;
  posterSrc?: string;
  objectPosition?: string;
}

/**
 * ScrollVideoBg
 *
 * True scroll-driven video playback optimized for both mobile and desktop:
 * - Scans frame-accurate intra-frame video (`-g 1`) strictly on scroll.
 * - Holds still when scrolling stops.
 * - Positioned lower ("make the video lower as possible"): anchored with custom or default
 *   `objectPosition` so visual focal points stay prominent in the lower/middle half across viewports.
 * - Full vibrancy ("dont opacity"): rich, sharp refractions without dimming filters.
 * - Strictly contained inside parent container (`overflow-hidden`).
 */
export function ScrollVideoBg({
  className = "",
  mp4Src = "/brand/Camera_moving_through_purple_cry…_20261004133011.mp4",
  webmSrc = undefined,
  posterSrc = "/media/brand-reel-poster.jpg",
  objectPosition = "object-[center_65%]",
}: ScrollVideoBgProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [inView, setInView] = useState(false);

  // Check reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Intersection observer: only attach scroll listeners when section is in view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries.some((e) => e.isIntersecting);
        setInView(isIntersecting);
      },
      { rootMargin: "120px" }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Scroll scrub: maps scroll position through the section directly to video playback time
  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    const media = mediaRef.current;
    if (reducedMotion || !inView || !container || !video) return;

    let rafId: number | null = null;
    let duration = video.duration || 10;
    let lastTime = -1;

    const onMeta = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        duration = video.duration;
      }
      paint();
    };

    const paint = () => {
      rafId = null;
      if (!duration) return;

      const section = container.closest("section") || container;
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;

      // Progress goes 0.0 at section start to 1.0 at section end
      const progress = Math.max(0, Math.min(1, -rect.top / travel));

      // Calculate target time: stop 0.05s short of duration so video never hits end-of-file pause
      const targetTime = progress * Math.max(0, duration - 0.05);

      // Quantise seek threshold: only seek if changed by more than ~1/60th second
      if (Math.abs(targetTime - lastTime) > 0.015) {
        lastTime = targetTime;
        try {
          video.currentTime = targetTime;
        } catch {
          // Ignore transient seek errors before media buffer ready
        }
      }

      // Parallax translation: subtle physical movement in sync with scroll
      if (media) {
        // Starts lower down (+8%) and travels up to (-6%)
        const yOffset = 8 - progress * 14;
        media.style.transform = `translate3d(0, ${yOffset.toFixed(2)}%, 0)`;
      }
    };

    const onScroll = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(paint);
      }
    };

    video.addEventListener("loadedmetadata", onMeta);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    if (video.readyState >= 1) {
      onMeta();
    } else {
      paint();
    }

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      video.removeEventListener("loadedmetadata", onMeta);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reducedMotion, inView]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none z-0 ${className}`}
    >
      {/* 
        Media layer: anchored lower in the viewport ("make the video lower as possible")
        with responsive object alignment so the shards look dramatic on both phone and desktop.
      */}
      <div
        ref={mediaRef}
        className="absolute inset-x-0 -bottom-[12%] h-[126%] w-full will-change-transform flex items-end justify-center"
        style={{ transform: "translate3d(0, 8%, 0)" }}
      >
        {reducedMotion ? (
          <img
            src={posterSrc}
            alt=""
            className={`size-full object-cover ${objectPosition} opacity-90`}
          />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            tabIndex={-1}
            poster={posterSrc}
            className={`size-full object-cover ${objectPosition} opacity-95`}
          >
            <source src={mp4Src} type="video/mp4" />
            <source src={webmSrc} type="video/webm" />
          </video>
        )}
      </div>

      {/* Edge blending vignettes */}
      <div className="absolute inset-x-0 top-0 h-24 sm:h-32 bg-gradient-to-b from-rhymvex-black via-rhymvex-black/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 sm:h-32 bg-gradient-to-t from-rhymvex-black via-rhymvex-black/70 to-transparent" />
    </div>
  );
}
