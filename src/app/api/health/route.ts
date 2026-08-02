import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Desmake API",
    version: "0.1.0-mvp",
    status: "ok",
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
    ],
    docs: "/api/health",
  });
}
