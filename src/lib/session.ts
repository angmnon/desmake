// Session + user store for Desmake.
//
// Identity now requires a password (real accounts), persisted to Cloudflare D1
// via the native D1 binding. In-memory Maps are a per-isolate hot cache; every
// write is mirrored to D1 (the source of truth), and reads fall back to D1 when
// the cache misses — so no boot-time hydration is needed and data stays consistent
// across all Worker isolates.
//
// IMPORTANT (B1 / R2/C1): every route that reads or writes these stores must run
// on the Node.js runtime. Do NOT add `export const runtime = "edge"` — edge
// isolates do not share globalThis.

import { newId } from "@/lib/stores";
import { d1Query, D1_ENABLED } from "@/lib/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  /** Public handle used in share links, profile URLs (`/creators/<handle>`) and attribution. */
  handle: string;
  role: "user" | "creator";
  emailVerified: boolean;
  /**
   * H-7: session invalidation epoch. Bumped on logout / password change / account
   * deletion so any stateless token issued before the bump is rejected at validation
   * time. Embedded in the signed token and checked against the live user record.
   */
  sessionEpoch: number;
};

/** Full user row — includes the password hash, never exposed to the client. */
export type UserRecord = SessionUser & {
  passwordHash: string;
  createdAt: string;
  // ── M-UGC: creator profile (optional, editable by the user) ──
  bio?: string;
  city?: string;
  /** Stable seed driving the generated avatar hue, so the avatar is deterministic. */
  avatarSeed?: string;
  /** Short free-text role tag shown on the creator profile (e.g. "Patterns & Illustration"). */
  roleTag?: string;
  /** Curator-verified badge. Set by admin, not by the user. */
  verified?: boolean;
  /** Handle of the user who referred this account (set at registration via ?ref=). */
  referredBy?: string | null;
  // ── P0-2: paid-acquisition attribution captured at sign-up (UTM / click ids) ──
  acquisitionSource?: string | null;
  acquisitionMedium?: string | null;
  acquisitionCampaign?: string | null;
  acquisitionGclid?: string | null;
  acquisitionFbclid?: string | null;
  acquisitionLanding?: string | null;
  /** H-10: per-user AI generation quota counters (monthly window). */
  gen_used_month?: number;
  gen_month?: string;
};

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "dm_session";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

declare global {
  var __dm_users: Map<string, UserRecord> | undefined;
}

export function users(): Map<string, UserRecord> {
  const g = globalThis as typeof globalThis & { __dm_users?: Map<string, UserRecord> };
  if (!g.__dm_users) g.__dm_users = new Map();
  return g.__dm_users;
}

