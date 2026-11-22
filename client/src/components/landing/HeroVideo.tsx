import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

// ⚠️ PLACEHOLDER: your sales video (VSL). Set `src` to an MP4 (in client/public or on a CDN) or
// `embedUrl` to a YouTube / Vimeo embed link (https://www.youtube.com/embed/<id>). `poster` is the
// image shown before playing (optional). With neither source, the poster shows but does not play.
const VSL = {
  src: "",
  embedUrl: "",
  poster: "",
  title: "Découvre MakeSaaS en 2 minutes",
  duration: "2:14",
};

const withAutoplay = (url: string) => `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;

/** Landing sales video in a 16:9 frame: a poster with a play button, replaced by the player on click. */
export function HeroVideo({ className }: { className?: string }) {
  const [playing, setPlaying] = useState(false);
  const canPlay = Boolean(VSL.src || VSL.embedUrl);

  const play = () => {
    if (canPlay) setPlaying(true);
  };

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-card shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] md:rounded-3xl",
        className,
      )}
    >
      {playing ? (
        VSL.embedUrl ? (
          <iframe
            src={withAutoplay(VSL.embedUrl)}
            title={VSL.title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <video src={VSL.src} controls autoPlay playsInline className="absolute inset-0 size-full bg-black" />
        )
      ) : (
        <button
          type="button"
          onClick={play}
          aria-label={`Lire la vidéo : ${VSL.title}`}
          className={cn("group absolute inset-0 text-left", !canPlay && "cursor-default")}
        >
          {VSL.poster ? (
            <img src={VSL.poster} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            // Placeholder poster: warm glow on a faint grid
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(60% 70% at 50% 50%, hsl(var(--pumpkin) / 0.22), transparent 70%), linear-gradient(hsl(var(--white) / 0.04) 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(90deg, hsl(var(--white) / 0.04) 1px, transparent 1px) 0 0 / 40px 40px, hsl(var(--black-raised))",
              }}
            />
          )}

          {/* Play button with a pulsing ring, centered */}
          <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center md:size-20">
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/30 motion-reduce:hidden" />
            <span className="relative flex size-full items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-5px_hsl(var(--primary)/0.6)] transition-transform duration-300 group-hover:scale-105">
              <Play className="ml-1 size-6 fill-current md:size-8" strokeWidth={0} />
            </span>
          </span>

          {/* Title and duration, top left */}
          <span className="absolute left-3 right-3 top-3 flex items-center gap-2 md:left-5 md:top-5">
            <span className="truncate text-sm font-semibold text-foreground md:text-base">{VSL.title}</span>
            <span className="shrink-0 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-foreground/80 backdrop-blur">
              {VSL.duration}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
