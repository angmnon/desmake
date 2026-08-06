// Minimal monitoring + alerting primitives.
//
// Tracks recent server errors in a ring buffer and exposes health counters. If
// ALERT_WEBHOOK_URL is set (Slack/Discord/Generic webhook), notifyAlert() posts
// a message on important events (payment failures, 5xx spikes).

type ErrRec = { route: string; message: string; ts: number };
const errors: ErrRec[] = [];
const MAX = 300;
const startedAt = Date.now();

export function recordError(route: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  errors.push({ route, message, ts: Date.now() });
  if (errors.length > MAX) errors.shift();
}

/** Errors in the last `ms` milliseconds. */
export function errorWindow(ms: number): ErrRec[] {
  const cutoff = Date.now() - ms;
  return errors.filter((e) => e.ts >= cutoff);
}

export function uptimeMs(): number {
  return Date.now() - startedAt;
}

export async function notifyAlert(subject: string, text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `【Desmake 告警】${subject}\n${text}` }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* best effort */
  }
}
