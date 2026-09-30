"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Waveform band — the "rhythm" motif in motion.
 *
 * Bar artwork is the supplied vector, cropped to its real bounds. Each bar is
 * a pre-composed rounded shape, so motion is a scaleY about the bar's own
 * centre (transform-box: fill-box) rather than a redraw: the GPU handles it
 * and the artwork stays untouched.
 *
 * One shared cycle length with a per-bar delay stepping left to right turns 29
 * independent pulses into a single travelling wave. Peak amplitude varies
 * slightly per bar so it reads as a mix rather than a metronome.
 *
 * Decorative only. Animation is paused while off-screen and disabled entirely
 * under prefers-reduced-motion.
 */

/** Total length of one pass of the wave, in ms. Also the max delay. */
const CYCLE = 2200;

type Bar = { x: number; d: string };

/** Left-to-right by centre x, so the stagger sweeps across the band. */
const BARS: Bar[] = [
  { x: 140.6, d: "M1357 3748 c-16 -6 -35 -25 -47 -49 -19 -37 -20 -61 -20 -723 0 -619 2 -689 17 -720 33 -71 148 -78 196 -12 19 27 20 48 19 736 -1 627 -3 712 -17 733 -28 43 -87 58 -148 35z" },
  { x: 192.1, d: "M1863 3210 c-50 -30 -56 -51 -60 -209 -3 -165 5 -209 48 -245 47 -39 107 -36 153 8 l36 33 0 177 c0 98 -4 186 -10 196 -14 27 -73 60 -106 60 -16 0 -43 -9 -61 -20z" },
  { x: 244.1, d: "M2363 3352 l-31 -29 -7 -144 c-4 -79 -5 -230 -4 -334 4 -217 9 -232 79 -255 36 -12 48 -12 83 1 75 26 76 31 78 384 1 299 0 312 -20 346 -39 66 -123 80 -178 31z" },
  { x: 296.0, d: "M2913 3559 c-19 -6 -39 -22 -52 -45 -21 -34 -21 -45 -21 -540 0 -497 0 -505 21 -533 11 -16 38 -34 60 -41 34 -11 44 -11 79 5 80 36 75 -4 75 559 0 467 -1 504 -19 543 -13 29 -26 43 -45 47 -14 3 -35 8 -46 10 -11 3 -34 0 -52 -5z" },
  { x: 347.0, d: "M3449 4542 c-35 -9 -61 -28 -79 -58 -20 -31 -20 -57 -20 -1509 l0 -1477 21 -29 c11 -16 37 -36 57 -45 47 -19 102 -4 138 39 l24 29 0 1490 0 1491 -34 32 c-33 31 -76 46 -107 37z" },
  { x: 398.6, d: "M3930 3861 c-21 -12 -39 -31 -46 -52 -9 -26 -13 -231 -13 -834 0 -902 -4 -855 73 -882 55 -19 101 -8 131 31 l24 32 1 821 c1 908 5 854 -61 889 -37 19 -66 17 -109 -5z" },
  { x: 450.3, d: "M4414 3823 l-29 -38 -3 -770 c-2 -423 0 -790 3 -814 9 -59 62 -111 113 -111 46 0 98 33 111 72 16 44 15 1593 0 1637 -14 40 -54 61 -117 61 -46 0 -52 -3 -78 -37z" },
  { x: 501.9, d: "M4943 3860 c-22 -21 -34 -42 -38 -72 -9 -61 -1 -1650 8 -1668 10 -21 45 -42 86 -51 47 -10 93 10 119 54 l22 34 0 827 0 826 -36 40 c-32 36 -41 40 -83 40 -37 0 -52 -6 -78 -30z" },
  { x: 554.0, d: "M5483 3730 c-13 -5 -32 -24 -43 -42 -19 -32 -20 -50 -20 -715 l0 -681 26 -31 c14 -17 43 -36 64 -42 36 -11 43 -10 81 15 22 15 47 42 54 59 10 25 13 167 15 685 1 714 2 695 -58 742 -26 21 -80 25 -119 10z" },
  { x: 605.0, d: "M6002 4183 c-18 -9 -42 -27 -52 -41 -20 -24 -20 -48 -20 -1165 l0 -1139 40 -40 c38 -38 43 -40 86 -35 34 3 54 13 80 38 l34 33 0 1146 0 1146 -27 26 c-27 26 -72 48 -96 48 -7 0 -27 -8 -45 -17z" },
  { x: 656.4, d: "M6506 4201 c-58 -39 -56 15 -56 -1223 0 -852 2 -1148 11 -1173 25 -69 133 -83 191 -25 l28 28 0 1171 0 1171 -27 29 c-38 40 -105 50 -147 22z" },
  { x: 707.8, d: "M7020 4044 c-64 -54 -60 13 -60 -1069 l0 -985 24 -38 c32 -51 85 -70 136 -48 20 8 44 24 55 36 20 22 20 41 23 1015 1 545 -1 1010 -6 1031 -7 33 -15 42 -52 61 -58 29 -82 29 -120 -3z" },
  { x: 760.0, d: "M7518 3801 l-33 -29 -3 -775 c-2 -497 1 -783 7 -800 6 -14 28 -38 50 -53 54 -35 96 -28 145 26 l36 40 0 755 c0 808 1 790 -49 843 -34 35 -110 31 -153 -7z" },
  { x: 811.6, d: "M8070 3503 c-14 -3 -35 -19 -47 -39 l-23 -35 0 -457 1 -457 25 -29 c48 -55 154 -45 188 18 17 32 18 64 17 476 -1 243 -6 452 -11 465 -17 45 -84 71 -150 58z" },
  { x: 863.0, d: "M8580 4233 c-14 -10 -35 -28 -47 -42 l-23 -24 0 -1189 0 -1190 33 -33 c38 -38 74 -50 114 -40 14 3 41 21 60 40 l33 33 0 1189 c0 1312 5 1210 -64 1252 -41 26 -74 27 -106 4z" },
  { x: 914.5, d: "M9094 3640 c-12 -4 -31 -21 -43 -36 -21 -27 -21 -29 -21 -615 0 -653 -1 -637 65 -674 47 -25 95 -14 134 31 l31 35 0 600 0 601 -34 34 c-27 27 -42 34 -72 33 -22 0 -49 -4 -60 -9z" },
  { x: 966.0, d: "M9580 3674 l-40 -36 0 -645 c0 -701 -2 -676 56 -722 64 -50 165 -10 178 70 6 35 7 1136 1 1258 -1 37 -8 50 -38 78 -52 47 -102 46 -157 -3z" },
  { x: 1018.1, d: "M10112 4132 c-23 -11 -35 -26 -42 -53 -7 -24 -9 -421 -8 -1123 l3 -1086 25 -24 c17 -16 42 -26 79 -30 53 -7 54 -7 92 34 l39 41 0 1084 c0 1067 0 1084 -20 1118 -34 57 -101 73 -168 39z" },
  { x: 1069.5, d: "M10644 3870 c-23 -12 -46 -32 -53 -46 -8 -18 -11 -251 -11 -849 l0 -823 24 -29 c13 -15 39 -34 59 -41 30 -11 40 -10 78 7 37 15 46 25 56 59 10 32 13 232 13 839 1 702 -1 803 -15 836 -10 24 -22 37 -34 37 -10 0 -24 7 -31 15 -17 20 -37 19 -86 -5z" },
  { x: 1121.0, d: "M11124 4726 l-34 -34 0 -1714 0 -1714 28 -26 c62 -58 116 -60 177 -6 l35 30 0 1714 0 1715 -35 34 c-30 31 -40 35 -86 35 -45 0 -55 -4 -85 -34z" },
  { x: 1172.0, d: "M11664 4745 c-22 -10 -36 -27 -47 -57 -16 -41 -17 -176 -15 -1724 3 -1649 3 -1680 23 -1711 12 -21 35 -39 62 -49 40 -15 45 -15 80 1 20 10 45 27 55 39 17 20 17 110 15 1738 l-2 1718 -26 26 c-32 32 -98 41 -145 19z" },
  { x: 1223.9, d: "M12185 4002 c-6 -4 -23 -22 -38 -40 l-27 -34 0 -943 c0 -1050 -4 -995 67 -1029 44 -21 64 -20 113 5 31 16 42 29 50 60 7 26 10 348 8 985 l-3 945 -35 29 c-27 23 -45 29 -80 30 -25 0 -50 -4 -55 -8z" },
  { x: 1276.1, d: "M12688 3585 c-30 -20 -38 -32 -43 -67 -3 -24 -5 -283 -3 -576 l3 -534 29 -23 c36 -29 92 -40 128 -26 15 5 38 27 52 48 l26 38 0 521 c0 538 -2 569 -41 607 -44 42 -98 46 -151 12z" },
  { x: 1327.4, d: "M13223 4013 c-12 -2 -31 -19 -42 -37 -20 -32 -20 -49 -21 -994 -2 -961 -2 -962 19 -996 24 -38 38 -46 86 -46 57 0 101 27 114 70 8 26 11 312 11 976 0 874 -1 941 -18 974 -26 52 -71 68 -149 53z" },
  { x: 1379.0, d: "M13707 3199 l-37 -30 0 -189 0 -188 35 -31 c63 -55 110 -54 169 4 l36 35 0 179 0 180 -35 36 c-31 30 -42 35 -83 35 -38 0 -55 -6 -85 -31z" },
  { x: 1430.1, d: "M14265 4416 c-16 -7 -41 -26 -55 -41 l-25 -27 -3 -1360 c-1 -1055 1 -1364 10 -1376 7 -8 17 -23 23 -34 5 -11 27 -27 48 -36 53 -21 109 -2 137 45 20 34 20 51 20 1398 l0 1364 -27 29 c-49 52 -77 60 -128 38z" },
  { x: 1481.9, d: "M14752 4144 c-55 -38 -52 17 -53 -1163 0 -1192 -4 -1122 57 -1170 32 -25 96 -28 114 -6 7 8 19 15 27 15 8 0 21 16 29 35 12 29 14 192 14 1097 0 585 -3 1087 -6 1115 -6 46 -11 55 -41 73 -41 24 -110 26 -141 4z" },
  { x: 1533.6, d: "M15277 4339 c-65 -34 -63 35 -57 -1387 l5 -1284 33 -29 c26 -24 41 -29 80 -29 55 1 85 21 107 74 13 32 15 198 15 1289 0 789 -4 1265 -11 1287 -14 53 -42 79 -92 89 -35 6 -52 4 -80 -10z" },
  { x: 1585.8, d: "M15774 3497 l-35 -32 1 -479 c1 -530 -1 -519 65 -551 58 -27 126 1 151 62 21 50 20 916 -1 967 -30 71 -121 88 -181 33z" },
];

