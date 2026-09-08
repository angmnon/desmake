import { NextResponse } from "next/server";
import { CREATORS, DESIGNS, creatorByHandle, type Creator } from "@/lib/data";
import { creatorViewFromUser, designsForUser } from "@/lib/creators";
import { getUserByHandle } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  // Real registered creator takes precedence; fall back to the editorial seed.
  const user = getUserByHandle(handle);
  let creator: Creator | undefined;
  let listings: Array<{ slug: string; title: string; price_cents: number; seed: string; palette: [string, string, string]; shape: number }> = [];

  if (user) {
    const works = await designsForUser(user.id);
    creator = creatorViewFromUser(user, works.length);
    listings = works.map((d) => ({
      slug: d.slug,
      title: d.title,
      price_cents: d.priceCents,
      seed: d.seed,
      palette: d.palette,
      shape: d.shape,
    }));
  } else {
    const seed = creatorByHandle(handle) || CREATORS.find((c) => c.handle === handle);
    if (!seed) {
      return NextResponse.json({ error: { code: "not_found", message: "Creator not found" } }, { status: 404 });
    }
    creator = seed;
    listings = DESIGNS.filter((d) => d.creator === handle).map((d) => ({
      slug: d.slug,
      title: d.title,
      price_cents: d.priceCents,
      seed: d.seed,
      palette: d.palette,
      shape: d.shape,
    }));
  }

  return NextResponse.json({
    data: {
      handle: creator.handle,
      name: creator.name,
      city: creator.city,
      role: creator.role,
      verified: creator.verified,
      followers: creator.followers,
      sales: creator.sales,
      works: creator.works,
      rating: creator.rating,
      bio: creator.bio,
      listings,
    },
  });
}
