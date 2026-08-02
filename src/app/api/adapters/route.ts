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
      retail_cents: a.retailCents,
      cost_cents: a.costCents,
      mockup: a.mockup,
    })),
  });
}
