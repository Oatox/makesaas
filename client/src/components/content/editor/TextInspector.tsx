import type { ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, Copy, Italic, Trash2, Underline, X } from "lucide-react";
import {
  CAROUSEL_TEXT,
  createCarouselId,
  type CarouselFontWeight,
  type CarouselSlide,
  type CarouselTextLayer,
} from "@shared/carousel";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useEditor } from "./editor-context";
import { edits } from "./editor-state";

const TEXT_COLORS = ["#ffffff", "#111111", "#ff6b1a", "#facc15", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
const BACKGROUND_COLORS = ["#000000", "#ffffff", "#ff6b1a", "#facc15", "#ef4444", "#22c55e", "#3b82f6", "#a855f7"];

const WEIGHTS: { value: `${CarouselFontWeight}`; label: string }[] = [
  { value: "400", label: "Normal" },
  { value: "600", label: "Semi" },
  { value: "700", label: "Gras" },
  { value: "800", label: "Extra" },
];

const SHADOWS = [
  { value: "none", label: "Aucune" },
  { value: "soft", label: "Douce" },
  { value: "strong", label: "Forte" },
] as const;

// ---- Colours: "#rrggbb" + an opacity, stored as "#rrggbbaa" ("transparent" = no box) ----

function splitColor(value: string): { hex: string; alpha: number } {
  if (value === "transparent") return { hex: "#000000", alpha: 0 };
  const hex = value.slice(0, 7);
  const alpha = value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1;
  return { hex, alpha: Number.isNaN(alpha) ? 1 : alpha };
}

function joinColor(hex: string, alpha: number) {
  if (alpha <= 0) return "transparent";
  if (alpha >= 1) return hex;
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}

// ---- Controls ----

function Field({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-white/60">{label}</span>
        {value !== undefined && <span className="tabular-nums text-white/80">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function Range({ value, min, max, step = 1, onChange, label }: { value: number; min: number; max: number; step?: number; onChange: (value: number) => void; label: string }) {
  return (
    <input
      type="range"
      aria-label={label}
      className="w-full accent-primary"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (hex: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`${label} ${color}`}
          onClick={() => onChange(color)}
          className={cn("size-6 rounded-full border border-white/20 transition-transform hover:scale-110", value === color && "ring-2 ring-primary ring-offset-2 ring-offset-neutral-950")}
          style={{ background: color }}
        />
      ))}
      <label className="relative flex size-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/20 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Autre couleur">
        <input
          type="color"
          className="sr-only"
          aria-label={`${label} personnalisée`}
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}

function ToggleButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-8 flex-1 items-center justify-center rounded-lg border text-white/70 transition-colors",
        active ? "border-primary/40 bg-primary/15 text-primary" : "border-white/10 hover:bg-white/5 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

/** Right panel of the selected text layer. Each control is one history step per gesture. */
export function TextInspector({ slide, layer }: { slide: CarouselSlide; layer: CarouselTextLayer }) {
  const { edit, endGesture, select } = useEditor();
  const update = (patch: Partial<CarouselTextLayer>, field: string) => edit(edits.updateTextLayer(slide.id, layer.id, patch), `${field}:${layer.id}`);
  const background = splitColor(layer.backgroundColor);
  const hasBackground = layer.backgroundColor !== "transparent";

  return (
    <aside
      className="absolute bottom-3 right-3 top-3 flex w-72 flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/92 text-white shadow-2xl backdrop-blur-xl"
      onPointerUp={endGesture}
      data-canvas-control
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-semibold">Texte</p>
        <button type="button" aria-label="Fermer" className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => select(slide.id, null)}>
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <Textarea
          value={layer.text}
          rows={3}
          aria-label="Contenu du texte"
          onChange={(event) => update({ text: event.target.value }, "text")}
          className="resize-none bg-white/[0.04] text-sm"
        />

        <Field label="Taille" value={`${layer.fontSize} px`}>
          <Range label="Taille" value={layer.fontSize} min={CAROUSEL_TEXT.minFontSize} max={CAROUSEL_TEXT.maxFontSize} onChange={(fontSize) => update({ fontSize }, "size")} />
        </Field>

        <Field label="Style">
          <SegmentedControl
            options={WEIGHTS}
            value={`${layer.fontWeight}` as `${CarouselFontWeight}`}
            onValueChange={(value) => update({ fontWeight: Number(value) as CarouselFontWeight }, "weight")}
            label="Graisse"
            className="w-full"
          />
          <div className="flex gap-1.5">
            <ToggleButton active={layer.italic} label="Italique" onClick={() => update({ italic: !layer.italic }, "italic")}>
              <Italic className="size-4" />
            </ToggleButton>
            <ToggleButton active={layer.underline} label="Souligné" onClick={() => update({ underline: !layer.underline }, "underline")}>
              <Underline className="size-4" />
            </ToggleButton>
            {(
              [
                ["left", AlignLeft, "Aligner à gauche"],
                ["center", AlignCenter, "Centrer"],
                ["right", AlignRight, "Aligner à droite"],
              ] as const
            ).map(([align, Icon, label]) => (
              <ToggleButton key={align} active={layer.textAlign === align} label={label} onClick={() => update({ textAlign: align }, "align")}>
                <Icon className="size-4" />
              </ToggleButton>
            ))}
          </div>
        </Field>

        <Field label="Largeur" value={layer.width === null ? "Auto" : `${Math.round(layer.width)} %`}>
          <div className="flex items-center gap-2">
            <Range
              label="Largeur"
              value={layer.width ?? CAROUSEL_TEXT.maxAutoWidth}
              min={CAROUSEL_TEXT.minWidth}
              max={100}
              onChange={(width) => update({ width }, "width")}
            />
            <button
              type="button"
              className={cn("shrink-0 rounded-md px-2 py-1 text-xs", layer.width === null ? "bg-primary/15 text-primary" : "text-white/60 hover:bg-white/10")}
              onClick={() => update({ width: null }, "width-auto")}
            >
              Auto
            </button>
          </div>
        </Field>

        <Field label="Couleur">
          <Swatches label="Couleur du texte" colors={TEXT_COLORS} value={layer.color} onChange={(color) => update({ color }, "color")} />
        </Field>

        <Field label="Fond" value={hasBackground ? `${Math.round(background.alpha * 100)} %` : "Aucun"}>
          <Swatches
            label="Fond"
            colors={BACKGROUND_COLORS}
            value={hasBackground ? background.hex : ""}
            onChange={(hex) => update({ backgroundColor: joinColor(hex, hasBackground ? background.alpha : 0.7) }, "background")}
          />
          {hasBackground && (
            <>
              <Range label="Opacité du fond" value={Math.round(background.alpha * 100)} min={5} max={100} onChange={(alpha) => update({ backgroundColor: joinColor(background.hex, alpha / 100) }, "background-alpha")} />
              <Field label="Arrondi" value={`${layer.backgroundRadius} px`}>
                <Range label="Arrondi du fond" value={layer.backgroundRadius} min={0} max={CAROUSEL_TEXT.maxBackgroundRadius} onChange={(backgroundRadius) => update({ backgroundRadius }, "radius")} />
              </Field>
              <button type="button" className="text-xs text-white/50 underline-offset-2 hover:text-white hover:underline" onClick={() => update({ backgroundColor: "transparent" }, "background")}>
                Retirer le fond
              </button>
            </>
          )}
        </Field>

        <Field label="Contour" value={layer.outlineWidth > 0 ? `${layer.outlineWidth} px` : "Aucun"}>
          <Range label="Épaisseur du contour" value={layer.outlineWidth} min={0} max={CAROUSEL_TEXT.maxOutlineWidth} step={0.5} onChange={(outlineWidth) => update({ outlineWidth }, "outline")} />
          {layer.outlineWidth > 0 && (
            <Swatches label="Couleur du contour" colors={TEXT_COLORS} value={layer.outlineColor} onChange={(outlineColor) => update({ outlineColor }, "outline-color")} />
          )}
        </Field>

        <Field label="Ombre">
          <SegmentedControl options={SHADOWS} value={layer.shadow} onValueChange={(shadow) => update({ shadow }, "shadow")} label="Ombre" className="w-full" />
          {layer.shadow !== "none" && (
            <Range label="Intensité de l'ombre" value={layer.shadowIntensity} min={0} max={100} onChange={(shadowIntensity) => update({ shadowIntensity }, "shadow-intensity")} />
          )}
        </Field>
      </div>

      <div className="flex gap-2 border-t border-white/10 p-3">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            const copyId = createCarouselId();
            edit(edits.duplicateTextLayer(slide.id, layer.id, copyId));
            select(slide.id, copyId);
          }}
        >
          <Copy /> Dupliquer
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-destructive hover:text-destructive"
          onClick={() => {
            edit(edits.removeTextLayer(slide.id, layer.id));
            select(slide.id, null);
          }}
        >
          <Trash2 /> Supprimer
        </Button>
      </div>
    </aside>
  );
}
