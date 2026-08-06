import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getJob, type GenOutput } from "@/lib/stores";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { STYLE_PRESETS } from "@/lib/presets";

// R2/M13: the requested aspect ratio must actually shape the artifact. It used to be
// stored on the job and then ignored — every output came back 1024×1024 regardless,
// so "Wide" and "Portrait" produced identical assets that were merely CSS-cropped.
const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 896, height: 1192 },
  "4:3": { width: 1192, height: 896 },
  "16:9": { width: 1360, height: 768 },
};

// No edge runtime — the job store lives on `globalThis` and must be shared with
// POST /api/generate, which created the job (R2/C1).

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in to view generation" } }, { status: 401 });
  }

  const { id } = await params;

  // Never synthesize a job for an unknown id, and never expose someone else's.
  // R2/H1: the ownership check was missing — any signed-in user could poll another
  // user's job and read their prompt. A foreign id returns 404, not 403.
  // getJob() reads memory first and falls back to D1 so the poll resolves even
  // when it lands on a different container instance than the one that created it.
  const job = await getJob(id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: { code: "not_found", message: "Job not found" } }, { status: 404 });
  }

  const elapsed = Date.now() - (job.started_at || Date.now());
  let status: string;
  let progress: number;

  // Real AI jobs: the async worker mutates the job in place. Until outputs or an
  // error arrive, report queued/running so the Studio UI keeps polling.
  if (job.ai) {
    if (job.status === "failed") {
      status = "failed";
      progress = job.progress;
    } else if (job.outputs) {
      status = "succeeded";
      progress = 100;
    } else {
      status = "queued";
      progress = Math.min(92, 5 + Math.floor(elapsed / 1200));
    }
  } else if (elapsed < 800) {
    status = "queued";
    progress = Math.min(15, Math.floor(elapsed / 60));
  } else if (elapsed < 3200) {
    status = "running";
    progress = Math.min(92, 15 + Math.floor((elapsed - 800) / 30));
  } else {
    status = "succeeded";
    progress = 100;
  }

  job.status = status;
  job.progress = progress;

  let outputs: GenOutput[] | null = job.outputs ?? null;
  // Deterministic (demo) fallback: synthesize outputs once the elapsed threshold passes.
  if (status === "succeeded" && !outputs && !job.ai) {
    const palette = STYLE_PRESETS[job.style] || STYLE_PRESETS.minimal;
    const count = job.count || 4;
    const dims = ASPECT_DIMENSIONS[job.aspect] ?? ASPECT_DIMENSIONS["1:1"];
    outputs = Array.from({ length: count }).map((_, i) => {
      const baseShape =
        job.style === "radial" ? 3 :
        job.style === "bold" ? 2 :
        job.style === "abstract" || job.style === "organic" ? 1 : 0;
      const shape = (baseShape + i) % 6;
      const seedStr = (job.prompt || "design") + "-" + id + "-" + i;
      return { seed: seedStr, width: dims.width, height: dims.height, palette, shape };
    });
    job.outputs = outputs;
  }

  return NextResponse.json(
    {
      job_id: id,
      status,
      progress,
      prompt: job.prompt,
      style: job.style,
      aspect: job.aspect,
      eta_seconds: Math.max(0, Math.ceil((100 - progress) / 25)),
      outputs,
      error: job.error,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
