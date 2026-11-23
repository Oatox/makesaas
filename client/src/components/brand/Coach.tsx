import { cn } from "@/lib/utils";

/** The coach's name: how it signs its messages and how the landing introduces it. */
export const COACH_NAME = "Gus";

// ⚠️ PLACEHOLDER: an AI-generated portrait (Codex), 256 px, cropped for a circle.
const COACH_PHOTO = "/brand/coach-gus.webp";

/**
 * Gus's face: his portrait in a circle, with a thin orange ring so its dark background never melts
 * into the page. Sized by `className` (36px by default); `online` adds a green dot at the bottom
 * right, like a chat contact.
 */
export function CoachAvatar({ className, online = false }: { className?: string; online?: boolean }) {
  return (
    <span aria-hidden className={cn("relative inline-flex h-9 w-9 shrink-0", className)}>
      <img
        src={COACH_PHOTO}
        alt=""
        width={256}
        height={256}
        loading="lazy"
        decoding="async"
        // Block: no line box inside, so set in text the avatar's baseline is its bottom edge.
        className="block h-full w-full rounded-full object-cover ring-2 ring-primary/70"
      />
      {online && (
        <span className="absolute bottom-0 right-0 h-[26%] w-[26%] rounded-full bg-success ring-2 ring-background" />
      )}
    </span>
  );
}