export function WaveformRhythm({
  className = "",
}: {
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  // Stop burning frames on a band nobody is looking at.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setLive(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setLive(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const last = BARS.length - 1;

  return (
    <div ref={ref} data-live={live} className={className} aria-hidden="true">
      <svg
        viewBox="125 78 1477 366"
        /* Keep the artwork's proportions: stretching to fill distorts the bars
           into blocks. The wrapper carries the aspect ratio instead, so the
           waveform fills edge to edge on narrow screens and centres at its
           natural proportion on wide ones. */
        className="h-full w-full text-rhymvex-volt"
        fill="currentColor"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Artwork ships in a 1728x558 box at 10x scale; the wrapper brings it
            into viewBox space, where the declared viewBox is cropped to the
            bar bounds (x 129-1597, y 82-439). */}
        <g transform="translate(0,558) scale(0.1,-0.1)" data-wave-bars>
          {BARS.map((bar, i) => (
            <path
              key={bar.x}
              d={bar.d}
              className="rv-wave-bar"
              style={
                {
                  animationDelay: `${Math.round((i / last) * CYCLE)}ms`,
                  // Slightly uneven peaks: a mix, not a metronome.
                  "--rv-wave-peak": (0.78 + 0.22 * Math.abs(Math.sin(i * 1.7))).toFixed(3),
                } as React.CSSProperties
              }
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
