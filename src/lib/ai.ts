// Shared OpenAI-compatible image generation helper.
//
// Primary provider: Agnes AI (https://apihub.agnes-ai.com/v1, OpenAI-compatible).
// Falls back to OPENAI_* if Agnes keys are absent. Returns null upstream when no
// provider is configured so callers fall back to the deterministic preview.

export const AGNES_IMAGE_ENABLED = Boolean(process.env.AGNES_API_KEY);
export const OPENAI_IMAGE_ENABLED = Boolean(process.env.OPENAI_API_KEY);

const AGNES_BASE = process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1";
const AGNES_MODEL = process.env.AGNES_IMAGE_MODEL || "agnes-image-2.1-flash";
const OPENAI_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

export type AiImage = { url: string; seed: string; width: number; height: number };

// Aspect ratio → Agnes size string + the raster dimensions we report back.
const ASPECT_SIZE: Record<string, { size: string; width: number; height: number }> = {
  "1:1": { size: "1024x1024", width: 1024, height: 1024 },
  "3:4": { size: "768x1024", width: 768, height: 1024 },
  "4:3": { size: "1024x768", width: 1024, height: 768 },
  "16:9": { size: "1280x720", width: 1280, height: 720 },
};

function dimsForAspect(aspect: string) {
  return ASPECT_SIZE[aspect] ?? ASPECT_SIZE["1:1"];
}

/** Whether any real image provider is configured. */
export function imageProviderEnabled(): boolean {
  return AGNES_IMAGE_ENABLED || OPENAI_IMAGE_ENABLED;
}

export function imageProviderName(): string {
  if (AGNES_IMAGE_ENABLED) return "agnes";
  if (OPENAI_IMAGE_ENABLED) return "openai";
  return "none";
}

export async function generateImage(prompt: string, count: number, aspect = "1:1"): Promise<AiImage[]> {
  if (AGNES_IMAGE_ENABLED) return generateWithAgnes(prompt, count, aspect);
  if (OPENAI_IMAGE_ENABLED) return generateWithOpenAI(prompt, count, aspect);
  throw new Error("No image provider configured");
}

async function generateWithAgnes(prompt: string, count: number, aspect: string): Promise<AiImage[]> {
  const key = process.env.AGNES_API_KEY;
  if (!key) throw new Error("AGNES_API_KEY is not configured");
  const { size, width, height } = dimsForAspect(aspect);
  const jobs = Array.from({ length: Math.max(1, Math.min(4, count)) }, () =>
    fetch(`${AGNES_BASE}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: AGNES_MODEL, prompt, size, n: 1 }),
      signal: AbortSignal.timeout(120_000),
    }),
  );
  const responses = await Promise.all(jobs);
  const outputs: AiImage[] = [];
  for (const res of responses) {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Agnes AI image error (${res.status}): ${text.slice(0, 160)}`);
    }
    const body = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
    const item = body.data?.[0];
    const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
    if (!url) throw new Error("Agnes AI returned no image data");
    outputs.push({ url, seed: `agnes-${Date.now().toString(36)}-${outputs.length}`, width, height });
  }
  return outputs;
}

async function generateWithOpenAI(prompt: string, count: number, aspect: string): Promise<AiImage[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const { size, width, height } = dimsForAspect(aspect);
  const jobs = Array.from({ length: Math.max(1, Math.min(4, count)) }, () =>
    fetch(`${OPENAI_BASE}/v1/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: OPENAI_MODEL, prompt, n: 1, size }),
      signal: AbortSignal.timeout(90_000),
    }),
  );
  const responses = await Promise.all(jobs);
  const outputs: AiImage[] = [];
  for (const res of responses) {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI image error (${res.status}): ${text.slice(0, 160)}`);
    }
    const body = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
    const item = body.data?.[0];
    const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
    if (!url) throw new Error("OpenAI returned no image data");
    outputs.push({ url, seed: `openai-${Date.now().toString(36)}-${outputs.length}`, width, height });
  }
  return outputs;
}
