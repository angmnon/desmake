// Resolve the public base URL of the site for building absolute links
// (verification emails, redirects). Inside a Cloudflare Container the
// request.url.origin is the internal host (e.g. http://0.0.0.0:3000), so we
// must prefer an explicit SITE_URL or the public Host header forwarded by the
// edge, not the raw request URL.

export function getSiteBaseUrl(request: Request): string {
  const envSite = process.env.SITE_URL?.trim();
  if (envSite) return envSite.replace(/\/+$/, "");

  const req = request as Request & { headers: Headers };
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "";
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://desmake.com";
  }
}