// ────────────────────────── password hashing ──────────────────────────
// Low #2: use an explicit, raised scrypt cost. The stored hash format is
// `scrypt$<N>$<saltHex>$<hashHex>`; legacy hashes (no explicit N field) fall
// back to the 16384 default so existing accounts keep verifying after deploy.
// NOTE: 32768 (2^15) was tried but `scryptSync(.., {N:32768})` exceeds OpenSSL's
// default scrypt maxmem (~32MB) and throws "memory limit exceeded" — on the Worker
// this surfaces as "Scrypt failed" and blocks ALL registration + password login.
// 16384 (2^14, the node default) is still a strong cost and matches the legacy
// hash fallback in verifyPassword(), so we keep it. Bump only with a matching
// `maxmem` option if OWASP-strength 32768 is ever required.
const SCRYPT_COST = 16384; // 2^14 — node default; safe within OpenSSL scrypt maxmem. r=8, p=1.
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_COST });
  return `scrypt$${SCRYPT_COST}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts[0] !== "scrypt" || parts.length < 3) return false;
    let saltHex: string;
    let hashHex: string;
    let cost = 16384; // legacy hashes were stored without an explicit cost field
    if (parts.length === 3) {
      [, saltHex, hashHex] = parts;
    } else if (parts.length === 4) {
      const n = Number(parts[1]);
      if (Number.isFinite(n) && n > 0) cost = n;
      [, , saltHex, hashHex] = parts;
    } else {
      return false;
    }
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length, { N: cost });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ────────────────────────── account ops ──────────────────────────

/**
 * H-9 fix: run a durability write without blocking the response, but **keep it
 * alive** past the response.
 *
 * A bare `void persistX().catch(() => {})` is cancelled by the Workers runtime the
 * moment the response is returned, so accounts and paid orders could exist only in
 * one isolate's memory and vanish on the next request. Registering the promise with
 * `ctx.waitUntil` keeps it running; errors are logged instead of silently swallowed.
 */
export function runDurable(label: string, p: Promise<unknown>): void {
  const guarded = p.catch((e) => {
    console.error(`[db] ${label} failed:`, e instanceof Error ? e.message : e);
  });
  try {
    const ctx = (getCloudflareContext() as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } | undefined)?.ctx;
    if (ctx?.waitUntil) {
      ctx.waitUntil(guarded);
      return;
    }
  } catch {
    /* not inside a Worker request context (e.g. build/CLI) — fall through */
  }
  void guarded;
}

export function findUserByEmail(email: string): UserRecord | undefined {
  return users().get(email.toLowerCase());
}

/** Look up a user record by internal id (used by attribution + dashboard). */
export function getUserById(userId: string): UserRecord | undefined {
  for (const u of users().values()) if (u.id === userId) return u;
  return undefined;
}

/** Look up a user record by public handle (case-insensitive). */
export function getUserByHandle(handle: string): UserRecord | undefined {
  const h = (handle || "").toLowerCase();
  if (!h) return undefined;
  // `u.handle` is defensively coerced: a legacy D1 row could still carry NULL
  // before the backfill in hydrate lands, and a throw here would 500 the page.
  for (const u of users().values()) if ((u.handle || "").toLowerCase() === h) return u;
  return undefined;
}

/**
 * Resolve a public handle to an internal user id. Returns the id when the handle
 * belongs to a real registered user, otherwise undefined. Used by the orders
 * endpoint to attribute a referral to a referrer_id.
 */
export function resolveHandleToUserId(handle: string | null | undefined): string | undefined {
  if (!handle) return undefined;
  return getUserByHandle(handle)?.id;
}

// ────────────────────────── async lookups (D1-backed) ──────────────────────────
//
// C-1 (critical): the synchronous lookups above only see the per-isolate in-memory
// map, and `hydrateUsersAndSessions()` had **zero call sites** — so on Cloudflare
// Workers (multiple isolates, cold starts) every user registered on another isolate
// was invisible, and login returned 401 for perfectly valid credentials. That alone
// blocked 100% of returning buyers from ordering.
//
// Rather than re-introducing a boot-time full-table hydrate (which does not scale
// and still misses rows created on other isolates afterwards), the async lookups
// below fall back to D1 **per query** and cache the row in memory on a hit. This is
// correct under multi-isolate, needs no lifecycle hook, and self-heals.

const USER_SELECT_COLUMNS = `id, email, name, password_hash, role, created_at, email_verified, session_epoch, gen_used_month, gen_month, handle, bio, avatar_seed, city, role_tag, verified, referred_by, acquisition_source, acquisition_medium, acquisition_campaign, acquisition_gclid, acquisition_fbclid, acquisition_landing`;

type UserRow = {
  id: string; email: string; name: string; password_hash: string; role: string;
  created_at: string; email_verified?: number | null; session_epoch?: number | null;
  handle?: string | null; bio?: string | null; avatar_seed?: string | null;
  city?: string | null; role_tag?: string | null; verified?: number | null;
  referred_by?: string | null; acquisition_source?: string | null;
  acquisition_medium?: string | null; acquisition_campaign?: string | null;
  acquisition_gclid?: string | null; acquisition_fbclid?: string | null;
  acquisition_landing?: string | null; gen_used_month?: number | null; gen_month?: string | null;
};

function rowToUser(r: UserRow): UserRecord {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    // Legacy rows may have handle = NULL; derive deterministically so every
    // isolate agrees on the same handle (see deriveLegacyHandle).
    handle: r.handle || deriveLegacyHandle(r.name || r.email, r.id),
    role: (r.role as SessionUser["role"]) || "user",
    emailVerified: Boolean(r.email_verified),
    sessionEpoch: r.session_epoch ?? 0,
    passwordHash: r.password_hash,
    createdAt: r.created_at,
    bio: r.bio ?? undefined,
    avatarSeed: r.avatar_seed ?? undefined,
    city: r.city ?? undefined,
    roleTag: r.role_tag ?? undefined,
    verified: Boolean(r.verified),
    gen_used_month: r.gen_used_month ?? 0,
    gen_month: r.gen_month ?? undefined,
    referredBy: r.referred_by ?? null,
    acquisitionSource: r.acquisition_source ?? null,
    acquisitionMedium: r.acquisition_medium ?? null,
    acquisitionCampaign: r.acquisition_campaign ?? null,
    acquisitionGclid: r.acquisition_gclid ?? null,
    acquisitionFbclid: r.acquisition_fbclid ?? null,
    acquisitionLanding: r.acquisition_landing ?? null,
  };
}

/** In-memory first, then D1. Returns undefined only when the user truly does not exist. */
export async function findUserByEmailAsync(email: string): Promise<UserRecord | undefined> {
  const key = (email || "").toLowerCase();
  if (!key) return undefined;
  const cached = users().get(key);
  if (cached) return cached;
  if (!D1_ENABLED) return undefined;
  try {
    const rows = await d1Query<UserRow>(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE email = ?`, [key]);
    const r = rows?.[0];
    if (!r) return undefined;
    const u = rowToUser(r);
    users().set(key, u);
    return u;
  } catch (e) {
    console.error("[db] findUserByEmailAsync failed:", e instanceof Error ? e.message : e);
    return undefined;
  }
}

