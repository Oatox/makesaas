import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Minus,
  MousePointer2,
  Plus,
  Sparkle,
  Sparkles,
  Type,
} from "lucide-react";
import {
  CAROUSEL_GENERATED_SLIDES,
  CAROUSEL_RATIOS,
  CAROUSEL_RATIO_IDS,
  CAROUSEL_TOPIC_MAX_LENGTH,
  generateCarouselBodySchema,
  type CarouselRatio,
} from "@shared/carousel";
import type { Carousel } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCarouselQuota, useGenerateCarousel } from "@/hooks/use-carousels";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// The ratio tiles of the generation form: each draws its slide shape at the same height.
const RATIO_SHAPE_HEIGHT = 30;
const ratioShapeWidth = (ratio: CarouselRatio) => {
  const { width, height } = CAROUSEL_RATIOS[ratio].base;
  return Math.round((RATIO_SHAPE_HEIGHT * width) / height);
};

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** The quota in a few words: under the AI card, and next to the "Générer" button. */
function quotaShort(quota: { used: number; limit: number; nextAvailableAt: string | null }) {
  const left = quota.limit - quota.used;
  if (left > 0) return `${left} génération${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} sur 24 h`;
  return quota.nextAvailableAt ? `Prochaine possible à ${timeFormat.format(new Date(quota.nextAvailableAt))}` : "Plus de générations pour l'instant";
}

// A slide in the card illustrations: portrait, like a carousel slide. The fanned ones of the AI card
// sit on top of each other (absolute); glass: the white-tinted look of an unfilled slide.
const miniSlideClass = "h-[74px] w-14 rounded-[8px] transition-transform duration-300 ease-out";
const fannedSlideClass = `absolute left-[42px] top-0 ${miniSlideClass}`;
const glassSlideClass = "border border-white/10 bg-gradient-to-b from-white/[0.14] to-white/[0.04]";

function SlideLines({ className }: { className: string }) {
  return (
    <span className="absolute inset-x-2 bottom-2.5 space-y-1">
      <span className={`block h-1 rounded-full ${className}`} />
      <span className={`block h-1 w-2/3 rounded-full ${className}`} />
    </span>
  );
}

/** Three slides fanned out, the front one orange with the AI sparkles; they spread out on hover. */
function GeneratePreview() {
  return (
    <span aria-hidden className="relative h-[74px] w-[140px]">
      <span className={`${fannedSlideClass} ${glassSlideClass} -translate-x-6 -rotate-12 group-hover:-translate-x-8 group-hover:-rotate-[16deg]`}>
        <SlideLines className="bg-white/20" />
      </span>
      <span className={`${fannedSlideClass} ${glassSlideClass} translate-x-6 rotate-12 group-hover:translate-x-8 group-hover:rotate-[16deg]`}>
        <SlideLines className="bg-white/20" />
      </span>
      <span
        className={`${fannedSlideClass} flex justify-center bg-gradient-to-br from-orange-400 to-orange-600 pt-3.5 shadow-[0_10px_24px_-6px_rgb(0_0_0/0.6),inset_0_1px_0_rgb(255_255_255/0.35)] group-hover:-translate-y-1.5`}
      >
        <Sparkles className="size-6 text-white" />
        <SlideLines className="bg-white/60" />
      </span>
      {/* Two sparks around the front slide, which twinkle on hover. */}
      <Sparkle className="absolute -top-2.5 right-4 size-3 fill-current text-orange-200/90 transition-transform duration-500 group-hover:rotate-90 group-hover:scale-125" />
      <Sparkle className="absolute bottom-0 left-2.5 size-2.5 fill-current text-orange-300/70 transition-transform duration-500 group-hover:-rotate-90 group-hover:scale-125" />
    </span>
  );
}

/**
 * The editor in miniature: a blank slide (an image to drop, a text being typed), the tool bar under
 * it, and the cursor, which moves onto the slide on hover.
 */
