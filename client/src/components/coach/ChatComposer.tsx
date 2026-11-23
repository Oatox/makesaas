import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { COACH_MESSAGE_MAX_LENGTH } from "@shared/coach";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_HEIGHT_PX = 220;

type ChatComposerProps = {
  /** Sends the message; resolves false when it was refused, to give the text back. */
  onSend: (content: string) => Promise<boolean>;
  /** Gus is answering: the member can type the next message, not send it yet. */
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

/** Message field of the discussions: grows with the text, Enter sends, Shift+Enter breaks the line. */
export function ChatComposer({ onSend, busy = false, disabled = false, placeholder = "Écris à Gus…", autoFocus = false }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const content = value.trim();
  const tooLong = content.length > COACH_MESSAGE_MAX_LENGTH;
  const canSend = !!content && !tooLong && !busy && !disabled;

  // Grows with its content up to MAX_HEIGHT_PX, then scrolls.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) textareaRef.current?.focus();
  }, [autoFocus]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    setValue("");
    void onSend(content).then((sent) => {
      // Refused (limit reached, network…): give the text back unless a new one was started.
      if (!sent) setValue((current) => current || content);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex items-end gap-2 rounded-[18px] border border-border bg-card p-2 pl-4 shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] transition-colors",
        "focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-primary/25",
        disabled && "opacity-60",
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Message pour Gus"
        className="max-h-[220px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed md:text-[15px]"
        data-testid="input-coach-message"
      />
      <div className="flex shrink-0 items-center gap-2">
        {content.length > COACH_MESSAGE_MAX_LENGTH * 0.8 && (
          <span className={cn("text-xs tabular-nums text-muted-foreground", tooLong && "text-destructive")}>
            {content.length.toLocaleString("fr-FR")} / {COACH_MESSAGE_MAX_LENGTH.toLocaleString("fr-FR")}
          </span>
        )}
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label={busy ? "Gus est en train de répondre" : "Envoyer"}
          // 36 px + the 4 px edge of the 3D button = the 40 px text row: lifted by the edge, it sits
          // 8 px from the field's border on every side, whatever the screen size.
          className="mb-1 h-9 w-9 rounded-full sm:h-9 sm:w-9"
          data-testid="button-coach-send"
        >
          {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </div>
    </form>
  );
}
