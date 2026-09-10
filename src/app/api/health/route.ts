import { NextResponse } from "next/server";
import { D1_ENABLED, getSchemaFailures } from "@/lib/db";
import { AGNES_IMAGE_ENABLED, OPENAI_IMAGE_ENABLED, imageProviderName } from "@/lib/ai";
import { STRIPE_ENABLED } from "@/lib/stripe";
import { EMAIL_ENABLED } from "@/lib/email";
import { uptimeMs, errorWindow } from "@/lib/monitor";

export async function GET() {
  const errors1h = errorWindow(60 * 60 * 1000).length;
  // R2: db.ts documented this as "exposed via /api/health so a half-built schema is
  // visible instead of silently degrading", but the export had zero call sites — so a
  // failed CREATE TABLE/INDEX was invisible and endpoints just 500'd later. Surface it.
  const schemaFailures = getSchemaFailures();
  return NextResponse.json({
    name: "Desmake API",
    version: "0.1.0-mvp",
    // Degrade the reported status when the schema did not fully build, so an uptime
    // check catches a broken bootstrap instead of seeing a cheerful "ok".
    status: schemaFailures.length ? "degraded" : "ok",
    uptime_seconds: Math.floor(uptimeMs() / 1000),
    enabled: {
      d1: D1_ENABLED,
      image_provider: imageProviderName(),
      agnes_image: AGNES_IMAGE_ENABLED,
      openai_image: OPENAI_IMAGE_ENABLED,
      stripe: STRIPE_ENABLED,
      email: EMAIL_ENABLED(),
    },
    errors_last_hour: errors1h,
    schema_failures: schemaFailures,
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
      "DELETE /api/designs/:slug",
      "POST /api/payments",
      "POST /api/payments/confirm",
      "POST /api/payments/webhook",
      "POST /api/auth/register",
      "POST /api/auth/login",
      "GET /api/auth/verify",
      "GET /api/account/export",
      "POST /api/account/delete",
      "POST /api/consent",
    ],
  });
}
