"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import "lenis/dist/lenis.css";

interface SmoothScrollProps {
  children: ReactNode;
}

/**
 * SmoothScroll
 *
 * Provides momentum-based smooth scrolling powered by Lenis (darkroomengineering/lenis).
 * Scoped strictly to the landing page so portal, admin, and form routes keep native scroll behavior.
 * Pauses during modal displays to guarantee isolated, native scrolling within dialog sheets.
 */
export function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    const handleModalOpen = () => {
      lenisRef.current?.lenis?.stop();
    };
    const handleModalClose = () => {
      lenisRef.current?.lenis?.start();
    };

    window.addEventListener("rv-modal-open", handleModalOpen);
    window.addEventListener("rv-modal-close", handleModalClose);

    return () => {
      window.removeEventListener("rv-modal-open", handleModalOpen);
      window.removeEventListener("rv-modal-close", handleModalClose);
    };
  }, []);

  return (
    <ReactLenis
      ref={lenisRef}
      root
      options={{
        lerp: 0.09,
        duration: 1.1,
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.0,
        infinite: false,
        syncTouch: true,
        allowNestedScroll: true,
        prevent: (node: HTMLElement) => {
          return (
            node.hasAttribute?.("data-lenis-prevent") ||
            Boolean(node.closest?.("[data-lenis-prevent]")) ||
            Boolean(node.closest?.("[role='dialog']")) ||
            Boolean(node.closest?.("[aria-modal='true']"))
          );
        },
      }}
    >
      {children}
    </ReactLenis>
  );
}
