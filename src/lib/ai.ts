// Shared OpenAI-compatible image generation helper.
// Used by POST /api/generate when an API key is configured; returns null when the
// provider is not configured so callers fall back to the deterministic preview.

export const OPENAI_IMAGE_ENABLED = Boolean(process.env.OPENAI_API_KEY);
const OPENAI_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

export type AiImage = { url: string; seed: string };

/**
 * Generate `count` images from a prompt via an OpenAI-compatible images API.
 * Throws on provider errors — callers decide whether that fails the job.
 */
export async function generateWithOpenAI(prompt: string, count: number): Promise<AiImage[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const jobs = Array.from({ length: Math.max(1, Math.min(4, count)) }, () =>
    fetch(`${OPENAI_BASE}/v1/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        prompt,
        n: 1,
        size: "1024x1024",
      }),
      signal: AbortSignal.timeout(90_000),
    }),
  );
  const responses = await Promise.all(jobs);
  const outputs: AiImage[] = [];
  for (let i = 0; i < responses.length; i++) {
    const res = responses[i];
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI image provider error (${res.status}): ${text.slice(0, 160)}`);
    }
    const body = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
    const item = body.data?.[0];
    const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
    if (!url) throw new Error("AI image provider returned no image data");
    outputs.push({ url, seed: `ai-${prompt.slice(0, 24).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}-${i}` });
  }
  return outputs;
}
