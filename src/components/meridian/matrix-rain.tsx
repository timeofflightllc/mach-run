import { useEffect, useRef } from "react";

const GLYPHS = "0123456789ABCDEF#$%+-=";

/** Quiet green code rain for a white card. Heads fall; the trail fades into the paper. */
export function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    if (!parent || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box: HTMLElement = parent;
    const pen: CanvasRenderingContext2D = ctx;
    const surface: HTMLCanvasElement = canvas;

    const font = 13;
    const gap = 20;
    let drops: { y: number; speed: number }[] = [];

    function size() {
      const w = box.clientWidth;
      const h = box.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.max(1, Math.floor(w * dpr));
      surface.height = Math.max(1, Math.floor(h * dpr));
      surface.style.width = `${w}px`;
      surface.style.height = `${h}px`;
      pen.setTransform(dpr, 0, 0, dpr, 0, 0);
      pen.fillStyle = "#ffffff";
      pen.fillRect(0, 0, w, h);
      const cols = Math.max(1, Math.ceil(w / gap));
      drops = Array.from({ length: cols }, () => ({
        y: Math.random() * h,
        speed: 0.55 + Math.random() * 1.15,
      }));
    }

    size();
    const watch = new ResizeObserver(size);
    watch.observe(box);

    let raf = 0;
    function tick() {
      const w = surface.clientWidth;
      const h = surface.clientHeight;
      pen.fillStyle = "rgba(255,255,255,0.16)";
      pen.fillRect(0, 0, w, h);
      pen.font = `${font}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      pen.textAlign = "center";
      pen.fillStyle = "rgba(14, 110, 64, 0.4)";
      for (let i = 0; i < drops.length; i++) {
        if (i % 5 === 0) continue;
        const drop = drops[i];
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "0";
        pen.fillText(glyph, i * gap + gap / 2, drop.y);
        drop.y += drop.speed * 2.4;
        if (drop.y > h + font) drop.y = -Math.random() * h * 0.35;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      watch.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-0 h-full w-full" />;
}
