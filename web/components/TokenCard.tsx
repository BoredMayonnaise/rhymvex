"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Hero panel: the design system, shown rather than described.
 *
 * Two halves. The top is the reference — palette and type with real names and
 * values, so it reads as a spec somebody could hand over. The bottom is what
 * actually ships: the four core templates from docs/DESIGN.md, rendered from
 * brand/templates/ and cycling on a timer. It answers the only question a
 * prospect actually has, which is "what do I get".
 *
 * These are the real files, not mock-ups of them, and the copy inside each one
 * is the template's own example text rather than a client's result. That
 * distinction is the whole reason to show them: a prospective client can open
 * the same PNGs in brand/templates/ and see there is nothing hidden behind the
 * preview. An earlier version of this card drew its previews in markup and
 * filled them with invented figures — a "+38% inbound" result and a "3 slots"
 * offer for engagements that had not happened. It looked more impressive and
 * proved nothing, which is the failure this panel is meant to avoid.
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
  {
    id: "case",
    name: "Case Study",
    file: "/brand/templates/template-case-study.png",
    for: "Challenge, work, result. Three lines, in that order.",
  },
  {
    id: "quote",
    name: "Quote",
    file: "/brand/templates/template-quote.png",
    for: "One line from a client, at the size it deserves.",
  },
  {
    id: "offer",
    name: "Offer",
    file: "/brand/templates/template-offer.png",
    for: "A dated slot or a campaign, with the scarcity stated.",
  },
  {
    id: "process",
    name: "Process",
    file: "/brand/templates/template-process.png",
    for: "Numbered steps. The one people screenshot.",
  },
] as const;

const DWELL = 4200;

/**
 * Each specimen renders into the same fixed box and letterboxes rather than
 * crops, so the tabbed panel never shifts and a template is never shown with
 * its own content cut off.
 */
function Preview({ id }: { id: (typeof TEMPLATES)[number]["id"] }) {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1 bg-rhymvex-black/40">
        <Image
          src={template.file}
          alt={`${template.name} template, rendered from the Rhymvex design system`}
          fill
          sizes="(min-width: 1024px) 22rem, 100vw"
          className="object-contain"
        />
      </div>
      {/* The caption carries the meaning at this size, where the artwork itself
          is too small to read. */}
      <p className="shrink-0 px-3 pt-2 text-[10px] leading-snug text-rhymvex-white/50">
        {template.for}
      </p>
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
        <p className="text-sm font-semibold tracking-tight text-rhymvex-white">Studio Architecture</p>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-rhymvex-volt font-medium">
          <span className="size-1.5 rounded-full bg-rhymvex-volt animate-pulse" />
          Production stack · v2.4
        </span>
      </div>

      {/* Integrated capabilities */}
      <div className="px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
          Integrated Capabilities
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="rounded-md border border-rhymvex-white/5 bg-rhymvex-black/40 p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-rhymvex-volt font-semibold">01 · Products</p>
            <p className="mt-0.5 text-xs text-rhymvex-white/80 font-sans">Full-Stack SaaS</p>
          </div>
          <div className="rounded-md border border-rhymvex-white/5 bg-rhymvex-black/40 p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-rhymvex-volt font-semibold">02 · Platforms</p>
            <p className="mt-0.5 text-xs text-rhymvex-white/80 font-sans">Client Portals</p>
          </div>
          <div className="rounded-md border border-rhymvex-white/5 bg-rhymvex-black/40 p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-rhymvex-volt font-semibold">03 · Pipelines</p>
            <p className="mt-0.5 text-xs text-rhymvex-white/80 font-sans">Design Tokens</p>
          </div>
          <div className="rounded-md border border-rhymvex-white/5 bg-rhymvex-black/40 p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-rhymvex-volt font-semibold">04 · Identity</p>
            <p className="mt-0.5 text-xs text-rhymvex-white/80 font-sans">Brand Systems</p>
          </div>
        </div>
      </div>

      {/* Colour & Type tokens */}
      <div className="border-t border-rhymvex-white/10 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
            Design Tokens
          </p>
          <span className="text-[10px] font-mono text-rhymvex-white/40">Next.js 16 · Tailwind</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {COLOURS.map((c) => (
              <span
                key={c.name}
                className={`size-4 rounded-sm ${c.swatch}`}
                title={`${c.name} ${c.hex}`}
              />
            ))}
          </div>
          <span className="font-mono text-[10px] text-rhymvex-white/60 truncate">
            Space Grotesk + Inter
          </span>
        </div>
      </div>

      {/* The templates that ship in the system */}
      <div className="border-t border-rhymvex-white/10 px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rhymvex-white/50">
            Templates
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

        <div className="relative mt-3 h-56 overflow-hidden rounded-lg border border-rhymvex-white/10 bg-rhymvex-black/40 sm:h-64">
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

        <p className="mt-2.5 text-[10px] leading-snug text-rhymvex-white/40">
          These four ship inside every system we hand over. The files are the
          deliverable, not a mock-up of one.
        </p>
      </div>
    </div>
  );
}
