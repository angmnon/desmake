import { NextResponse } from "next/server";
import { CREATORS, DESIGNS } from "@/lib/data";

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const c = CREATORS.find((x) => x.handle === handle);
  if (!c) {
    return NextResponse.json({ error: { code: "not_found", message: "Creator not found" } }, { status: 404 });
  }
  const listings = DESIGNS.filter((d) => d.creator === handle).map((d) => ({
    slug: d.slug,
    title: d.title,
    price_cents: d.priceCents,
    stats: { sales: d.sales, likes: d.likes },
    seed: d.seed,
    palette: d.palette,
    shape: d.shape,
  }));
  return NextResponse.json({
    data: {
      handle: c.handle,
      name: c.name,
      city: c.city,
      role: c.role,
      verified: c.verified,
      followers: c.followers,
      sales: c.sales,
      works: c.works,
      rating: c.rating,
      bio: c.bio,
      listings,
    },
  });
}
