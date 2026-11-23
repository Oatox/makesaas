import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { cn } from "@/lib/utils";

/** One message of the thread: Gus's, or the member's. */
export type ThreadLine = { id: number; from: "coach" | "you"; text: string };

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
/** Gus "types" for a time that follows the length of what he says. */
const typingTime = (text: string) => Math.min(1500, 500 + text.length * 11);

/**
 * A conversation played message after message, like the onboarding's chat (CoachChatStep): Gus's
 * messages come after typing dots, the member's pop in. `say` queues messages and resolves once
 * they are shown, so the next step (the ideas) can wait for them.
 */
export function useCoachThread() {
  const reduceMotion = useReducedMotion();
  const [lines, setLines] = useState<ThreadLine[]>([]);
  const [typing, setTyping] = useState(false);
  const [queued, setQueued] = useState(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const nextId = useRef(0);

  const say = useCallback(
    (from: ThreadLine["from"], texts: string[]) => {
      setQueued((count) => count + 1);
      chain.current = chain.current.then(async () => {
        for (const text of texts) {
          if (!reduceMotion) {
            if (from === "coach") {
              setTyping(true);
              await wait(typingTime(text));
              setTyping(false);
            } else {
              await wait(250);
            }
          }
          setLines((previous) => [...previous, { id: nextId.current++, from, text }]);
          if (!reduceMotion) await wait(250);
        }
        setQueued((count) => count - 1);
      });
      return chain.current;
    },
    [reduceMotion],
  );

  /** Nothing left to play: dots shown now mean Gus is working (the ideas are being written). */
  return { lines, typing, idle: queued === 0, say };
}

const bubbleIn = { initial: { opacity: 0, y: 8, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.25 } };

function TypingDots() {
  return (
    <span className="flex gap-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3.5" aria-label={`${COACH_NAME} écrit`}>
      {[0, 1, 2].map((dot) => (
        <motion.i
          key={dot}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15 }}
        />
      ))}
    </span>
  );
}

/** The thread: Gus's bubbles on the left (his face by the last one of a run), the member's on the right. */
export function CoachThread({ lines, typing }: { lines: ThreadLine[]; typing: boolean }) {
  return (
    <div className="space-y-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {lines.map((line, index) => {
          if (line.from === "you") {
            return (
              <motion.p
                key={line.id}
                {...bubbleIn}
                className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground"
              >
                {line.text}
              </motion.p>
            );
          }
          const next = lines[index + 1];
          const lastOfRun = next ? next.from !== "coach" : !typing;
          const firstOfRun = lines[index - 1]?.from !== "coach";
          return (
            <motion.div key={line.id} {...bubbleIn}>
              {firstOfRun && <p className="mb-1 ml-12 text-xs font-semibold text-primary">{COACH_NAME}</p>}
              <div className="flex items-end gap-3">
                <span className={cn(!lastOfRun && "invisible")}>
                  <CoachAvatar />
                </span>
                <p className="max-w-[80%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-2.5 text-[15px] leading-relaxed">
                  {line.text}
                </p>
              </div>
            </motion.div>
          );
        })}
        {typing && (
          <motion.div key="typing" {...bubbleIn}>
            {lines[lines.length - 1]?.from !== "coach" && <p className="mb-1 ml-12 text-xs font-semibold text-primary">{COACH_NAME}</p>}
            <div className="flex items-end gap-3">
              <CoachAvatar />
              <TypingDots />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
