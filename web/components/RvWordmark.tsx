/**
 * Script "Rh" wordmark — the alternate brand signature supplied as vector
 * artwork. Single-colour by design, so it takes the theme's text colour and
 * reads as a wordmark rather than a logo lockup.
 *
 * viewBox is cropped to the artwork's real bounds (the source 0 0 600 box is
 * mostly dead space, which made it render small at any given CSS size).
 */
export function RvWordmark({
  className = "",
  label = "Rhymvex",
}: {
  className?: string;
  label?: string | null;
}) {
  return (
    <svg
      viewBox="108 98 393 303"
      className={className}
      role={label ? "img" : "presentation"}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0,502) scale(0.05,-0.05)" stroke="none">
        <path
          fill="currentColor"
          d="M5460 7512 c-1159 -483 -1192 -500 -1233 -664 -14 -55 2 -545 55 -1688 40 -885 72 -1612 69 -1615 -2 -3 -58 21 -123 53 -537 264 -1267 -14 -1268 -484 -1 -613 1172 -768 1522 -201 76 122 76 177 17 1474 -32 695 -58 1326 -58 1403 l-1 140 1072 446 c590 246 1075 444 1079 440 8 -8 89 -1740 89 -1909 l0 -124 -115 58 c-779 388 -1700 -378 -1050 -874 429 -327 1264 -131 1360 319 16 75 -106 3117 -141 3503 -22 245 -18 246 -1274 -277z"
        />
        <path
          fill="currentColor"
          d="M2560 6911 c-201 -57 -320 -127 -320 -189 0 -30 68 -175 513 -1100 223 -461 217 -414 52 -426 -569 -41 -739 -716 -180 -716 310 0 609 285 541 517 -12 40 -166 370 -343 733 l-321 660 54 45 c286 238 737 102 917 -277 69 -146 98 -99 65 108 -78 494 -508 777 -978 645z"
        />
        <path
          fill="currentColor"
          d="M8422 5585 c-41 -35 -82 -161 -671 -2055 -105 -341 -196 -632 -202 -647 -6 -18 -47 11 -121 85 -473 472 -1368 361 -1368 -171 0 -560 952 -946 1396 -565 117 99 106 72 413 1058 151 484 323 1035 383 1225 l110 345 74 -1 c192 -1 504 -160 675 -344 301 -323 330 -645 119 -1285 -23 -70 243 221 314 343 472 813 144 1650 -773 1978 -217 78 -288 85 -349 34z"
        />
      </g>
    </svg>
  );
}
