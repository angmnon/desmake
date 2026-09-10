// Minimal monitoring + alerting primitives.
//
// Tracks recent server errors in a ring buffer and exposes health counters. If
// ALERT_WEBHOOK_URL is set (Slack/Discord/Generic webhook), notifyAlert() posts
// a message on important events (payment failures, 5xx spikes).

type ErrRec = { route: string; message: string; ts: number };
const errors: ErrRec[] = [];
const MAX = 300;
const startedAt = Date.now();

// R2-Low: alert/error payloads must not carry user PII or secrets. Alerts are
// posted to a third-party webhook and are readable by ops, so email addresses,
// bearer tokens, API keys and card-like digit runs are redacted before they
// leave the process. Messages are also truncated so a model prompt (which may
// echo the user's input) cannot dump wholesale into the alert channel.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._\-]{6,}/gi;
const TOKEN_RE = /\b(?:sk|pk|rk|cfut|cf|ghp|gho|ghs|xox[baprs]|AIza|eyJ)[A-Za-z0-9_\-.]{8,}\b/g;
const LONG_DIGITS_RE = /\b\d{13,19}\b/g;

/** Redact PII/secrets from a free-text string destined for logs or alerts. */
export function redact(input: string): string {
  return input
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(EMAIL_RE, "[email]")
    .replace(TOKEN_RE, "[token]")
    .replace(LONG_DIGITS_RE, "[num]")
    .slice(0, 500);
}

export function recordError(route: string, err: unknown): void {
  const raw = err instanceof Error ? err.message : String(err);
  errors.push({ route, message: redact(raw).slice(0, 300), ts: Date.now() });
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
      // R2-Low: redact before the payload leaves the process (third-party webhook).
      body: JSON.stringify({ text: `[Desmake Alert] ${redact(subject)}\n${redact(text)}` }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* best effort */
  }
}
