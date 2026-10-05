import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Decorative artwork rendered behind the section content. */
  overlay?: ReactNode;
};

/**
 * Standard dark section shell. Optional eyebrow label sits above the Volt
 * rule and headline. Vertical rhythm is fluid (--spacing-section), so there
 * is no breakpoint-specific padding to keep in sync.
 */
export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className = "",
  overlay,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-20 overflow-hidden border-t border-rhymvex-white/10 py-section ${className}`}
    >
      {overlay}
      <div className="rv-container relative">
        <Reveal className="mb-10 max-w-3xl sm:mb-14">
          {eyebrow && <p className="rv-eyebrow mb-4">{eyebrow}</p>}
          <span className="rv-rule mb-5 block h-px w-10" aria-hidden="true" />
          <h2 className="text-display-2">{title}</h2>
          {description && (
            <div className="mt-5 max-w-2xl text-lead text-rhymvex-white/70">
              {description}
            </div>
          )}
        </Reveal>
        {children}
      </div>
    </section>
  );
}
