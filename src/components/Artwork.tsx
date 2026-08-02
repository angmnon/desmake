type ArtworkProps = {
  seed: string;
  palette: [string, string, string];
  shape: number;
  className?: string;
  rounded?: boolean;
};

// Deterministic PRNG from seed string (no Math.random to avoid hydration mismatch)
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic pure function — safe for SSR and client (no client-only hooks, no Math.random)
// H11: only allow hex colors into the SVG markup to prevent stored/reflected XSS
// via the palette sink (designs / studio palettes are user-influenced).
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
function safeColor(c: string): string {
  return HEX_RE.test(c) ? c : "#000000";
}

/**
 * Serialize the artwork to a standalone SVG string.
 * Exported so Studio can offer a real file download (R2/H8) — the generated
 * result used to be un-downloadable, un-publishable and lost on refresh.
 */
export function artworkSvg(seed: string, palette: [string, string, string], shape: number): string {
  return generateArt(seed, palette, shape);
}

function generateArt(seed: string, palette: [string, string, string], shape: number): string {
  const c1 = safeColor(palette[0]);
  const c2 = safeColor(palette[1]);
  const c3 = safeColor(palette[2]);
  const rand = rng(seed + "|" + shape);
  const shapes: string[] = [];
  const W = 400, H = 400;

  shapes.push(`<rect width="${W}" height="${H}" fill="${c3}"/>`);

  const r = (min: number, max: number) => min + rand() * (max - min);

  switch (shape % 6) {
    case 0: {
      const cols = 3 + Math.floor(rand() * 3);
      const size = W / cols;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < cols; j++) {
          if (rand() > 0.35) {
            const color = rand() > 0.5 ? c1 : c2;
            const x = i * size;
            const y = j * size;
            const pad = size * 0.08;
            if (rand() > 0.5) {
              shapes.push(`<rect x="${x + pad}" y="${y + pad}" width="${size - pad * 2}" height="${size - pad * 2}" fill="${color}"/>`);
            } else {
              shapes.push(`<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${(size - pad * 2) / 2}" fill="${color}"/>`);
            }
          }
        }
      }
      break;
    }
    case 1: {
      shapes.push(`<rect width="${W}" height="${H}" fill="${c2}"/>`);
      for (let i = 0; i < 5; i++) {
        const y = r(50, H - 50);
        const color = i % 2 === 0 ? c1 : c3;
        const amp = r(30, 80);
        const freq = r(0.008, 0.02);
        const phase = r(0, Math.PI * 2);
        let path = `M0 ${y}`;
        for (let x = 0; x <= W; x += 8) {
          path += ` L${x} ${y + Math.sin(x * freq + phase) * amp}`;
        }
        path += ` L${W} ${H} L0 ${H} Z`;
        shapes.push(`<path d="${path}" fill="${color}" opacity="${0.5 + rand() * 0.5}"/>`);
      }
      break;
    }
    case 2: {
      shapes.push(`<rect width="${W}" height="${H}" fill="${c3}"/>`);
      const sx = r(40, 120), sy = r(40, 100);
      const w = r(60, 180), h = r(200, 280);
      shapes.push(`<rect x="${sx}" y="${sy}" width="${w}" height="${h}" fill="${c1}"/>`);
      shapes.push(`<rect x="${sx + w}" y="${sy + h * 0.3}" width="${r(60, 120)}" height="${h * 0.4}" fill="${c2}"/>`);
      shapes.push(`<circle cx="${r(W - 120, W - 40)}" cy="${r(40, 120)}" r="${r(18, 36)}" fill="${c1}"/>`);
      break;
    }
    case 3: {
      shapes.push(`<rect width="${W}" height="${H}" fill="${c3}"/>`);
      const cx = W / 2 + r(-40, 40);
      const cy = H / 2 + r(-40, 40);
      const rings = 4 + Math.floor(rand() * 4);
      for (let i = 0; i < rings; i++) {
        const rad = (i + 1) * (W / (rings + 2));
        const color = i % 2 === 0 ? c1 : c2;
        shapes.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${color}" stroke-width="${r(8, 20)}" opacity="${0.7 + rand() * 0.3}"/>`);
      }
      shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r(20, 40)}" fill="${c1}"/>`);
      break;
    }
    case 4: {
      shapes.push(`<rect width="${W}" height="${H}" fill="${c2}"/>`);
      const blobs = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < blobs; i++) {
        const cx = r(60, W - 60);
        const cy = r(60, H - 60);
        const rx = r(60, 140);
        const ry = r(60, 140);
        const color = i % 2 === 0 ? c1 : c3;
        shapes.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${0.55 + rand() * 0.4}"/>`);
      }
      break;
    }
    case 5: {
      // Diagonal stripes / constructivist
      shapes.push(`<rect width="${W}" height="${H}" fill="${c3}"/>`);
      const stripeW = r(18, 40);
      for (let i = -H; i < W + H; i += stripeW * 2) {
        shapes.push(`<rect x="${i}" y="${-H}" width="${stripeW}" height="${H * 3}" fill="${c1}" transform="rotate(-20 ${W / 2} ${H / 2})"/>`);
      }
      shapes.push(`<rect x="${r(40, 120)}" y="${r(40, 120)}" width="${r(120, 220)}" height="${r(120, 220)}" fill="${c2}"/>`);
      shapes.push(`<circle cx="${r(W - 120, W - 40)}" cy="${r(40, 120)}" r="${r(20, 40)}" fill="${c1}"/>`);
      break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" shape-rendering="geometricPrecision">${shapes.join("")}</svg>`;
}

// Server/Client-safe deterministic component (no useMemo needed since function is pure)
export function Artwork({ seed, palette, shape, className = "", rounded = true }: ArtworkProps) {
  const svg = generateArt(seed, palette, shape);
  return (
    <div
      className={`art-canvas ${rounded ? "rounded-[18px]" : ""} ${className}`}
      style={{ background: safeColor(palette[2]), width: "100%", aspectRatio: "1/1", overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
