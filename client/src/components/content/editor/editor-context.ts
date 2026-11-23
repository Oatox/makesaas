import { createContext, useContext, type Dispatch } from "react";
import type { CarouselDocument } from "@shared/carousel";
import type { EditorAction } from "./editor-state";

export type EditorSelection = { slideId: string | null; layerId: string | null };

/** What the slides, the canvas and the inspector share with the editor (CarouselEditor provides it). */
export type EditorContextValue = {
  document: CarouselDocument;
  dispatch: Dispatch<EditorAction>;
  /** Applies a change to the document (see editorReducer for `mergeKey`). */
  edit: (apply: (document: CarouselDocument) => CarouselDocument, mergeKey?: string) => void;
  /** Ends a continuous change (drag, slider): the next change starts a new history step. */
  endGesture: () => void;
  selection: EditorSelection;
  select: (slideId: string | null, layerId?: string | null) => void;
  /** Text layer being typed in, on the slide itself. */
  editingLayerId: string | null;
  setEditingLayerId: (layerId: string | null) => void;
  zoom: number;
  /** Opens the file picker for an image cell. */
  pickImage: (slideId: string, index: number) => void;
  uploadImage: (slideId: string, index: number, file: File) => void;
  /** Cells being uploaded, as `${slideId}:${index}`. */
  uploadingCells: ReadonlySet<string>;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor() {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor must be used inside the carousel editor");
  return value;
}

export const cellKey = (slideId: string, index: number) => `${slideId}:${index}`;

/**
 * Follows a pointer from a pointerdown until it is released, wherever it goes (window listeners):
 * `move` gets the event and the distance travelled since the start, in screen px.
 */
export function trackPointer(
  start: { clientX: number; clientY: number },
  move: (event: PointerEvent, delta: { x: number; y: number }) => void,
  end?: () => void,
) {
  const onMove = (event: PointerEvent) => move(event, { x: event.clientX - start.clientX, y: event.clientY - start.clientY });
  const onEnd = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    end?.();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onEnd);
  window.addEventListener("pointercancel", onEnd);
}
