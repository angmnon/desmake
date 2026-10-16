/* ============================================================
   DESMAKE — Shared UI kit (icons, chrome, behaviours)
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- Icons (lucide-flavoured, 24px stroke grid) ---------- */
  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    heart: '<path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    arrowRight: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
    arrowUpRight: '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
    arrowLeft: '<path d="M20 12H5"/><path d="M11 6l-6 6 6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    chevronLeft: '<path d="M15 6l-6 6 6 6"/>',
    sparkles: '<path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15.4l-1.6-4.6L6 9.2l4.4-1.6z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 4"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    truck: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    package: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M8 5.2l8 4.6M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 1z"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M17 5l2 2M14.5 7.5l2 2"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 9.5l3 2.5-3 2.5M13 15h4"/>',
    activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
    zap: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
    share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/>',
    download: '<path d="M12 3v12"/><path d="M7.5 11L12 15.5 16.5 11"/><path d="M4 20h16"/>',
    upload: '<path d="M12 16V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M4 20h16"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-.6 4"/><path d="M20 4v7h-7"/>',
    externalLink: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/>',
    factory: '<path d="M3 20V9l6 4V9l6 4V4h6v16z"/><path d="M7 16h2M13 16h2M18 16h1"/>',
    bag: '<path d="M5 7h14l1 13H4z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
    message: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
    more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    menu: '<path d="M3.5 7h17M3.5 12h17M3.5 17h17"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    dollar: '<path d="M12 3v18"/><path d="M16.5 7.5c-.7-1.6-2.4-2.5-4.5-2.5-2.5 0-4.5 1.2-4.5 3.4S9.5 11.5 12 12s4.5 1 4.5 3.3S14.5 19 12 19c-2.2 0-3.9-.9-4.6-2.6"/>',
    trendingUp: '<path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v5h-5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
    link: '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 1 0 5.7 5.7l1.3-1.3"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M4.5 15.5A2 2 0 0 1 3.5 14V5.5a2 2 0 0 1 2-2H14a2 2 0 0 1 1.5 1"/>',
    wand: '<path d="M4 20L16 8"/><path d="M15 3l.9 2.6L18.5 6.5l-2.6.9L15 10l-.9-2.6L11.5 6.5l2.6-.9z"/><path d="M6 4l.6 1.7L8.3 6.3l-1.7.6L6 8.6l-.6-1.7L3.7 6.3l1.7-.6z"/>',
    crop: '<path d="M6.5 2.5v15h15"/><path d="M2.5 6.5h15v15"/>',
    scissors: '<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/><path d="M8.5 8.5L20 19M20 5L8.5 15.5"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 2-1.8 0-1.6-1.6-1.7-1.6-3 0-.9.8-1.7 1.8-1.7h1.6A4.7 4.7 0 0 0 20.5 9c0-3.2-3.6-5.5-8.5-5.5z"/><circle cx="8" cy="10" r="1.1"/><circle cx="12" cy="7.5" r="1.1"/><circle cx="16" cy="10" r="1.1"/>',
    printer: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="7" rx="2"/><path d="M7 14h10v6.5H7z"/>',
    bookmark: '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
    users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16.5 5.2a3.4 3.4 0 0 1 0 5.6M18 20a6.4 6.4 0 0 0-2.2-4.8"/>',
    barChart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5A2.4 2.4 0 0 1 14.4 10c0 1.6-2.4 2-2.4 3.5M12 17h.01"/>',
    shirt: '<path d="M8 3l-4.5 2 1.5 4L7 8.5V21h10V8.5L19 9l1.5-4L16 3a4 4 0 0 1-8 0z"/>',
    frame: '<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><rect x="7.5" y="7" width="9" height="10"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 5.5h3"/>',
    sticker: '<path d="M14.5 3.5H7a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h6l7-7v-7a3 3 0 0 0-3-3z"/><path d="M13 20.5v-4a2.5 2.5 0 0 1 2.5-2.5h4"/>',
    sliders: '<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>',
    folder: '<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
    logout: '<path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9"/><path d="M15 8l4 4-4 4M19 12H9"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    undo: '<path d="M4 9h11a5 5 0 0 1 0 10h-4"/><path d="M8 5L4 9l4 4"/>',
    redo: '<path d="M20 9H9a5 5 0 0 0 0 10h4"/><path d="M16 5l4 4-4 4"/>'
  };

  function icon(name, size, sw) {
    const d = P[name] || P.info;
    return `<svg width="${size || 16}" height="${size || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }
  const iconFill = (name, size) => `<svg width="${size || 16}" height="${size || 16}" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">${P[name] || ""}</svg>`;

  /* ---------- Brand mark ---------- */
  const MARK = `<svg class="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M2 2h10a10 10 0 0 1 0 20H2z" fill="currentColor"/>
    <path d="M12 2a10 10 0 0 1 0 20z" fill="#FF4D18"/>
  </svg>`;

  /* ---------- Screens registry ---------- */
  const SCREENS = [
    { f: "index.html", t: "Home", d: "Marketplace landing" },
    { f: "explore.html", t: "Explore", d: "Search + filters" },
    { f: "listing.html", t: "Product Detail", d: "Listing & purchase" },
    { f: "creator.html", t: "Creator Profile", d: "Public portfolio" },
    { f: "studio.html", t: "Design Studio", d: "AI creation canvas" },
    { f: "publish.html", t: "Publish Flow", d: "D2M engine" },
    { f: "works.html", t: "My Works", d: "Creator library" },
    { f: "earnings.html", t: "Earnings", d: "Payouts & revenue" },
    { f: "agents.html", t: "Agent Hub", d: "Agent access center" },
    { f: "cart.html", t: "Cart", d: "Basket review" },
    { f: "checkout.html", t: "Checkout", d: "Payment flow" },
    { f: "orders.html", t: "Orders", d: "Purchase history" },
    { f: "order-detail.html", t: "Order Tracking", d: "Manufacturing timeline" },
    { f: "account.html", t: "Account", d: "Profile & settings" },
    { f: "notifications.html", t: "Notifications", d: "Message center" },
    { f: "auth.html", t: "Sign in", d: "Auth & onboarding" },
    { f: "admin.html", t: "Admin Console", d: "Operations backend" },
    { f: "styleguide.html", t: "Design System", d: "Tokens & components" }
  ];

  /* ---------- Header ---------- */
  function header(active, opts) {
    opts = opts || {};
    const links = [
      { f: "explore.html", t: "Explore" },
      { f: "studio.html", t: "Studio" },
      { f: "agents.html", t: "Agent Hub" },
      { f: "works.html", t: "Sell" }
    ];
    return `<header class="nav">
      <div class="container-wide nav-inner">
        <a class="brand" href="index.html">${MARK}<span class="brand-tx">DESMAKE</span></a>
        <nav class="nav-links">
          ${links.map((l) => `<a class="nav-link${active === l.f ? " is-active" : ""}" href="${l.f}">${l.t}</a>`).join("")}
        </nav>
        <a class="nav-search" href="explore.html">${icon("search", 15)}<span>Search designs, creators, products</span><kbd>⌘K</kbd></a>
        <div class="nav-actions">
          <a class="icon-btn hide-sm" href="notifications.html" aria-label="Notifications">${icon("bell", 17)}<i class="nub"></i></a>
          <a class="icon-btn" href="cart.html" aria-label="Cart">${icon("cart", 17)}<i class="nub"></i></a>
          <a class="btn btn-sm hide-sm" href="studio.html">${icon("sparkles", 14)} Create</a>
          <a href="account.html" class="av av-sm" aria-label="Account" style="margin-left:4px">${Art.avatar("me-desmake")}</a>
        </div>
      </div>
    </header>`;
  }

  /* ---------- Footer ---------- */
  function footer() {
    const cols = [
      { t: "Marketplace", l: ["Explore", "Trending", "New arrivals", "AI Picks", "Collections", "Gift cards"] },
      { t: "Create", l: ["Design Studio", "Upload work", "Publish flow", "Creator handbook", "Pricing guide"] },
      { t: "Platform", l: ["Agent Hub", "MCP server", "REST API", "Manufacturing network", "Status", "Changelog"] },
      { t: "Company", l: ["About", "Careers", "Press", "Sustainability", "Contact"] }
    ];
    return `<footer class="foot">
      <div class="container-wide">
        <div class="grid" style="grid-template-columns:minmax(0,1.4fr) repeat(4,minmax(0,1fr));gap:40px">
          <div class="stack gap-20">
            <div class="row gap-8">${MARK}<span class="brand-tx">DESMAKE</span></div>
            <p class="body" style="color:var(--tx-inv-2);max-width:30ch">The AI native design marketplace. Design once, manufacture anywhere.</p>
            <div class="stack gap-8" style="max-width:280px">
              <label class="eyebrow" for="nl">Dispatch — weekly</label>
              <div class="row gap-8">
                <input id="nl" class="input input-ink input-sm" placeholder="you@studio.com"/>
                <button class="btn btn-paper btn-sm" style="flex:none">Join</button>
              </div>
            </div>
          </div>
          ${cols.map((c) => `<div class="foot-col"><div class="foot-col-t">${c.t}</div><ul>${c.l.map((x) => `<li><a href="#">${x}</a></li>`).join("")}</ul></div>`).join("")}
        </div>
        <div class="foot-word center" style="margin-top:clamp(40px,6vw,80px)">DESMAKE</div>
        <div class="hr-ink"></div>
        <div class="row-between wrap" style="padding:20px 0 26px">
          <div class="row gap-16 wrap mono" style="color:var(--tx-inv-3)">
            <span>© 2026 Desmake Inc.</span><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Cookies</a><a href="#">DMCA</a>
          </div>
          <div class="row gap-16 mono" style="color:var(--tx-inv-3)">
            <span class="row gap-6">${icon("globe", 13)} English · USD</span>
            <span class="row gap-6"><i class="dot dot-live"></i> All systems operational</span>
          </div>
        </div>
      </div>
    </footer>`;
  }

  /* ---------- Work tile ---------- */
  function work(d, opts) {
    opts = opts || {};
    const c = DB.creatorByHandle(d.creator);
    const ad = DB.adapterById(d.adapters[0]);
    const media = opts.mockup ? Art.mockup(ad.mockup, d.seed, {}) : Art.svg(d.seed);
    return `<a class="work" href="listing.html">
      <div class="work-media"${opts.ratio ? ` style="aspect-ratio:${opts.ratio}"` : ""}>
        ${media}
        <div class="work-top">
          <span>${d.aiGenerated ? `<span class="pill-glass">${icon("sparkles", 12)} AI</span>` : ""}</span>
          ${d.new ? '<span class="pill-glass pill-glass-dark">New</span>' : ""}
        </div>
        <div class="work-float">
          <span class="pill-glass">${d.adapters.length} products</span>
          <span class="pill-glass">${icon("heart", 12)} ${DB.compact(d.likes)}</span>
        </div>
      </div>
      <div class="work-meta">
        <div>
          <div class="work-title">${d.title}</div>
          <div class="work-sub row gap-6">${c.name}${c.verified ? `<span class="verified">${iconFill("check", 0)}</span>` : ""}</div>
        </div>
        <div class="work-price">${DB.money(d.priceCents)}</div>
      </div>
    </a>`;
  }

  /* ---------- Prototype launcher ---------- */
  function protoNav() {
    const here = location.pathname.split("/").pop() || "index.html";
    return `<button class="proto-fab" id="protoFab">${icon("grid", 14)} Screens <span class="mono" style="opacity:.5">${SCREENS.length}</span></button>
    <div class="proto-ov" id="protoOv">
      <div class="proto-card">
        <div class="row-between" style="margin-bottom:22px">
          <div>
            <div class="eyebrow eyebrow-dot">Prototype map</div>
            <div class="h2" style="margin-top:8px">All screens</div>
          </div>
          <button class="btn btn-outline btn-icon" id="protoClose" aria-label="Close">${icon("x", 16)}</button>
        </div>
        <div class="proto-grid">
          ${SCREENS.map((s) => `<a class="proto-item" href="${s.f}" ${s.f === here ? 'style="border-color:var(--ink)"' : ""}><b>${s.t}</b><span>${s.d}</span></a>`).join("")}
        </div>
      </div>
    </div>`;
  }

  /* ---------- Behaviours ---------- */
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches && window.matchMedia("(hover: hover)").matches;

  function reveal() {
    const els = document.querySelectorAll(".rv, .rv-blur");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en, i) => {
        if (en.isIntersecting) {
          const el = en.target;
          const delay = parseFloat(el.dataset.d || 0);
          setTimeout(() => el.classList.add("in"), delay * 1000);
          io.unobserve(el);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    els.forEach((e) => io.observe(e));
  }

  /* Scroll progress bar */
  function scrollProgress() {
    if (prefersReduced) return;
    const bar = document.createElement("div");
    bar.className = "rx-progress";
    document.body.appendChild(bar);
    let ticking = false;
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? (h.scrollTop || window.scrollY) / max : 0) + ")";
      bar.classList.add("on");
      ticking = false;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
  }

  /* Desktop cursor glow */
  function cursorGlow() {
    if (prefersReduced || !finePointer) return;
    const g = document.createElement("div");
    g.className = "cursor-glow";
    g.style.cssText = "position:fixed;top:0;left:0;width:420px;height:420px;border-radius:50%;pointer-events:none;z-index:80;opacity:0;mix-blend-mode:multiply;background:radial-gradient(circle, rgba(255,77,24,.055) 0%, rgba(34,68,255,.035) 45%, transparent 70%);transform:translate3d(-50%,-50%,0);transition:opacity .5s var(--e);";
    document.body.appendChild(g);
    let tx = -9999, ty = -9999, raf = null;
    const move = (e) => {
      tx = e.clientX; ty = e.clientY;
      if (g.style.opacity === "0") g.style.opacity = "1";
      if (!raf) raf = requestAnimationFrame(() => { g.style.transform = "translate3d(" + tx + "px," + ty + "px,0) translate(-50%,-50%)"; raf = null; });
    };
    const leave = () => { g.style.opacity = "0"; };
    window.addEventListener("mousemove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
  }

  /* 3D tilt on [data-tilt] elements (event delegation) */
  function tilt3d() {
    if (prefersReduced || !finePointer) return;
    document.addEventListener("mousemove", (e) => {
      const el = e.target.closest("[data-tilt]");
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tyr", (px * 5).toFixed(2) + "deg");
      el.style.setProperty("--txr", (-py * 5).toFixed(2) + "deg");
    }, { passive: true });
  }

  /* Count-up numbers: <span data-count="128400">…</span>, optional data-dec / data-dur */
  function countUp() {
    const els = document.querySelectorAll("[data-count]");
    if (!els.length) return;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      els.forEach((el) => { el.textContent = el.dataset.count; });
      return;
    }
    const fmt = (v, dec) => {
      const s = dec > 0 ? v.toFixed(dec) : Math.round(v).toString();
      return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const target = parseFloat(el.dataset.count);
        const dec = parseInt(el.dataset.dec || "0", 10);
        const dur = parseFloat(el.dataset.dur || "1.2") * 1000;
        const t0 = performance.now();
        const step = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - p, 4);
          el.textContent = fmt(target * e, dec);
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = fmt(target, dec);
        };
        requestAnimationFrame(step);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    els.forEach((el) => io.observe(el));
  }

  /* SplitText: [data-split] splits by <br> into masked lines that rise in */
  function splitText() {
    const targets = document.querySelectorAll("[data-split]");
    if (!targets.length) return;
    if (prefersReduced) return;
    targets.forEach((el) => {
      if (el.dataset.splitDone) return;
      el.dataset.splitDone = "1";
      const parts = el.innerHTML.split(/<br\s*\/?>/i);
      const lines = parts.map((p) => {
        const inner = p.trim();
        if (!inner) return "";
        return `<span class="split-line"><span class="split-inner">${inner}</span></span>`;
      }).filter(Boolean);
      el.innerHTML = lines.join("");
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        el.querySelectorAll(".split-line").forEach((ln, i) => {
          setTimeout(() => ln.classList.add("in"), 60 + i * 120);
        });
      }, { rootMargin: "0px 0px -6% 0px" });
      io.observe(el);
    });
  }

  /* Parallax: [data-parallax] moves on scroll with rate from data-rate (default -0.08) */
  function parallax() {
    if (prefersReduced) return;
    const els = Array.from(document.querySelectorAll("[data-parallax]"));
    if (!els.length) return;
    let ticking = false;
    const update = () => {
      const sy = window.scrollY || window.pageYOffset;
      els.forEach((el) => {
        const rate = parseFloat(el.dataset.rate || "-0.08");
        el.style.transform = "translate3d(0," + (sy * rate).toFixed(1) + "px,0)";
      });
      ticking = false;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
  }

  /* MPA page transitions (intercept internal links) */
  function pageTransitions() {
    if (prefersReduced) return;
    const html = document.documentElement;
    html.classList.add("dm-entering");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      html.classList.remove("dm-entering");
      html.classList.add("dm-entered");
    }));
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || a.target === "_blank" || a.hasAttribute("download")) return;
      if (a.hasAttribute("data-fly-to-cart")) return; /* fly-to-cart handles its own navigation */
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      html.classList.remove("dm-entered");
      html.classList.add("dm-leaving");
      setTimeout(() => { location.href = url.href; }, 170);
    });
  }

  /* Terminal typewriter: [data-type] — reveals its pre-formatted HTML line by line */
  function typewriter() {
    const t = document.querySelector("[data-type]");
    if (!t || prefersReduced || !("IntersectionObserver" in window)) return;
    const source = t.innerHTML;
    const lines = source.split("\n");
    t.innerHTML = "";
    let li = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const tick = () => {
        if (li >= lines.length) return;
        t.innerHTML += (li === 0 ? "" : "\n") + lines[li];
        li++;
        setTimeout(tick, 110 + Math.random() * 80);
      };
      setTimeout(tick, 300);
    }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(t);
  }

  /* Fly-to-cart: [data-fly-to-cart] clones [data-fly-src] to the header cart icon */
  function flyToCart() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fly-to-cart]");
      if (!btn || prefersReduced) return;
      e.preventDefault();
      const src = btn.hasAttribute("data-fly-src") ? document.querySelector(btn.dataset.flySrc) : btn.querySelector("svg, img");
      if (!src) return;
      const cart = document.querySelector(".nav-actions .icon-btn[href*='cart']");
      if (!cart) return;
      const clone = src.cloneNode(true);
      clone.style.cssText = "position:fixed;z-index:500;width:56px;height:68px;border-radius:10px;overflow:hidden;pointer-events:none;margin:0;background:var(--surface);box-shadow:var(--sh-3);";
      const sr = src.getBoundingClientRect();
      const cr = cart.getBoundingClientRect();
      clone.style.left = sr.left + "px"; clone.style.top = sr.top + "px";
      document.body.appendChild(clone);
      const dx = cr.left + cr.width / 2 - (sr.left + sr.width / 2);
      const dy = cr.top + cr.height / 2 - (sr.top + sr.height / 2);
      clone.animate([
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: "translate(" + dx * 0.55 + "px," + (dy - 120) + "px) scale(0.55)", opacity: 0.85, offset: 0.55 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(0.12)", opacity: 0.25 }
      ], { duration: 720, easing: "cubic-bezier(.22,1,.36,1)" }).onfinish = () => clone.remove();
      const nub = cart.querySelector(".nub, .cnt, .badge");
      if (nub && nub.classList) { nub.classList.remove("badge-pop"); void nub.offsetWidth; nub.classList.add("badge-pop"); }
      /* navigate after the animation for <a> buttons */
      if (btn.tagName === "A" && btn.getAttribute("href")) {
        setTimeout(() => { location.href = btn.getAttribute("href"); }, 760);
      }
    });
  }

  function interactions() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-toggle]");
      if (t) {
        const cls = t.dataset.toggle;
        t.classList.toggle(cls);
        e.preventDefault();
      }
      const tab = e.target.closest("[data-tab]");
      if (tab) {
        const grp = tab.closest("[data-tabs]");
        if (grp) {
          grp.querySelectorAll("[data-tab]").forEach((x) => x.classList.remove("is-active"));
          tab.classList.add("is-active");
          const panelSet = document.querySelector(`[data-panels="${grp.dataset.tabs}"]`);
          if (panelSet) {
            panelSet.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("hide", p.dataset.panel !== tab.dataset.tab));
          }
        }
        e.preventDefault();
      }
      const sw = e.target.closest(".switch");
      if (sw) sw.classList.toggle("is-on");
      const ck = e.target.closest(".check");
      if (ck) ck.classList.toggle("is-on");
      const chip = e.target.closest("[data-chipgroup] .chip");
      if (chip) {
        const g = chip.closest("[data-chipgroup]");
        if (g.dataset.chipgroup === "single") g.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.toggle("is-active");
      }
      const seg = e.target.closest(".seg button");
      if (seg) {
        seg.parentElement.querySelectorAll("button").forEach((b) => b.classList.remove("is-active"));
        seg.classList.add("is-active");
      }
      const opt = e.target.closest("[data-optgroup] .opt");
      if (opt) {
        const g = opt.closest("[data-optgroup]");
        if (g.dataset.optgroup === "single") g.querySelectorAll(".opt").forEach((o) => { o.classList.remove("is-on"); const r = o.querySelector(".radio"); if (r) r.classList.remove("is-on"); });
        opt.classList.toggle("is-on");
        const r = opt.querySelector(".radio, .check");
        if (r) r.classList.toggle("is-on", opt.classList.contains("is-on"));
      }
      /* Heart / like pop */
      const heart = e.target.closest("[data-heart]");
      if (heart && !prefersReduced) {
        const ico = heart.classList.contains("pop-ico") ? heart : heart.querySelector(".pop-ico, svg");
        if (ico) {
          ico.classList.remove("popping"); void ico.offsetWidth; ico.classList.add("popping");
          const n = heart.querySelector("[data-heart-count]");
          if (n) {
            const cur = parseInt(n.textContent.replace(/[^\d]/g, "") || "0", 10);
            const liked = heart.getAttribute("aria-pressed") === "true";
            n.textContent = (liked ? cur - 1 : cur + 1).toString();
            heart.setAttribute("aria-pressed", liked ? "false" : "true");
          }
        }
      }
      /* Segmented active pop */
      const segBtn = e.target.closest(".seg button");
      if (segBtn && !prefersReduced) {
        segBtn.classList.remove("seg-pop"); void segBtn.offsetWidth; segBtn.classList.add("seg-pop");
      }
    });
  }

  /* ---------- Auto-fix: replace stray icon template literals in DOM ---------- */
  function fixIconLiterals() {
    /* Fix text nodes */
    const re = /\$\{(?:UI\.icon|I|icon)\(\s*["']([^"']+)["']\s*(?:,\s*(\d+))?(?:,\s*([\d.]+))?\s*\)}\}/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while (n = walker.nextNode()) if (re.test(n.nodeValue)) nodes.push(n);
    nodes.forEach((node) => {
      re.lastIndex = 0;
      node.nodeValue = node.nodeValue.replace(re, (_, name, sz, sw) => {
        const el = document.createElement("span");
        el.innerHTML = icon(name, parseInt(sz) || 16, sw ? parseFloat(sw) : undefined);
        return el.innerHTML;
      });
    });
    /* Fix attribute values (style=, title=, etc.) */
    const attrRe = /\$\{(?:UI\.icon|I|icon)\(\s*["']([^"']+)["']\s*(?:,\s*(\d+))?\s*\)/g;
    document.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes || []).forEach((attr) => {
        if (attrRe.test(attr.value)) {
          attrRe.lastIndex = 0;
          attr.value = attr.value.replace(attrRe, "");
        }
      });
    });
  }

  function mount(opts) {
    opts = opts || {};
    const h = document.getElementById("app-header");
    if (h) h.outerHTML = header(opts.active || "", opts);
    const f = document.getElementById("app-footer");
    if (f) f.outerHTML = footer();
    document.body.insertAdjacentHTML("beforeend", protoNav());
    const fab = document.getElementById("protoFab"), ov = document.getElementById("protoOv");
    fab.addEventListener("click", () => ov.classList.add("on"));
    document.getElementById("protoClose").addEventListener("click", () => ov.classList.remove("on"));
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.remove("on"); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") ov.classList.remove("on");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ov.classList.toggle("on"); }
    });
    reveal();
    interactions();
    fixIconLiterals();
    scrollProgress();
    cursorGlow();
    tilt3d();
    countUp();
    pageTransitions();
    typewriter();
    flyToCart();
    splitText();
    parallax();
  }

  global.UI = { icon, iconFill, MARK, header, footer, work, mount, reveal, SCREENS, protoNav };
})(window);
