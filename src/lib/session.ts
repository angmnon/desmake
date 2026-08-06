// Session + user store for Desmake.
//
// Identity now requires a password (real accounts), persisted to Cloudflare D1
// through the HTTP API. In-memory Maps remain the hot path; mutations are
// mirrored to D1 asynchronously, and `hydrateStores()` (called once at server
// start) reloads everything so data survives container rebuilds.
//
// IMPORTANT (R2/C1): every route that reads or writes these stores must run on the
// Node.js runtime. Do NOT add `export const runtime = "edge"` — edge isolates do
// not share globalThis.

import { newId, newToken } from "@/lib/stores";
import { d1Query, D1_ENABLED } from "@/lib/db";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "creator";
  emailVerified: boolean;
};

/** Full user row — includes the password hash, never exposed to the client. */
export type UserRecord = SessionUser & { passwordHash: string; createdAt: string };

type SessionRecord = {
  user: SessionUser;
  expiresAt: number;
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
  var __dm_sessions: Map<string, SessionRecord> | undefined;
  var __dm_users: Map<string, UserRecord> | undefined;
}

function sessions(): Map<string, SessionRecord> {
  const g = globalThis as typeof globalThis & { __dm_sessions?: Map<string, SessionRecord> };
  if (!g.__dm_sessions) g.__dm_sessions = new Map();
  return g.__dm_sessions;
}

export function users(): Map<string, UserRecord> {
  const g = globalThis as typeof globalThis & { __dm_users?: Map<string, UserRecord> };
  if (!g.__dm_users) g.__dm_users = new Map();
  return g.__dm_users;
}

// ────────────────────────── password hashing ──────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ────────────────────────── account ops ──────────────────────────

export function findUserByEmail(email: string): UserRecord | undefined {
  return users().get(email.toLowerCase());
}

/** Create a brand-new password account. Throws if the email is taken. */
export function createUser(email: string, name: string, password: string): UserRecord {
  const key = email.toLowerCase();
  if (users().has(key)) throw new Error("An account with this email already exists");
  const user: UserRecord = {
    id: newId("usr"),
    email: key,
    name: name || key.split("@")[0],
    role: "user",
    emailVerified: false,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users().set(key, user);
  void persistUser(user).catch(() => {});
  return user;
}

async function persistUser(u: UserRecord): Promise<void> {
  if (!D1_ENABLED) return;
  await d1Query(
    `INSERT INTO users (id, email, name, password_hash, role, created_at, email_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET id=excluded.id, name=excluded.name, password_hash=excluded.password_hash, role=excluded.role, email_verified=excluded.email_verified`,
    [u.id, u.email, u.name, u.passwordHash, u.role, u.createdAt, u.emailVerified ? 1 : 0],
  );
}

/** Mark a user's email as verified (D1 + in-memory). */
export async function markUserVerified(userId: string): Promise<void> {
  for (const u of users().values()) {
    if (u.id === userId) u.emailVerified = true;
  }
  if (D1_ENABLED) {
    await d1Query(`UPDATE users SET email_verified = 1 WHERE id = ?`, [userId]).catch(() => {});
  }
}

// ────────────────────────── session ops ──────────────────────────

export function createSession(user: SessionUser): string {
  sweepExpired();
  const token = newToken();
  const record: SessionRecord = { user, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions().set(token, record);
  void persistSession(token, record).catch(() => {});
  return token;
}

async function persistSession(token: string, r: SessionRecord): Promise<void> {
  if (!D1_ENABLED) return;
  await d1Query(
    `INSERT INTO sessions (token, user_id, user_email, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(token) DO NOTHING`,
    [token, r.user.id, r.user.email, r.expiresAt, new Date().toISOString()],
  );
}

export function getSession(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const record = sessions().get(token);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    sessions().delete(token);
    return null;
  }
  return record.user;
}

export function destroySession(token: string | undefined | null): void {
  if (!token) return;
  sessions().delete(token);
  void d1Query(`DELETE FROM sessions WHERE token = ?`, [token]).catch(() => {});
}

function sweepExpired(): void {
  const now = Date.now();
  const store = sessions();
  if (store.size < 128) return;
  for (const [token, record] of store) {
    if (record.expiresAt <= now) store.delete(token);
  }
}

// ────────────────────────── D1 hydrate ──────────────────────────

/** Reload users + sessions from D1 into memory. Call once at server start. */
export async function hydrateUsersAndSessions(): Promise<void> {
  if (!D1_ENABLED) return;
  try {
    const rows = await d1Query<{ id: string; email: string; name: string; password_hash: string; role: string; created_at: string; email_verified?: number }>(
      `SELECT id, email, name, password_hash, role, created_at, email_verified FROM users`,
    );
    for (const r of rows) {
      users().set(r.email, {
        id: r.id,
        email: r.email,
        name: r.name,
        role: (r.role as SessionUser["role"]) || "user",
        emailVerified: Boolean(r.email_verified),
        passwordHash: r.password_hash,
        createdAt: r.created_at,
      });
    }
    const sess = await d1Query<{ token: string; user_id: string; user_email: string; expires_at: number }>(
      `SELECT token, user_id, user_email, expires_at FROM sessions`,
    );
    const now = Date.now();
    for (const s of sess) {
      if (s.expires_at <= now) continue;
      const user = users().get(s.user_email);
      if (!user) continue;
      sessions().set(s.token, { user: { id: user.id, email: user.email, name: user.name, role: user.role, emailVerified: user.emailVerified }, expiresAt: s.expires_at });
    }
  } catch (e) {
    console.error("[db] hydrate users/sessions failed:", e instanceof Error ? e.message : e);
  }
}
