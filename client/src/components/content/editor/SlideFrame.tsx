import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Columns2,
  Copy,
  Grid2X2,
  Grid3X3,
  ImagePlus,
  Loader2,
  RefreshCw,
  Rows2,
  Square,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  CAROUSEL_LAYOUTS,
  CAROUSEL_LAYOUT_IDS,
  CAROUSEL_RATIOS,
  CAROUSEL_TEXT,
  createTextLayer,
  type CarouselLayout,
  type CarouselSlide,
  type CarouselTextLayer,
} from "@shared/carousel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TextLayerContent, cellImageStyle, slideCells, textBoxStyle } from "../SlideView";
import { cellKey, trackPointer, useEditor } from "./editor-context";
import { edits } from "./editor-state";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

export const LAYOUT_ICONS: Record<CarouselLayout, LucideIcon> = {
  single: Square,
  "two-columns": Columns2,
  "two-rows": Rows2,
  "grid-2x2": Grid2X2,
  "grid-3x3": Grid3X3,
};

/** Snaps the centre of a dragged text to the slide's middle, within a few px. */
const SNAP_PX = 6;

type Guides = { vertical: boolean; horizontal: boolean } | null;

// Chrome around the slide (labels, toolbar, handles) keeps a constant size on screen whatever the zoom.
const chromeStyle = (zoom: number, width: number, origin: string) => ({
  width: width * zoom,
  transform: `scale(${1 / zoom})`,
  transformOrigin: origin,
});

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

function ChromeButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClick}
          className={cn(
            "flex size-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30",
            danger && "hover:bg-destructive/15 hover:text-destructive",
          )}
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ---- Image cells ----

function ImageCell({ slide, index, cell }: { slide: CarouselSlide; index: number; cell: { x: number; y: number; width: number; height: number } }) {
  const { selection, select, edit, endGesture, pickImage, uploadImage, uploadingCells } = useEditor();
  const [dragOver, setDragOver] = useState(false);
  const image = slide.images[index];
  const isUploading = uploadingCells.has(cellKey(slide.id, index));
  const isSlideSelected = selection.slideId === slide.id;

  const dropProps = {
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files[0];
      if (file) uploadImage(slide.id, index, file);
    },
  };
  const position = { left: cell.x, top: cell.y, width: cell.width, height: cell.height };

  // Drag the image to choose which part of it stays visible in its cell.
  const startFraming = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (!isSlideSelected || event.button !== 0 || !image) return;
    event.stopPropagation();
    select(slide.id, null);
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    if (!element.naturalWidth || !element.naturalHeight) return;
    const scale = Math.max(rect.width / element.naturalWidth, rect.height / element.naturalHeight);
    const overflowX = element.naturalWidth * scale - rect.width;
    const overflowY = element.naturalHeight * scale - rect.height;
    const start = { x: image.focalX, y: image.focalY };
    trackPointer(
      event,
      (_, delta) =>
        edit(
          edits.setFocalPoint(
            slide.id,
            index,
            round1(overflowX > 0 ? start.x - (delta.x / overflowX) * 100 : start.x),
            round1(overflowY > 0 ? start.y - (delta.y / overflowY) * 100 : start.y),
          ),
          `focal:${image.id}`,
        ),
      endGesture,
    );
  };

  if (!image?.url) {
    return (
      <button
        type="button"
        className={cn(
          "absolute flex flex-col items-center justify-center gap-1 border border-dashed text-white/35 transition-colors hover:border-primary/60 hover:text-white/80",
          dragOver ? "border-primary bg-primary/10 text-white" : "border-white/15",
        )}
        style={position}
        onClick={() => {
          select(slide.id, null);
          pickImage(slide.id, index);
        }}
        aria-label="Ajouter une image"
        {...dropProps}
      >
        {isUploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
        {cell.width > 80 && <span className="text-[10px] font-medium">Image</span>}
      </button>
    );
  }

  return (
    <div className="group/cell absolute overflow-hidden" style={position} {...dropProps}>
      <img
        src={image.url}
        alt=""
        draggable={false}
        onPointerDown={startFraming}
        className={cn("h-full w-full select-none", isSlideSelected && "cursor-grab active:cursor-grabbing")}
        style={cellImageStyle(image)}
      />
      {isSlideSelected && (
        <div className="absolute right-1 top-1 hidden gap-1 group-hover/cell:flex">
          {[
            { icon: RefreshCw, label: "Remplacer l'image", run: () => pickImage(slide.id, index) },
            { icon: X, label: "Retirer l'image", run: () => edit(edits.setImage(slide.id, index, null)) },
          ].map(({ icon: Icon, label, run }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={run}
              className="flex size-6 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black"
            >
              <Icon className="size-3" />
            </button>
          ))}
        </div>
      )}
      {(isUploading || dragOver) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
          {isUploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
        </div>
      )}
    </div>
  );
}

