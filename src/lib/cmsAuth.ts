// CMS API key auth. The key is a single shared ops key stored as the Cloudflare
// Worker secret CMS_API_KEY (set via `wrangler secret put`). Requests must send it via the
// `Authorization: Bearer <key>` header or the `x-cms-key` header.

export function getCmsKeyFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const key = req.headers.get("x-cms-key");
  if (key) return key.trim();
  return null;
}

export function cmsKeyValid(provided: string | null): boolean {
  const expected = process.env.CMS_API_KEY;
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function unauthorized(): Response {
  return new Response(
    JSON.stringify({
      error:
        "Unauthorized. Send the CMS API key via `Authorization: Bearer <key>` or the `x-cms-key` header.",
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="desmake-cms"',
      },
    },
  );
}
