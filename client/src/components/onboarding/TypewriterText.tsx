import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Measured before paint in the browser; the prerender has no layout.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Keeps the height of a line not reached yet.
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

type TypewriterTextProps = {
  text: string;
  /** Pause before the first letter, so the step's entrance settles first. */
  startDelayMs?: number;
  /** Average time per letter; each one varies a little, like real typing. */
  charMs?: number;
  /** Called once the last letter is typed (right away when motion is reduced). */
  onDone?: () => void;
};

/** The text's lines as the browser broke them, read from where each word sits. */
function readLines(layout: HTMLElement) {
  const lines: string[] = [];
  let top = Number.NEGATIVE_INFINITY;
  layout.querySelectorAll<HTMLElement>("[data-word]").forEach((word) => {
    const wordTop = word.getBoundingClientRect().top;
    if (wordTop > top + 2) {
      lines.push(word.textContent ?? "");
      top = wordTop;
    } else {
      lines[lines.length - 1] += ` ${word.textContent ?? ""}`;
    }
  });
  return lines;
}

/**
 * Types the text letter by letter. The whole text is laid out from the start, so the line breaks
 * never move; screen readers get the full text at once.
 * Left-aligned, the untyped rest sits invisible after the typed letters. Centered, that would make
 * the line being typed lean left, so each line is drawn on its own and grows from the middle.
 */
export function TypewriterText({ text, startDelayMs = 150, charMs = 34, onDone }: TypewriterTextProps) {
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(reduceMotion ? text.length : 0);
  // Latest callback, so a new function identity from the parent does not restart the typing.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const layoutRef = useRef<HTMLSpanElement>(null);
  // Lines of a centered text (null when the text is not centered).
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      setCount(text.length);
      onDoneRef.current?.();
      return;
    }

    setCount(0);
    let timer: number;
    const type = (next: number) => {
      setCount(next);
      if (next < text.length) timer = window.setTimeout(() => type(next + 1), charMs * (0.7 + Math.random() * 0.6));
      else onDoneRef.current?.();
    };
    timer = window.setTimeout(() => type(1), startDelayMs);
    return () => window.clearTimeout(timer);
  }, [text, startDelayMs, charMs, reduceMotion]);

  // Read the lines again whenever the width, the font size or the font itself changes.
  useBrowserLayoutEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    const measure = () => {
      const next = getComputedStyle(layout).textAlign === "center" ? readLines(layout) : null;
      setLines((prev) => (prev?.join("\n") === next?.join("\n") ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [text]);

  let wordStart = 0;
  let lineStart = 0;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="relative block">
        {/* The whole text as it will end. Centered, it stays invisible under the drawn lines. */}
        <span ref={layoutRef} className={cn("block", lines && "invisible")}>
          {text.split(" ").map((word, i) => {
            const shown = Math.max(0, Math.min(word.length, count - wordStart));
            wordStart += word.length + 1;
            return (
              <Fragment key={i}>
                {i > 0 && " "}
                <span data-word className="whitespace-nowrap">
                  {word.slice(0, shown)}
                  <span className="opacity-0">{word.slice(shown)}</span>
                </span>
              </Fragment>
            );
          })}
        </span>
        {lines && (
          <span className="absolute inset-x-0 top-0">
            {lines.map((line, i) => {
              const typed = line.slice(0, Math.max(0, count - lineStart));
              lineStart += line.length + 1;
              return (
                <span key={i} className="block whitespace-nowrap">
                  {typed || ZERO_WIDTH_SPACE}
                </span>
              );
            })}
          </span>
        )}
      </span>
    </>
  );
}
