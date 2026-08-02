import { fal } from "@fal-ai/client";
import { put } from "@vercel/blob";

export const OUTCOME_CONFIG = {
  fast: {
    model: "fal-ai/flux/schnell",
    chargeCents: 8,
    input(prompt) {
      return {
        prompt,
        image_size: "landscape_4_3",
        num_images: 1,
        output_format: "jpeg",
        enable_safety_checker: true,
      };
    },
  },
  cinematic: {
    model: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    chargeCents: 42,
    input(prompt) {
      return {
        prompt,
        aspect_ratio: "16:9",
        duration: "5",
        negative_prompt: "blur, distort, low quality, text, watermark",
      };
    },
  },
  quality: {
    model: "fal-ai/flux-pro/v1.1-ultra",
    chargeCents: 76,
    input(prompt) {
      return {
        prompt,
        aspect_ratio: "4:3",
        num_images: 1,
        output_format: "jpeg",
        enhance_prompt: true,
        safety_tolerance: "2",
      };
    },
  },
};

function configuredFal() {
  if (process.env.LMIERE_ENABLE_PAID_GENERATIONS !== "true") {
    throw new Error("Paid generations are disabled until the first test is approved.");
  }
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured.");
  fal.config({ credentials: process.env.FAL_KEY });
  return fal;
}

export async function submitFal(outcome, prompt) {
  const config = OUTCOME_CONFIG[outcome];
  if (!config) throw new Error("Unsupported outcome.");
  return configuredFal().queue.submit(config.model, { input: config.input(prompt) });
}

export async function getFalStatus(model, requestId) {
  return configuredFal().queue.status(model, { requestId, logs: false });
}

export async function getFalResult(model, requestId) {
  return configuredFal().queue.result(model, { requestId });
}

export function extractMedia(result) {
  const data = result?.data ?? result;
  const media = data?.video ?? data?.images?.[0] ?? data?.image;
  const url = typeof media === "string" ? media : media?.url;
  if (!url) throw new Error("Fal returned no media URL.");

  const contentType = media?.content_type
    ?? media?.contentType
    ?? (data?.video ? "video/mp4" : "image/jpeg");

  return { url, contentType };
}

export async function persistMedia({ providerUrl, contentType, userId, generationId }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return providerUrl;

  const response = await fetch(providerUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Could not preserve generated media (HTTP ${response.status}).`);
  }

  const extension = contentType.includes("video") ? "mp4" : contentType.includes("png") ? "png" : "jpg";
  const blob = await put(`generations/${userId}/${generationId}.${extension}`, response.body, {
    access: "public",
    addRandomSuffix: false,
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}