// ---- Text layers ----

/** The text typed on the slide itself: Enter validates, Shift+Enter breaks the line, Escape cancels. */
function EditableText({ initial, onDone }: { initial: string; onDone: (text: string | null) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.textContent = initial;
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    // Mounted once per editing session: `initial` is only the starting text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      className="block min-w-[1ch] cursor-text select-text outline-none"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          ref.current?.blur();
        }
        if (event.key === "Escape") {
          cancelled.current = true;
          ref.current?.blur();
        }
      }}
      onBlur={() => onDone(cancelled.current ? null : (ref.current?.innerText ?? "").replace(/\n$/, ""))}
    />
  );
}

const RESIZE_HANDLES = [
  { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize", x: -1, y: -1, mode: "font" },
  { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize", x: 1, y: -1, mode: "font" },
  { id: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize", x: -1, y: 1, mode: "font" },
  { id: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize", x: 1, y: 1, mode: "font" },
  { id: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize", x: -1, y: 0, mode: "width" },
  { id: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize", x: 1, y: 0, mode: "width" },
] as const;

function TextLayerItem({
  slide,
  layer,
  frameRef,
  onGuides,
}: {
  slide: CarouselSlide;
  layer: CarouselTextLayer;
  frameRef: RefObject<HTMLDivElement>;
  onGuides: (guides: Guides) => void;
}) {
  const { selection, select, edit, endGesture, editingLayerId, setEditingLayerId, zoom } = useEditor();
  const boxRef = useRef<HTMLDivElement>(null);
  const isSelected = selection.layerId === layer.id;
  const isEditing = editingLayerId === layer.id;
  const update = (patch: Partial<CarouselTextLayer>, mergeKey: string) => edit(edits.updateTextLayer(slide.id, layer.id, patch), mergeKey);

  const startMove = (event: ReactPointerEvent) => {
    event.stopPropagation();
    if (isEditing || event.button !== 0 || !frameRef.current) return;
    select(slide.id, layer.id);
    const frame = frameRef.current.getBoundingClientRect();
    const toPercent = (clientX: number, clientY: number) => ({
      x: ((clientX - frame.left) / frame.width) * 100,
      y: ((clientY - frame.top) / frame.height) * 100,
    });
    const grab = toPercent(event.clientX, event.clientY);
    const offset = { x: grab.x - layer.x, y: grab.y - layer.y };
    const threshold = { x: (SNAP_PX / frame.width) * 100, y: (SNAP_PX / frame.height) * 100 };

    trackPointer(
      event,
      (move) => {
        const point = toPercent(move.clientX, move.clientY);
        let x = clamp(point.x - offset.x, 0, 100);
        let y = clamp(point.y - offset.y, 0, 100);
        const vertical = Math.abs(x - 50) <= threshold.x;
        const horizontal = Math.abs(y - 50) <= threshold.y;
        if (vertical) x = 50;
        if (horizontal) y = 50;
        onGuides(vertical || horizontal ? { vertical, horizontal } : null);
        update({ x: round1(x), y: round1(y) }, `move:${layer.id}`);
      },
      () => {
        onGuides(null);
        endGesture();
      },
    );
  };

  // Corners change the font size, the sides the box width (centred box: the dragged side follows).
  const startResize = (event: ReactPointerEvent, handle: (typeof RESIZE_HANDLES)[number]) => {
    event.stopPropagation();
    if (!frameRef.current || !boxRef.current) return;
    const frameWidth = frameRef.current.getBoundingClientRect().width;
    const startWidth = layer.width ?? clamp((boxRef.current.getBoundingClientRect().width / frameWidth) * 100, CAROUSEL_TEXT.minWidth, 100);
    const startFontSize = layer.fontSize;

    trackPointer(
      event,
      (_, delta) => {
        if (handle.mode === "width") {
          update({ width: round1(clamp(startWidth + (delta.x / frameWidth) * 200 * handle.x, CAROUSEL_TEXT.minWidth, 100)) }, `width:${layer.id}`);
        } else {
          const change = (delta.x * handle.x + delta.y * handle.y) / (2 * zoom);
          update(
            { fontSize: Math.round(clamp(startFontSize + change, CAROUSEL_TEXT.minFontSize, CAROUSEL_TEXT.maxFontSize)) },
            `size:${layer.id}`,
          );
        }
      },
      endGesture,
    );
  };

  const handleSize = 12 / zoom;
  const ringWidth = 1.5 / zoom;

  return (
    <div
      ref={boxRef}
      style={{
        ...textBoxStyle(layer),
        outline: isSelected ? `${ringWidth}px solid hsl(var(--primary))` : undefined,
        outlineOffset: isSelected ? ringWidth : undefined,
      }}
      className={cn("select-none", !isEditing && "cursor-move", !isSelected && "hover:outline hover:outline-1 hover:outline-primary/60")}
      onPointerDown={startMove}
      onDoubleClick={(event) => {
        event.stopPropagation();
        select(slide.id, layer.id);
        setEditingLayerId(layer.id);
      }}
    >
      {isEditing ? (
        <EditableText
          initial={layer.text}
          onDone={(text) => {
            if (text !== null && text !== layer.text) update({ text }, `typing:${layer.id}`);
            endGesture();
            setEditingLayerId(null);
          }}
        />
      ) : (
        <TextLayerContent layer={layer} text={layer.text || " "} />
      )}

      {isSelected &&
        !isEditing &&
        RESIZE_HANDLES.map((handle) => (
          <span
            key={handle.id}
            role="presentation"
            onPointerDown={(event) => startResize(event, handle)}
            className={cn("absolute rounded-full border border-slate-300 bg-white shadow", handle.className)}
            style={{ width: handleSize, height: handleSize, borderWidth: 1 / zoom }}
          />
        ))}
    </div>
  );
}

// ---- Slide ----

function SlideToolbar({ slide }: { slide: CarouselSlide }) {
  const { document, edit, select, setEditingLayerId, pickImage, zoom } = useEditor();
  const { base } = CAROUSEL_RATIOS[document.ratio];
  const LayoutIcon = LAYOUT_ICONS[slide.layout];

  const addText = () => {
    // 28 px suits the 9:16 frame; larger frames get proportionally larger text.
    const layer = createTextLayer({ fontSize: Math.round(28 * Math.min(base.width / 270, base.height / 480)) });
    edit(edits.addTextLayer(slide.id, layer));
    select(slide.id, layer.id);
    setEditingLayerId(layer.id);
  };
  const firstEmptyCell = Math.max(0, slide.images.findIndex((image) => !image.url));

  return (
    <div
      className="absolute left-0 top-full flex justify-center pt-3"
      style={chromeStyle(zoom, base.width, "top left")}
      onPointerDown={(event) => event.stopPropagation()}
      data-canvas-control
    >
      <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-neutral-950/90 p-1 shadow-xl backdrop-blur">
        <ChromeButton icon={Type} label="Ajouter un texte" onClick={addText} />
        <ChromeButton icon={ImagePlus} label="Ajouter une image" onClick={() => pickImage(slide.id, firstEmptyCell)} />

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Disposition des images"
                  className="flex size-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <LayoutIcon className="size-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Disposition des images</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" className="z-[60]">
            {CAROUSEL_LAYOUT_IDS.map((layout) => {
              const Icon = LAYOUT_ICONS[layout];
              return (
                <DropdownMenuItem key={layout} onClick={() => edit(edits.setLayout(slide.id, layout))}>
                  <Icon /> {CAROUSEL_LAYOUTS[layout].label}
                  {layout === slide.layout && <span className="ml-auto text-primary">•</span>}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <label className="flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-white/10">
              <span className="size-4 rounded-full border border-white/40" style={{ background: slide.background }} />
              <input
                type="color"
                className="sr-only"
                aria-label="Couleur de fond"
                value={slide.background.slice(0, 7)}
                onChange={(event) => edit(edits.updateSlide(slide.id, { background: event.target.value }), `background:${slide.id}`)}
              />
            </label>
          </TooltipTrigger>
          <TooltipContent>Couleur de fond</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function SlideFrame({ slide, index, left }: { slide: CarouselSlide; index: number; left: number }) {
  const { document, selection, select, edit, zoom } = useEditor();
  const { base } = CAROUSEL_RATIOS[document.ratio];
  const frameRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<Guides>(null);
  const isSelected = selection.slideId === slide.id;
  const count = document.slides.length;

  return (
    <div className="group/slide absolute top-0" style={{ left, width: base.width }} data-slide>
      <div
        className="absolute bottom-full left-0 flex items-center justify-between pb-2"
        style={chromeStyle(zoom, base.width, "bottom left")}
        onPointerDown={(event) => event.stopPropagation()}
        data-canvas-control
      >
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", isSelected ? "bg-primary/15 text-primary" : "text-white/50")}>
          {index + 1}
        </span>
        <div className={cn("flex items-center", !isSelected && "opacity-0 transition-opacity group-hover/slide:opacity-100")}>
          <ChromeButton icon={ArrowLeft} label="Déplacer à gauche" disabled={index === 0} onClick={() => edit(edits.moveSlide(slide.id, -1))} />
          <ChromeButton icon={ArrowRight} label="Déplacer à droite" disabled={index === count - 1} onClick={() => edit(edits.moveSlide(slide.id, 1))} />
          <ChromeButton icon={Copy} label="Dupliquer la slide" onClick={() => edit(edits.duplicateSlide(slide.id))} />
          <ChromeButton icon={Trash2} label="Supprimer la slide" danger disabled={count <= 1} onClick={() => edit(edits.removeSlide(slide.id))} />
        </div>
      </div>

      <div
        ref={frameRef}
        className="relative overflow-hidden shadow-2xl shadow-black/50"
        style={{
          width: base.width,
          height: base.height,
          background: slide.background,
          outline: `${(isSelected ? 2 : 1) / zoom}px solid ${isSelected ? "hsl(var(--primary))" : "rgb(255 255 255 / 0.08)"}`,
        }}
        onPointerDown={(event) => {
          if (event.button === 0) select(slide.id, null);
        }}
      >
        {slideCells(slide, document.ratio).map((cell, cellIndex) => (
          <ImageCell key={slide.images[cellIndex]?.id ?? cellIndex} slide={slide} index={cellIndex} cell={cell} />
        ))}
        {slide.textLayers.map((layer) => (
          <TextLayerItem key={layer.id} slide={slide} layer={layer} frameRef={frameRef} onGuides={setGuides} />
        ))}
        {guides?.vertical && <span className="pointer-events-none absolute inset-y-0 left-1/2 bg-primary" style={{ width: 1 / zoom }} />}
        {guides?.horizontal && <span className="pointer-events-none absolute inset-x-0 top-1/2 bg-primary" style={{ height: 1 / zoom }} />}
      </div>

      {isSelected && <SlideToolbar slide={slide} />}
    </div>
  );
}