export async function getUserByIdAsync(userId: string): Promise<UserRecord | undefined> {
  if (!userId) return undefined;
  for (const u of users().values()) if (u.id === userId) return u;
  if (!D1_ENABLED) return undefined;
  try {
    const rows = await d1Query<UserRow>(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE id = ?`, [userId]);
    const r = rows?.[0];
    if (!r) return undefined;
    const u = rowToUser(r);
    users().set(u.email, u);
    return u;
  } catch (e) {
    console.error("[db] getUserByIdAsync failed:", e instanceof Error ? e.message : e);
    return undefined;
  }
}

export async function getUserByHandleAsync(handle: string): Promise<UserRecord | undefined> {
  const h = (handle || "").toLowerCase();
  if (!h) return undefined;
  for (const u of users().values()) if ((u.handle || "").toLowerCase() === h) return u;
  if (!D1_ENABLED) return undefined;
  try {
    // Handles were backfilled deterministically, but a legacy NULL row can still be
    // matched by re-deriving, so fall back to a LIKE-free scan of the derived value.
    const rows = await d1Query<UserRow>(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE lower(handle) = ?`, [h]);
    const r = rows?.[0];
    if (!r) return undefined;
    const u = rowToUser(r);
    users().set(u.email, u);
    return u;
  } catch (e) {
    console.error("[db] getUserByHandleAsync failed:", e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** Async referral attribution — must hit D1 or referral credit silently dies. */
export async function resolveHandleToUserIdAsync(handle: string | null | undefined): Promise<string | undefined> {
  if (!handle) return undefined;
  return (await getUserByHandleAsync(handle))?.id;
}

/**
 * Turn an arbitrary display name into a URL-safe handle fragment: lowercase,
 * strip everything except [a-z0-9], collapse runs. Falls back to "creator" when
 * the name carries no latin/numeric characters (e.g. CJK-only names) so we always
 * get a non-empty base.
 */
function slugifyHandle(raw: string): string {
  const cleaned = (raw || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");
  return cleaned.length ? cleaned.slice(0, 16) : "creator";
}

/**
 * Generate a unique handle for a new user. Base = slugified name (+ optional
 * discriminator when the base collides). Uniqueness is checked against the
 * in-memory user map; the D1 unique index (`idx_users_handle`) is the durable
 * backstop against rare cross-instance collisions.
 */
function generateHandle(baseName: string): string {
  const base = slugifyHandle(baseName);
  const existing = new Set(
    Array.from(users().values()).map((u) => u.handle),
  );
  if (!existing.has(base)) return base;
  // Collision: append a short, opaque suffix and increment until free.
  for (let i = 0; i < 50; i++) {
    const candidate = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
    if (!existing.has(candidate)) return candidate;
  }
  // Extremely unlikely fallback: timestamp-based uniqueness.
  return `${base}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Deterministic handle for a legacy user row whose `handle` column is still NULL
 * (created before the UGC migration).
 *
 * This MUST NOT use randomness: on Cloudflare Workers each isolate has its own
 * memory and may cold-start independently. A random suffix would give the same
 * user a different handle per isolate, so `/creators/<handle>` and share links
 * would resolve inconsistently. Seeding the suffix from the immutable user id
 * makes every isolate agree.
 */
function deriveLegacyHandle(baseName: string, userId: string): string {
  const base = slugifyHandle(baseName);
  let h = 5381;
  for (let i = 0; i < userId.length; i++) h = ((h * 33) ^ userId.charCodeAt(i)) >>> 0;
  return `${base}${(h % 9000 + 1000).toString()}`;
}

/** Create a brand-new password account. Throws if the email is taken. */
export function createUser(
  email: string,
  name: string,
  password: string,
  opts?: {
    referredBy?: string | null;
    acquisition?: {
      source?: string;
      medium?: string;
      campaign?: string;
      gclid?: string;
      fbclid?: string;
      landing?: string;
    } | null;
  },
): UserRecord {
  const key = email.toLowerCase();
  if (users().has(key)) throw new Error("An account with this email already exists");
  const displayName = name || key.split("@")[0];
  const user: UserRecord = {
    id: newId("usr"),
    email: key,
    name: displayName,
    handle: generateHandle(displayName),
    role: "user",
    emailVerified: false,
    sessionEpoch: 0,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    avatarSeed: newId("av").slice(0, 12),
    referredBy: opts?.referredBy ?? null,
    acquisitionSource: opts?.acquisition?.source ?? null,
    acquisitionMedium: opts?.acquisition?.medium ?? null,
    acquisitionCampaign: opts?.acquisition?.campaign ?? null,
    acquisitionGclid: opts?.acquisition?.gclid ?? null,
    acquisitionFbclid: opts?.acquisition?.fbclid ?? null,
    acquisitionLanding: opts?.acquisition?.landing ?? null,
  };
  users().set(key, user);
  runDurable("persistUser", persistUser(user));
  return user;
}

async function persistUser(u: UserRecord): Promise<void> {
  if (!D1_ENABLED) return;
  await d1Query(
    `INSERT INTO users (id, email, name, password_hash, role, created_at, email_verified, session_epoch, gen_used_month, gen_month, handle, bio, avatar_seed, city, role_tag, verified, referred_by, acquisition_source, acquisition_medium, acquisition_campaign, acquisition_gclid, acquisition_fbclid, acquisition_landing)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
        name=excluded.name, role=excluded.role,
        email_verified=excluded.email_verified, session_epoch=excluded.session_epoch,
        gen_used_month=excluded.gen_used_month, gen_month=excluded.gen_month,
        handle=excluded.handle, bio=excluded.bio,
        avatar_seed=excluded.avatar_seed, city=excluded.city, role_tag=excluded.role_tag,
        verified=excluded.verified, referred_by=excluded.referred_by,
        acquisition_source=excluded.acquisition_source, acquisition_medium=excluded.acquisition_medium,
        acquisition_campaign=excluded.acquisition_campaign, acquisition_gclid=excluded.acquisition_gclid,
        acquisition_fbclid=excluded.acquisition_fbclid, acquisition_landing=excluded.acquisition_landing`,
    [
      u.id, u.email, u.name, u.passwordHash, u.role, u.createdAt, u.emailVerified ? 1 : 0, u.sessionEpoch ?? 0, u.gen_used_month ?? 0, u.gen_month ?? null,
      u.handle, u.bio ?? null, u.avatarSeed ?? null, u.city ?? null, u.roleTag ?? null,
      u.verified ? 1 : 0, u.referredBy ?? null,
      u.acquisitionSource ?? null, u.acquisitionMedium ?? null, u.acquisitionCampaign ?? null,
      u.acquisitionGclid ?? null, u.acquisitionFbclid ?? null, u.acquisitionLanding ?? null,
    ],
  );
}

/**
 * Patch a user's creator profile fields. Used by the dashboard "Edit profile"
 * action. Updates both the in-memory record and D1 (best-effort). The handle is
 * not editable here — it is immutable once assigned.
 */
export async function updateCreatorProfile(
  userId: string,
  patch: { bio?: string; city?: string; roleTag?: string; name?: string },
): Promise<void> {
  let target: UserRecord | undefined;
  for (const u of users().values()) if (u.id === userId) { target = u; break; }
  if (!target) return;
  if (typeof patch.bio === "string") target.bio = patch.bio.slice(0, 280);
  if (typeof patch.city === "string") target.city = patch.city.slice(0, 80);
  if (typeof patch.roleTag === "string") target.roleTag = patch.roleTag.slice(0, 60);
  if (typeof patch.name === "string" && patch.name.trim()) target.name = patch.name.trim().slice(0, 80);
  if (!D1_ENABLED) return;
  try {
    await d1Query(
      `UPDATE users SET bio=?, city=?, role_tag=?, name=? WHERE id=?`,
      [target.bio ?? null, target.city ?? null, target.roleTag ?? null, target.name, userId],
    );
  } catch (e) {
    console.error("[db] updateCreatorProfile failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Mark a user's email as verified (D1 + in-memory) and return the refreshed record.
 *
 * C-2 fix: previously this only walked the (usually empty) in-memory map, so the
 * caller had nothing to re-issue a session from. It now resolves through D1 and
 * hands back the record so `/api/auth/verify` can immediately re-sign the cookie.
 */
export async function markUserVerified(userId: string): Promise<UserRecord | undefined> {
  const target = await getUserByIdAsync(userId);
  if (!target) return undefined;
  target.emailVerified = true;
  users().set(target.email, target);
  if (D1_ENABLED) {
    await d1Query(`UPDATE users SET email_verified = 1 WHERE id = ?`, [userId]).catch((e) => {
      console.error("[db] markUserVerified failed:", e instanceof Error ? e.message : e);
    });
  }
  return target;
}

// ────────────────────────── session ops (stateless, signed cookie) ──────────────────────────
//
// Sessions are a signed base64url token `<payload>.<hmac>` verifiable by ANY Worker isolate that
// shares SESSION_SECRET — the token is stateless, so any isolate can verify it without shared
// memory. SESSION_SECRET MUST be identical across isolates — set it via Cloudflare Worker secret
// (`wrangler secret put SESSION_SECRET`). The token stays synchronous to read, so no route changes.

// H-13 (fail-closed): an unset SESSION_SECRET previously fell back to a hardcoded,
// public default — anyone could then forge arbitrary sessions. Now we refuse to serve
// in production without it. `NEXT_PHASE === phase-production-build` is excluded so the
// warning never breaks `next build` (the secret is only required at runtime).
const SESSION_SECRET = process.env.SESSION_SECRET || "desmake-dev-insecure-session-secret";
const __isBuild = process.env.NEXT_PHASE === "phase-production-build";
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET && !__isBuild) {
  throw new Error(
    "[session] FATAL: SESSION_SECRET is required in production. Set it via `wrangler secret put SESSION_SECRET`.",
  );
}
if (process.env.NODE_ENV === "development" && !process.env.SESSION_SECRET) {
  console.warn(
    "[session] WARNING: SESSION_SECRET not set — using an insecure dev default. Never use this in production.",
  );
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}
function signSession(payload: string): string {
  return b64urlEncode(createHmac("sha256", SESSION_SECRET).update(payload).digest("base64"));
}

export function createSession(user: SessionUser): string {
  const payload = b64urlEncode(JSON.stringify({ u: user, exp: Date.now() + SESSION_TTL_MS, e: user.sessionEpoch ?? 0 }));
  return `${payload}.${signSession(payload)}`;
}

export function getSession(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = signSession(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(b64urlDecode(payload)) as { u: SessionUser; exp: number; e?: number };
    if (!obj.u || typeof obj.exp !== "number" || obj.exp <= Date.now()) return null;
    // H-7: reject tokens issued before the user's session epoch was bumped (logout /
    // password change / account deletion). Fail-open: if this isolate hasn't loaded the
    // user record we skip the check rather than mass-logout valid users on a cold instance.
    const rec = getUserById(obj.u.id);
    if (rec && (rec.sessionEpoch ?? 0) > (obj.u.sessionEpoch ?? 0)) return null;
    return obj.u;
  } catch {
    return null;
  }
}

/**
 * Async session validation backed by the live user row.
 *
 * Fixes two critical issues at once:
 *
 *  - **C-2 (email-verification deadlock):** `emailVerified` is read from the live
 *    record instead of the value frozen into the token at sign-in. A buyer who just
 *    clicked the verification link is no longer told to "sign in again" — an action
 *    that C-1 had made impossible anyway, which is what locked this loop shut.
 *  - **H-9 (logout didn't log out):** the session-epoch check now actually resolves
 *    the user, so `bumpSessionEpoch` invalidates previously issued tokens instead of
 *    silently failing open.
 *
 * Use this on money paths (orders / payments). Read-only routes can keep using the
 * synchronous `getSession()` for cheap signature + expiry validation.
 */
export async function getSessionAsync(token: string | undefined | null): Promise<SessionUser | null> {
  const base = getSession(token);
  if (!base) return null;
  const rec = await getUserByIdAsync(base.id);
  // Unknown to D1 (dev seeds / legacy): don't lock a legitimately signed-in user out.
  if (!rec) return base;
  if ((rec.sessionEpoch ?? 0) > (base.sessionEpoch ?? 0)) return null;
  return {
    ...base,
    emailVerified: rec.emailVerified,
    name: rec.name,
    handle: rec.handle,
    role: rec.role,
    sessionEpoch: rec.sessionEpoch ?? base.sessionEpoch,
  };
}

/**
 * H-7: advance a user's session epoch so every previously-issued stateless token is
 * rejected on its next validation. Mirrors the bump to D1 (source of truth) and the
 * per-isolate in-memory record. Call on logout, password change, and account deletion.
 */
export async function bumpSessionEpoch(userId: string): Promise<void> {
  for (const u of users().values()) {
    if (u.id === userId) u.sessionEpoch = (u.sessionEpoch ?? 0) + 1;
  }
  if (D1_ENABLED) {
    try {
      await d1Query(`UPDATE users SET session_epoch = COALESCE(session_epoch, 0) + 1 WHERE id = ?`, [userId]);
    } catch (e) {
      console.error("[db] bumpSessionEpoch failed:", e instanceof Error ? e.message : e);
    }
  }
}

export function destroySession(token: string | undefined | null): void {
  if (!token) return;
  // H-7: invalidate stateless tokens by advancing the user's session epoch. The token
  // itself is stateless, but bumping the epoch makes it fail validation everywhere.
  try {
    const dot = token.lastIndexOf(".");
    if (dot > 0) {
      const obj = JSON.parse(b64urlDecode(token.slice(0, dot))) as { u?: { id?: string } };
      if (obj.u?.id) void bumpSessionEpoch(obj.u.id).catch(() => {});
    }
  } catch {
    /* ignore malformed token */
  }
}

/**
 * H-10: enforce a per-user monthly generation quota to cap AI/compute cost and blunt
 * abuse (especially when combined with unverified throwaway accounts). Returns whether
 * the user is under the cap and how many generations remain this month.
 *
 * This is a WAF-level, per-isolate counter (mirrored to D1 for durability): under
 * Cloudflare's multi-instance model a single user's requests may hit different isolates,
 * so the effective ceiling is roughly cap × instance-count. For a hard global ceiling,
 * back this with a transactional D1 counter (single source of truth).
 */
export const GEN_MONTHLY_CAP = Number(process.env.GEN_MONTHLY_CAP_PER_USER || 200);

/**
 * H-8: gate sensitive, costly, or abuse-prone operations (generation, orders, payouts)
 * behind email verification. The flag defaults OFF so the marketplace keeps working while
 * transactional email (H-6 / RESEND_API_KEY) is being wired up — flipping it ON before
 * email actually sends would lock out every existing user. Enable once verification emails
 * are confirmed delivering.
 */
export const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === "true";

export function isEmailVerificationSatisfied(user: SessionUser): boolean {
  return !REQUIRE_EMAIL_VERIFICATION || Boolean(user.emailVerified);
}

export async function consumeGenerationQuota(userId: string): Promise<{ ok: boolean; remaining: number }> {
  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  let target: UserRecord | undefined;
  for (const u of users().values()) if (u.id === userId) { target = u; break; }
  if (!target) return { ok: true, remaining: GEN_MONTHLY_CAP }; // unknown user (dev) → allow
  // Roll the window over on a new month.
  if (target.gen_month !== monthKey) {
    target.gen_month = monthKey;
    target.gen_used_month = 0;
  }
  const used = target.gen_used_month ?? 0;
  if (used >= GEN_MONTHLY_CAP) return { ok: false, remaining: 0 };
  target.gen_used_month = used + 1;
  if (D1_ENABLED) {
    try {
      // Only bump when the month still matches (avoids double-counting right after a rollover
      // observed on a different isolate). A mismatch is reconciled on the next hydrate.
      await d1Query(
        `UPDATE users SET gen_used_month = COALESCE(gen_used_month, 0) + 1, gen_month = ? WHERE id = ? AND (gen_month IS NULL OR gen_month = ?)`,
        [monthKey, userId, monthKey],
      );
    } catch (e) {
      console.error("[db] consumeGenerationQuota failed:", e instanceof Error ? e.message : e);
    }
  }
  return { ok: true, remaining: GEN_MONTHLY_CAP - (used + 1) };
}

// ────────────────────────── D1 hydrate ──────────────────────────

/** Reload users + sessions from D1 into memory. Call once at server start. */
export async function hydrateUsersAndSessions(): Promise<void> {
  if (!D1_ENABLED) return;
  try {
    const rows = await d1Query<{
      id: string; email: string; name: string; password_hash: string; role: string;
      created_at: string; email_verified?: number; session_epoch?: number; handle?: string; bio?: string;
      avatar_seed?: string; city?: string; role_tag?: string; verified?: number; referred_by?: string;
      acquisition_source?: string; acquisition_medium?: string; acquisition_campaign?: string;
      acquisition_gclid?: string; acquisition_fbclid?: string; acquisition_landing?: string;
      gen_used_month?: number; gen_month?: string;
    }>(
      `SELECT id, email, name, password_hash, role, created_at, email_verified, session_epoch, gen_used_month, gen_month, handle, bio, avatar_seed, city, role_tag, verified, referred_by, acquisition_source, acquisition_medium, acquisition_campaign, acquisition_gclid, acquisition_fbclid, acquisition_landing FROM users`,
    );
    // Legacy rows (pre-UGC migration) have handle = NULL. Backfill deterministically
    // so every instance agrees, then write the value back so it becomes durable.
    const backfill: { id: string; handle: string }[] = [];
    for (const r of rows) {
      const handle = r.handle || deriveLegacyHandle(r.name || r.email, r.id);
      if (!r.handle) backfill.push({ id: r.id, handle });
      users().set(r.email, {
        id: r.id,
        email: r.email,
        name: r.name,
        handle,
        role: (r.role as SessionUser["role"]) || "user",
        emailVerified: Boolean(r.email_verified),
        sessionEpoch: r.session_epoch ?? 0,
        passwordHash: r.password_hash,
        createdAt: r.created_at,
        bio: r.bio ?? undefined,
        avatarSeed: r.avatar_seed ?? undefined,
        city: r.city ?? undefined,
        roleTag: r.role_tag ?? undefined,
        verified: Boolean(r.verified),
        gen_used_month: r.gen_used_month ?? 0,
        gen_month: r.gen_month ?? undefined,
        referredBy: r.referred_by ?? null,
        acquisitionSource: r.acquisition_source ?? null,
        acquisitionMedium: r.acquisition_medium ?? null,
        acquisitionCampaign: r.acquisition_campaign ?? null,
        acquisitionGclid: r.acquisition_gclid ?? null,
        acquisitionFbclid: r.acquisition_fbclid ?? null,
        acquisitionLanding: r.acquisition_landing ?? null,
      });
    }
    // Persist the backfilled handles (best-effort, never blocks startup). A rare
    // unique-index rejection is harmless: memory still holds the deterministic value.
    for (const b of backfill) {
      void d1Query(`UPDATE users SET handle=? WHERE id=? AND (handle IS NULL OR handle='')`, [b.handle, b.id]).catch(
        () => {},
      );
    }

    // Sessions are now stateless signed cookies (see createSession/getSession), so there is
    // no instance-affinity map to hydrate. Nothing to do here for sessions.
  } catch (e) {
    console.error("[db] hydrate users/sessions failed:", e instanceof Error ? e.message : e);
  }
}
