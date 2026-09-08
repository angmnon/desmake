import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// B1 migration: deploy Next.js to Cloudflare Workers via the OpenNext Cloudflare
// adapter (no Containers). The default config is sufficient to get the app running
// with native D1/R2/image bindings declared in wrangler.jsonc.
//
// Phase 2 optimization (optional, later): enable R2-backed incremental cache +
// Durable Objects revalidation queue for ISR:
//   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
//   export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
export default defineCloudflareConfig({});
