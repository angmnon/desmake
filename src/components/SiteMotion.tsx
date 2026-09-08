"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * SiteMotion — motion layer per ReadyX "Silver & Ink" spec (§4).
 * 1. Lenis smooth scrolling (skipped when the user prefers reduced motion).
 * 2. `.rx-progress` — 2px top scroll progress bar.
 * 3. `.cursor-glow` — 480px pale-blue radial glow following the pointer,
 *    desktop fine pointers only, mix-blend multiply.
 * All three are progressive enhancements: if JS fails the page keeps native
 * scrolling and nothing else breaks.
 */
export function SiteMotion() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1) Lenis smooth scrolling
    let lenis: Lenis | null = null;
    let raf = 0;
    if (!reduce) {
      lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      const loop = (time: number) => {
        lenis?.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    // 2) Top scroll progress bar
    const bar = document.querySelector<HTMLElement>(".rx-progress > i");
    const onScroll = () => {
      if (!bar) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.width = `${(p * 100).toFixed(2)}%`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // 3) Desktop cursor glow
    const glow = glowRef.current;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    let move: ((e: PointerEvent) => void) | null = null;
    if (glow && !reduce && finePointer) {
      move = (e: PointerEvent) => {
        glow.style.transform = `translate(${e.clientX - 240}px, ${e.clientY - 240}px)`;
      };
      window.addEventListener("pointermove", move, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (move) window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, []);

  return (
    <>
      <div className="rx-progress" aria-hidden="true">
        <i />
      </div>
      <div className="cursor-glow" ref={glowRef} aria-hidden="true" />
    </>
  );
}
