/**
 * Rv monogram — the official logo artwork (docs/icon logo.svg), inlined so it
 * scales crisply with no asset request. Source of truth: docs/icon logo.svg;
 * keep the two in sync.
 *
 * Full-colour variant for dark backgrounds: R in Rhymvex White, V in the logo
 * cyan. Both fills are driven by CSS custom properties so a surface can tint
 * the mark without forking the paths:
 *   --rv-mark-r  letter R   default: Rhymvex White #F5F7FA
 *   --rv-mark-v  letter V   default: logo cyan     #0BBEFF
 */
export function RvMark({
  className = "",
  label = "Rhymvex",
}: {
  className?: string;
  /** Pass null for decorative use where an adjacent label already names the brand. */
  label?: string | null;
}) {
  return (
    <svg
      /* Tight viewBox on the artwork's real bounds (the source file's 0 0 600
         box leaves ~40% dead space, which made the mark render tiny in UI). */
      viewBox="118 170 365 243"
      className={className}
      role={label ? "img" : "presentation"}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0,600) scale(0.1,-0.1)" stroke="none">
        {/* V — left stem and terminal dot */}
        <path
          fill="var(--rv-mark-v, #0BBEFF)"
          d="M3557 4223 c-52 -18 -142 -91 -152 -123 -6 -19 -17 -20 -211 -20 -129 0 -204 -4 -204 -10 0 -5 22 -37 49 -71 27 -33 62 -89 77 -124 l29 -64 123 -1 124 0 45 -50 c59 -66 111 -92 194 -98 83 -6 150 15 208 64 201 172 93 496 -169 510 -43 3 -81 -2 -113 -13z"
        />
        {/* R — counter, bowl and leg */}
        <path
          fill="var(--rv-mark-r, #F5F7FA)"
          d="M1244 4145 c-6 -15 136 -218 214 -306 25 -27 67 -60 100 -76 l57 -28 400 -5 400 -5 54 -30 c95 -53 146 -146 139 -254 -8 -112 -73 -208 -178 -262 -43 -23 -56 -24 -340 -30 -218 -4 -308 -10 -345 -21 -180 -54 -318 -174 -405 -353 -65 -133 -70 -169 -70 -523 l0 -312 208 2 207 3 5 315 c4 272 7 319 22 346 57 105 129 144 274 152 174 8 140 36 393 -317 271 -380 314 -423 481 -484 47 -17 86 -21 268 -25 159 -3 212 -1 212 8 0 6 -62 112 -137 236 -113 185 -141 224 -159 224 -13 0 -35 5 -51 11 -66 24 -106 66 -225 233 -66 94 -125 176 -130 183 -6 7 9 21 49 44 72 41 217 185 261 261 63 107 85 188 90 333 5 155 -9 219 -71 340 -86 167 -271 304 -461 340 -116 22 -1254 22 -1262 0z"
        />
        {/* V — diagonal body */}
        <path
          fill="var(--rv-mark-v, #0BBEFF)"
          d="M4343 3996 c-95 -31 -178 -110 -213 -202 -24 -66 -27 -167 -5 -222 l16 -39 -82 -144 c-103 -182 -188 -333 -324 -576 -59 -106 -109 -193 -110 -193 -2 0 -34 55 -71 123 -37 67 -93 167 -124 222 -59 103 -70 123 -173 309 -67 120 -63 120 -91 1 -23 -95 -76 -206 -142 -292 l-55 -72 22 -43 c33 -64 172 -310 346 -611 180 -310 191 -322 288 -322 51 0 67 4 96 26 36 28 299 476 587 999 229 417 212 390 273 423 72 39 121 87 155 155 26 50 29 68 29 147 0 81 -3 96 -30 144 -34 61 -97 120 -162 152 -57 27 -170 35 -230 15z"
        />
      </g>
    </svg>
  );
}
