"use client";

import { Menu, MoreHorizontal, X } from "lucide-react";

/**
 * Menu/close toggle that morphs between states instead of hard-swapping icons.
 *
 * Both icons are always rendered, absolutely stacked; the active one rotates in
 * at full scale while the other rotates out and shrinks. The container has a
 * fixed size so the button never changes layout, and the transition runs on
 * transform/opacity only, so it stays on the compositor.
 */
export function MenuToggleIcon({
  open,
  variant = "menu",
  className = "size-5",
}: {
  open: boolean;
  /** "menu" for a hamburger, "more" for the ellipsis used on the tab bar. */
  variant?: "menu" | "more";
  className?: string;
}) {
  const Closed = variant === "more" ? MoreHorizontal : Menu;
  return (
    <span className={`relative inline-block ${className}`} aria-hidden="true">
      <Closed
        className={`size-full absolute inset-0 transition-all duration-200 ease-out ${
          open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
      />
      <X
        className={`size-full absolute inset-0 transition-all duration-200 ease-out ${
          open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
        }`}
      />
    </span>
  );
}
