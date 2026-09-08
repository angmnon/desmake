// Ambient declarations for Cloudflare Workers runtime-only modules that ship no
// type definitions consumable by `tsc` during `next build` (they only resolve
// inside the workerd runtime). Without these, the dynamic `import("cloudflare:email")`
// in src/lib/email.ts fails type-checking with TS2307 even though it works at runtime.

declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(
      from: string,
      to: string,
      message: string | ReadableStream | ArrayBuffer | BufferSource,
    );
    readonly from: string;
    readonly to: string;
    readonly body: string | ReadableStream | ArrayBuffer | BufferSource;
  }
}