function ScratchPreview({ busy }: { busy?: boolean }) {
  return (
    <span aria-hidden className="relative flex h-[90px] w-[140px] justify-center">
      <span className={`relative ${miniSlideClass} ${glassSlideClass} group-hover:-translate-y-1`}>
        <span className="absolute inset-x-1.5 top-1.5 flex h-7 items-center justify-center rounded-[4px] border border-dashed border-white/20 text-white/35">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
        </span>
        <span className="absolute inset-x-2 top-[42px] flex items-center gap-0.5">
          <span className="h-1 w-6 rounded-full bg-white/30" />
          <span className="h-2.5 w-px animate-pulse bg-primary" />
        </span>
      </span>
      <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full border border-white/10 bg-[hsl(160_7%_14%)] p-0.5 shadow-lg shadow-black/40">
        {[Type, ImageIcon, LayoutGrid].map((Icon, index) => (
          <span
            key={index}
            className={cn(
              "flex size-5 items-center justify-center rounded-full",
              index === 0 ? "bg-white/10 text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-3" />
          </span>
        ))}
      </span>
      <MousePointer2
        strokeWidth={1.5}
        className="absolute right-5 top-7 size-4 fill-white text-black/70 transition-transform duration-300 ease-out group-hover:-translate-x-2.5 group-hover:-translate-y-1"
      />
    </span>
  );
}

/** The footer line of a card: a colored dot, then a few words. */
function CardNote({ dotClassName, children }: { dotClassName: string; children: ReactNode }) {
  return (
    <span className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
      <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />
      {children}
    </span>
  );
}

function ChoiceCard({
  title,
  description,
  preview,
  previewClassName,
  onClick,
  busy,
  footer,
}: {
  title: string;
  description: string;
  preview: ReactNode;
  previewClassName?: string;
  onClick: () => void;
  busy?: boolean;
  footer?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group flex flex-col rounded-[16px] border border-border bg-background/40 p-1.5 text-left transition-colors hover:border-white/[0.16] hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
    >
      <span
        className={cn(
          "flex h-32 items-center justify-center overflow-hidden rounded-[11px] border border-white/[0.05] bg-white/[0.02]",
          previewClassName,
        )}
      >
        {preview}
      </span>
      <span className="flex flex-1 flex-col gap-1 px-2.5 pb-2 pt-3">
        <span className="font-medium">{title}</span>
        <span className="text-sm leading-snug text-muted-foreground">{description}</span>
        {footer}
      </span>
    </button>
  );
}

/**
 * "Nouveau carrousel": first a choice between an AI generation (topic → full carousel, generated in
 * the background) and an empty carousel opened in the editor, then the generation form if chosen.
 */
export function NewCarouselDialog({
  open,
  onOpenChange,
  onCreateEmpty,
  creatingEmpty,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateEmpty: () => void;
  creatingEmpty: boolean;
  onStarted: (carousel: Carousel) => void;
}) {
  const [step, setStep] = useState<"choose" | "generate">("choose");
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState<number>(CAROUSEL_GENERATED_SLIDES.default);
  const [ratio, setRatio] = useState<CarouselRatio>("9:16");
  const [error, setError] = useState<string | null>(null);
  const generate = useGenerateCarousel();
  const quota = useCarouselQuota();
  const quotaReached = !!quota.data && quota.data.used >= quota.data.limit;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setStep("choose");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {step === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle>Nouveau carrousel</DialogTitle>
              <DialogDescription>Comment veux-tu commencer ?</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                title="Générer avec l'IA"
                description="Donne un sujet : l'IA écrit les slides et crée les images."
                preview={<GeneratePreview />}
                onClick={() => setStep("generate")}
                footer={
                  quota.data && (
                    <CardNote dotClassName={quotaReached ? "bg-muted-foreground/50" : "bg-primary"}>{quotaShort(quota.data)}</CardNote>
                  )
                }
              />
              <ChoiceCard
                title="Partir de zéro"
                description="Un carrousel vide, à remplir dans l'éditeur."
                preview={<ScratchPreview busy={creatingEmpty} />}
                // The editor's canvas: a dot grid.
                previewClassName="bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] bg-[length:12px_12px]"
                onClick={onCreateEmpty}
                busy={creatingEmpty}
                footer={<CardNote dotClassName="bg-white/40">Illimité, sans crédit IA</CardNote>}
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  aria-label="Retour"
                  title="Retour"
                  className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <ArrowLeft className="size-[18px]" />
                </button>
                <DialogTitle>Générer avec l'IA</DialogTitle>
              </div>
              <DialogDescription>L'IA écrit les slides et crée les images. Tu pourras tout modifier ensuite dans l'éditeur.</DialogDescription>
            </DialogHeader>

            <form
              id="generate-carousel"
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = generateCarouselBodySchema.omit({ saasId: true }).safeParse({ topic, slideCount, ratio });
                if (!parsed.success) {
                  setError(parsed.error.issues[0]?.message ?? "Vérifie le formulaire.");
                  return;
                }
                setError(null);
                generate.mutate(parsed.data, {
                  onSuccess: (carousel) => {
                    setTopic("");
                    setStep("choose");
                    onStarted(carousel);
                    toast({ title: "Génération lancée", description: "Ton carrousel sera prêt dans une minute environ." });
                  },
                  onError: (mutationError) => setError(mutationError.message),
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="carousel-topic">De quoi parle ton carrousel ?</Label>
                <Textarea
                  id="carousel-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  // Ctrl/Cmd + Enter generates, Enter alone goes to the next line.
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  maxLength={CAROUSEL_TOPIC_MAX_LENGTH}
                  rows={3}
                  autoFocus
                  placeholder="Ex. : les 5 erreurs qui empêchent un SaaS de trouver ses premiers clients"
                  className="resize-none"
                  data-testid="input-carousel-topic"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:gap-4">
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-medium">Format</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {CAROUSEL_RATIO_IDS.map((id) => {
                      const selected = ratio === id;
                      return (
                        <label key={id} className="cursor-pointer">
                          {/* A real radio (hidden): arrow keys move between the formats. */}
                          <input
                            type="radio"
                            name="carousel-ratio"
                            value={id}
                            checked={selected}
                            onChange={() => setRatio(id)}
                            className="peer sr-only"
                          />
                          <span
                            className={cn(
                              "flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-[12px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40",
                              selected
                                ? "border-primary/60 bg-primary/[0.08]"
                                : "border-border bg-background/40 hover:border-white/20 hover:bg-white/[0.03]",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "rounded-[4px] border-[1.5px] transition-colors",
                                selected ? "border-primary bg-primary/20" : "border-white/30",
                              )}
                              style={{ width: ratioShapeWidth(id), height: RATIO_SHAPE_HEIGHT }}
                            />
                            <span className="text-center leading-tight">
                              <span className={cn("block text-xs font-semibold", selected ? "text-foreground" : "text-foreground/80")}>
                                {CAROUSEL_RATIOS[id].label}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">{CAROUSEL_RATIOS[id].detail}</span>
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Slides</legend>
                  <div className="flex h-[84px] items-center justify-between gap-1 rounded-[12px] border border-border bg-background/40 px-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-[10px]"
                      onClick={() => setSlideCount((count) => Math.max(CAROUSEL_GENERATED_SLIDES.min, count - 1))}
                      disabled={slideCount <= CAROUSEL_GENERATED_SLIDES.min}
                      aria-label="Une slide de moins"
                    >
                      <Minus />
                    </Button>
                    <span className="w-12 text-center" aria-live="polite">
                      <span className="block text-2xl font-semibold leading-none tabular-nums">{slideCount}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">slides</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-[10px]"
                      onClick={() => setSlideCount((count) => Math.min(CAROUSEL_GENERATED_SLIDES.max, count + 1))}
                      disabled={slideCount >= CAROUSEL_GENERATED_SLIDES.max}
                      aria-label="Une slide de plus"
                    >
                      <Plus />
                    </Button>
                  </div>
                </fieldset>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </form>

            {/* The quota on the left, the action on the right; the button on top on phones. */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {quota.data ? (
                <span className={cn("flex items-center gap-1.5 text-xs", quotaReached ? "text-destructive" : "text-muted-foreground")}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", quotaReached ? "bg-destructive" : "bg-primary")} />
                  {quotaShort(quota.data)}
                </span>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                form="generate-carousel"
                disabled={generate.isPending || quotaReached}
                className="w-full sm:w-auto"
                data-testid="button-generate-carousel"
              >
                {generate.isPending ? <Loader2 className="animate-spin" /> : <GalleryHorizontalEnd />}
                Générer
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
