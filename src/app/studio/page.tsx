"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sparkles, Upload, Wand2, Image as ImageIcon, Eraser, Maximize2, RefreshCw, Loader2, ArrowRight, Download, Plus, History } from "lucide-react";
import { Artwork, artworkSvg } from "@/components/Artwork";
import { STYLE_PRESETS as SERVER_PALETTES } from "@/lib/presets";
import { ensureSession } from "@/lib/client-session";
import { useUser } from "@/lib/use-user";
import { CATEGORIES, PRODUCT_SKUS, FAMILY_LABELS, unitPriceForSku, adapterDefaultSku, money, type FamilyId } from "@/lib/data";
import { netCentsForSku, SKU_BY_ID } from "@/lib/pricing";

type GenState = "idle" | "queued" | "running" | "succeeded" | "failed";
type GenResult = { seed: string; palette: [string, string, string]; shape: number; imageUrl?: string };

const STYLE_PRESETS = [
  { id: "minimal", name: "Minimal", palette: ["#0c0c0d", "#f7f6f3", "#f1efea"] as [string, string, string], shape: 0 },
  { id: "swiss", name: "Swiss Grid", palette: ["#ff4d18", "#0c0c0d", "#f7f6f3"] as [string, string, string], shape: 0 },
  { id: "abstract", name: "Abstract", palette: ["#6b3df5", "#ff4d18", "#f7f6f3"] as [string, string, string], shape: 1 },
  { id: "organic", name: "Organic", palette: ["#1f7a4d", "#0c0c0d", "#f7f6f3"] as [string, string, string], shape: 1 },
  { id: "bold", name: "Bold Type", palette: ["#0c0c0d", "#f7f6f3", "#ff4d18"] as [string, string, string], shape: 2 },
  { id: "radial", name: "Radial", palette: ["#2244ff", "#f7f6f3", "#0c0c0d"] as [string, string, string], shape: 3 },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "Square", w: 1, h: 1 },
  { id: "3:4", label: "Portrait", w: 3, h: 4 },
  { id: "4:3", label: "Landscape", w: 4, h: 3 },
  { id: "16:9", label: "Wide", w: 16, h: 9 },
];

type ApiOutput = { seed?: string; palette?: [string, string, string]; shape?: number; imageUrl?: string };
type PollResponse = {
  status?: string;
  progress?: number;
  prompt?: string;
  outputs?: ApiOutput[];
  error?: { message?: string } | string | null;
};

