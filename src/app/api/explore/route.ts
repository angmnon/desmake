import { NextResponse } from "next/server";
import { allPublishedDesigns } from "@/lib/stores";
import { publishedToDesign } from "@/lib/catalog";
import type { Design } from "@/lib/data";

// Published designs (AI + uploaded) live in the server store + D1, not in the static
// seed catalog. The explore page merges these in so anything a creator publishes is
// browsable and searchable in the marketplace — and, because we read from D1 as well
// as memory, it is visible on every container instance without a restart.
export async function GET() {
  const pub = await allPublishedDesigns();
  const list: Design[] = pub.map(publishedToDesign);
  return NextResponse.json({ designs: list });
}
