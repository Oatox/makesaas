import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowLeft, Check, CloudOff, Download, Loader2, Redo2, Undo2 } from "lucide-react";
import {
  CAROUSEL_RATIOS,
  CAROUSEL_RATIO_IDS,
  CAROUSEL_TITLE_MAX_LENGTH,
  DEFAULT_CAROUSEL_TITLE,
  parseCarouselDocument,
  type CarouselDocument,
} from "@shared/carousel";
import type { Carousel } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { uploadCarouselImage, useCarousel, useSaveCarousel } from "@/hooks/use-carousels";
import { toast } from "@/hooks/use-toast";
import { downloadCarousel } from "@/lib/carousel-export";
import { ensureCarouselFont } from "@/lib/carousel-font";
import { cn } from "@/lib/utils";
import { EditorContext, cellKey, type EditorContextValue, type EditorSelection } from "./editor-context";
import { editorReducer, edits, initialEditorState } from "./editor-state";
import { EditorCanvas, type CanvasView } from "./EditorCanvas";
import { TextInspector } from "./TextInspector";

export const CONTENT_PATH = "/acquisition/contenu";
const AUTOSAVE_DELAY_MS = 1200;

type SaveState = "saved" | "pending" | "saving" | "error";

/** Full-screen layer over the app: the editor needs all the room. */
function Screen({ children }: { children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">{children}</div>;
}

function StatusScreen({ icon, title, description, onBack }: { icon: ReactNode; title: string; description?: string; onBack: () => void }) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        {icon}
        <h1 className="font-display text-2xl font-light">{title}</h1>
        {description && <p className="max-w-md text-muted-foreground">{description}</p>}
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft /> Retour aux carrousels
        </Button>
      </div>
    </Screen>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") {
    return (
      <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-xs text-destructive hover:underline">
        <CloudOff className="size-3.5" /> Échec, réessayer
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {state === "saved" ? <Check className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}
      {state === "saved" ? "Enregistré" : "Enregistrement…"}
    </span>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** The editor once the carousel is loaded: state, autosave, shortcuts, canvas and inspector. */
function Workspace({ carousel, initialDocument, onExit }: { carousel: Carousel; initialDocument: CarouselDocument; onExit: () => void }) {
  const [state, dispatch] = useReducer(editorReducer, { title: carousel.title, document: initialDocument }, initialEditorState);
  const [selection, setSelection] = useState<EditorSelection>({ slideId: initialDocument.slides[0]?.id ?? null, layerId: null });
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [view, setView] = useState<CanvasView>({ zoom: 1, x: 0, y: 0 });
  const [uploadingCells, setUploadingCells] = useState<ReadonlySet<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const { document, title } = state.present;

  // ---- Autosave: a short delay after the last change, one save at a time ----
  const save = useSaveCarousel(carousel.id);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const presentRef = useRef(state.present);
  presentRef.current = state.present;
  const savedRef = useRef(state.present);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(() => {
    queueRef.current = queueRef.current.then(async () => {
      const snapshot = presentRef.current;
      if (snapshot === savedRef.current) return;
      setSaveState("saving");
      try {
        await save.mutateAsync({ title: snapshot.title.trim() || DEFAULT_CAROUSEL_TITLE, document: snapshot.document });
        savedRef.current = snapshot;
        setSaveState(presentRef.current === snapshot ? "saved" : "pending");
      } catch {
        setSaveState("error");
      }
    });
    return queueRef.current;
    // save.mutateAsync is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.present === savedRef.current) return;
    setSaveState("pending");
    const timer = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.present, flush]);

  // Leaving the page with unsaved changes asks first.
  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const exit = async () => {
    await flush();
    onExit();
  };

  // ---- Editing ----
  const select = useCallback((slideId: string | null, layerId: string | null = null) => setSelection({ slideId, layerId }), []);
  const edit = useCallback<EditorContextValue["edit"]>((apply, mergeKey) => dispatch({ type: "edit", apply, mergeKey }), []);
  const endGesture = useCallback(() => dispatch({ type: "endGesture" }), []);

  // A selection whose slide or layer no longer exists (undo, delete) is dropped.
  const selectedSlide = document.slides.find((slide) => slide.id === selection.slideId);
  const selectedLayer = selectedSlide?.textLayers.find((layer) => layer.id === selection.layerId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickTarget = useRef<{ slideId: string; index: number } | null>(null);

  const uploadImage = useCallback(
    async (slideId: string, index: number, file: File) => {
      const key = cellKey(slideId, index);
      setUploadingCells((cells) => new Set(cells).add(key));
      try {
        const url = await uploadCarouselImage(carousel.id, file);
        dispatch({ type: "edit", apply: edits.setImage(slideId, index, url) });
      } catch (error) {
        toast({ variant: "destructive", title: "Image non ajoutée", description: (error as Error).message });
      } finally {
        setUploadingCells((cells) => {
          const next = new Set(cells);
          next.delete(key);
          return next;
        });
      }
    },
    [carousel.id],
  );

  const context = useMemo<EditorContextValue>(
    () => ({
      document,
      dispatch,
      edit,
      endGesture,
      selection,
      select,
      editingLayerId,
      setEditingLayerId,
      zoom: view.zoom,
      pickImage: (slideId, index) => {
        pickTarget.current = { slideId, index };
        fileInputRef.current?.click();
      },
      uploadImage: (slideId, index, file) => void uploadImage(slideId, index, file),
      uploadingCells,
    }),
    [document, edit, endGesture, selection, select, editingLayerId, view.zoom, uploadImage, uploadingCells],
  );

  // ---- Shortcuts: undo/redo, delete or duplicate the selected text, Escape to deselect ----
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (modifier && event.key.toLowerCase() === "d" && selectedSlide && selectedLayer) {
        event.preventDefault();
        const copyId = crypto.randomUUID();
        dispatch({ type: "edit", apply: edits.duplicateTextLayer(selectedSlide.id, selectedLayer.id, copyId) });
        select(selectedSlide.id, copyId);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedSlide && selectedLayer) {
        event.preventDefault();
        dispatch({ type: "edit", apply: edits.removeTextLayer(selectedSlide.id, selectedLayer.id) });
        select(selectedSlide.id, null);
      } else if (event.key === "Escape") {
        select(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedSlide, selectedLayer, select]);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadCarousel(title.trim() || DEFAULT_CAROUSEL_TITLE, document);
    } catch (error) {
      toast({ variant: "destructive", title: "Téléchargement impossible", description: (error as Error).message });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <EditorContext.Provider value={context}>
      <Screen>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:px-3">
          <IconButton label="Retour aux carrousels" onClick={() => void exit()}>
            <ArrowLeft />
          </IconButton>
          <input
            value={title}
            maxLength={CAROUSEL_TITLE_MAX_LENGTH}
            onChange={(event) => dispatch({ type: "rename", title: event.target.value })}
            onBlur={endGesture}
            aria-label="Titre du carrousel"
            className="min-w-0 max-w-xs flex-1 truncate rounded-md bg-transparent px-2 py-1 font-display text-sm outline-none ring-primary/40 hover:bg-white/5 focus:bg-white/5 focus:ring-2 sm:text-base"
          />
          {/* On the right, the save state by the download. */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block">
              <SaveIndicator state={saveState} onRetry={() => void flush()} />
            </div>
            <Button onClick={() => void download()} disabled={downloading} data-testid="button-download-carousel">
              {downloading ? <Loader2 className="animate-spin" /> : <Download />}
              <span className="hidden sm:inline">Télécharger</span>
            </Button>
          </div>
        </header>

        <div className="relative flex-1 overflow-hidden">
          <EditorCanvas view={view} setView={setView} />
          {/* Undo / redo float over the canvas, top left (the zoom sits bottom left). */}
          <div className="absolute left-4 top-4 flex items-center gap-0.5 rounded-xl border border-white/10 bg-neutral-950/85 p-1 text-white/80 shadow-xl backdrop-blur">
            {(
              [
                { label: "Annuler (Ctrl+Z)", icon: Undo2, action: "undo", disabled: state.past.length === 0 },
                { label: "Rétablir (Ctrl+Maj+Z)", icon: Redo2, action: "redo", disabled: state.future.length === 0 },
              ] as const
            ).map(({ label, icon: Icon, action, disabled }) => (
              <Tooltip key={action}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={label}
                    disabled={disabled}
                    onClick={() => dispatch({ type: action })}
                    className="flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
                  >
                    <Icon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          {/* The slide format floats bottom right, in line with the zoom (bottom left). Hidden while the
              text inspector takes that side; shapes only on phones, so it does not reach the zoom. */}
          {!selectedLayer && (
            <div
              role="radiogroup"
              aria-label="Format des slides"
              className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-xl border border-white/10 bg-neutral-950/85 p-1 text-white/80 shadow-xl backdrop-blur"
            >
              {CAROUSEL_RATIO_IDS.map((ratio) => {
                const active = document.ratio === ratio;
                const { base, label, detail } = CAROUSEL_RATIOS[ratio];
                return (
                  <Tooltip key={ratio}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`${label} · ${detail}`}
                        onClick={() => !active && edit(edits.setRatio(ratio))}
                        className={cn(
                          "flex h-8 min-w-8 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium tabular-nums transition-colors",
                          active ? "bg-white/10 text-white" : "hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn("rounded-[3px] border-[1.5px]", active ? "border-primary" : "border-current opacity-70")}
                          style={{ width: Math.round((14 * base.width) / base.height), height: 14 }}
                        />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{detail}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
          {selectedSlide && selectedLayer && <TextInspector key={selectedLayer.id} slide={selectedSlide} layer={selectedLayer} />}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const target = pickTarget.current;
            event.target.value = "";
            if (file && target) void uploadImage(target.slideId, target.index, file);
          }}
        />
      </Screen>
    </EditorContext.Provider>
  );
}

/** Editor of a carousel (/acquisition/contenu/:id), over the app. */
export function CarouselEditor({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const carousel = useCarousel(id);
  const back = () => navigate(CONTENT_PATH);
  useEffect(() => ensureCarouselFont(), []);

  if (carousel.isPending) {
    return (
      <Screen>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </Screen>
    );
  }
  if (carousel.isError || !carousel.data) {
    return (
      <StatusScreen
        icon={<AlertTriangle className="size-10 text-destructive" />}
        title={carousel.isError ? "Impossible de charger ce carrousel" : "Carrousel introuvable"}
        description={carousel.isError ? "Vérifie ta connexion internet puis réessaie." : "Il a peut-être été supprimé."}
        onBack={back}
      />
    );
  }
  if (carousel.data.status === "generating") {
    return (
      <StatusScreen
        icon={<Loader2 className="size-10 animate-spin text-primary" />}
        title="Génération en cours…"
        description="L'IA écrit les slides et crée leurs images : environ une minute. Cette page s'ouvrira dès que ce sera prêt."
        onBack={back}
      />
    );
  }
  if (carousel.data.status === "failed") {
    return (
      <StatusScreen
        icon={<AlertTriangle className="size-10 text-destructive" />}
        title="La génération a échoué"
        description={carousel.data.error ?? undefined}
        onBack={back}
      />
    );
  }

  const document = parseCarouselDocument(carousel.data.document);
  if (!document) {
    return <StatusScreen icon={<AlertTriangle className="size-10 text-destructive" />} title="Ce carrousel est illisible" onBack={back} />;
  }
  return <Workspace key={carousel.data.id} carousel={carousel.data} initialDocument={document} onExit={back} />;
}
