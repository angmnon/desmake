// Email-verification token store (D1-backed).
//
// A token is created on registration and consumed by /api/auth/verify. Without
// D1 the flow is a no-op (verification simply stays unenforced) so local/dev
// still works.

import { newToken } from "@/lib/stores";
import { d1Query, D1_ENABLED } from "@/lib/db";

const TTL_MS = 24 * 60 * 60 * 1000;

export async function createVerificationToken(userId: string): Promise<string> {
  const token = newToken();
  if (D1_ENABLED) {
    await d1Query(
      `INSERT INTO email_verifications (token, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id, expires_at=excluded.expires_at`,
      [token, userId, Date.now() + TTL_MS, new Date().toISOString()],
    );
  }
  return token;
}

export async function consumeVerificationToken(token: string): Promise<string | null> {
  if (!D1_ENABLED) return null;
  const rows = await d1Query<{ user_id: string; expires_at: number }>(
    `SELECT user_id, expires_at FROM email_verifications WHERE token = ?`,
    [token],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  if (r.expires_at <= Date.now()) return null;
  await d1Query(`DELETE FROM email_verifications WHERE token = ?`, [token]);
  return r.user_id;
}
