import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_PIPELINE_SLUGS,
  CAROUSEL_TEXT_LIMITS,
  carouselAiResultSchema,
  carouselResponseSchema,
  type CarouselTemplateVariable,
} from "@shared/ai-pipeline";
import {
  CAROUSEL_IMAGE_MODEL,
  CAROUSEL_IMAGE_RESOLUTION,
  CAROUSEL_RATIOS,
  carouselImagePrompt,
  type CarouselRatio,
} from "@shared/carousel";
import type { ChatMessage, OneShotClient } from "../ai/oneshot-client";
import { AiPipelineNotFoundError, AiPipelineRepository, renderTemplate } from "../ai/pipelines";
import { logger } from "../lib/logger";
import { storage, type R2Storage } from "../storage/r2";
import { buildGeneratedDocument } from "./generated-document";
import { removeCarouselImages, storeGeneratedImage } from "./storage";

/** Images generated at once: OneShotAPI queues the rest, and refuses too many at a time. */
const IMAGE_CONCURRENCY = 3;
const IMAGE_PROMPT_MAX_LENGTH = 3000;

/** French message shown on the carousel when its generation fails. */
class GenerationError extends Error {}

export type CarouselGenerationJob = {
  carouselId: string;
  generationId: string;
  userId: string;
  saasId: string;
  saasName: string;
  topic: string;
  slideCount: number;
  ratio: CarouselRatio;
};

async function mapWithConcurrency<T, R>(items: T[], limit: number, run: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Text of the carousel by the "carousel" pipeline (admin-editable prompts). */
async function writeCarouselText(db: SupabaseClient, oneshot: OneShotClient, job: CarouselGenerationJob) {
  let pipeline;
  try {
    pipeline = await new AiPipelineRepository(db).get(AI_PIPELINE_SLUGS.carousel);
  } catch (err) {
    if (err instanceof AiPipelineNotFoundError) {
      logger.error({ err }, "Carousel AI pipeline missing");
      throw new GenerationError("La génération n'est pas configurée : pipeline « carousel » introuvable.");
    }
    throw err;
  }

  const variables: Record<CarouselTemplateVariable, string> = {
    input: job.topic,
    saas: job.saasName,
    slides: String(job.slideCount),
    format: `${CAROUSEL_RATIOS[job.ratio].detail.toLowerCase()} ${job.ratio}`,
  };
  const messages: ChatMessage[] = [
    { role: "system", content: renderTemplate(pipeline.system_prompt, variables) },
    { role: "user", content: renderTemplate(pipeline.data_prompt, variables) },
    { role: "user", content: renderTemplate(pipeline.instructions_prompt, variables) },
    { role: "user", content: renderTemplate(pipeline.output_format_prompt, variables) },
  ];

  const { jobId, json } = await oneshot.generateJson({
    model: pipeline.model,
    messages,
    responseSchema: carouselResponseSchema(job.slideCount),
  });
  const result = carouselAiResultSchema.safeParse(json);
  if (!result.success) {
    logger.error({ jobId, issues: result.error.issues }, "Carousel AI answer does not match the expected schema");
    throw new GenerationError("L'IA a renvoyé une réponse invalide : relance la génération.");
  }

  // The schema asks for exact lengths, the model may still exceed them: keep the slides readable.
  return {
    title: result.data.title.slice(0, CAROUSEL_TEXT_LIMITS.title),
    slides: result.data.slides.slice(0, job.slideCount).map((slide) => ({
      headline: slide.headline.slice(0, CAROUSEL_TEXT_LIMITS.headline),
      body: slide.body.slice(0, CAROUSEL_TEXT_LIMITS.body),
      imagePrompt: slide.imagePrompt.slice(0, CAROUSEL_TEXT_LIMITS.imagePrompt),
    })),
  };
}

/** The image of a slide, stored in the bucket; null when it could not be made (the slide keeps its colour). */
async function makeSlideImage(files: R2Storage, oneshot: OneShotClient, job: CarouselGenerationJob, imagePrompt: string) {
  // The text is laid over the image and must stay editable: the model draws none.
  const prompt = carouselImagePrompt(imagePrompt, job.ratio);
  try {
    const image = await oneshot.generateImage({
      model: CAROUSEL_IMAGE_MODEL,
      prompt: prompt.slice(0, IMAGE_PROMPT_MAX_LENGTH),
      aspectRatio: job.ratio,
      resolution: CAROUSEL_IMAGE_RESOLUTION,
    });
    return await storeGeneratedImage(files, { userId: job.userId, saasId: job.saasId, carouselId: job.carouselId, url: image.url });
  } catch (err) {
    logger.warn({ err, carouselId: job.carouselId }, "Carousel slide image generation failed");
    return null;
  }
}

async function setGenerationStatus(db: SupabaseClient, generationId: string, status: "succeeded" | "failed") {
  const { error } = await db.from("carousel_generations").update({ status }).eq("id", generationId);
  if (error) logger.error({ err: error, generationId }, "Failed to update a carousel generation");
}

/**
 * Generates a carousel in the background (the route has already answered): its text, then one image
 * per slide, then the document. Never throws: a failure is recorded on the carousel, and a failed
 * generation does not count in the daily quota.
 */
export async function generateCarousel(db: SupabaseClient, oneshot: OneShotClient, job: CarouselGenerationJob) {
  try {
    const text = await writeCarouselText(db, oneshot, job);
    // Without the bucket, no image is drawn: it could not be kept (OneShotAPI URLs are temporary).
    const files = storage;
    const imageUrls = files
      ? await mapWithConcurrency(text.slides, IMAGE_CONCURRENCY, (slide) => makeSlideImage(files, oneshot, job, slide.imagePrompt))
      : text.slides.map(() => null);
    const missing = imageUrls.filter((url) => !url).length;

    const { data: updated, error } = await db
      .from("carousels")
      .update({
        title: text.title,
        document: buildGeneratedDocument(job.ratio, text.slides, imageUrls),
        status: "ready",
        error: missing > 0 ? `${missing} image${missing > 1 ? "s" : ""} sur ${imageUrls.length} n'${missing > 1 ? "ont" : "a"} pas pu être générée${missing > 1 ? "s" : ""} : ajoute-les à la main.` : null,
      })
      .eq("id", job.carouselId)
      .select("id");
    if (error) throw error;

    // Deleted while it was being generated: its images have no carousel anymore.
    if (updated.length === 0 && files) await removeCarouselImages(files, job);
    await setGenerationStatus(db, job.generationId, "succeeded");
  } catch (err) {
    if (!(err instanceof GenerationError)) logger.error({ err, carouselId: job.carouselId }, "Carousel generation failed");
    const message =
      err instanceof GenerationError ? err.message : "L'IA est momentanément indisponible : relance la génération dans un instant.";
    const { error } = await db.from("carousels").update({ status: "failed", error: message }).eq("id", job.carouselId);
    if (error) logger.error({ err: error, carouselId: job.carouselId }, "Failed to record a carousel generation failure");
    await setGenerationStatus(db, job.generationId, "failed");
  }
}
