import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, RotateCcw } from "lucide-react";
import type { CoachMessage } from "@shared/coach";
import { COACH_NAME, CoachAvatar } from "@/components/brand/Coach";
import { Button } from "@/components/ui/button";
import type { LiveTurn } from "@/hooks/use-coach";
import { cn } from "@/lib/utils";
import { CoachMarkdown } from "./CoachMarkdown";

const bubbleIn = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.22 },
};

function MemberBubble({ content, pending = false }: { content: string; pending?: boolean }) {
  return (
    <p
      className={cn(
        "ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground",
        pending && "opacity-70",
      )}
    >
      {content}
    </p>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-1 py-1.5" aria-label={`${COACH_NAME} écrit`}>
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

/** One answer of Gus: his face and name, then the text (Markdown) in a bubble. */
function CoachBubble({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <div className="group/answer flex items-start gap-3">
      <CoachAvatar className="mt-0.5 h-8 w-8" />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-semibold text-primary">{COACH_NAME}</p>
        <div className="w-fit max-w-full rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-[15px] leading-relaxed text-foreground/90 md:max-w-[46rem]">
          {text ? <CoachMarkdown text={text} /> : <TypingDots />}
        </div>
        {!streaming && text && (
          <div className="mt-1 opacity-100 transition-opacity md:opacity-0 md:group-hover/answer:opacity-100 md:focus-within:opacity-100">
            <CopyButton text={text} />
          </div>
        )}
      </div>
    </div>
  );
}

type ChatThreadProps = {
  messages: CoachMessage[];
  /** The turn being answered, if any. */
  live: LiveTurn | null;
  /** Shown when the last message got no answer: asks Gus to answer it again. */
  onRetry?: () => void;
};

/** The messages of a discussion, then the turn being answered (or a retry when an answer failed). */
export function ChatThread({ messages, live, onRetry }: ChatThreadProps) {
  const unanswered = !live && messages[messages.length - 1]?.role === "user";

  return (
    <div className="space-y-5" aria-live="polite">
      {/* Saved messages appear as is: each one takes the place of its pending or live bubble below,
          which already made its entrance. */}
      {messages.map((message) =>
        message.role === "user" ? (
          <MemberBubble key={message.id} content={message.content} />
        ) : (
          <CoachBubble key={message.id} text={message.content} />
        ),
      )}
      <AnimatePresence initial={false}>
        {live?.pendingContent && (
          <motion.div key="pending" {...bubbleIn}>
            <MemberBubble content={live.pendingContent} pending />
          </motion.div>
        )}
        {live && (
          <motion.div key="live" {...bubbleIn}>
            <CoachBubble text={live.answer} streaming />
          </motion.div>
        )}
      </AnimatePresence>

      {unanswered && onRetry && (
        <div className="flex flex-col items-start gap-3 rounded-[14px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">{COACH_NAME} n'a pas répondu à ce message.</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw />
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}
