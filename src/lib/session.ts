// Session store for the MVP.
//
// Sessions live in an in-memory Map keyed off `globalThis`. That is a deliberate
// MVP trade-off (documented in AGENTS.md): sessions do not survive a restart and do
// not work across multiple server instances. It *does* work correctly for the single
// custom Node server this app ships with (`src/server.ts`).
//
// IMPORTANT (R2/C1): every route that reads or writes these stores must run on the
// Node.js runtime. Do NOT add `export const runtime = "edge"` to API routes — Next.js
// gives each edge function its own isolate and therefore its own `globalThis`, so a
// session written by /api/auth/login would be invisible to /api/orders.

import { newId, newToken } from "@/lib/stores";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "creator";
  /** True for auto-provisioned browser identities that never supplied an email. */
  guest: boolean;
};

type SessionRecord = {
  user: SessionUser;
  expiresAt: number;
};

/** 7 days, matching the `dm_session` cookie Max-Age. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = "dm_session";

/** Single definition of the session cookie attributes, shared by login/guest/logout. */
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
  var __dm_sessions: Map<string, SessionRecord> | undefined;
  var __dm_users: Map<string, SessionUser> | undefined;
}

function sessions(): Map<string, SessionRecord> {
  const g = globalThis as typeof globalThis & { __dm_sessions?: Map<string, SessionRecord> };
  if (!g.__dm_sessions) g.__dm_sessions = new Map();
  return g.__dm_sessions;
}

function users(): Map<string, SessionUser> {
  const g = globalThis as typeof globalThis & { __dm_users?: Map<string, SessionUser> };
  if (!g.__dm_users) g.__dm_users = new Map();
  return g.__dm_users;
}

/**
 * Resolve (or create) the account behind an email address.
 * Identity is intentionally shared per email — that is what "sign in" means.
 * Anonymous visitors must NOT go through here; see `createGuestUser`.
 */
export function upsertUser(email: string, name: string): SessionUser {
  const key = email.toLowerCase();
  const existing = users().get(key);
  if (existing) {
    if (name && existing.name !== name) existing.name = name;
    return existing;
  }
  const user: SessionUser = {
    id: newId("usr"),
    email: key,
    name: name || key.split("@")[0],
    role: "user",
    guest: false,
  };
  users().set(key, user);
  return user;
}

/**
 * Create a fresh, unique identity for a visitor who has not signed in.
 *
 * R2/C5: the client used to silently sign everyone in as `demo@desmake.app`.
 * Because `upsertUser` returns the same `user.id` for a given email, every visitor
 * on the deployment shared one account — so the `o.user_id === user.id` filter on
 * GET /api/orders passed for everyone and each visitor could read every other
 * visitor's orders, including shipping address, name and email. Guests now get a
 * distinct id that is never keyed by a shared email.
 */
export function createGuestUser(): SessionUser {
  const id = newId("usr");
  return {
    id,
    email: `${id}@guest.desmake.local`,
    name: "Guest",
    role: "user",
    guest: true,
  };
}

export function createSession(user: SessionUser): string {
  sweepExpired();
  const token = newToken();
  sessions().set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function getSession(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const record = sessions().get(token);
  if (!record) return null;
  // R2/H2: sessions previously never expired — a leaked token was valid forever.
  if (record.expiresAt <= Date.now()) {
    sessions().delete(token);
    return null;
  }
  return record.user;
}

export function destroySession(token: string | undefined | null): void {
  if (token) sessions().delete(token);
}

/** Drop expired records so the Map cannot grow without bound. */
function sweepExpired(): void {
  const now = Date.now();
  const store = sessions();
  if (store.size < 64) return; // cheap guard — no need to scan a small map
  for (const [token, record] of store) {
    if (record.expiresAt <= now) store.delete(token);
  }
}
