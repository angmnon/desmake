import { NextResponse } from "next/server";
import { D1_ENABLED } from "@/lib/db";
import { AGNES_IMAGE_ENABLED, OPENAI_IMAGE_ENABLED, imageProviderName } from "@/lib/ai";
import { STRIPE_ENABLED } from "@/lib/stripe";
import { EMAIL_ENABLED } from "@/lib/email";
import { uptimeMs, errorWindow } from "@/lib/monitor";

export async function GET() {
  const errors1h = errorWindow(60 * 60 * 1000).length;
  return NextResponse.json({
    name: "Desmake API",
    version: "0.1.0-mvp",
    status: "ok",
    uptime_seconds: Math.floor(uptimeMs() / 1000),
    enabled: {
      d1: D1_ENABLED,
      image_provider: imageProviderName(),
      agnes_image: AGNES_IMAGE_ENABLED,
      openai_image: OPENAI_IMAGE_ENABLED,
      stripe: STRIPE_ENABLED,
      email: EMAIL_ENABLED,
    },
    errors_last_hour: errors1h,
    endpoints: [
      "GET /api/health",
      "GET /api/adapters",
      "GET /api/listings",
      "GET /api/listings/:slug",
      "GET /api/creators/:handle",
      "POST /api/generate",
      "GET /api/generate/:id",
      "POST /api/orders",
      "GET /api/orders/:id",
      "POST /api/payments",
      "POST /api/payments/confirm",
      "POST /api/payments/webhook",
      "POST /api/auth/register",
      "POST /api/auth/login",
      "GET /api/auth/verify",
    ],
  });
}