/** Compress an uploaded image file to a JPEG data URL (max 1280px, q0.82). */
function compressImage(file: File): Promise<{ dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

// M3: 发布前配置"要印成哪些商品 + 分成率"的内联面板（AI / 上传两种模式共用）。
function ProductConfigPanel({
  selSkus,
  onToggle,
  royalty,
  onRoyalty,
}: {
  selSkus: string[];
  onToggle: (sku: string) => void;
  royalty: number;
  onRoyalty: (n: number) => void;
}) {
  const families = Object.keys(FAMILY_LABELS) as FamilyId[];
  const avgEarn =
    selSkus.length > 0
      ? Math.round(
          selSkus.reduce((s, sku) => s + netCentsForSku(SKU_BY_ID[sku]) * (royalty / 100), 0) / selSkus.length,
        )
      : 0;
  return (
    <div className="stack gap-4">
      <div className="hr" />
      <div>
        <div className="label">Products to sell</div>
        <p className="tiny muted" style={{ marginBottom: 10 }}>
          Pick the items this design is printed on. Prices come from our supply chain.
        </p>
        <div className="stack gap-4">
          {families.map((fam) => {
            const skus = PRODUCT_SKUS.filter((s) => s.family === fam);
            if (skus.length === 0) return null;
            return (
              <div key={fam}>
                <div className="tiny font-medium" style={{ marginBottom: 6, color: "var(--color-tx-2)" }}>
                  {FAMILY_LABELS[fam]}
                </div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                  {skus.map((s) => {
                    const on = selSkus.includes(s.sku);
                    const price = unitPriceForSku(s.sku) ?? 0;
                    return (
                      <button
                        key={s.sku}
                        type="button"
                        onClick={() => onToggle(s.sku)}
                        className="text-left"
                        style={{
                          padding: "10px",
                          border: "1px solid",
                          borderColor: on ? "var(--color-ink)" : "rgba(12,12,13,0.12)",
                          borderRadius: 10,
                          background: on ? "var(--color-ink)" : "var(--color-surface)",
                          color: on ? "var(--color-paper)" : "var(--color-tx)",
                        }}
                      >
                        <div className="tiny font-medium" style={{ lineHeight: 1.3 }}>{s.name}</div>
                        <div className="tiny mono" style={{ color: on ? "rgba(247,246,243,0.6)" : "var(--color-tx-3)", marginTop: 2 }}>
                          {money(price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="row-between mb-2">
          <div className="label" style={{ marginBottom: 0 }}>Your earnings</div>
          <div className="tiny mono" style={{ color: "var(--color-tx-2)" }}>{royalty}% per sale</div>
        </div>
        <input
          type="range"
          min={10}
          max={50}
          step={1}
          value={royalty}
          onChange={(e) => onRoyalty(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <p className="tiny muted" style={{ marginTop: 6 }}>
          You earn about{" "}
          <span className="mono font-medium" style={{ color: "var(--color-ink)" }}>{money(avgEarn)}</span> per item sold
          (avg. across selected products).
        </p>
      </div>
    </div>
  );
}

export default function StudioPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loaded } = useUser();
  const [mode, setMode] = useState<"ai" | "upload">("ai");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("minimal");
  const [aspect, setAspect] = useState("1:1");
  const [state, setState] = useState<GenState>("idle");
  const [results, setResults] = useState<GenResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<number | null>(null);
  // Upload-mode state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [upTitle, setUpTitle] = useState("");
  const [upCategory, setUpCategory] = useState("art");
  const [upDesc, setUpDesc] = useState("");
  const [upLoading, setUpLoading] = useState(false);
  // M3: 发布时勾选的具体商品（SKU）+ 创作者分成率（10–50%）
  const [selSkus, setSelSkus] = useState<string[]>(
    (["poster", "tshirt", "sticker"] as string[]).map((a) => adapterDefaultSku(a) ?? "").filter(Boolean),
  );
  const [royalty, setRoyalty] = useState(30);
  const toggleSku = (sku: string) =>
    setSelSkus((prev) => (prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]));
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // M2: guards every setState reached from an async callback after unmount.
  const alive = useRef(true);
  // Monotonic id: bumping it invalidates any poll loop still in flight, so a stale
  // run started by a previous "Generate" click can never write into current state.
  const runId = useRef(0);
  // Resolver of the in-flight sleep, so stopPolling can wake the loop immediately
  // instead of leaving a promise pending forever.
  const wake = useRef<(() => void) | null>(null);

  const stopPolling = () => {
    runId.current += 1;
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    const w = wake.current;
    wake.current = null;
    if (w) w();
  };

  // R2/M2: the polling setTimeout chain had zero cleanup — navigating away mid-generation
  // left a timer calling setState on an unmounted component every 700ms, forever.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
      // Wake the suspended sleep so the loop can observe `alive === false`
      // and unwind, instead of leaving a promise pending forever.
      const w = wake.current;
      wake.current = null;
      if (w) w();
    };
  }, []);

  // M3: Studio is a write surface — generation and publishing require a session.
  // A signed-out visitor who lands here (e.g. via the hero "Start creating" CTA)
  // must be sent to sign-in and returned here afterwards, not left staring at a
  // "could not sign you in" error. Hard-navigate so the fresh session cookie is
  // carried to /auth and the proxy prefetch cache can't bounce us back.
  useEffect(() => {
    if (loaded && !user) {
      window.location.assign(`/auth?next=${encodeURIComponent(pathname)}`);
    }
  }, [loaded, user, pathname]);

  // A single async loop, not a recursive setTimeout chain. The old version had
  // `poll` calling itself from inside its own useCallback, which captures the
  // first-render binding and is rejected by the React Compiler.
  const poll = useCallback(async (jobId: string, chosenStyle: string, delayMs = 0) => {
    const myRun = ++runId.current;
    const active = () => alive.current && runId.current === myRun;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        wake.current = resolve;
        pollTimer.current = setTimeout(() => {
          pollTimer.current = null;
          wake.current = null;
          resolve();
        }, ms);
      });

    if (delayMs > 0) await sleep(delayMs);

    while (active()) {
      try {
        const res = await fetch(`/api/generate/${jobId}`);
        if (!res.ok) throw new Error("poll_failed");
        const data = (await res.json()) as PollResponse;
        if (!active()) return;
        setProgress(data.progress || 0);

        if (data.status === "succeeded" && Array.isArray(data.outputs)) {
          const palette = SERVER_PALETTES[chosenStyle] || SERVER_PALETTES.minimal;
          const newResults: GenResult[] = data.outputs.map((o, i) => ({
            seed: o.seed || `${data.prompt ?? "design"}-${jobId}-${i}`,
            palette: o.palette || palette,
            shape: typeof o.shape === "number" ? o.shape : i % 6,
            imageUrl: o.imageUrl,
          }));
          setResults((r) => [...newResults, ...r]);
          setState("succeeded");
          setProgress(100);
          return;
        }
        if (data.status === "failed") {
          const msg = typeof data.error === "string" ? data.error : data.error?.message;
          setError(msg || "Generation failed");
          setState("failed");
          return;
        }

        // queued/running — wait and poll again
        setState(data.status === "queued" ? "queued" : "running");
        await sleep(700);
      } catch {
        if (!active()) return;
        setError("Network error while polling");
        setState("failed");
        return;
      }
    }
  }, []);

  const generate = async () => {
    if (!prompt.trim()) return;
    stopPolling();
    setError(null);
    setState("queued");
    setProgress(5);
    try {
      // C6: generation is a server-side write — ensure a session first.
      const authed = await ensureSession();
      if (!authed) {
        window.location.assign(`/auth?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, aspect, count: 4 }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Failed to start generation");
      }
      const data = (await res.json()) as { job_id: string };
      if (!alive.current) return;
      setState("running");
      void poll(data.job_id, style, 600);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : "Generation failed to start");
      setState("failed");
    }
  };

  /**
   * R2/H8 — real download. `Artwork` is pure SVG, so serialize it and hand the user a file.
   * Previously this button had no onClick at all: the entire generation flow dead-ended.
   */
  const download = (r: GenResult, index: number) => {
    const svg = artworkSvg(r.seed, r.palette, r.shape);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = (prompt.trim() || "desmake-design").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
    a.href = url;
    a.download = `${base || "desmake-design"}-${index + 1}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick so Safari has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /** R2/H8 — publish an AI generation into the marketplace and open the real detail page. */
  const publish = async (r: GenResult, index: number) => {
    setPublishing(index);
    setError(null);
    try {
      const authed = await ensureSession();
      if (!authed) {
        window.location.assign(`/auth?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: r.seed,
          palette: r.palette,
          shape: r.shape,
          prompt: prompt.trim(),
          title: prompt.trim().slice(0, 80),
          imageUrl: r.imageUrl,
          selectedProducts: selSkus.map((sku) => ({ sku })),
          royaltyRate: royalty / 100,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Publish failed");
      }
      const data = (await res.json()) as { slug: string };
      router.push(`/listing/${data.slug}`);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : "Publish failed");
      setPublishing(null);
    }
  };

  // ───────────── Upload mode ─────────────

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8MB");
      return;
    }
    try {
      const { dataUrl } = await compressImage(file);
      setUploadDataUrl(dataUrl);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process image");
    }
  };

  const publishUpload = async () => {
    if (!uploadDataUrl || !upTitle.trim() || selSkus.length === 0) return;
    setUpLoading(true);
    setError(null);
    try {
      const authed = await ensureSession();
      if (!authed) {
        window.location.assign(`/auth?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const up = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadDataUrl }),
      });
      if (!up.ok) {
        const err = (await up.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Upload failed");
      }
      const { url } = (await up.json()) as { url: string };
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "upload",
          imageUrl: url,
          title: upTitle.trim().slice(0, 80),
          category: upCategory,
          selectedProducts: selSkus.map((sku) => ({ sku })),
          royaltyRate: royalty / 100,
          description: upDesc.trim().slice(0, 500),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Publish failed");
      }
      const data = (await res.json()) as { slug: string };
      router.push(`/listing/${data.slug}`);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : "Publish failed");
      setUpLoading(false);
    }
  };

  // While we resolve the session, or if signed out (about to redirect), show a
  // calm placeholder instead of flashing the editor.
  if (!loaded) {
    return (
      <section className="section"><div className="container-narrow center" style={{ padding: "clamp(48px,6vw,80px) 24px" }}><div className="tiny mono">Loading studio…</div></div></section>
    );
  }
  if (!user) {
    return (
      <section className="section"><div className="container-narrow center" style={{ padding: "clamp(48px,6vw,80px) 24px" }}><div className="tiny mono">Redirecting to sign in…</div></div></section>
    );
  }

  return (
    <div>
      <section style={{ paddingTop: "clamp(32px,4vw,56px)" }}>
        <div className="container-narrow center">
          <span className="eyebrow eyebrow-dot">Design Studio</span>
          <h1 className="display balance" style={{ marginTop: 14 }}>Create with <span className="serif-i">AI.</span></h1>
          <p className="lead" style={{ maxWidth: "44ch", margin: "16px auto 0" }}>Describe what you want to see, or upload a design you already have. Both paths publish straight to the marketplace.</p>
        </div>
      </section>

      <section className="section-sm" style={{ paddingTop: 32 }}>
        <div className="container-wide" style={{ display: "grid", gridTemplateColumns: "minmax(0,380px) minmax(0,1fr)", gap: 40 }}>
          {/* Controls */}
          <aside className="card" style={{ padding: 24, height: "fit-content", position: "sticky", top: 88 }}>
            <div className="stack gap-5">
              {/* Mode tabs */}
              <div className="row gap-2" style={{ border: "1px solid rgba(12,12,13,0.12)", borderRadius: 12, padding: 4 }}>
                <button
                  onClick={() => setMode("ai")}
                  className="btn btn-sm full"
                  style={{
                    background: mode === "ai" ? "var(--color-ink)" : "transparent",
                    color: mode === "ai" ? "#fff" : "var(--color-tx)",
                    borderColor: "transparent",
                  }}
                >
                  <Wand2 size={15} strokeWidth={1.8} /> Generate
                </button>
                <button
                  onClick={() => setMode("upload")}
                  className="btn btn-sm full"
                  style={{
                    background: mode === "upload" ? "var(--color-ink)" : "transparent",
                    color: mode === "upload" ? "#fff" : "var(--color-tx)",
                    borderColor: "transparent",
                  }}
                >
                  <Upload size={15} strokeWidth={1.8} /> Upload
                </button>
              </div>

              {mode === "ai" ? (
                <>
                  <div>
                    <label className="label">Prompt</label>
                    <textarea
                      className="input"
                      rows={4}
                      placeholder="A brutalist grid poster, ember and charcoal palette, abstract geometry…"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      style={{ resize: "vertical", borderRadius: 12 }}
                    />
                  </div>

                  <div>
                    <label className="label">Style preset</label>
                    <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                      {STYLE_PRESETS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setStyle(s.id)}
                          className="text-left"
                          style={{
                            padding: "10px", border: "1px solid",
                            borderColor: style === s.id ? "var(--color-ink)" : "rgba(12,12,13,0.12)",
                            borderRadius: 10, background: style === s.id ? "var(--color-ink)" : "#fff",
                            color: style === s.id ? "#fff" : "var(--color-tx)",
                            transition: "all 0.2s",
                          }}
                        >
                          <div className="row gap-1 mb-1.5">
                            {s.palette.map((c, i) => (
                              <div key={i} style={{ width: 14, height: 14, borderRadius: 4, background: c, border: "1px solid rgba(0,0,0,0.1)" }} />
                            ))}
                          </div>
                          <div className="tiny font-medium">{s.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Aspect ratio</label>
                    <div className="row gap-2">
                      {ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setAspect(r.id)}
                          className="chip"
                          style={{
                            borderColor: aspect === r.id ? "var(--color-ink)" : "rgba(12,12,13,0.15)",
                            background: aspect === r.id ? "var(--color-ink)" : "#fff",
                            color: aspect === r.id ? "#fff" : "var(--color-tx)",
                          }}
                        >
                          {r.id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="hr" />

                  <button
                    onClick={generate}
                    disabled={state === "queued" || state === "running" || !prompt.trim()}
                    className="btn btn-lg full"
                    style={{ height: 54 }}
                  >
                    {state === "queued" || state === "running" ? (
                      <><Loader2 size={18} className="animate-spin" /> Generating…</>
                    ) : (
                      <><Wand2 size={18} strokeWidth={1.8} /> Generate</>
                    )}
                  </button>

                  {(state === "queued" || state === "running") && (
                    <div>
                      <div className="bar"><i style={{ width: `${progress}%`, background: "var(--color-signal)" }} /></div>
                      <div className="tiny mono mt-2" style={{ color: "var(--color-tx-3)" }}>
                        {state === "queued" ? "Queued…" : `Generating preview — ${progress}%`}
                      </div>
                    </div>
                  )}

                  {state === "failed" && error && (
                    <div className="tiny" style={{ color: "var(--color-signal)" }}>{error}</div>
                  )}

                  <div className="hr" />

                  <div>
                    <div className="label">Quick tools</div>
                    <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                      {[
                        { icon: <Eraser size={15} strokeWidth={1.8} />, t: "Remove bg" },
                        { icon: <Maximize2 size={15} strokeWidth={1.8} />, t: "Upscale 2×" },
                        { icon: <RefreshCw size={15} strokeWidth={1.8} />, t: "Variations" },
                        { icon: <ImageIcon size={15} strokeWidth={1.8} />, t: "Img → img" },
                      ].map((t) => (
                        <button key={t.t} className="btn btn-outline" style={{ padding: "10px", fontSize: "0.8125rem", justifyContent: "flex-start" }}>
                          {t.icon}{t.t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ProductConfigPanel selSkus={selSkus} onToggle={toggleSku} royalty={royalty} onRoyalty={setRoyalty} />
                </>
              ) : (
                <>
                  <div>
                    <label className="label">Your design</label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                    />
                    {!uploadDataUrl ? (
                      <button
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
                        className="card center"
                        style={{
                          width: "100%", minHeight: 190, cursor: "pointer",
                          borderStyle: "dashed", display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                      >
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Upload size={22} strokeWidth={1.5} style={{ color: "var(--color-tx-2)" }} />
                        </div>
                        <div className="small font-medium">Click or drop an image</div>
                        <div className="tiny muted">PNG · JPG · WebP · up to 8MB</div>
                      </button>
                    ) : (
                      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                        <div style={{ aspectRatio: "1", position: "relative" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={uploadDataUrl} alt="upload preview" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                        </div>
                        <div className="row gap-2 p-3">
                          <button onClick={() => fileRef.current?.click()} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: "0.8rem" }}>Replace</button>
                          <button onClick={() => { setUploadDataUrl(null); }} className="btn btn-outline" style={{ padding: "8px 14px", fontSize: "0.8rem" }}>Remove</button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label">Title</label>
                    <input
                      className="input"
                      value={upTitle}
                      onChange={(e) => setUpTitle(e.target.value)}
                      placeholder="Name your design"
                      style={{ borderRadius: 12 }}
                    />
                  </div>

                  <div>
                    <label className="label">Category</label>
                    <select
                      className="input"
                      value={upCategory}
                      onChange={(e) => setUpCategory(e.target.value)}
                      style={{ borderRadius: 12 }}
                    >
                      {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <ProductConfigPanel selSkus={selSkus} onToggle={toggleSku} royalty={royalty} onRoyalty={setRoyalty} />

                  <div>
                    <label className="label">Description <span className="faint">(optional)</span></label>
                    <textarea
                      className="input"
                      rows={3}
                      value={upDesc}
                      onChange={(e) => setUpDesc(e.target.value)}
                      placeholder="Tell buyers about this design…"
                      style={{ resize: "vertical", borderRadius: 12 }}
                    />
                  </div>

                  <button
                    onClick={publishUpload}
                    disabled={!uploadDataUrl || !upTitle.trim() || selSkus.length === 0 || upLoading}
                    className="btn btn-lg full"
                    style={{ height: 54 }}
                  >
                    {upLoading ? <><Loader2 size={18} className="animate-spin" /> Publishing…</> : <>Publish <ArrowRight size={18} /></>}
                  </button>

                  {error && <div className="tiny" style={{ color: "var(--color-signal)" }}>{error}</div>}
                </>
              )}
            </div>
          </aside>

          {/* Canvas */}
          <div>
            {mode === "upload" ? (
              uploadDataUrl ? (
                <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 22 }}>
                  <div style={{ aspectRatio: "1", position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadDataUrl} alt={upTitle || "uploaded design"} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                  </div>
                  <div className="p-4">
                    <h3 className="h3" style={{ marginBottom: 6 }}>{upTitle || "Untitled upload"}</h3>
                    <p className="small muted">
                      {CATEGORIES.find((c) => c.id === upCategory)?.name} · {selSkus.length} product{selSkus.length === 1 ? "" : "s"}
                    </p>
                    <p className="tiny mono mt-2" style={{ color: "var(--color-tx-3)" }}>Looks good? Hit Publish on the left.</p>
                  </div>
                </div>
              ) : (
                <div
                  className="card center"
                  style={{
                    padding: "clamp(48px,8vw,96px) 24px",
                    minHeight: 500,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    borderStyle: "dashed",
                  }}
                >
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                    <Upload size={26} strokeWidth={1.5} style={{ color: "var(--color-tx-2)" }} />
                  </div>
                  <h3 className="h3" style={{ marginBottom: 8 }}>Upload your design</h3>
                  <p className="small muted" style={{ maxWidth: 360 }}>Pick an image on the left and we&apos;ll get it ready to publish as a real, buyable product.</p>
                </div>
              )
            ) : results.length === 0 && state !== "running" ? (
              <div
                className="card center"
                style={{
                  padding: "clamp(48px,8vw,96px) 24px",
                  minHeight: 500,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  borderStyle: "dashed",
                }}
              >
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <Sparkles size={26} strokeWidth={1.5} style={{ color: "var(--color-tx-2)" }} />
                </div>
                <h3 className="h3" style={{ marginBottom: 8 }}>Start with a prompt</h3>
                <p className="small muted" style={{ maxWidth: 360 }}>Describe your idea, pick a style, and we&apos;ll render four preview variations you can publish.</p>
                <div className="row gap-2 wrap mt-6" style={{ justifyContent: "center" }}>
                  {["minimalist mountain line art", "swiss typographic poster", "bauhaus pattern, warm tones"].map((s) => (
                    <button key={s} className="chip" onClick={() => setPrompt(s)} style={{ fontSize: "0.75rem" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="stack gap-6">
                <div className="row-between">
                  <h3 className="h3">{state === "running" ? "Generating…" : "Results"}</h3>
                  <button onClick={generate} disabled={state === "running"} className="btn btn-outline" style={{ padding: "9px 16px", fontSize: "0.8125rem" }}>
                    <RefreshCw size={14} strokeWidth={1.8} /> Regenerate
                  </button>
                </div>
                {state === "running" && (
                  <div className="grid g-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="card" style={{ aspectRatio: "1", background: "var(--color-paper-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-tx-3)" }} />
                      </div>
                    ))}
                  </div>
                )}
                {results.length > 0 && (
                  <div className="grid g-2">
                    {results.slice(0, 4).map((r, i) => (
                      <div key={i} className="card card-hover" style={{ position: "relative", padding: 0, overflow: "hidden" }}>
                        <div style={{ aspectRatio: aspect.replace(":", "/") }}>
                          {r.imageUrl ? (
                            // Real AI-generated image
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.imageUrl} alt={prompt.slice(0, 60)} className="w-full h-full object-cover" style={{ width: "100%", height: "100%" }} />
                          ) : (
                            <Artwork seed={r.seed} palette={r.palette} shape={r.shape} rounded={false} className="!rounded-none" />
                          )}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-3" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => download(r, i)}
                            aria-label="Download SVG"
                            className="btn btn-sm"
                            style={{ padding: "7px 14px", fontSize: "0.75rem", background: "#fff", color: "#0c0c0d", borderColor: "#fff" }}
                          >
                            <Download size={13} strokeWidth={1.8} />
                          </button>
                          <button
                            onClick={() => publish(r, i)}
                            disabled={publishing !== null}
                            className="btn btn-sm"
                            style={{ padding: "7px 14px", fontSize: "0.75rem" }}
                          >
                            {publishing === i ? <><Loader2 size={13} className="animate-spin" /> Publishing…</> : <>Publish <ArrowRight size={13} /></>}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Editor / canvas placeholder */}
                <div className="card" style={{ padding: 24 }}>
                  <div className="row-between mb-4">
                    <h4 className="h4">Editor</h4>
                    <span className="badge badge-outline" style={{ fontSize: "0.625rem" }}>Coming soon</span>
                  </div>
                  <p className="small muted">Fabric.js canvas with layers, text, and vectors lands in the next release. For now you can publish directly from generated outputs.</p>
                </div>

                <div className="card" style={{ padding: 20 }}>
                  <div className="row-between mb-3">
                    <div className="row gap-2">
                      <History size={16} strokeWidth={1.8} />
                      <h5 className="h5">Recent generations</h5>
                    </div>
                    <span className="tiny mono" style={{ color: "var(--color-tx-3)" }}>{results.length} items</span>
                  </div>
                  <div className="row gap-2" style={{ overflowX: "auto", paddingBottom: 4 }}>
                    {results.slice(4).concat(results.slice(0, 4)).slice(0, 8).map((r, i) => (
                      <div key={i} style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: "1px solid rgba(12,12,13,0.1)" }}>
                        <Artwork seed={r.seed} palette={r.palette} shape={r.shape} rounded={false} className="!rounded-none" />
                      </div>
                    ))}
                    <button className="row gap-1" style={{ width: 72, height: 72, borderRadius: 10, border: "1px dashed rgba(12,12,13,0.2)", color: "var(--color-tx-3)", fontSize: "0.75rem", flexShrink: 0 }}>
                      <Plus size={14} /> New
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
