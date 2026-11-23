import {
  CAROUSEL_RATIOS,
  CAROUSEL_TEXT,
  CAROUSEL_MAX_SLIDES,
  createCarouselId,
  createSlide,
  imagesForLayout,
  type CarouselDocument,
  type CarouselLayout,
  type CarouselRatio,
  type CarouselSlide,
  type CarouselTextLayer,
} from "@shared/carousel";

/**
 * Editor state: the carousel being edited (title + document) with its undo/redo history. Every change
 * is a pure function of the document; consecutive changes sharing a `mergeKey` (a drag, a slider,
 * typing in a field) make a single history step, until the gesture ends.
 */

export type EditorSnapshot = { title: string; document: CarouselDocument };

export type EditorState = {
  present: EditorSnapshot;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  mergeKey: string | null;
};

export type EditorAction =
  | { type: "edit"; apply: (document: CarouselDocument) => CarouselDocument; mergeKey?: string }
  | { type: "rename"; title: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "endGesture" };

const MAX_HISTORY = 80;

export const initialEditorState = (present: EditorSnapshot): EditorState => ({ present, past: [], future: [], mergeKey: null });

function commit(state: EditorState, next: EditorSnapshot, mergeKey: string | null): EditorState {
  if (next.document === state.present.document && next.title === state.present.title) return state;
  const merge = mergeKey !== null && mergeKey === state.mergeKey;
  return {
    present: next,
    past: merge ? state.past : [...state.past, state.present].slice(-MAX_HISTORY),
    future: [],
    mergeKey,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "edit":
      return commit(state, { ...state.present, document: action.apply(state.present.document) }, action.mergeKey ?? null);
    case "rename":
      return commit(state, { ...state.present, title: action.title }, "title");
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return { present: previous, past: state.past.slice(0, -1), future: [state.present, ...state.future], mergeKey: null };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (!next) return state;
      return { present: next, past: [...state.past, state.present], future, mergeKey: null };
    }
    case "endGesture":
      return state.mergeKey === null ? state : { ...state, mergeKey: null };
  }
}

// ---- Document operations (pure) ----

type Edit = (document: CarouselDocument) => CarouselDocument;

const mapSlide = (slideId: string, change: (slide: CarouselSlide) => CarouselSlide): Edit => (document) => ({
  ...document,
  slides: document.slides.map((slide) => (slide.id === slideId ? change(slide) : slide)),
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Copy with new ids, so the copy's images and layers can be edited apart. */
const cloneSlide = (slide: CarouselSlide): CarouselSlide => ({
  ...slide,
  id: createCarouselId(),
  images: slide.images.map((image) => ({ ...image, id: createCarouselId() })),
  textLayers: slide.textLayers.map((layer) => ({ ...layer, id: createCarouselId() })),
});

export const edits = {
  updateSlide: (slideId: string, patch: Partial<Pick<CarouselSlide, "background">>): Edit =>
    mapSlide(slideId, (slide) => ({ ...slide, ...patch })),

  /** A new empty slide after `afterSlideId` (at the end when null), with the same background. */
  addSlide:
    (afterSlideId: string | null, slide: CarouselSlide): Edit =>
    (document) => {
      if (document.slides.length >= CAROUSEL_MAX_SLIDES) return document;
      const index = afterSlideId ? document.slides.findIndex((item) => item.id === afterSlideId) : document.slides.length - 1;
      const slides = [...document.slides];
      slides.splice(index + 1, 0, slide);
      return { ...document, slides };
    },

  duplicateSlide:
    (slideId: string): Edit =>
    (document) => {
      const index = document.slides.findIndex((slide) => slide.id === slideId);
      if (index < 0 || document.slides.length >= CAROUSEL_MAX_SLIDES) return document;
      const slides = [...document.slides];
      slides.splice(index + 1, 0, cloneSlide(document.slides[index]));
      return { ...document, slides };
    },

  /** The last slide cannot be removed. */
  removeSlide:
    (slideId: string): Edit =>
    (document) =>
      document.slides.length <= 1 ? document : { ...document, slides: document.slides.filter((slide) => slide.id !== slideId) },

  moveSlide:
    (slideId: string, offset: -1 | 1): Edit =>
    (document) => {
      const index = document.slides.findIndex((slide) => slide.id === slideId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= document.slides.length) return document;
      const slides = [...document.slides];
      [slides[index], slides[target]] = [slides[target], slides[index]];
      return { ...document, slides };
    },

  setLayout: (slideId: string, layout: CarouselLayout): Edit =>
    mapSlide(slideId, (slide) => ({ ...slide, layout, images: imagesForLayout(layout, slide.images) })),

  setImage: (slideId: string, index: number, url: string | null): Edit =>
    mapSlide(slideId, (slide) => ({
      ...slide,
      images: slide.images.map((image, position) => (position === index ? { ...image, url, focalX: 50, focalY: 50 } : image)),
    })),

  setFocalPoint: (slideId: string, index: number, focalX: number, focalY: number): Edit =>
    mapSlide(slideId, (slide) => ({
      ...slide,
      images: slide.images.map((image, position) =>
        position === index ? { ...image, focalX: clamp(focalX, 0, 100), focalY: clamp(focalY, 0, 100) } : image,
      ),
    })),

  addTextLayer: (slideId: string, layer: CarouselTextLayer): Edit =>
    mapSlide(slideId, (slide) => ({ ...slide, textLayers: [...slide.textLayers, layer] })),

  updateTextLayer: (slideId: string, layerId: string, patch: Partial<Omit<CarouselTextLayer, "id">>): Edit =>
    mapSlide(slideId, (slide) => ({
      ...slide,
      textLayers: slide.textLayers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
    })),

  removeTextLayer: (slideId: string, layerId: string): Edit =>
    mapSlide(slideId, (slide) => ({ ...slide, textLayers: slide.textLayers.filter((layer) => layer.id !== layerId) })),

  /** Copy placed just below the original, on top of the other layers. */
  duplicateTextLayer: (slideId: string, layerId: string, copyId: string): Edit =>
    mapSlide(slideId, (slide) => {
      const source = slide.textLayers.find((layer) => layer.id === layerId);
      if (!source) return slide;
      return { ...slide, textLayers: [...slide.textLayers, { ...source, id: copyId, y: clamp(source.y + 8, 0, 100) }] };
    }),

  /** Changes the format; font sizes follow the frame, so the text keeps fitting its slide. */
  setRatio:
    (ratio: CarouselRatio): Edit =>
    (document) => {
      if (ratio === document.ratio) return document;
      const from = CAROUSEL_RATIOS[document.ratio].base;
      const to = CAROUSEL_RATIOS[ratio].base;
      const scale = Math.min(to.width / from.width, to.height / from.height);
      return {
        ...document,
        ratio,
        slides: document.slides.map((slide) => ({
          ...slide,
          textLayers: slide.textLayers.map((layer) => ({
            ...layer,
            fontSize: Math.round(clamp(layer.fontSize * scale, CAROUSEL_TEXT.minFontSize, CAROUSEL_TEXT.maxFontSize)),
          })),
        })),
      };
    },
};

/** A fresh slide for `addSlide`, keeping the background of the slide it follows. */
export const newSlideAfter = (previous: CarouselSlide | undefined) => createSlide("single", previous?.background);
