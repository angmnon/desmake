import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jobsStore, newId, type GenJob } from "@/lib/stores";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { STYLE_PRESETS } from "@/lib/presets";

// No edge runtime — jobs and sessions live in the shared `globalThis` store (R2/C1).

const ASPECTS = ["1:1", "3:4", "4:3", "16:9"] as const;

export async function POST(request: NextRequest) {
  // Generation creates a server-side job (a write) — require auth.
  const user = getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to generate designs" } }, { status: 401 });
  }

  let body: { prompt?: string; style?: string; aspect?: string; count?: number } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "invalid_json", message: "Request body must be valid JSON" } }, { status: 400 });
  }

  const { prompt, style = "minimal", aspect = "1:1", count = 4 } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
    return NextResponse.json({ error: { code: "validation", message: "prompt is required (min 2 chars)" } }, { status: 400 });
  }
  if (prompt.length > 500) {
    return NextResponse.json({ error: { code: "validation", message: "prompt must be ≤ 500 chars" } }, { status: 400 });
  }
  const n = Math.max(1, Math.min(4, Number(count) || 4));
  const safeStyle = STYLE_PRESETS[style] ? style : "minimal";
  // R2/M13: validate the aspect instead of echoing arbitrary client input into the job.
  const safeAspect = (ASPECTS as readonly string[]).includes(aspect) ? aspect : "1:1";

  const id = newId("gen");
  const job: GenJob = {
    id,
    user_id: user.id,
    status: "queued",
    progress: 5,
    prompt: prompt.trim(),
    style: safeStyle,
    aspect: safeAspect,
    count: n,
    created_at: new Date().toISOString(),
    started_at: Date.now(),
    outputs: null,
    error: null,
  };
  jobsStore().set(id, job);

  // No fake "credits_charged" / GPU claims. This endpoint produces a deterministic
  // client-rendered preview; it does not invoke an external model.
  return NextResponse.json(
    { job_id: id, status: "queued", eta_seconds: 6, created_at: job.created_at },
    { status: 202 },
  );
}
