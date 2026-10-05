"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType } from "react";

type RevealProps = {
  children: React.ReactNode;
  /** Render as a different element so grid/list semantics survive the wrapper. */
  as?: ElementType;
  /** Stagger, in milliseconds, relative to the parent's reveal. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Reveals children the first time they scroll into view.
 *
 * The hidden state lives behind `html.rv-js` in globals.css, which an inline
 * script adds before first paint. Without JS the class is absent and content
 * renders immediately — no invisible content, no layout shift on load.
 */
export function Reveal({
  children,
  as,
  delay = 0,
  className = "",
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.02 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = (as ?? "div") as ElementType;

  return (
    <Tag
      ref={ref}
      data-visible={visible}
      className={`rv-reveal ${className}`}
      style={delay ? { "--rv-reveal-delay": `${delay}ms`, ...style } : style}
    >
      {children}
    </Tag>
  );
}
