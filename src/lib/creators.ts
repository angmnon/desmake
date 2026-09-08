// M-UGC: creator identity resolution for the public creator profiles.
//
// The creator ecosystem is now driven by REAL registered users who publish designs
// from Studio, not just the static `CREATORS` seed (which is kept as an editorial
// "Desmake Select" layer). This module bridges the session/user store and the
// published-design store so profile pages render real data.
//
// IMPORTANT: this module is imported only by server components / route handlers.
// It pulls in `@/lib/session` (which uses `node:crypto`), so it must NOT be
// imported from any "use client" component.

import { allPublishedDesigns, type PublishedDesign } from "@/lib/stores";
import { getUserByHandle, getUserById, type UserRecord } from "@/lib/session";
import { publishedToDesign } from "@/lib/catalog";
import type { Creator, Design } from "@/lib/data";

/** Deterministic hue (0–5) from a seed string, for the generated avatar. */
function avatarHueOf(seed?: string): number {
  const s = seed || "x";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 6;
}

/** Build a `Creator`-shaped view from a real user record + their work count. */
export function creatorViewFromUser(u: UserRecord, works: number): Creator {
  const name = u.name || u.email.split("@")[0];
  return {
    handle: u.handle,
    name,
    city: u.city || "Worldwide",
    role: u.roleTag || "Designer",
    verified: Boolean(u.verified),
    followers: 0,
    sales: 0,
    works,
    rating: 0,
    bio:
      u.bio ||
      `${name} shares original AI-assisted designs made on demand and shipped worldwide by Desmake.`,
    avatarHue: avatarHueOf(u.avatarSeed || u.handle),
  };
}

/** Resolve a public handle to a real creator view, or null if no such user exists. */
export async function creatorProfileByHandle(handle: string): Promise<Creator | null> {
  const user = getUserByHandle(handle);
  if (!user) return null;
  const all = await allPublishedDesigns();
  const works = all.filter((d) => d.user_id === user.id).length;
  return creatorViewFromUser(user, works);
}

/** All published designs authored by a given user (cross-instance safe). */
export async function publishedDesignsByUser(userId: string): Promise<PublishedDesign[]> {
  const all = await allPublishedDesigns();
  return all.filter((d) => d.user_id === userId);
}

/** Published designs for a user, already mapped to the `Design` shape for cards. */
export async function designsForUser(userId: string): Promise<Design[]> {
  const pub = await publishedDesignsByUser(userId);
  return pub.map(publishedToDesign);
}

/**
 * Every real creator who has published at least one design, sorted by work count
 * (most prolific first). Used by the /creators discovery page, merged with the
 * editorial seed creators.
 */
export async function allRealCreators(): Promise<Array<{ user: UserRecord; works: number }>> {
  const all = await allPublishedDesigns();
  const counts = new Map<string, number>();
  for (const d of all) counts.set(d.user_id, (counts.get(d.user_id) ?? 0) + 1);
  const out: Array<{ user: UserRecord; works: number }> = [];
  for (const [uid, works] of counts) {
    const u = getUserById(uid);
    if (u) out.push({ user: u, works });
  }
  out.sort((a, b) => b.works - a.works);
  return out;
}
