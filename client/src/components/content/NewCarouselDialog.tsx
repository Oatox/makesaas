import { useState, type ReactNode } from "react";
import { ArrowLeft, GalleryHorizontalEnd, Loader2, Minus, PenLine, Plus, WandSparkles, type LucideIcon } from "lucide-react";
import {
  CAROUSEL_GENERATED_SLIDES,
  CAROUSEL_RATIOS,
  CAROUSEL_RATIO_IDS,
  CAROUSEL_TOPIC_MAX_LENGTH,
  DEFAULT_CAROUSEL_TEXT_STYLE,
  generateCarouselBodySchema,
  type CarouselRatio,
  type CarouselTextStyle,
} from "@shared/carousel";
import type { Carousel } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCarouselQuota, useGenerateCarousel } from "@/hooks/use-carousels";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TextStylePicker } from "./TextStylePicker";

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

/** The footer line of a card: a colored dot, then a few words. */
function CardNote({ dotClassName, children }: { dotClassName: string; children: ReactNode }) {
  return (
    <span className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
      <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />
      {children}
    </span>
  );
}

/** A way to start: its icon (a spinner while it opens), title, description and footer line. */
function ChoiceCard({
  icon: Icon,
  iconClassName,
  title,
  description,
  onClick,
  busy,
  footer,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  description: string;
  onClick: () => void;
  busy?: boolean;
  footer?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex flex-col gap-1 rounded-[16px] border border-border bg-background/40 p-4 text-left transition-colors hover:border-white/[0.16] hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
    >
      <span aria-hidden className={cn("mb-2 flex size-9 items-center justify-center rounded-[10px]", iconClassName)}>
        {busy ? <Loader2 className="size-[18px] animate-spin" /> : <Icon className="size-[18px]" />}
      </span>
      <span className="font-medium">{title}</span>
      <span className="text-sm leading-snug text-muted-foreground">{description}</span>
      {footer}
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
  const [textStyle, setTextStyle] = useState<CarouselTextStyle>(DEFAULT_CAROUSEL_TEXT_STYLE);
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
                icon={WandSparkles}
                iconClassName="bg-primary/10 text-primary"
                title="Générer avec l'IA"
                description="Donne un sujet : l'IA écrit les slides et crée les images."
                onClick={() => setStep("generate")}
                footer={
                  quota.data && (
                    <CardNote dotClassName={quotaReached ? "bg-muted-foreground/50" : "bg-primary"}>{quotaShort(quota.data)}</CardNote>
                  )
                }
              />
              <ChoiceCard
                icon={PenLine}
                iconClassName="bg-white/[0.06] text-foreground/80"
                title="Partir de zéro"
                description="Un carrousel vide, à remplir dans l'éditeur."
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
                const parsed = generateCarouselBodySchema.omit({ saasId: true }).safeParse({ topic, slideCount, ratio, textStyle });
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

              <TextStylePicker value={textStyle} onChange={setTextStyle} />

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
