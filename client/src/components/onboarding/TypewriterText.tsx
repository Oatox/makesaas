import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type TypewriterTextProps = {
  text: string;
  /** Pause before the first letter, so the step's entrance settles first. */
  startDelayMs?: number;
  /** Average time per letter; each one varies a little, like real typing. */
  charMs?: number;
  /** Called once the last letter is typed (right away when motion is reduced). */
  onDone?: () => void;
};

/**
 * Types the text letter by letter. The untyped rest is already laid out (invisible), so the
 * line breaks never move; screen readers get the full text at once.
 */
export function TypewriterText({ text, startDelayMs = 150, charMs = 34, onDone }: TypewriterTextProps) {
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(reduceMotion ? text.length : 0);
  // Latest callback, so a new function identity from the parent does not restart the typing.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

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

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.slice(0, count)}
        <span className="opacity-0">{text.slice(count)}</span>
      </span>
    </>
  );
}
