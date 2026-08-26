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

const ASPECT_RATIO_MAP = {
  fast: {
    "1:1": "square_hd",
    "4:3": "landscape_4_3",
    "16:9": "landscape_16_9",
    "9:16": "portrait_16_9",
  },
};

const STYLE_PROMPTS = {
  natural: "",
  editorial: "Editorial art direction, controlled composition, confident lighting, publication-ready finish.",
  product: "Premium product photography, material accuracy, intentional highlights, clean commercial composition.",
  cinematic: "Cinematic lighting, atmospheric depth, deliberate lens language, emotionally precise color.",
  analog: "Analog photographic character, tactile grain, imperfect optics, restrained color separation.",
  surreal: "Surreal but coherent visual logic, unexpected scale, poetic material transformation.",
};

function withStyle(prompt, style = "natural") {
  const direction = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.natural;
  return direction ? `${prompt}\n\nVisual direction: ${direction}` : prompt;
}

function safeAspectRatio(value, fallback) {
  return ["1:1", "4:3", "16:9", "9:16"].includes(value) ? value : fallback;
}

export function resolveGenerationConfig(outcome, options = {}) {
  const base = OUTCOME_CONFIG[outcome];
  if (!base) throw new Error("Unsupported outcome.");

  const referenceUrl = typeof options.referenceUrl === "string" ? options.referenceUrl : "";
  const aspectRatio = safeAspectRatio(options.aspectRatio, outcome === "cinematic" ? "16:9" : "4:3");
  const prompt = withStyle(options.prompt ?? "", options.style);

  if (referenceUrl && outcome === "cinematic") {
    return {
      ...base,
      model: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
      input: {
        prompt,
        image_url: referenceUrl,
        aspect_ratio: aspectRatio,
        duration: "5",
        negative_prompt: "blur, distort, low quality, text, watermark",
      },
    };
  }

  if (referenceUrl && outcome === "quality") {
    const requestedStrength = Number(options.referenceStrength);
    const strength = Number.isFinite(requestedStrength)
      ? Math.min(0.95, Math.max(0.55, requestedStrength))
      : 0.78;
    return {
      ...base,
      model: "fal-ai/flux/krea/image-to-image",
      input: {
        image_url: referenceUrl,
        prompt,
        strength,
        num_images: 1,
        output_format: "jpeg",
        enable_safety_checker: true,
      },
    };
  }

  if (referenceUrl) throw new Error("References require the Studio image or cinematic route.");

  if (outcome === "fast") {
    return {
      ...base,
      input: {
        ...base.input(prompt),
        image_size: ASPECT_RATIO_MAP.fast[aspectRatio],
      },
    };
  }

  return {
    ...base,
    input: {
      ...base.input(prompt),
      aspect_ratio: aspectRatio,
    },
  };
}

function configuredFal() {
  if (process.env.LMIERE_ENABLE_PAID_GENERATIONS !== "true") {
    throw new Error("Paid generations are disabled until the first test is approved.");
  }
  if (!process.env.FAL_KEY) throw new Error("FAL_KEY is not configured.");
  fal.config({ credentials: process.env.FAL_KEY });
  return fal;
}

export async function uploadFalReference({ bytes, name, contentType }) {
  const file = new File([bytes], name, { type: contentType });
  return configuredFal().storage.upload(file);
}

export async function submitFal(outcome, prompt, options = {}) {
  const config = resolveGenerationConfig(outcome, { ...options, prompt });
  return configuredFal().queue.submit(config.model, { input: config.input });
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
