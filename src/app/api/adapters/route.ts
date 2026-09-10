import { NextResponse } from "next/server";
import { ADAPTERS } from "@/lib/data";

export async function GET() {
  return NextResponse.json({
    total: ADAPTERS.length,
    adapters: ADAPTERS.map((a) => ({
      id: a.id,
      name: a.name,
      method: a.method,
      lead_time: a.lead,
      // R2-Low: `cost_cents` (our internal manufacturing cost) is deliberately NOT
      // exposed — it is commercially sensitive margin data and nothing public needs it.
      retail_cents: a.retailCents,
      mockup: a.mockup,
    })),
  });
}
