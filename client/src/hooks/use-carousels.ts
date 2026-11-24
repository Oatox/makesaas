import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CAROUSEL_IMAGE_MAX_BYTES,
  DEFAULT_CAROUSEL_TITLE,
  carouselApi,
  createCarouselDocument,
  type CarouselDocument,
  type CarouselQuota,
  type CarouselRatio,
  type GenerateCarouselBody,
} from "@shared/carousel";
import type { Carousel } from "@shared/schema";
import { IMAGE_TYPES_LABEL, isImageType } from "@shared/storage";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/api-client";
import { downloadCarousel } from "@/lib/carousel-export";
import { translateSupabaseError } from "@/lib/error-translator";
import { useCurrentSaasId } from "./use-saas";
import { toast } from "./use-toast";

export const carouselKeys = {
  all: ["carousels"] as const,
  list: (saasId: string | undefined) => ["carousels", "list", saasId] as const,
  detail: (id: string) => ["carousels", "detail", id] as const,
  quota: ["carousels", "quota"] as const,
};

/** While a carousel is being generated, its row is re-read every few seconds. */
const GENERATING_REFETCH_MS = 3000;

/** Carousels of the active SaaS, last edited first (straight from Supabase, RLS). */
export function useCarousels() {
  const saasId = useCurrentSaasId();
  return useQuery({
    queryKey: carouselKeys.list(saasId),
    queryFn: async (): Promise<Carousel[]> => {
      const { data, error } = await supabase
        .from("carousels")
        .select("*")
        .eq("saas_id", saasId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!saasId,
    refetchInterval: (query) => (query.state.data?.some((carousel) => carousel.status === "generating") ? GENERATING_REFETCH_MS : false),
  });
}

export function useCarousel(id: string) {
  return useQuery({
    queryKey: carouselKeys.detail(id),
    queryFn: async (): Promise<Carousel | null> => {
      const { data, error } = await supabase.from("carousels").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => (query.state.data?.status === "generating" ? GENERATING_REFETCH_MS : false),
  });
}

/** Generations left over the last 24 hours (the server keeps the count). */
export function useCarouselQuota() {
  return useQuery({
    queryKey: carouselKeys.quota,
    queryFn: () => apiRequest<CarouselQuota>(carouselApi.quota.path),
  });
}

/** An empty carousel in the active SaaS, created from the browser (RLS). */
export function useCreateCarousel() {
  const queryClient = useQueryClient();
  const saasId = useCurrentSaasId();
  return useMutation({
    mutationFn: async (ratio: CarouselRatio): Promise<Carousel> => {
      if (!saasId) throw new Error("Crée d'abord un SaaS depuis la barre latérale.");
      const { data, error } = await supabase
        .from("carousels")
        .insert({ saas_id: saasId, title: DEFAULT_CAROUSEL_TITLE, document: createCarouselDocument(ratio) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: carouselKeys.all }),
    onError: (error) => toast({ variant: "destructive", ...translateSupabaseError(error, "Création impossible") }),
  });
}

/** Starts a generation: the server answers at once with the carousel, then fills it in the background. */
export function useGenerateCarousel() {
  const queryClient = useQueryClient();
  const saasId = useCurrentSaasId();
  return useMutation({
    mutationFn: (input: Omit<GenerateCarouselBody, "saasId">) => {
      if (!saasId) throw new Error("Crée d'abord un SaaS depuis la barre latérale.");
      const body: GenerateCarouselBody = { ...input, saasId };
      return apiRequest<Carousel>(carouselApi.generate.path, { method: "POST", body });
    },
    // Its card appears at once in the library, then the list and the quota are read again. Not
    // awaited: the caller's onSuccess (closing the dialog) does not wait for the reads.
    onSuccess: (carousel) => {
      queryClient.setQueryData<Carousel[]>(carouselKeys.list(carousel.saas_id), (previous) =>
        previous && !previous.some((item) => item.id === carousel.id) ? [carousel, ...previous] : previous,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: carouselKeys.all });
    },
  });
}

/** Saves the editor's changes (autosave). */
export function useSaveCarousel(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: { title: string; document: CarouselDocument }) => {
      const { data, error } = await supabase.from("carousels").update(changes).eq("id", id).select().single();
      if (error) throw error;
      return data as Carousel;
    },
    onSuccess: (carousel) => {
      queryClient.setQueryData(carouselKeys.detail(id), carousel);
      queryClient.invalidateQueries({ queryKey: ["carousels", "list"] });
    },
  });
}

/** Deleted from Supabase, then its images from the bucket by the server (best effort: the row is already gone). */
export function useDeleteCarousel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (carousel: Pick<Carousel, "id" | "saas_id">) => {
      const { error } = await supabase.from("carousels").delete().eq("id", carousel.id);
      if (error) throw error;
      await apiRequest(carouselApi.images.path(carousel.id), { method: "DELETE", query: { saasId: carousel.saas_id } }).catch(
        () => undefined,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: carouselKeys.all });
      toast({ title: "Carrousel supprimé" });
    },
    onError: (error) => toast({ variant: "destructive", ...translateSupabaseError(error, "Suppression impossible") }),
  });
}

/** Draws the slides and downloads them (one PNG, or a zip of PNGs); a failure shows a toast. */
export function useDownloadCarousel() {
  return useMutation({
    mutationFn: ({ title, document }: { title: string; document: CarouselDocument }) => downloadCarousel(title, document),
    onError: (error) => toast({ variant: "destructive", title: "Téléchargement impossible", description: error.message }),
  });
}

/** Checks an image, then sends it to the server, which stores it in the carousel's folder; returns its public URL. */
export async function uploadCarouselImage(carouselId: string, file: File): Promise<string> {
  if (!isImageType(file.type)) throw new Error(`Formats acceptés : ${IMAGE_TYPES_LABEL}.`);
  if (file.size > CAROUSEL_IMAGE_MAX_BYTES) {
    throw new Error(`Image trop lourde : ${CAROUSEL_IMAGE_MAX_BYTES / 1024 / 1024} Mo maximum.`);
  }
  const { url } = await apiRequest<{ url: string }>(carouselApi.images.path(carouselId), { method: "POST", body: file });
  return url;
}
