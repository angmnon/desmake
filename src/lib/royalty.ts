// Creator royalty tier model.
//
// Powers the "Early Creator Program" growth lever: early / founding creators
// earn a guaranteed higher royalty floor than the per-design rate they set,
// capped at the hard 0.50 ceiling shared by every tier.
//
// The tier is denormalized onto each PublishedDesign at publish time (see
// api/designs/route.ts) so order-time computation needs zero extra DB lookups
// and stays correct across container instances.

export type CreatorTier = "standard" | "early" | "founding";

/** Guaranteed minimum royalty rate for each tier (fraction of net sale price). */
export const TIER_MIN_RATE: Record<CreatorTier, number> = {
  standard: 0.1, // no boost — design rate applies as-is
  early: 0.4, // early creators earn at least 40%
  founding: 0.5, // founding creators earn the max 50%
};

/** Hard bounds shared across tiers (mirrors the clamp in api/orders + catalog). */
export const ROYALTY_CAP = 0.5;
export const ROYALTY_FLOOR = 0.1;

export const TIER_LABEL: Record<CreatorTier, string> = {
  standard: "Standard",
  early: "Early Creator",
  founding: "Founding Creator",
};

/** Normalize any stored value to a valid tier (unknown/legacy → standard). */
export function normalizeTier(value: unknown): CreatorTier {
  return value === "early" || value === "founding" ? value : "standard";
}

/**
 * Resolve the effective royalty rate earned on a sale.
 *
 * @param designRate the per-design rate the creator set (valid only in [0.10, 0.50])
 * @param tier       the creator's tier at publish time (denormalized onto the design)
 * @returns 0 when the design has no valid rate (creator opted out / legacy data);
 *          otherwise max(designRate, tier floor), capped at ROYALTY_CAP.
 */
export function effectiveRoyaltyRate(
  designRate: number | undefined,
  tier: CreatorTier | string | undefined,
): number {
  const dr =
    typeof designRate === "number" && designRate >= ROYALTY_FLOOR && designRate <= ROYALTY_CAP
      ? designRate
      : 0;
  if (dr <= 0) return 0;
  const floor = TIER_MIN_RATE[normalizeTier(tier)] ?? ROYALTY_FLOOR;
  return Math.min(ROYALTY_CAP, Math.max(dr, floor));
}
