"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero panel: the design system, shown rather than described.
 *
 * Two halves. The top is the reference — palette and type with real names and
 * values, so it reads as a spec somebody could hand over. The bottom is the
 * proof: the same tokens applied to the four core templates from docs/DESIGN.md,
 * cycling on a timer. It answers the only question a prospect actually has,
 * which is "what do I get".
 */

const COLOURS = [
  { name: "Volt", hex: "#6EE7FF", swatch: "bg-rhymvex-volt" },
  { name: "White", hex: "#F5F7FA", swatch: "bg-rhymvex-white" },
  { name: "Slate", hex: "#151B24", swatch: "bg-rhymvex-slate ring-1 ring-inset ring-rhymvex-white/15" },
  { name: "Black", hex: "#0B0F14", swatch: "bg-rhymvex-black ring-1 ring-inset ring-rhymvex-white/15" },
  { name: "Ember", hex: "#FF6B6B", swatch: "bg-rhymvex-ember" },
] as const;

const TYPE = [
  { role: "Display", spec: "Space Grotesk · 700", sample: "Ag", className: "font-display text-2xl font-bold leading-none tracking-tight" },
  { role: "Body", spec: "Inter · 400", sample: "Ag", className: "text-sm leading-none" },
  { role: "Label", spec: "Inter · 600 · caps", sample: "LABEL", className: "text-[10px] font-semibold uppercase leading-none tracking-[0.18em]" },
] as const;

const TEMPLATES = [
  { id: "case", name: "Case Study" },
  { id: "quote", name: "Quote" },
  { id: "offer", name: "Offer" },
  { id: "process", name: "Process" },
] as const;

const DWELL = 4200;

/** Each template renders to the same fixed box, so cycling never shifts layout. */
function Preview({ id }: { id: (typeof TEMPLATES)[number]["id"] }) {
  if (id === "case") {
    return (
      <div className="flex h-full flex-col justify-between p-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-volt">
          Case study
        </p>
        <div>
          <p className="font-display text-3xl font-bold leading-none tracking-tight">
            +38%
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-rhymvex-white/55">
            inbound in 90 days, one system instead of six
          </p>
        </div>
      </div>
    );
  }

  if (id === "quote") {
    return (
      <div className="flex h-full flex-col justify-between p-4">
        <span className="rv-rule block h-px w-8" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-medium leading-snug text-rhymvex-white">
            &ldquo;Your brand is a system. Build it like one.&rdquo;
          </p>
          <p className="mt-2 text-[10px] text-rhymvex-white/50">&mdash; Rhymvex</p>
        </div>
      </div>
    );
  }

  if (id === "offer") {
    return (
      <div className="flex h-full flex-col justify-between p-4">
        <span className="w-fit rounded-full border border-rhymvex-ember/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-rhymvex-ember">
          3 slots
        </span>
        <div>
          <p className="font-display text-lg font-bold leading-tight tracking-tight">
            Brand Sprint
          </p>
          <p className="mt-1 text-[11px] text-rhymvex-white/50">January</p>
          <span className="mt-3 inline-block rounded-md bg-rhymvex-volt px-2.5 py-1 text-[10px] font-semibold text-rhymvex-black">
            Book now
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
        Framework
      </p>
      <ol className="space-y-1.5">
        {["Diagnose", "Define", "Systemise"].map((step, i) => (
          <li key={step} className="flex items-baseline gap-2">
            <span className="font-display text-[10px] font-bold text-rhymvex-volt">
              0{i + 1}
            </span>
            <span className="text-[11px] text-rhymvex-white/70">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TokenCard({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    reduceMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useEffect(() => {
    if (paused || reduceMotion.current) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % TEMPLATES.length),
      DWELL,
    );
    return () => window.clearInterval(id);
  }, [paused]);

  /**
   * Arrow-key navigation for the tablist.
   *
   * The WAI-ARIA tabs pattern makes the arrow keys the primary interaction and
   * keeps a single tab stop for the whole group via roving tabindex. Without it
   * this control was three separate tab stops, so reaching the last template
   * meant pressing Tab three times, and there was no way to move between them
   * with an arrow key at all.
   */
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const last = TEMPLATES.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setIndex(next);
    // Move focus with the selection, which is what makes the arrow key feel
    // like it is driving the control rather than just the highlight.
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-rhymvex-white/10 bg-rhymvex-slate/85 backdrop-blur-sm ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // The auto-cycle used to stop only for a mouse. A keyboard user tabbing
      // onto these controls had the content swap underneath them every 4.2s.
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-rhymvex-white/10 px-5 py-4">
        <p className="text-sm font-medium">Design tokens</p>
        <p className="text-[10px] text-rhymvex-white/50">Brand system · v1</p>
      </div>

      {/* Colour reference */}
      <div className="px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
          Colour
        </p>
        <ul className="mt-3 space-y-1.5">
          {COLOURS.map((c) => (
            <li key={c.name} className="flex items-center gap-2.5">
              <span className={`size-3.5 shrink-0 rounded-sm ${c.swatch}`} />
              <span className="text-xs text-rhymvex-white/75">{c.name}</span>
              <span className="ms-auto font-mono text-[10px] text-rhymvex-white/50">
                {c.hex}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Type reference */}
      <div className="border-t border-rhymvex-white/10 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
          Type
        </p>
        <ul className="mt-3 space-y-3">
          {TYPE.map((t) => (
            <li key={t.role} className="flex items-center gap-3">
              <span className={`w-14 shrink-0 text-rhymvex-white/80 ${t.className}`}>
                {t.sample}
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-rhymvex-white/75">{t.role}</span>
                <span className="block text-[10px] text-rhymvex-white/50">
                  {t.spec}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* The system in use */}
      <div className="border-t border-rhymvex-white/10 px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
            In use
          </p>
          <div
            className="flex items-center"
            role="tablist"
            aria-label="Template previews"
            onKeyDown={onTabKeyDown}
          >
            {TEMPLATES.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                id={`tk-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-controls={`tk-panel-${t.id}`}
                // Roving tabindex: one stop for the whole group. The visual is a
                // 6px pill, which is nowhere near the 24px minimum target size,
                // so the button carries a 24x24 hit area and the pill sits inside
                // it as an aria-hidden span. Hover and focus are painted on the
                // pill via group- so the larger button stays invisible.
                tabIndex={i === index ? 0 : -1}
                aria-label={t.name}
                onClick={() => setIndex(i)}
                className="group flex size-6 cursor-pointer items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rhymvex-volt"
              >
                <span
                  aria-hidden="true"
                  className={`block rounded-full transition-all duration-300 group-hover:bg-rhymvex-white/75 ${
                    i === index
                      ? "h-1.5 w-4 bg-rhymvex-volt"
                      : "h-1.5 w-1.5 bg-rhymvex-white/50"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-3 h-32 overflow-hidden rounded-lg border border-rhymvex-white/10 bg-rhymvex-black/40">
          {TEMPLATES.map((t, i) => (
            <div
              key={t.id}
              id={`tk-panel-${t.id}`}
              role="tabpanel"
              aria-labelledby={`tk-tab-${t.id}`}
              aria-hidden={i !== index}
              className={`absolute inset-0 transition-opacity duration-500 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            >
              <Preview id={t.id} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
