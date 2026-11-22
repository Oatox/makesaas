import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const DOT_COUNT = 420;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Turns per second around the vertical axis, and the fixed tilt towards the viewer. */
const SPIN_SPEED = 0.08;
const TILT = 0.38;
/** How fast a dot fades from white to orange once lit (per second). */
const LIGHT_SPEED = 3;

type Dot = { x: number; y: number; z: number; litAt: number; lit: number };

/** Dots spread evenly on a unit sphere (Fibonacci lattice), each lighting up at its own share of the progress. */
function createDots(): Dot[] {
  return Array.from({ length: DOT_COUNT }, (_, i) => {
    const y = 1 - (i / (DOT_COUNT - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = i * GOLDEN_ANGLE;
    return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, litAt: Math.random(), lit: 0 };
  });
}

/**
 * Rotating sphere of dots, in the spirit of Apple's data transfer screens. Dots turn orange as
 * `progress` (0-1) goes up. Drawn on a canvas: hundreds of moving dots stay smooth there.
 */
export function DotSphere({ progress, className }: { progress: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dots = createDots();
    // Brand orange from the theme ("H S% L%"), so the sphere follows the design tokens.
    const primaryHsl = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    const primary = `hsl(${primaryHsl})`;
    let frame = 0;
    let last = performance.now();
    let angle = 0;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduceMotion) angle += dt * SPIN_SPEED * Math.PI * 2;

      const { width, height } = canvas.getBoundingClientRect();
      const cx = width / 2;
      const cy = height / 2;
      const sphere = Math.min(width, height) * 0.4;
      // Slow breathing, like the transfer animation.
      const breath = reduceMotion ? 1 : 1 + Math.sin(now / 900) * 0.025;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const cosT = Math.cos(TILT);
      const sinT = Math.sin(TILT);

      ctx.clearRect(0, 0, width, height);

      // Warm glow behind the sphere, growing with the progress.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, sphere * 1.25);
      glow.addColorStop(0, `hsl(${primaryHsl} / ${0.06 + progressRef.current * 0.16})`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const projected = dots.map((dot) => {
        const target = progressRef.current >= dot.litAt ? 1 : 0;
        dot.lit += Math.sign(target - dot.lit) * Math.min(Math.abs(target - dot.lit), dt * LIGHT_SPEED);
        // Spin around Y, then tilt around X.
        const x = dot.x * cosA + dot.z * sinA;
        const z1 = -dot.x * sinA + dot.z * cosA;
        const y = dot.y * cosT - z1 * sinT;
        const z = dot.y * sinT + z1 * cosT;
        const depth = (z + 1) / 2; // 0 back, 1 front
        const scale = 1 + z * 0.18; // light perspective: the front is a bit larger
        return { dot, sx: cx + x * sphere * breath * scale, sy: cy + y * sphere * breath * scale, depth, scale };
      });
      projected.sort((a, b) => a.depth - b.depth);

      for (const { dot, sx, sy, depth, scale } of projected) {
        const size = (0.7 + depth * 1.1) * scale;
        const alpha = 0.12 + depth * 0.88;
        if (dot.lit > 0) {
          ctx.globalAlpha = alpha * dot.lit * 0.18;
          ctx.fillStyle = primary;
          ctx.beginPath();
          ctx.arc(sx, sy, size * 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = dot.lit > 0.5 ? primary : "#ffffff";
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [reduceMotion]);

  return <canvas ref={canvasRef} aria-hidden className={cn("block", className)} />;
}
