/* ============================================================
   DESMAKE — Procedural Art Engine
   Deterministic generative artwork + product mockups (pure SVG)
   ============================================================ */
(function (global) {
  "use strict";

  /* ---- deterministic RNG ---- */
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hash(String(seed));
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- curated palettes ---- */
  const PALETTES = [
    { n: "ember",   bg: "#F2EBE1", c: ["#FF4D18", "#E9A63B", "#171310", "#C9502B"] },
    { n: "cobalt",  bg: "#E7EBF8", c: ["#2244FF", "#0B1033", "#93A8FF", "#FF6B4A"] },
    { n: "moss",    bg: "#E8EFE6", c: ["#1F7A4D", "#0F2A1E", "#C9DC72", "#E4A93C"] },
    { n: "dusk",    bg: "#17122A", c: ["#FF6B8A", "#6B3DF5", "#F7E7CE", "#2BD9C4"] },
    { n: "sand",    bg: "#EDE4D6", c: ["#C4652F", "#2A2118", "#8FA37E", "#E8C56B"] },
    { n: "ink",     bg: "#0C0C0D", c: ["#F7F6F3", "#FF4D18", "#6B6A67", "#C8FF3D"] },
    { n: "ocean",   bg: "#E1EEF1", c: ["#0E5B6B", "#08333C", "#F2A65A", "#7FC8D4"] },
    { n: "blush",   bg: "#F6E7E8", c: ["#D9455F", "#2B1A1D", "#F0B7A4", "#8C6BA0"] },
    { n: "neon",    bg: "#0A0F09", c: ["#C8FF3D", "#1F7A4D", "#F7F6F3", "#FF4D18"] },
    { n: "mono",    bg: "#EFEDE8", c: ["#0C0C0D", "#8B8880", "#C7C3BA", "#FF4D18"] },
    { n: "sunset",  bg: "#FCE9D9", c: ["#FF4D18", "#7A2B4E", "#FFB35C", "#2B1A2E"] },
    { n: "arctic",  bg: "#EDF4F7", c: ["#123B57", "#4E8FB0", "#EAD9C0", "#FF6B4A"] }
  ];

  let UID = 0;
  const uid = () => "a" + (UID++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  const rint = (r, a, b) => Math.floor(a + r() * (b - a + 1));
  const rf = (r, a, b) => a + r() * (b - a);

  /* ============================================================
     RECIPES — each returns inner SVG markup on a 400×400 canvas
     ============================================================ */
  const RECIPES = {
    /* Bauhaus: quarter circles + bars */
    bauhaus(r, p, id) {
      let s = `<rect width="400" height="400" fill="${p.bg}"/>`;
      const cells = pick(r, [2, 2, 3, 4]);
      const u = 400 / cells;
      for (let x = 0; x < cells; x++) {
        for (let y = 0; y < cells; y++) {
          if (r() < 0.18) continue;
          const c = pick(r, p.c);
          const t = rint(r, 0, 3);
          const px = x * u, py = y * u;
          if (t === 0) {
            const rot = rint(r, 0, 3) * 90;
            s += `<path d="M0,${u} A${u},${u} 0 0 1 ${u},0 L${u},${u} Z" fill="${c}" transform="translate(${px},${py}) rotate(${rot},${u / 2},${u / 2})"/>`;
          } else if (t === 1) {
            s += `<circle cx="${px + u / 2}" cy="${py + u / 2}" r="${u * rf(r, 0.24, 0.42)}" fill="${c}"/>`;
          } else if (t === 2) {
            const h = u * rf(r, 0.18, 0.5);
            s += `<rect x="${px}" y="${py + (u - h) / 2}" width="${u}" height="${h}" fill="${c}"/>`;
          } else {
            s += `<path d="M${px},${py + u} L${px + u / 2},${py} L${px + u},${py + u} Z" fill="${c}"/>`;
          }
        }
      }
      return s;
    },

    /* Orbit: concentric rings */
    orbit(r, p, id) {
      const cx = rf(r, 140, 260), cy = rf(r, 140, 260);
      let s = `<rect width="400" height="400" fill="${p.bg}"/>`;
      const n = rint(r, 6, 13);
      for (let i = n; i > 0; i--) {
        const rad = (i / n) * rf(r, 190, 260);
        s += `<circle cx="${cx}" cy="${cy}" r="${rad.toFixed(1)}" fill="none" stroke="${pick(r, p.c)}" stroke-width="${rf(r, 1, 9).toFixed(1)}" opacity="${rf(r, 0.55, 1).toFixed(2)}"/>`;
      }
      s += `<circle cx="${cx}" cy="${cy}" r="${rf(r, 14, 40).toFixed(1)}" fill="${p.c[0]}"/>`;
      return s;
    },

    /* Diagonal bands */
    stripes(r, p, id) {
      const ang = pick(r, [-45, 45, 0, 90, 30]);
      let s = `<rect width="400" height="400" fill="${p.bg}"/><g transform="rotate(${ang},200,200)">`;
      let x = -240;
      while (x < 640) {
        const w = rf(r, 6, 52);
        s += `<rect x="${x.toFixed(1)}" y="-240" width="${w.toFixed(1)}" height="880" fill="${pick(r, p.c)}" opacity="${rf(r, 0.7, 1).toFixed(2)}"/>`;
        x += w + rf(r, 4, 34);
      }
      s += `</g>`;
      if (r() < 0.55) s += `<circle cx="${rf(r, 120, 280)}" cy="${rf(r, 120, 280)}" r="${rf(r, 40, 82)}" fill="${p.bg}" opacity=".92"/>`;
      return s;
    },

    /* Soft gradient mesh */
    mesh(r, p, id) {
      let defs = `<filter id="${id}b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${rf(r, 26, 46).toFixed(0)}"/></filter>`;
      let s = `<rect width="400" height="400" fill="${p.bg}"/><g filter="url(#${id}b)">`;
      const n = rint(r, 4, 7);
      for (let i = 0; i < n; i++) {
        s += `<ellipse cx="${rf(r, 20, 380).toFixed(0)}" cy="${rf(r, 20, 380).toFixed(0)}" rx="${rf(r, 60, 170).toFixed(0)}" ry="${rf(r, 60, 170).toFixed(0)}" fill="${pick(r, p.c)}" opacity="${rf(r, 0.6, 1).toFixed(2)}"/>`;
      }
      s += `</g>`;
      s += `<rect width="400" height="400" fill="none" stroke="${p.c[1]}" stroke-width="0" />`;
      return `<defs>${defs}</defs>` + s;
    },

    /* Topographic contours */
    topo(r, p, id) {
      let s = `<rect width="400" height="400" fill="${p.bg}"/>`;
      const cx = rf(r, 120, 280), cy = rf(r, 120, 280);
      const n = rint(r, 9, 16);
      const col = pick(r, p.c);
      for (let i = n; i > 0; i--) {
        const k = i / n;
        let d = "";
        const pts = 14;
        for (let j = 0; j <= pts; j++) {
          const a = (j / pts) * Math.PI * 2;
          const wob = 1 + Math.sin(a * rint(r, 2, 4) + i * 0.5) * 0.16;
          const rad = k * 230 * wob;
          const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.86;
          d += (j === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
        }
        d += "Z";
        s += `<path d="${d}" fill="${i % 3 === 0 ? pick(r, p.c) : "none"}" fill-opacity=".13" stroke="${col}" stroke-width="1.3" opacity=".85"/>`;
      }
      return s;
    },

    /* Giant glyph */
    glyph(r, p, id) {
      const L = pick(r, ["A", "M", "K", "S", "R", "D", "E", "8", "3", "&", "@", "%"]);
      const c1 = pick(r, p.c), c2 = pick(r, p.c.filter(c => c !== c1));
      let s = `<rect width="400" height="400" fill="${p.bg}"/>`;
      if (r() < 0.6) s += `<circle cx="${rf(r, 110, 290)}" cy="${rf(r, 110, 290)}" r="${rf(r, 90, 150)}" fill="${c2}" opacity=".9"/>`;
      else s += `<rect x="0" y="${rf(r, 120, 240).toFixed(0)}" width="400" height="${rf(r, 60, 150).toFixed(0)}" fill="${c2}" opacity=".9"/>`;
      s += `<text x="200" y="200" text-anchor="middle" dominant-baseline="central" font-family="Instrument Serif, Georgia, serif" font-size="${rf(r, 300, 400).toFixed(0)}" fill="${c1}" font-style="${r() < 0.5 ? "italic" : "normal"}">${L}</text>`;
      return s;
    },

    /* Dot matrix */
    matrix(r, p, id) {
      let s = `<rect width="400" height="400" fill="${p.bg}"/>`;
      const n = rint(r, 9, 18), u = 400 / n, c = pick(r, p.c);
      for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
          const d = Math.hypot(x - n / 2, y - n / 2) / (n / 2);
          const rad = Math.max(0.6, (1 - d) * u * 0.44 * rf(r, 0.7, 1.25));
          s += `<circle cx="${(x * u + u / 2).toFixed(1)}" cy="${(y * u + u / 2).toFixed(1)}" r="${rad.toFixed(1)}" fill="${c}"/>`;
        }
      }
      const c2 = pick(r, p.c.filter(x => x !== c));
      if (r() < 0.7) s += `<path d="M${rf(r, 20, 120).toFixed(0)},${rf(r, 240, 360).toFixed(0)} L${rf(r, 180, 240).toFixed(0)},${rf(r, 40, 140).toFixed(0)} L${rf(r, 280, 380).toFixed(0)},${rf(r, 240, 360).toFixed(0)} Z" fill="${c2}" opacity=".92"/>`;
      return s;
    },

    /* Layered waves */
    wave(r, p, id) {
      let s = `<rect width="400" height="400" fill="${p.bg}"/>`;
      const layers = rint(r, 3, 6);
      for (let i = 0; i < layers; i++) {
        const base = 120 + (i / layers) * 260;
        const amp = rf(r, 16, 46), fr = rf(r, 1.2, 3.4);
        let d = `M0,400 L0,${base.toFixed(0)}`;
        for (let x = 0; x <= 400; x += 10) {
          const y = base + Math.sin((x / 400) * Math.PI * 2 * fr + i) * amp;
          d += ` L${x},${y.toFixed(1)}`;
        }
        d += " L400,400 Z";
        s += `<path d="${d}" fill="${p.c[i % p.c.length]}" opacity="${(0.95 - i * 0.06).toFixed(2)}"/>`;
      }
      if (r() < 0.6) s += `<circle cx="${rf(r, 80, 320).toFixed(0)}" cy="${rf(r, 60, 130).toFixed(0)}" r="${rf(r, 26, 54).toFixed(0)}" fill="${p.c[0]}"/>`;
      return s;
    },

    /* Terrazzo scatter */
    terrazzo(r, p, id) {
      let s = `<rect width="400" height="400" fill="${p.bg}"/>`;
      const n = rint(r, 34, 64);
      for (let i = 0; i < n; i++) {
        const x = rf(r, 0, 400), y = rf(r, 0, 400), sz = rf(r, 7, 26), c = pick(r, p.c), rot = rf(r, 0, 360);
        const t = rint(r, 0, 2);
        if (t === 0) s += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${sz.toFixed(0)}" ry="${(sz * rf(r, 0.5, 1)).toFixed(0)}" fill="${c}" transform="rotate(${rot.toFixed(0)},${x.toFixed(0)},${y.toFixed(0)})"/>`;
        else if (t === 1) s += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${sz.toFixed(0)}" height="${(sz * rf(r, 0.4, 1.2)).toFixed(0)}" fill="${c}" transform="rotate(${rot.toFixed(0)},${x.toFixed(0)},${y.toFixed(0)})"/>`;
        else s += `<path d="M${x.toFixed(0)},${y.toFixed(0)} l${sz.toFixed(0)},${(sz * 0.4).toFixed(0)} l${(-sz * 0.5).toFixed(0)},${sz.toFixed(0)} Z" fill="${c}"/>`;
      }
      return s;
    },

    /* Prism / translucent overlaps */
    prism(r, p, id) {
      let s = `<rect width="400" height="400" fill="${p.bg}"/><g style="mix-blend-mode:multiply">`;
      const n = rint(r, 3, 6);
      for (let i = 0; i < n; i++) {
        const t = rint(r, 0, 2), c = pick(r, p.c), o = rf(r, 0.45, 0.8).toFixed(2);
        if (t === 0) s += `<circle cx="${rf(r, 90, 310).toFixed(0)}" cy="${rf(r, 90, 310).toFixed(0)}" r="${rf(r, 70, 140).toFixed(0)}" fill="${c}" opacity="${o}"/>`;
        else if (t === 1) s += `<rect x="${rf(r, 10, 180).toFixed(0)}" y="${rf(r, 10, 180).toFixed(0)}" width="${rf(r, 120, 240).toFixed(0)}" height="${rf(r, 120, 240).toFixed(0)}" fill="${c}" opacity="${o}" transform="rotate(${rf(r, -25, 25).toFixed(0)},200,200)"/>`;
        else s += `<path d="M${rf(r, 20, 120).toFixed(0)},${rf(r, 260, 380).toFixed(0)} L${rf(r, 150, 250).toFixed(0)},${rf(r, 20, 120).toFixed(0)} L${rf(r, 280, 380).toFixed(0)},${rf(r, 260, 380).toFixed(0)} Z" fill="${c}" opacity="${o}"/>`;
      }
      s += `</g>`;
      return s;
    },

    /* Blueprint grid */
    blueprint(r, p, id) {
      const line = p.c[1] || p.c[0];
      let s = `<rect width="400" height="400" fill="${p.bg}"/><g stroke="${line}" stroke-width=".7" opacity=".35">`;
      for (let i = 20; i < 400; i += 20) s += `<line x1="${i}" y1="0" x2="${i}" y2="400"/><line x1="0" y1="${i}" x2="400" y2="${i}"/>`;
      s += `</g>`;
      const c = p.c[0];
      const cx = rf(r, 150, 250), cy = rf(r, 150, 250);
      s += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rf(r, 70, 120).toFixed(0)}" fill="none" stroke="${c}" stroke-width="2"/>`;
      s += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rf(r, 20, 50).toFixed(0)}" fill="${c}"/>`;
      s += `<line x1="0" y1="${cy.toFixed(0)}" x2="400" y2="${cy.toFixed(0)}" stroke="${c}" stroke-width="1.2" stroke-dasharray="6 5"/>`;
      s += `<line x1="${cx.toFixed(0)}" y1="0" x2="${cx.toFixed(0)}" y2="400" stroke="${c}" stroke-width="1.2" stroke-dasharray="6 5"/>`;
      s += `<rect x="${(cx - 150).toFixed(0)}" y="${(cy - 150).toFixed(0)}" width="300" height="300" fill="none" stroke="${p.c[2] || c}" stroke-width="1.4"/>`;
      return s;
    },

    /* Ribbon / flowing bezier */
    ribbon(r, p, id) {
      let s = `<rect width="400" height="400" fill="${p.bg}"/>`;
      const n = rint(r, 5, 11);
      for (let i = 0; i < n; i++) {
        const y0 = rf(r, -40, 440);
        const d = `M-40,${y0.toFixed(0)} C${rf(r, 60, 160).toFixed(0)},${rf(r, -60, 460).toFixed(0)} ${rf(r, 240, 340).toFixed(0)},${rf(r, -60, 460).toFixed(0)} 440,${rf(r, -40, 440).toFixed(0)}`;
        s += `<path d="${d}" fill="none" stroke="${pick(r, p.c)}" stroke-width="${rf(r, 3, 26).toFixed(1)}" stroke-linecap="round" opacity="${rf(r, 0.65, 1).toFixed(2)}"/>`;
      }
      return s;
    },

    /* Halftone gradient */
    halftone(r, p, id) {
      const c = pick(r, p.c);
      let s = `<rect width="400" height="400" fill="${p.bg}"/>`;
      const n = 20, u = 400 / n;
      const dir = rint(r, 0, 3);
      for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
          let t = dir === 0 ? y / n : dir === 1 ? x / n : dir === 2 ? (x + y) / (2 * n) : 1 - Math.hypot(x - n / 2, y - n / 2) / (n / 1.4);
          const rad = Math.max(0, t * u * 0.62);
          if (rad > 0.4) s += `<circle cx="${(x * u + u / 2).toFixed(1)}" cy="${(y * u + u / 2).toFixed(1)}" r="${rad.toFixed(1)}" fill="${c}"/>`;
        }
      }
      return s;
    }
  };

  const KEYS = Object.keys(RECIPES);

  /* ---- public: artwork ---- */
  function inner(seed) {
    const r = rng(seed);
    const p = PALETTES[Math.floor(r() * PALETTES.length)];
    const k = KEYS[Math.floor(r() * KEYS.length)];
    const id = uid();
    return { markup: RECIPES[k](r, p, id), palette: p, recipe: k };
  }

  function svg(seed, opts) {
    opts = opts || {};
    const o = inner(seed);
    const cls = opts.class ? ` class="${opts.class}"` : "";
    const style = opts.style ? ` style="${opts.style}"` : "";
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"${cls}${style} role="img" aria-label="Generated design artwork">${o.markup}</svg>`;
  }

  function nested(seed, x, y, w, h, clip) {
    const o = inner(seed);
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice"${clip ? ` clip-path="url(#${clip})"` : ""}>${o.markup}</svg>`;
  }

  function paletteOf(seed) {
    const r = rng(seed);
    return PALETTES[Math.floor(r() * PALETTES.length)];
  }

  /* ============================================================
     MOCKUPS
     ============================================================ */
  const TEE_PATH = "M158,34 C158,34 168,68 200,68 C232,68 242,34 242,34 L302,52 C314,56 320,63 324,75 L350,148 L302,168 L302,438 C302,444 298,448 292,448 L108,448 C102,448 98,444 98,438 L98,168 L50,148 L76,75 C80,63 86,56 98,52 Z";

  const MOCKUPS = {
    tshirt(seed, o) {
      const id = uid();
      const fabric = o.fabric || "#F2F1ED";
      const dark = fabric === "#1A1A1C" || fabric === "#0C0C0D";
      return `<svg viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="T-shirt mockup">
        <defs>
          <clipPath id="${id}c"><rect x="138" y="132" width="124" height="152" rx="1"/></clipPath>
          <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset=".2" stop-color="#000" stop-opacity="0"/>
            <stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/>
          </linearGradient>
        </defs>
        <rect width="400" height="480" fill="${o.bg || "#EFEDE8"}"/>
        <path d="${TEE_PATH}" fill="${fabric}"/>
        ${nested(seed, 138, 132, 124, 152, id + "c")}
        <path d="${TEE_PATH}" fill="url(#${id}g)"/>
        <path d="M158,34 Q200,92 242,34" fill="none" stroke="${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"}" stroke-width="2.4"/>
        <path d="M100,52 L104,170" fill="none" stroke="${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.07)"}" stroke-width="2"/>
        <path d="M300,52 L296,170" fill="none" stroke="${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.07)"}" stroke-width="2"/>
        <path d="${TEE_PATH}" fill="none" stroke="rgba(0,0,0,.1)" stroke-width="1"/>
      </svg>`;
    },

    poster(seed, o) {
      const id = uid();
      return `<svg viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Poster mockup">
        <defs>
          <clipPath id="${id}c"><rect x="88" y="64" width="224" height="300"/></clipPath>
          <filter id="${id}s" x="-40%" y="-40%" width="200%" height="200%">
            <feDropShadow dx="6" dy="18" stdDeviation="16" flood-color="#0C0C0D" flood-opacity=".18"/>
          </filter>
        </defs>
        <rect width="400" height="480" fill="${o.bg || "#E8E5DE"}"/>
        <rect x="70" y="46" width="260" height="336" fill="#fff" filter="url(#${id}s)"/>
        ${nested(seed, 88, 64, 224, 300, id + "c")}
        <rect x="70" y="46" width="260" height="336" fill="none" stroke="rgba(0,0,0,.08)"/>
        <rect x="70" y="382" width="260" height="8" fill="#0C0C0D" opacity=".06"/>
      </svg>`;
    },

    mug(seed, o) {
      const id = uid();
      return `<svg viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mug mockup">
        <defs>
          <clipPath id="${id}c"><rect x="112" y="168" width="156" height="150"/></clipPath>
          <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#000" stop-opacity=".13"/><stop offset=".25" stop-color="#fff" stop-opacity=".5"/>
            <stop offset=".75" stop-color="#000" stop-opacity=".03"/><stop offset="1" stop-color="#000" stop-opacity=".16"/>
          </linearGradient>
        </defs>
        <rect width="400" height="480" fill="${o.bg || "#EDEAE3"}"/>
        <path d="M272,192 c56,0 56,104 0,104" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round"/>
        <path d="M272,192 c56,0 56,104 0,104" fill="none" stroke="rgba(0,0,0,.1)" stroke-width="26" stroke-linecap="round" opacity=".3"/>
        <rect x="100" y="140" width="180" height="212" rx="16" fill="#fff"/>
        ${nested(seed, 112, 168, 156, 150, id + "c")}
        <rect x="100" y="140" width="180" height="212" rx="16" fill="url(#${id}g)"/>
        <ellipse cx="190" cy="142" rx="90" ry="17" fill="#fff"/>
        <ellipse cx="190" cy="142" rx="90" ry="17" fill="none" stroke="rgba(0,0,0,.1)"/>
        <ellipse cx="190" cy="142" rx="78" ry="12" fill="#E7E3DA"/>
        <rect x="100" y="140" width="180" height="212" rx="16" fill="none" stroke="rgba(0,0,0,.09)"/>
      </svg>`;
    },

    phonecase(seed, o) {
      const id = uid();
      return `<svg viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Phone case mockup">
        <defs><clipPath id="${id}c"><rect x="122" y="42" width="156" height="396" rx="32"/></clipPath></defs>
        <rect width="400" height="480" fill="${o.bg || "#ECEAE4"}"/>
        <rect x="118" y="38" width="164" height="404" rx="36" fill="#0C0C0D" opacity=".1"/>
        ${nested(seed, 122, 42, 156, 396, id + "c")}
        <rect x="144" y="62" width="78" height="78" rx="24" fill="rgba(255,255,255,.5)" stroke="rgba(0,0,0,.1)"/>
        <circle cx="168" cy="86" r="14" fill="#1C1C1E"/><circle cx="168" cy="86" r="6" fill="#3A5470"/>
        <circle cx="200" cy="86" r="14" fill="#1C1C1E"/><circle cx="200" cy="86" r="6" fill="#3A5470"/>
        <circle cx="168" cy="118" r="14" fill="#1C1C1E"/><circle cx="168" cy="118" r="6" fill="#3A5470"/>
        <rect x="122" y="42" width="156" height="396" rx="32" fill="none" stroke="rgba(0,0,0,.14)" stroke-width="1.5"/>
      </svg>`;
    },

    sticker(seed, o) {
      const id = uid();
      return `<svg viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sticker mockup">
        <defs>
          <clipPath id="${id}c"><circle cx="200" cy="240" r="118"/></clipPath>
          <filter id="${id}s" x="-40%" y="-40%" width="200%" height="200%"><feDropShadow dx="3" dy="10" stdDeviation="10" flood-color="#0C0C0D" flood-opacity=".2"/></filter>
        </defs>
        <rect width="400" height="480" fill="${o.bg || "#EFEDE8"}"/>
        <circle cx="200" cy="240" r="132" fill="#fff" filter="url(#${id}s)"/>
        ${nested(seed, 82, 122, 236, 236, id + "c")}
        <circle cx="200" cy="240" r="118" fill="none" stroke="rgba(0,0,0,.06)"/>
        <circle cx="200" cy="240" r="132" fill="none" stroke="rgba(0,0,0,.07)"/>
      </svg>`;
    },

    card(seed, o) {
      const id = uid();
      return `<svg viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Business card mockup">
        <defs>
          <clipPath id="${id}c"><rect x="64" y="150" width="216" height="128" rx="5"/></clipPath>
          <filter id="${id}s" x="-40%" y="-40%" width="200%" height="200%"><feDropShadow dx="4" dy="12" stdDeviation="12" flood-color="#0C0C0D" flood-opacity=".18"/></filter>
        </defs>
        <rect width="400" height="480" fill="${o.bg || "#EAE7E0"}"/>
        <g transform="rotate(-8,200,240)">
          <rect x="110" y="216" width="216" height="128" rx="5" fill="#fff" filter="url(#${id}s)"/>
          <rect x="134" y="252" width="86" height="7" rx="3.5" fill="#0C0C0D" opacity=".8"/>
          <rect x="134" y="270" width="130" height="5" rx="2.5" fill="#0C0C0D" opacity=".28"/>
          <rect x="134" y="284" width="104" height="5" rx="2.5" fill="#0C0C0D" opacity=".18"/>
        </g>
        <g transform="rotate(6,200,240)">
          <rect x="64" y="150" width="216" height="128" rx="5" fill="#fff" filter="url(#${id}s)"/>
          ${nested(seed, 64, 150, 216, 128, id + "c")}
          <rect x="64" y="150" width="216" height="128" rx="5" fill="none" stroke="rgba(0,0,0,.08)"/>
        </g>
      </svg>`;
    },

    print3d(seed, o) {
      const id = uid();
      const p = paletteOf(seed);
      return `<svg viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="3D print mockup">
        <defs>
          <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".35" stop-color="#fff" stop-opacity=".28"/>
            <stop offset=".7" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".3"/>
          </linearGradient>
          <clipPath id="${id}c"><path d="M158,414 C112,368 116,286 148,236 C176,192 176,148 156,110 L244,110 C224,148 224,192 252,236 C284,286 288,368 242,414 Z"/></clipPath>
        </defs>
        <rect width="400" height="480" fill="${o.bg || "#EDEBE5"}"/>
        <ellipse cx="200" cy="422" rx="96" ry="16" fill="#0C0C0D" opacity=".1"/>
        <path d="M158,414 C112,368 116,286 148,236 C176,192 176,148 156,110 L244,110 C224,148 224,192 252,236 C284,286 288,368 242,414 Z" fill="${p.c[0]}"/>
        <g clip-path="url(#${id}c)" opacity=".5">
          ${Array.from({ length: 40 }, (_, i) => `<line x1="100" y1="${110 + i * 8}" x2="300" y2="${110 + i * 8}" stroke="#000" stroke-opacity=".14" stroke-width="1"/>`).join("")}
        </g>
        <path d="M158,414 C112,368 116,286 148,236 C176,192 176,148 156,110 L244,110 C224,148 224,192 252,236 C284,286 288,368 242,414 Z" fill="url(#${id}g)"/>
        <ellipse cx="200" cy="110" rx="44" ry="10" fill="${p.c[1] || "#0C0C0D"}" opacity=".85"/>
      </svg>`;
    }
  };

  function mockup(kind, seed, o) {
    const f = MOCKUPS[kind] || MOCKUPS.poster;
    return f(seed, o || {});
  }

  /* ---- avatars ---- */
  function avatar(seed) {
    const r = rng("av-" + seed);
    const p = PALETTES[Math.floor(r() * PALETTES.length)];
    const id = uid();
    const c1 = p.c[0], c2 = p.bg, c3 = p.c[1] || p.c[0];
    const t = Math.floor(r() * 4);
    let art = "";
    if (t === 0) art = `<circle cx="${rf(r, 20, 80).toFixed(0)}" cy="${rf(r, 20, 80).toFixed(0)}" r="${rf(r, 26, 46).toFixed(0)}" fill="${c3}"/>`;
    else if (t === 1) art = `<path d="M0,100 L100,0 L100,100 Z" fill="${c3}"/>`;
    else if (t === 2) art = `<rect x="0" y="${rf(r, 30, 60).toFixed(0)}" width="100" height="60" fill="${c3}"/>`;
    else art = `<path d="M0,50 A50,50 0 0 1 100,50 Z" fill="${c3}"/>`;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" fill="${c1}"/>${art}<circle cx="${rf(r, 30, 70).toFixed(0)}" cy="${rf(r, 30, 70).toFixed(0)}" r="${rf(r, 8, 18).toFixed(0)}" fill="${c2}"/></svg>`;
  }

  global.Art = { svg, mockup, avatar, paletteOf, inner, PALETTES, recipes: KEYS, rng };
})(window);
