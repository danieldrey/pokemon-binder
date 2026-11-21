/* Daniel’s Binder — English share album.
   One continuous book: cover → contents → each set divider + pages → back.
   Portrait: a single full-size binder page. Landscape/desktop: a two-page spread.
*/
const B = window.BINDER || {};
const LS_WANT = "nextpull-wishlist";
const LS_SOUND = "nextpull-album-sound";

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const shekel = (n, d = 2) => n == null ? "—" :
  "₪" + Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const usd = (n) => n == null ? "" :
  "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: n >= 10 ? 0 : 2 });
const money = (ils, dollars) => ils == null ? "—" : `${shekel(ils)}${dollars != null ? " (" + usd(dollars) + ")" : ""}`;

function valueLabel(v) {
  if (!v || v.ils == null) return "No price";
  if (v.is_range && v.ils_low != null) {
    const dol = (v.usd_low != null && v.usd_high != null) ? ` (${usd(v.usd_low)}–${usd(v.usd_high)})` : "";
    return `${shekel(v.ils_low)}–${shekel(v.ils_high).replace("₪", "")}${dol}`;
  }
  return money(v.ils, v.usd);
}

function loadWanted() {
  const set = new Set((B.wishlist || []).map(w => w.id));
  try { JSON.parse(localStorage.getItem(LS_WANT) || "[]").forEach(id => set.add(id)); } catch (e) {}
  return set;
}
function saveWanted(set) { try { localStorage.setItem(LS_WANT, JSON.stringify([...set])); } catch (e) {} }
let wanted = loadWanted();
let soundOn = false;
try { soundOn = localStorage.getItem(LS_SOUND) === "on"; } catch (e) {}

const LS_ADDS = "nextpull-pack-adds";
let byId = new Map();
let allById = new Map();
function refreshIndexes() {
  byId = new Map((B.cards || []).map(c => [c.id, c]));
  allById = new Map();
  (B.sets || []).forEach(s => (s.cards || []).forEach(c => { if (c && c.id) allById.set(c.id, c); }));
}
refreshIndexes();
function enrich(c) {
  if (!c) return c;
  const extra = byId.get(c.id);
  return extra ? Object.assign({}, c, extra, { owned: true }) : c;
}
function cardById(id) {
  if (!id) return null;
  const owned = byId.get(id);
  if (owned) return enrich(owned);
  return allById.get(id) || null;
}
function allMissing() {
  const out = [];
  (B.sets || []).forEach(s => (s.cards || []).forEach(c => { if (c && !c.owned) out.push(c); }));
  return out;
}

function useSpread() {
  const w = window.innerWidth || document.documentElement.clientWidth || 0;
  const h = window.innerHeight || document.documentElement.clientHeight || 0;
  // Phone portrait must never be a two-page spread — pages would be unreadably small.
  const portrait = h >= w;
  if (portrait && w < 900) return false;
  return w >= 800;
}

function featuredCards() {
  return topHits(3);
}

function cardValueIls(c) {
  return (c && c.value && c.value.ils != null) ? Number(c.value.ils) : -1;
}

function topHits(n = 12) {
  return (B.cards || [])
    .filter(c => c.art && cardValueIls(c) >= 0)
    .sort((a, b) => cardValueIls(b) - cardValueIls(a) || (b.quantity || 1) - (a.quantity || 1))
    .slice(0, n);
}

function rarityLabel(c) {
  const r = (c && c.rarity) || "";
  const map = {
    "Illustration rare": "IR",
    "Special illustration rare": "SAR",
    "Ultra Rare": "UR",
    "Double rare": "ex",
    "Pikachu Rare": "Pikachu Rare",
    "RGB Rare": "RGB",
    "Mega Hyper Rare": "MHR",
    "Hyper Rare": "HR",
    "Art Rare": "AR",
    "Super Rare": "SR",
  };
  return map[r] || r;
}

/* ---------- page model: one continuous album ---------- */
let albumPages = [];
let setStarts = {}; // set id -> page index of its divider
let cardStarts = {}; // card id -> page index of its grid page
let hitsPageIndex = 1;

function buildAlbumPages() {
  const pages = [];
  const sets = B.sets || [];
  setStarts = {};
  cardStarts = {};
  pages.push({ type: "cover" });
  hitsPageIndex = pages.length;
  pages.push({ type: "hits", cards: topHits(9) });
  pages.push({ type: "index" });
  sets.forEach(set => {
    setStarts[set.id] = pages.length;
    pages.push({ type: "divider", set });
    const cards = set.cards || [];
    let n = 1;
    for (let i = 0; i < cards.length; i += 9) {
      const chunk = cards.slice(i, i + 9);
      const idx = pages.length;
      chunk.forEach(c => { if (c && c.id && cardStarts[c.id] == null) cardStarts[c.id] = idx; });
      pages.push({
        type: "grid",
        set,
        pageNo: n,
        pagesInSet: Math.ceil(cards.length / 9) || 1,
        from: i + 1,
        to: i + chunk.length,
        cards: chunk
      });
      n++;
    }
  });
  pages.push({ type: "back" });
  return pages;
}

function cardArt(c, wantHigh) {
  if (!c) return "";
  if (wantHigh) return c.art_high || c.art || "";
  return c.art || c.art_high || "";
}

function cardImg(c, alt, eager, big) {
  const high = cardArt(c, true);
  const base = cardArt(c, false);
  const primary = (big ? (high || base) : (base || high)) || "";
  const srcAttr = eager
    ? `src="${escapeHtml(primary)}"`
    : `data-src="${escapeHtml(primary)}" src=""`;
  let srcsetAttr = "";
  if (high && high !== primary) {
    srcsetAttr = eager ? ` srcset="${escapeHtml(high)} 2x"` : ` data-srcset="${escapeHtml(high)} 2x"`;
  } else if (high && eager) {
    srcsetAttr = ` srcset="${escapeHtml(high)} 2x"`;
  }
  return `<div class="card${big ? " big" : ""}" title="${escapeHtml(alt || "")}">
    <div class="face"><img ${srcAttr}${srcsetAttr} alt="${escapeHtml(alt || "")}" decoding="async" loading="${eager ? "eager" : "lazy"}"></div>
    <div class="edge"></div>
  </div>`;
}

function storageChips(c) {
  let s = "";
  if (c.toploader) s += `<span class="chip">Toploader</span>`;
  if (c.sleeve) s += `<span class="chip">Sleeve</span>`;
  return s;
}

function pocketEl(c, opts) {
  const wrap = document.createElement("div");
  const card = enrich(c);
  const owned = !!(card && card.owned);
  const rank = opts && opts.rank;
  wrap.className = "pocket " + (owned ? "owned" : "missing") + (card && card.art ? "" : " ghost");
  wrap.dataset.id = (card && card.id) || "";
  if (rank) wrap.dataset.rank = String(rank);
  if (owned || (card && card.art)) wrap.setAttribute("role", "button");
  const name = escapeHtml((card && card.name) || "");
  const num = escapeHtml((card && card.number) || "");
  const badge = rank ? `<span class="rank" aria-label="Rank ${rank}">${rank}</span>` : "";
  if (owned) {
    wrap.innerHTML = `
      ${badge}
      <div class="persp">${cardImg(card, card.name, false, false)}</div>
      <div class="meta">
        <span class="en">${name}</span>
        <small>${num}${card.quantity > 1 ? " · ×" + card.quantity : ""}</small>
        <div class="val">${valueLabel(card.value)}</div>
        ${storageChips(card)}
      </div>`;
  } else if (card && card.art) {
    const star = wanted.has(card.id) ? "★" : "☆";
    wrap.innerHTML = `
      <div class="persp">${cardImg(card, card.name, false, false)}</div>
      <div class="meta">
        <span class="en">${name}</span>
        <small>${num}</small>
        <div class="val">${valueLabel(card.value)}</div>
      </div>
      <button type="button" class="want-btn" title="Mark as wanted" aria-label="Mark as wanted">${star}</button>`;
    if (wanted.has(card.id)) wrap.classList.add("wanted-pocket");
  } else {
    wrap.innerHTML = `<div class="meta"><span class="en">${name || "—"}</span><small>${num}</small></div>`;
  }
  return wrap;
}

function fillPage(el, page) {
  el.innerHTML = "";
  const inner = document.createElement("div");
  inner.className = "page-inner";

  if (!page || page.type === "back") {
    el.classList.add("back");
    inner.innerHTML = `<div class="hero">
      <img class="logo" src="logo.png" alt="">
      <p class="kicker">Next Pull IL</p>
      <h2>That’s the album — for now.</h2>
      <p class="tagline">Loose cards still in the box will land here once they’re photographed.</p>
    </div>`;
    el.appendChild(inner);
    return;
  }

  if (page.type === "cover") {
    const T = B.totals || {};
    const sets = (B.sets || []).length;
    const fan = featuredCards();
    inner.innerHTML = `<div class="hero">
      <img class="logo" src="logo.png" alt="Next Pull IL">
      <p class="kicker">Next Pull IL</p>
      <h2>Daniel’s Binder</h2>
      <div class="count">${T.unique || 0} cards · ${sets} sets</div>
      <div class="value">${money(T.ils, T.usd)}</div>
      <div class="fan">${fan.map(c => cardImg(c, c.name, true, false)).join("")}</div>
      <p class="hint">Turn the page</p>
    </div>`;
    el.appendChild(inner);
    return;
  }

  if (page.type === "hits") {
    const cards = page.cards || topHits(9);
    const sum = cards.reduce((s, c) => s + Math.max(0, cardValueIls(c)) * (c.quantity || 1), 0);
    inner.innerHTML = `<div class="page-label">
      <span>Top Hits</span>
      <span class="num">Most valuable · ${money(sum)}</span>
    </div>`;
    const grid = document.createElement("div");
    grid.className = "grid-3";
    for (let i = 0; i < 9; i++) {
      const c = cards[i];
      if (!c) {
        const e = document.createElement("div");
        e.className = "pocket empty-slot";
        grid.appendChild(e);
      } else grid.appendChild(pocketEl(c, { rank: i + 1 }));
    }
    inner.appendChild(grid);
    el.appendChild(inner);
    return;
  }

  if (page.type === "index") {
    const items = (B.sets || []).map((s, i) => {
      const val = s.value_ils != null ? money(s.value_ils, s.value_usd) : "";
      return `<li><button type="button" data-jump="${escapeHtml(s.id)}">
        <span class="frac">${String(i + 1).padStart(2, "0")}</span>
        <span class="nm"><b>${escapeHtml(s.name || s.id)}</b><span>${s.owned || 0} of ${s.total || 0} · ${s.pct || 0}%</span></span>
        <span class="frac">${escapeHtml(val)}</span>
      </button></li>`;
    }).join("");
    inner.innerHTML = `<div class="toc-page">
      <h2>Contents</h2>
      <ol>${items}</ol>
    </div>`;
    el.appendChild(inner);
    return;
  }

  if (page.type === "divider") {
    const s = page.set;
    inner.innerHTML = `<div class="hero">
      ${s.logo ? `<img class="set-logo" src="${escapeHtml(s.logo)}" alt="">` : `<p class="kicker">Set</p>`}
      <h2>${escapeHtml(s.name || "")}</h2>
      <div class="count">${s.owned || 0} <span style="opacity:.6">/</span> ${s.total || 0}</div>
      <div class="bar"><i style="width:${Math.min(100, s.pct || 0)}%"></i></div>
      <div class="value">${s.value_ils != null ? money(s.value_ils, s.value_usd) : ""}</div>
      <p class="tagline">${s.pct || 0}% complete</p>
    </div>`;
    el.appendChild(inner);
    return;
  }

  // grid
  const s = page.set || {};
  inner.innerHTML = `<div class="page-label">
    <span>${escapeHtml(s.name || "")}</span>
    <span class="num">${page.from}–${page.to} · p. ${page.pageNo}/${page.pagesInSet}</span>
  </div>`;
  const grid = document.createElement("div");
  grid.className = "grid-3";
  for (let i = 0; i < 9; i++) {
    const c = page.cards[i];
    if (!c) {
      const e = document.createElement("div");
      e.className = "pocket empty-slot";
      grid.appendChild(e);
    } else grid.appendChild(pocketEl(c));
  }
  inner.appendChild(grid);
  el.appendChild(inner);
}

function makePageEl(page, i, last) {
  const el = document.createElement("div");
  const hard = page.type === "cover" || page.type === "back" || i === 0 || i === last;
  el.className = "stf-page sheet " + (page.type || "");
  if (hard) el.dataset.density = "hard";
  fillPage(el, page);
  if (i < 6) {
    el.querySelectorAll("img[data-src]").forEach(img => { img.src = img.dataset.src; if (img.dataset.srcset) img.srcset = img.dataset.srcset; });
  }
  return el;
}

/* ---------- layout & StPageFlip ---------- */
let pageFlip = null;

function bookSize() {
  const hud = document.querySelector(".hud");
  const dock = document.querySelector(".dock");
  const w = window.innerWidth || document.documentElement.clientWidth;
  const h = window.innerHeight || document.documentElement.clientHeight;
  const chrome = (hud ? hud.offsetHeight : 58) + (dock ? dock.offsetHeight : 46) + 8;
  const availW = Math.max(260, w - 8);
  const availH = Math.max(320, h - chrome);
  const spread = useSpread();
  const aspect = 0.70; // width / height of one binder page
  let pageW, pageH;
  if (spread) {
    pageW = Math.min(560, Math.floor(availW / 2) - 2);
    pageH = Math.floor(pageW / aspect);
    if (pageH > availH) { pageH = availH; pageW = Math.floor(pageH * aspect); }
  } else {
    // Fill the phone: almost full width, as tall as the 3×3 page wants.
    pageW = Math.min(availW - 6, Math.floor(availH * aspect));
    pageH = Math.min(availH, Math.floor(pageW / aspect));
    if (pageH > availH) { pageH = availH; pageW = Math.floor(pageH * aspect); }
  }
  return { pageW: Math.max(200, pageW), pageH: Math.max(280, pageH), spread };
}

function destroyBook() {
  if (pageFlip) {
    try { pageFlip.destroy(); } catch (e) {}
    pageFlip = null;
  }
  const host = $("bookHost");
  if (host) host.innerHTML = '<div id="book"></div>';
}

function hydrateAround(index) {
  const host = $("bookHost");
  if (!host) return;
  const items = host.querySelectorAll(".stf__item, .stf-page");
  const lo = Math.max(0, index - 2), hi = index + 3;
  const load = (node) => {
    if (!node) return;
    node.querySelectorAll("img[data-src]").forEach(img => {
      if (!img.getAttribute("src")) img.src = img.dataset.src; if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    });
  };
  for (let i = lo; i <= hi; i++) load(items[i] || null);
  // also hydrate cover fan (already eager) and any clone StPageFlip may have made
  const idle = () => {
    items.forEach((n, i) => { if (i < lo || i > hi) load(n); });
  };
  if (window.requestIdleCallback) requestIdleCallback(idle, { timeout: 2500 });
  else setTimeout(idle, 400);
}

function pageTitle(p) {
  if (!p) return "";
  if (p.type === "cover") return "Cover";
  if (p.type === "back") return "Back cover";
  if (p.type === "hits") return "Top Hits";
  if (p.type === "index") return "Contents";
  if (p.type === "divider") return (p.set && p.set.name) || "Set";
  if (p.type === "grid") return `${(p.set && p.set.name) || ""} · p. ${p.pageNo}`;
  return "";
}

function updatePager() {
  if (!pageFlip) return;
  const i = pageFlip.getCurrentPageIndex();
  const n = pageFlip.getPageCount();
  const mode = pageFlip.getOrientation && pageFlip.getOrientation();
  const spread = mode !== "portrait" && useSpread();
  const atStart = i <= 0, atEnd = i >= n - 1;
  ["pagePrev","dockPrev"].forEach(id => { if ($(id)) $(id).disabled = atStart; });
  ["pageNext","dockNext"].forEach(id => { if ($(id)) $(id).disabled = atEnd; });
  const left = pageTitle(albumPages[i]);
  const right = spread ? pageTitle(albumPages[i + 1]) : "";
  const label = right ? `${left}  —  ${right}` : left;
  if ($("pageCounter")) $("pageCounter").textContent = `${label}  ·  ${i + 1} / ${n}`;
  document.body.classList.toggle("portrait-book", !spread);
  document.body.classList.toggle("landscape-book", spread);
  hydrateAround(i);
}

function playFlipSound() {
  if (!soundOn) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!playFlipSound.ctx) playFlipSound.ctx = new AC();
    const ctx = playFlipSound.ctx;
    if (ctx.state === "suspended") ctx.resume();
    const len = Math.floor(ctx.sampleRate * 0.16);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / len * 7);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
  } catch (e) {}
}

function buildRings() {
  const box = $("binderRings");
  if (!box) return;
  box.innerHTML = "";
  for (let i = 0; i < 8; i++) box.appendChild(document.createElement("i"));
}

function mountBook(startPage) {
  if (typeof St === "undefined" || !St.PageFlip) {
    $("bookHost").innerHTML = "<p class='hero tagline'>The page-flip library failed to load.</p>";
    return;
  }
  destroyBook();
  const pages = albumPages.map((p, i) => makePageEl(p, i, albumPages.length - 1));
  const book = $("book");
  pages.forEach(p => book.appendChild(p));
  const { pageW, pageH, spread } = bookSize();
  const host = $("bookHost");
  if (host) {
    host.style.width = (spread ? pageW * 2 : pageW) + "px";
    host.style.maxWidth = "100%";
  }
  document.body.classList.toggle("portrait-book", !spread);
  document.body.classList.toggle("landscape-book", spread);
  // StPageFlip stays in landscape when the container is >= 2 * (computed page width)
  // (its check is `blockWidth < 2*pageWidth`, which fails when they're equal).
  // In portrait, pin a fixed single-page size and set minWidth to the page
  // width so the library cannot treat the host as a two-page spread.
  pageFlip = new St.PageFlip(book, {
    width: pageW,
    height: pageH,
    size: spread ? "stretch" : "fixed",
    minWidth: spread ? 160 : pageW,
    maxWidth: spread ? 700 : pageW,
    minHeight: spread ? 240 : pageH,
    maxHeight: spread ? 1200 : pageH,
    drawShadow: true,
    maxShadowOpacity: 0.75,
    flippingTime: 700,
    usePortrait: !spread,
    showCover: false,
    autoSize: true,
    mobileScrollSupport: true,
    swipeDistance: 24,
    clickEventForward: true,
    useMouseEvents: true,
    disableFlipByClick: true,
    showPageCorners: true,
    startZIndex: 1,
    startPage: Math.max(0, Math.min(startPage || 0, albumPages.length - 1))
  });
  pageFlip.on("flip", () => updatePager());
  pageFlip.on("changeState", ev => {
    if (ev.data === "flipping") playFlipSound();
    if (ev.data === "read") updatePager();
  });
  pageFlip.on("changeOrientation", () => updatePager());
  pageFlip.loadFromHTML(pages);
  try { window.__pageFlip = pageFlip; } catch (e) {}
  buildRings();
  updatePager();
  hydrateAround(pageFlip.getCurrentPageIndex());
}

function nextPage() { if (pageFlip) pageFlip.flipNext("bottom"); }
function prevPage() { if (pageFlip) pageFlip.flipPrev("bottom"); }

function jumpToSet(id) {
  const idx = setStarts[id];
  if (idx == null || !pageFlip) return;
  pageFlip.turnToPage(idx);
  updatePager();
  closeToc();
  closeHits();
  closeWish();
  closeValue();
  closeTrade();
  closePack(); closeCenter();
}

function jumpToCard(id) {
  if (!id || !pageFlip) return;
  const idx = cardStarts[id];
  closeFocus();
  closeHits();
  closeWish();
  closeValue();
  closeTrade();
  closePack(); closeCenter();
  closeToc();
  if (idx == null) return;
  pageFlip.turnToPage(idx);
  updatePager();
  requestAnimationFrame(() => highlightPocket(id));
}

function highlightPocket(id) {
  const nodes = document.querySelectorAll(`#bookHost .pocket[data-id="${CSS.escape(id)}"]`);
  nodes.forEach(n => {
    n.classList.add("flash");
    setTimeout(() => n.classList.remove("flash"), 1600);
  });
}

function currentSetFromPage() {
  const i = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
  for (let k = i; k >= 0; k--) {
    const p = albumPages[k];
    if (p && p.set) return p.set;
  }
  return null;
}

/* ---------- contents overlay ---------- */
function renderToc() {
  const root = $("tocList");
  if (!root) return;
  root.innerHTML = "<ol>" + (B.sets || []).map((s, i) =>
    `<li><button type="button" data-jump="${escapeHtml(s.id)}">
      <span class="frac">${String(i + 1).padStart(2, "0")}</span>
      <span class="nm"><b>${escapeHtml(s.name || s.id)}</b>
        <span>${s.owned || 0} of ${s.total || 0} · ${s.pct || 0}%</span></span>
      <span class="frac">${s.value_ils != null ? money(s.value_ils, s.value_usd) : ""}</span>
    </button></li>`
  ).join("") + "</ol>";
}
function openToc() {
  const toc = $("toc");
  if (!toc) return;
  closeHits();
  closeWish();
  closeValue();
  closeTrade();
  closePack(); closeCenter();
  toc.hidden = false;
  $("contentsBtn").setAttribute("aria-expanded", "true");
}
function closeToc() {
  const toc = $("toc");
  if (!toc) return;
  toc.hidden = true;
  $("contentsBtn").setAttribute("aria-expanded", "false");
}

/* ---------- Top Hits overlay ---------- */
let hitsOpen = false;
function hitsTotal(cards) {
  return cards.reduce((s, c) => s + Math.max(0, cardValueIls(c)) * (c.quantity || 1), 0);
}
function renderHits() {
  const root = $("hitsGrid");
  const sub = $("hitsSub");
  if (!root) return;
  const cards = topHits(12);
  const T = B.totals || {};
  if (sub) {
    sub.textContent = `${cards.length} most valuable cards · ${money(hitsTotal(cards))} of ${money(T.ils, T.usd)}`;
  }
  root.innerHTML = cards.map((c, i) => {
    const rare = rarityLabel(c);
    const copies = c.quantity > 1 ? `<span class="hit-copies"> · ×${c.quantity}</span>` : "";
    return `<article class="hit" role="button" tabindex="0" data-id="${escapeHtml(c.id)}">
      <div class="hit-top">
        <span class="hit-rank">${String(i + 1).padStart(2, "0")}</span>
        ${rare ? `<span class="hit-rare">${escapeHtml(rare)}</span>` : ""}
      </div>
      <div class="persp">${cardImg(c, c.name, true, false)}</div>
      <h3 class="hit-name">${escapeHtml(c.name || "")}</h3>
      <p class="hit-set">${escapeHtml(c.set_name || "")} · ${escapeHtml(c.number || "")}${copies}</p>
      <p class="hit-val">${valueLabel(c.value)}</p>
      <button type="button" class="hit-jump" data-jump-card="${escapeHtml(c.id)}">Show in album →</button>
    </article>`;
  }).join("");
}
function openHits() {
  const el = $("hits");
  if (!el) return;
  closeToc();
  closeWish();
  closeValue();
  closeTrade();
  closePack(); closeCenter();
  renderHits();
  el.hidden = false;
  hitsOpen = true;
  if ($("hitsBtn")) $("hitsBtn").setAttribute("aria-expanded", "true");
  if ($("hitsClose")) $("hitsClose").focus();
}
function closeHits() {
  const el = $("hits");
  if (!el || el.hidden) return;
  el.hidden = true;
  hitsOpen = false;
  if ($("hitsBtn")) $("hitsBtn").setAttribute("aria-expanded", "false");
}

function closeCenter() {
  if (window.CenteringTool) window.CenteringTool.close();
}
function openCenter(opts) {
  closeToc();
  closeHits();
  closeWish();
  closeValue();
  closeTrade();
  closePack();
  if (typeof closeFocus === "function" && focusOpen) closeFocus();
  if (window.CenteringTool) window.CenteringTool.open(opts || {});
}


/* ---------- Wishlist / missing cards ---------- */
let wishOpen = false;
const wishState = { set: "all", scope: "all", min: 0 };
const WISH_MINS = [
  { v: 0, label: "Any price" },
  { v: 1, label: "₪1+" },
  { v: 5, label: "₪5+" },
  { v: 10, label: "₪10+" },
  { v: 50, label: "₪50+" },
  { v: 100, label: "₪100+" },
];

function toggleWanted(id) {
  if (!id) return;
  if (wanted.has(id)) wanted.delete(id); else wanted.add(id);
  saveWanted(wanted);
  refreshWanted();
  if (wishOpen) renderWish();
}

function wishCards() {
  let cards = allMissing();
  if (wishState.set !== "all") cards = cards.filter(c => c.set_id === wishState.set);
  if (wishState.scope === "starred") cards = cards.filter(c => wanted.has(c.id));
  if (wishState.min > 0) cards = cards.filter(c => cardValueIls(c) >= wishState.min);
  cards.sort((a, b) => cardValueIls(b) - cardValueIls(a) || String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
  return cards;
}

function wishSum(cards) {
  let ils = 0, usd = 0, priced = 0, unpriced = 0;
  cards.forEach(c => {
    const v = c.value || {};
    if (v.ils != null) { ils += Number(v.ils); usd += Number(v.usd || 0); priced++; }
    else unpriced++;
  });
  return { ils, usd, priced, unpriced, count: cards.length };
}

function renderWishFilters() {
  const root = $("wishFilters");
  if (!root) return;
  const sets = [{ id: "all", name: "All sets" }].concat((B.sets || []).map(s => ({ id: s.id, name: s.name })));
  const setChips = sets.map(s =>
    `<button type="button" class="wish-chip" data-wish-set="${escapeHtml(s.id)}" aria-pressed="${wishState.set === s.id ? "true" : "false"}">${escapeHtml(s.name)}</button>`
  ).join("");
  const scopeChips = [
    ["all", "All missing"],
    ["starred", "Starred"],
  ].map(([v, label]) =>
    `<button type="button" class="wish-chip" data-wish-scope="${v}" aria-pressed="${wishState.scope === v ? "true" : "false"}">${label}</button>`
  ).join("");
  const minChips = WISH_MINS.map(m =>
    `<button type="button" class="wish-chip" data-wish-min="${m.v}" aria-pressed="${wishState.min === m.v ? "true" : "false"}">${m.label}</button>`
  ).join("");
  root.innerHTML = `<div class="wish-row" role="toolbar" aria-label="Filter by set">${setChips}</div>
    <div class="wish-row" role="toolbar" aria-label="Filter by list">${scopeChips}${minChips}</div>`;
}

function renderWish() {
  const root = $("wishList");
  const sub = $("wishSub");
  if (!root) return;
  renderWishFilters();
  const cards = wishCards();
  const sum = wishSum(cards);
  const unpriced = sum.unpriced ? ` · ${sum.unpriced} unpriced` : "";
  if (sub) {
    const verb = wishState.scope === "starred" ? "starred" : "missing";
    sub.textContent = `${sum.count} ${verb} · ${money(sum.ils, sum.usd)} to complete${unpriced}. Sorted by price.`;
  }
  if (!cards.length) {
    root.innerHTML = `<p class="wish-empty">${wishState.scope === "starred" ? "No starred cards match these filters. Tap the star on a missing card to add it." : "No missing cards match these filters."}</p>`;
    return;
  }
  const groups = [];
  if (wishState.set === "all") {
    // One price-sorted list so the most expensive chases appear first.
    groups.push({ id: "all", name: "All sets", cards });
  } else {
    const set = (B.sets || []).find(s => s.id === wishState.set);
    groups.push({ id: wishState.set, name: (set && set.name) || wishState.set, cards });
  }
  root.innerHTML = groups.map(g => {
    const gs = wishSum(g.cards);
    const items = g.cards.map(c => {
      const rare = rarityLabel(c);
      const on = wanted.has(c.id);
      return `<article class="wish-item" role="button" tabindex="0" data-id="${escapeHtml(c.id)}">
        <img src="${escapeHtml(c.art || "")}" alt="" loading="lazy" width="52" height="72">
        <div>
          <h3 class="wish-name">${escapeHtml(c.name || "")}${rare ? `<span class="wish-rare">${escapeHtml(rare)}</span>` : ""}</h3>
          <p class="wish-meta">${escapeHtml(c.set_name || "")} · ${escapeHtml(c.number || "")}</p>
        </div>
        <div class="wish-side">
          <p class="wish-val">${valueLabel(c.value)}</p>
          <button type="button" class="wish-star" data-wish-star="${escapeHtml(c.id)}" aria-pressed="${on ? "true" : "false"}" aria-label="${on ? "Remove from starred" : "Star as wanted"}">${on ? "★" : "☆"}</button>
          <button type="button" class="wish-jump" data-jump-card="${escapeHtml(c.id)}">Show in album →</button>
        </div>
      </article>`;
    }).join("");
    const head = g.id === "all" ? "" : `<h3 class="wish-group-h">${escapeHtml(g.name)} <span>${g.cards.length} · ${money(gs.ils, gs.usd)}</span></h3>`;
    return `<section class="wish-group">${head}${items}</section>`;
  }).join("");
}

function openWish() {
  const el = $("wish");
  if (!el) return;
  closeToc();
  closeHits();
  closeValue();
  closeTrade();
  closePack(); closeCenter();
  renderWish();
  el.hidden = false;
  wishOpen = true;
  if ($("wishBtn")) $("wishBtn").setAttribute("aria-expanded", "true");
  if ($("wishClose")) $("wishClose").focus();
}
function closeWish() {
  const el = $("wish");
  if (!el || el.hidden) return;
  el.hidden = true;
  wishOpen = false;
  if ($("wishBtn")) $("wishBtn").setAttribute("aria-expanded", "false");
}


/* ---------- Collection value over time ---------- */
let valueOpen = false;
let valueTipIndex = -1;

function snapshots() {
  return (B.snapshots || []).slice().sort((a, b) =>
    String(a.captured_at || a.date).localeCompare(String(b.captured_at || b.date)));
}
function snapLabel(s) {
  const day = formatDay(s.date);
  const snaps = snapshots();
  const same = snaps.filter(x => x.date === s.date).length > 1;
  const t = (s.captured_at || "").slice(11, 16);
  return same && t ? `${day} ${t}` : day;
}

function formatDay(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = String(isoDate).split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const mi = Number(m) - 1;
  return `${Number(d)} ${months[mi] || m} ${y}`;
}

function valueDelta(curr, prev) {
  if (prev == null || curr == null) return null;
  return Math.round((Number(curr) - Number(prev)) * 100) / 100;
}

function renderValueChart(snaps) {
  const w = 640, h = 200;
  const pad = { l: 48, r: 16, t: 18, b: 32 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  if (!snaps.length) {
    return `<p class="value-note">No snapshots yet. Weekly price refreshes will start the chart.</p>`;
  }
  const vals = snaps.map(s => Number(s.ils) || 0);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min = Math.max(0, min * 0.92); max = max * 1.08 || 1; }
  else {
    const padY = (max - min) * 0.12;
    min = Math.max(0, min - padY);
    max += padY;
  }
  const xAt = (i) => {
    if (snaps.length === 1) return pad.l + innerW / 2;
    return pad.l + (i / (snaps.length - 1)) * innerW;
  };
  const yAt = (v) => pad.t + innerH - ((v - min) / (max - min)) * innerH;
  const pts = snaps.map((s, i) => [xAt(i), yAt(vals[i])]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${pad.t + innerH} L${pts[0][0].toFixed(1)} ${pad.t + innerH} Z`;
  const grid = [0, 0.5, 1].map(t => {
    const y = pad.t + innerH * (1 - t);
    const val = min + (max - min) * t;
    return `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"></line>
      <text class="axis" x="${pad.l - 8}" y="${y + 4}" text-anchor="end">₪${Math.round(val)}</text>`;
  }).join("");
  const labels = snaps.map((s, i) => {
    if (snaps.length > 8 && i !== 0 && i !== snaps.length - 1 && i % 2) return "";
    return `<text class="axis" x="${pts[i][0].toFixed(1)}" y="${h - 8}" text-anchor="middle">${escapeHtml(snapLabel(s))}</text>`;
  }).join("");
  const dots = pts.map((p, i) =>
    `<circle class="dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5"></circle>
     <circle class="dot-hit" data-snap="${i}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="14"></circle>`
  ).join("");
  return `<svg class="value-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Collection value over time">
    <defs>
      <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e4c27a" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#e4c27a" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}
    <path class="area" d="${area}"></path>
    <path class="line" d="${line}"></path>
    ${dots}
    ${labels}
  </svg>
  <p class="value-tip" id="valueTip"></p>`;
}

function renderValue() {
  const snaps = snapshots();
  const last = snaps[snaps.length - 1];
  const prev = snaps.length > 1 ? snaps[snaps.length - 2] : null;
  const T = B.totals || {};
  const ils = (last && last.ils != null) ? last.ils : T.ils;
  const usd = (last && last.usd != null) ? last.usd : T.usd;
  const fx = (last && last.fx) || (B.meta && B.meta.fx) || {};
  if ($("valueSub")) {
    $("valueSub").textContent = `${T.unique || (last && last.unique) || 0} unique · ${T.copies || (last && last.copies) || 0} copies · $1 = ₪${Number(fx.usd_ils || 0).toFixed(3)}` +
      (fx.usd_date ? ` (${formatDay(fx.usd_date)})` : "");
  }
  const delta = prev ? valueDelta(ils, prev.ils) : null;
  let deltaHtml = "";
  if (delta != null) {
    const cls = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const sign = delta > 0 ? "+" : "";
    deltaHtml = `<p class="value-delta ${cls}">${sign}${shekel(delta)} since ${snapLabel(prev)}</p>`;
  } else {
    deltaHtml = `<p class="value-delta flat">First snapshot · weekly updates start from here</p>`;
  }
  if ($("valueHero")) {
    $("valueHero").innerHTML = `<p class="value-now">${money(ils, usd)}</p>${deltaHtml}`;
  }
  if ($("valueChartWrap")) $("valueChartWrap").innerHTML = renderValueChart(snaps);
  if ($("valueNote")) {
    $("valueNote").textContent = snaps.length < 2
      ? "A GitHub Action refreshes TCGdex market prices every Monday and appends a snapshot, so this chart will grow on its own."
      : `Prices refresh automatically every Monday via TCGdex, using Bank of Israel exchange rates. ${snaps.length} snapshots so far.`;
  }
  if ($("valueSets")) {
    $("valueSets").innerHTML = (B.sets || []).map(s =>
      `<div class="value-set">
        <b>${escapeHtml(s.name || s.id)}</b>
        <span class="pct">${s.owned || 0} / ${s.total || 0}</span>
        <span class="val">${s.value_ils != null ? money(s.value_ils, s.value_usd) : "—"}</span>
      </div>`
    ).join("");
  }
  valueTipIndex = -1;
}

function openValue() {
  const el = $("value");
  if (!el) return;
  closeToc(); closeHits(); closeWish(); closeTrade(); closePack(); closeCenter();
  renderValue();
  el.hidden = false;
  valueOpen = true;
  if ($("valueBtn")) $("valueBtn").setAttribute("aria-expanded", "true");
  if ($("valueClose")) $("valueClose").focus();
}
function closeValue() {
  const el = $("value");
  if (!el || el.hidden) return;
  el.hidden = true;
  valueOpen = false;
  if ($("valueBtn")) $("valueBtn").setAttribute("aria-expanded", "false");
}


/* ---------- Trade list of duplicates ---------- */
let tradeOpen = false;
const tradeState = { set: "all" };
const extrasOf = (c) => Math.max(0, ((c && c.quantity) || 1) - 1);

function allDuplicates() {
  return (B.cards || []).filter(c => extrasOf(c) > 0);
}

function tradeCards() {
  let cards = allDuplicates();
  if (tradeState.set !== "all") cards = cards.filter(c => c.set_id === tradeState.set);
  cards.sort((a, b) => extrasOf(b) - extrasOf(a) || cardValueIls(b) - cardValueIls(a) ||
    String(a.name || "").localeCompare(String(b.name || "")));
  return cards;
}

function tradeUrl() {
  try { return new URL("trade.html", document.baseURI || location.href).href; }
  catch (e) { return "https://danieldrey.github.io/pokemon-binder/trade.html"; }
}

function toast(msg) {
  const el = $("tradeToast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 1800);
}

async function shareTradeList() {
  const url = tradeUrl();
  const title = "Daniel’s Binder · Trade list";
  try {
    if (navigator.share) {
      await navigator.share({ title, text: "Extra copies from the binder, ready to trade.", url });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch (e) {
    toast(url);
  }
}

function renderTrade() {
  const cards = tradeCards();
  const all = allDuplicates();
  const extras = cards.reduce((s, c) => s + extrasOf(c), 0);
  const setsWithDups = new Set(all.map(c => c.set_id));
  if ($("tradeSub")) {
    $("tradeSub").textContent = cards.length
      ? `${cards.length} cards · ${extras} extra ${extras === 1 ? "copy" : "copies"} to trade. One of each stays in the album.`
      : "No extra copies match this filter.";
  }
  const filters = $("tradeFilters");
  if (filters) {
    const chips = [`<button type="button" class="wish-chip" data-trade-set="all" aria-pressed="${tradeState.set === "all" ? "true" : "false"}">All sets</button>`]
      .concat((B.sets || []).filter(s => setsWithDups.has(s.id)).map(s =>
        `<button type="button" class="wish-chip" data-trade-set="${escapeHtml(s.id)}" aria-pressed="${tradeState.set === s.id ? "true" : "false"}">${escapeHtml(s.name)}</button>`
      )).join("");
    filters.innerHTML = `<div class="wish-row" role="toolbar" aria-label="Filter by set">${chips}</div>`;
  }
  const root = $("tradeList");
  if (!root) return;
  if (!cards.length) {
    root.innerHTML = `<p class="wish-empty">No extra copies to trade${tradeState.set === "all" ? " yet" : " in this set"}.</p>`;
    return;
  }
  root.innerHTML = cards.map(c => {
    const rare = rarityLabel(c);
    const extra = extrasOf(c);
    return `<article class="wish-item trade-item" role="button" tabindex="0" data-id="${escapeHtml(c.id)}">
      <img src="${escapeHtml(c.art || "")}" alt="" loading="lazy" width="52" height="72">
      <div>
        <h3 class="wish-name">${escapeHtml(c.name || "")}${rare ? `<span class="wish-rare">${escapeHtml(rare)}</span>` : ""}</h3>
        <p class="wish-meta">${escapeHtml(c.set_name || "")} · ${escapeHtml(c.number || "")}</p>
      </div>
      <div class="wish-side">
        <p class="wish-val">${valueLabel(c.value)}</p>
        <p class="trade-extras">×${c.quantity} · ${extra} extra${extra === 1 ? "" : "s"}</p>
        <button type="button" class="wish-jump" data-jump-card="${escapeHtml(c.id)}">Show in album →</button>
      </div>
    </article>`;
  }).join("");
}

function openTrade() {
  const el = $("trade");
  if (!el) return;
  closeToc(); closeHits(); closeWish(); closeValue(); closePack(); closeCenter();
  renderTrade();
  el.hidden = false;
  tradeOpen = true;
  if ($("tradeBtn")) $("tradeBtn").setAttribute("aria-expanded", "true");
  if ($("tradeClose")) $("tradeClose").focus();
}
function closeTrade() {
  const el = $("trade");
  if (!el || el.hidden) return;
  el.hidden = true;
  tradeOpen = false;
  if ($("tradeBtn")) $("tradeBtn").setAttribute("aria-expanded", "false");
}

/* ---------- Pack-opening mode (localStorage + export JSON) ---------- */
let packOpen = false;
const packQueue = [];
let packSearchTimer = 0;

function loadAdds() {
  try { return JSON.parse(localStorage.getItem(LS_ADDS) || "[]"); } catch (e) { return []; }
}
function saveAdds(arr) {
  try { localStorage.setItem(LS_ADDS, JSON.stringify(arr)); } catch (e) {}
}

function recountTotals() {
  let ils = 0, usd = 0, unique = 0, copies = 0;
  (B.cards || []).forEach(c => {
    const q = c.quantity || 1;
    unique += 1;
    copies += q;
    if (c.value && c.value.ils != null) {
      ils += Number(c.value.ils) * q;
      usd += Number(c.value.usd || 0) * q;
    }
  });
  B.totals = Object.assign({}, B.totals || {}, {
    ils: Math.round(ils * 100) / 100,
    usd: Math.round(usd * 100) / 100,
    unique,
    copies,
    priced_copies: copies,
    ils_low: Math.round(ils * 100) / 100,
    ils_high: Math.round(ils * 100) / 100,
  });
}

function applyOneAdd(add, recount) {
  if (!add || !add.id) return;
  const qty = Math.max(1, Number(add.quantity) || 1);
  let set = (B.sets || []).find(s => s.id === add.set_id) ||
    (B.sets || []).find(s => (s.cards || []).some(c => c.id === add.id));
  let sc = set ? (set.cards || []).find(c => c.id === add.id) : null;
  if (sc) {
    if (sc.owned) sc.quantity = (sc.quantity || 1) + qty;
    else {
      sc.owned = true;
      sc.quantity = qty;
      set.owned = (set.owned || 0) + 1;
      if (set.missing_count != null) set.missing_count = Math.max(0, set.missing_count - 1);
      if (set.total) set.pct = Math.round(1000 * set.owned / set.total) / 10;
    }
    if (add.art && !sc.art) sc.art = add.art;
    if (add.rarity && !sc.rarity) sc.rarity = add.rarity;
  } else if (set) {
    sc = Object.assign({}, add, { owned: true, quantity: qty });
    set.cards = set.cards || [];
    set.cards.push(sc);
    set.owned = (set.owned || 0) + 1;
    set.total = (set.total || 0) + 1;
  }
  if (!B.cards) B.cards = [];
  const oc = B.cards.find(c => c.id === add.id);
  if (oc) oc.quantity = (oc.quantity || 1) + qty;
  else B.cards.push(Object.assign({}, sc || add, { owned: true, quantity: qty }));
  const val = (sc && sc.value) || add.value;
  if (set && val && val.ils != null) {
    set.value_ils = Math.round(((set.value_ils || 0) + Number(val.ils) * qty) * 100) / 100;
    set.value_usd = Math.round(((set.value_usd || 0) + Number(val.usd || 0) * qty) * 100) / 100;
  }
  if (recount !== false) recountTotals();
  refreshIndexes();
}

function applyLocalAdds() {
  loadAdds().forEach(a => applyOneAdd(a, false));
  recountTotals();
  refreshIndexes();
}

function tcgdexToCard(raw) {
  if (!raw || !raw.id) return null;
  const set = raw.set || {};
  const image = raw.image || "";
  return {
    id: raw.id,
    name: raw.name,
    number: String(raw.localId || raw.number || ""),
    rarity: raw.rarity || null,
    set_id: set.id || String(raw.id).split("-")[0],
    set_name: set.name || "",
    art: image ? (image.endsWith(".webp") ? image : image + "/low.webp") : "",
    value: raw.value || null,
  };
}

function searchCatalog(q) {
  q = (q || "").trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  const seen = new Set();
  const score = (c) => {
    const name = (c.name || "").toLowerCase();
    const id = (c.id || "").toLowerCase();
    const num = String(c.number || "").toLowerCase();
    const num2 = num.replace(/^0+/, "");
    const q2 = q.replace(/^0+/, "");
    if (id === q || name === q) return 0;
    if (num === q || num2 === q2) return 1;
    if (name.startsWith(q) || id.startsWith(q)) return 2;
    if (name.includes(q) || id.includes(q) || num.includes(q)) return 3;
    return 9;
  };
  allById.forEach(c => {
    if (!c || !c.id || seen.has(c.id)) return;
    if (score(c) < 9) { seen.add(c.id); hits.push(c); }
  });
  hits.sort((a, b) => score(a) - score(b) || String(a.name || "").localeCompare(String(b.name || "")));
  return hits.slice(0, 24);
}

async function searchTcgdex(q) {
  q = (q || "").trim();
  if (q.length < 2) return [];
  const out = [];
  const seen = new Set();
  const push = (c) => { if (c && c.id && !seen.has(c.id)) { seen.add(c.id); out.push(c); } };
  const look = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  };
  if (/^[A-Za-z0-9]+-\d/.test(q) || /^[A-Za-z]{1,6}-[0-9A-Za-z]+$/.test(q)) {
    push(tcgdexToCard(await look("https://api.tcgdex.net/v2/en/cards/" + encodeURIComponent(q))) ||
         tcgdexToCard(await look("https://api.tcgdex.net/v2/ja/cards/" + encodeURIComponent(q))));
  }
  const list = await look("https://api.tcgdex.net/v2/en/cards?name=" + encodeURIComponent(q));
  if (Array.isArray(list)) list.forEach(c => push(tcgdexToCard(c)));
  return out.slice(0, 24);
}

function mergeSearch(local, remote) {
  const seen = new Set();
  const out = [];
  [...local, ...remote].forEach(c => {
    if (!c || !c.id || seen.has(c.id)) return;
    seen.add(c.id);
    out.push(c);
  });
  return out.slice(0, 24);
}

function renderPackResults(shot, results) {
  const box = document.querySelector(`.pack-results[data-shot="${shot.uid}"]`);
  if (!box) return;
  if (!results.length) {
    box.innerHTML = shot.query && shot.query.length >= 1
      ? `<p class="pack-empty">No matches. Try a name, a number, or a TCGdex id like me04-011.</p>`
      : "";
    return;
  }
  box.innerHTML = results.map(c => `
    <button type="button" class="pack-hit" data-shot="${shot.uid}" data-card-id="${escapeHtml(c.id)}">
      <img src="${escapeHtml(c.art || "")}" alt="">
      <div>
        <b>${escapeHtml(c.name || c.id)}</b>
        <span>${escapeHtml(c.set_name || c.set_id || "")} · ${escapeHtml(c.number || "")}${c.rarity ? " · " + escapeHtml(rarityLabel(c)) : ""}</span>
      </div>
    </button>`).join("");
  box.querySelectorAll(".pack-hit").forEach(btn => {
    const card = results.find(c => c.id === btn.dataset.cardId);
    if (card) btn._card = card;
  });
}

async function runPackSearch(shot, query) {
  shot.query = query;
  const local = searchCatalog(query);
  renderPackResults(shot, local);
  if (query.trim().length >= 2) {
    const remote = await searchTcgdex(query);
    if (shot.query === query) renderPackResults(shot, mergeSearch(local, remote));
  }
}

function renderPackQueue() {
  const root = $("packQueue");
  if (!root) return;
  if (!packQueue.length) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = packQueue.map(shot => `
    <article class="pack-shot" data-shot="${shot.uid}">
      <img src="${escapeHtml(shot.url)}" alt="Pulled card photo">
      <div>
        <input class="pack-search" data-shot="${shot.uid}" type="search" placeholder="Search name, number, or id…" value="${escapeHtml(shot.query || "")}" ${shot.done ? "disabled" : ""}>
        ${shot.done ? `<p class="pack-empty">Added ${escapeHtml(shot.confirmed || "")} to the album.</p>` : `<div class="pack-results" data-shot="${shot.uid}"></div>`}
      </div>
    </article>`).join("");
  packQueue.forEach(shot => {
    if (!shot.done && shot.results) renderPackResults(shot, shot.results);
  });
}

function renderPackPending() {
  const root = $("packPending");
  if (!root) return;
  const adds = loadAdds();
  if ($("packSub")) {
    $("packSub").textContent = adds.length
      ? `${adds.length} card${adds.length === 1 ? "" : "s"} saved on this device. Export JSON to merge them into the binder data.`
      : "Photograph or upload your pulls, confirm each card, and they’ll fly into the album on this device.";
  }
  if (!adds.length) { root.innerHTML = ""; return; }
  root.innerHTML = `<h3>On this device</h3>` + adds.map((c, i) => `
    <div class="pack-add">
      <img src="${escapeHtml(c.art || "")}" alt="">
      <div>
        <b>${escapeHtml(c.name || c.id)}</b>
        <span class="wish-meta">${escapeHtml(c.set_name || "")} · ${escapeHtml(c.number || "")} · ×${c.quantity || 1}</span>
      </div>
      <button type="button" data-drop-add="${i}">Remove</button>
    </div>`).join("");
}

function renderPack() {
  renderPackQueue();
  renderPackPending();
}

function addPackFiles(fileList) {
  [...fileList].forEach(file => {
    if (!file || !file.type.startsWith("image/")) return;
    const uid = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    packQueue.push({ uid, file, url: URL.createObjectURL(file), query: "", results: [], done: false });
  });
  renderPackQueue();
}

function exportAdds() {
  const adds = loadAdds();
  const payload = {
    schema: "nextpull-binder-adds/v1",
    exported_at: new Date().toISOString(),
    note: "Merge into the repo with: python3 build_binder.py merge-adds this-file.json",
    cards: adds,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  a.href = URL.createObjectURL(blob);
  a.download = `binder-adds-${day}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function flyIntoAlbum(src, done) {
  const img = document.createElement("img");
  img.className = "pack-fly";
  img.src = src || "";
  const start = document.querySelector(".pack-shot img") || $("packBtn") || document.body;
  const sr = start.getBoundingClientRect();
  const host = $("binderFrame") || $("bookHost") || document.body;
  const er = host.getBoundingClientRect();
  img.style.left = sr.left + "px";
  img.style.top = sr.top + "px";
  img.style.transform = "translate(0,0) scale(1)";
  document.body.appendChild(img);
  requestAnimationFrame(() => {
    const dx = er.left + er.width / 2 - 45 - sr.left;
    const dy = er.top + er.height / 2 - 63 - sr.top;
    img.style.transform = `translate(${dx}px, ${dy}px) scale(.2)`;
    img.style.opacity = "0";
  });
  setTimeout(() => { img.remove(); if (done) done(); }, 720);
}

function confirmPackCard(shot, card, fromEl) {
  if (!shot || !card || !card.id) return;
  const add = {
    id: card.id,
    name: card.name,
    set_id: card.set_id,
    set_name: card.set_name,
    number: card.number,
    rarity: card.rarity || null,
    art: card.art || "",
    quantity: 1,
    added_at: new Date().toISOString(),
    source: "pack",
  };
  const existing = loadAdds();
  const prev = existing.find(a => a.id === add.id);
  if (prev) prev.quantity = (prev.quantity || 1) + 1;
  else existing.push(add);
  saveAdds(existing);
  applyOneAdd(add, true);
  shot.done = true;
  shot.confirmed = card.name || card.id;
  renderHud();
  const art = card.art || shot.url;
  closePack(); closeCenter();
  flyIntoAlbum(art, () => {
    albumPages = buildAlbumPages();
    const idx = cardStarts[card.id] != null ? cardStarts[card.id] : (pageFlip ? pageFlip.getCurrentPageIndex() : 0);
    mountBook(idx);
    requestAnimationFrame(() => highlightPocket(card.id));
  });
}

function dropAdd(index) {
  const adds = loadAdds();
  adds.splice(index, 1);
  saveAdds(adds);
  // Rebuild from pristine data.js + remaining adds
  location.reload();
}

function openPack() {
  const el = $("pack");
  if (!el) return;
  closeToc(); closeHits(); closeWish(); closeValue(); closeTrade(); closePack(); closeCenter();
  renderPack();
  el.hidden = false;
  packOpen = true;
  if ($("packBtn")) $("packBtn").setAttribute("aria-expanded", "true");
  if ($("packClose")) $("packClose").focus();
}
function closePack() {
  const el = $("pack");
  if (!el || el.hidden) return;
  el.hidden = true;
  packOpen = false;
  if ($("packBtn")) $("packBtn").setAttribute("aria-expanded", "false");
}


/* ---------- card modal ---------- */
let focusOpen = false, focusScrollY = 0;
function lockBody() {
  focusScrollY = window.scrollY || 0;
  document.body.classList.add("focus-lock");
  document.body.style.top = `-${focusScrollY}px`;
}
function unlockBody() {
  document.body.classList.remove("focus-lock");
  document.body.style.top = "";
  window.scrollTo(0, focusScrollY);
}
function storageNote(c) {
  if (c.toploader && c.sleeve) return "One copy in a toploader and one in a sleeve.";
  if (c.toploader) return "Kept in a toploader.";
  if (c.sleeve) return "Kept in a sleeve.";
  return "";
}
function fillFocus(c) {
  const card = $("bigCard");
  const high = cardArt(c, true) || cardArt(c, false);
  card.className = "card big";
  card.innerHTML = `<div class="face"><img src="${escapeHtml(high)}" alt="${escapeHtml(c.name || "")}" decoding="async"></div>
    <div class="edge"></div>`;
  const raw = c.price, g = c.graded_prices || {}, wg = c.worth_grading || {};
  const missing = !c.owned;
  const rare = rarityLabel(c);
  if (missing) {
    const starred = wanted.has(c.id);
    $("focusMeta").innerHTML = `
      <h3 id="focusHeading">${escapeHtml(c.name || "")}</h3>
      <div class="kv">
        <span>Set</span><b>${escapeHtml(c.set_name || "")} · ${escapeHtml(c.number || "")}</b>
        <span>Rarity</span><b>${escapeHtml(rare || "—")}</b>
        <span>Status</span><b>Not in the collection yet</b>
        <span>Market price</span><b>${valueLabel(c.value)}</b>
        <span>Source</span><b>${escapeHtml((raw && raw.source) || "—")}${(raw && raw.source_updated) ? " · " + raw.source_updated : ""}</b>
      </div>
      <div class="focus-actions">
        <button type="button" class="hud-btn gold" data-wish-star="${escapeHtml(c.id)}" aria-pressed="${starred ? "true" : "false"}">${starred ? "★ Starred" : "☆ Star on wishlist"}</button>
        ${cardStarts[c.id] != null ? `<button type="button" class="hud-btn" data-jump-card="${escapeHtml(c.id)}">Show in album</button>` : ""}
      </div>
    `;
    return;
  }
  const worth = wg.status === "unlikely"
    ? "Probably not worth grading on its own"
    : (wg.label_he || "—");
  const detail = wg.raw_ils != null
    ? `Raw value about ${shekel(wg.raw_ils)}, below the typical ~₪${wg.fee_ils || 260} grading cost from Israel.`
    : (wg.detail_he || "");
  $("focusMeta").innerHTML = `
    <h3 id="focusHeading">${escapeHtml(c.name || "")}</h3>
    <div class="kv">
      <span>Set</span><b>${escapeHtml(c.set_name || "")} · ${escapeHtml(c.number || "")}</b>
      <span>Condition</span><b>${c.grade ? `${c.grade_company || ""} ${c.grade}` : (c.condition || "NM")}${c.toploader ? " · Toploader" : ""}${c.sleeve ? " · Sleeve" : ""}</b>
      <span>Collection value</span><b>${valueLabel(c.value)}</b>
      <span>Raw NM</span><b>${raw && raw.ils != null ? money(raw.ils, raw.usd) : "—"}</b>
      <span>Source</span><b>${escapeHtml((raw && raw.source) || "—")}${(raw && raw.source_updated) ? " · " + raw.source_updated : ""}</b>
      <span>PSA 9 / 10</span><b>${g.available ? "Listed" : "No free source available"}</b>
      <span>Worth grading?</span><b class="${wg.status === "unlikely" ? "bad" : "warn"}">${escapeHtml(worth)}</b>
    </div>
    <p class="set-stats">${escapeHtml(detail)}</p>
    ${storageNote(c) ? `<p class="set-stats">${storageChips(c)} ${storageNote(c)}</p>` : ""}
    ${c.quantity > 1 ? `<p class="set-stats">Copies in the collection: ×${c.quantity}</p>` : ""}
    ${c.id_note_he ? `<p class="set-stats">${escapeHtml(c.id_note_he)}</p>` : ""}
    <div class="focus-actions">
      <button type="button" class="hud-btn gold" data-center-card="${escapeHtml(c.id)}">Measure centering</button>
      ${cardStarts[c.id] != null ? `<button type="button" class="hud-btn" data-jump-card="${escapeHtml(c.id)}">Show in album</button>` : ""}
    </div>
  `;
}
function openFocus(c) {
  fillFocus(c);
  if (!focusOpen) {
    lockBody();
    $("focus").hidden = false;
    focusOpen = true;
    history.pushState({ binderFocus: true, id: c.id || c.name || "" }, "", "#card");
    $("focusClose").focus();
  }
}
function closeFocus(fromPop) {
  if (!focusOpen) return;
  focusOpen = false;
  $("focus").hidden = true;
  unlockBody();
  if (!fromPop && history.state && history.state.binderFocus) history.back();
}

function refreshWanted() {
  document.querySelectorAll("#bookHost .pocket.missing, #book .pocket.missing").forEach(p => {
    const on = wanted.has(p.dataset.id);
    p.classList.toggle("wanted-pocket", on);
    const btn = p.querySelector(".want-btn");
    if (btn) btn.textContent = on ? "★" : "☆";
  });
}

function renderHud() {
  const T = B.totals || {};
  if ($("hudMeta")) $("hudMeta").innerHTML = `<b>${money(T.ils, T.usd)}</b> · ${T.unique || 0} unique`;
  if ($("soundToggle")) {
    $("soundToggle").setAttribute("aria-pressed", soundOn ? "true" : "false");
    $("soundToggle").textContent = soundOn ? "Sound: On" : "Sound: Off";
  }
}

function applyQueryJump() {
  try {
    const q = new URLSearchParams(location.search);
    const id = q.get("set");
    if (id && setStarts[id] != null) {
      pageFlip.turnToPage(setStarts[id]);
      updatePager();
    }
    const card = q.get("card");
    if (card && cardStarts[card] != null) {
      jumpToCard(card);
    }
    if (q.get("hits") === "1" || q.get("hits") === "true" || location.hash === "#hits") {
      setTimeout(openHits, 200);
    }
    if (q.get("wish") === "1" || q.get("wish") === "true" || q.get("wishlist") === "1" || location.hash === "#wishlist" || location.hash === "#wish") {
      setTimeout(openWish, 200);
    }
    if (q.get("value") === "1" || q.get("value") === "true" || location.hash === "#value") {
      setTimeout(openValue, 200);
    }
    if (q.get("trade") === "1" || q.get("trade") === "true" || location.hash === "#trade") {
      setTimeout(openTrade, 200);
    }
    if (q.get("pack") === "1" || q.get("pack") === "true" || location.hash === "#pack") {
      setTimeout(openPack, 200);
    }
    if (q.get("center") === "1" || q.get("center") === "true" || q.get("centering") === "1" || location.hash === "#center") {
      setTimeout(() => openCenter(), 200);
    }
  } catch (e) {}
}

function init() {
  applyLocalAdds();
  albumPages = buildAlbumPages();
  renderHud();
  renderToc();
  let started = false;
  const start = () => { if (started) return; started = true; mountBook(0); applyQueryJump(); };
  setTimeout(start, 350);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(start));
  else requestAnimationFrame(start);

  const host = $("bookHost");
  host.addEventListener("click", ev => {
    const jump = ev.target.closest("[data-jump]");
    if (jump) { ev.preventDefault(); ev.stopPropagation(); jumpToSet(jump.dataset.jump); return; }
    const btn = ev.target.closest(".want-btn");
    if (btn) {
      ev.preventDefault(); ev.stopPropagation();
      const id = btn.closest(".pocket").dataset.id;
      toggleWanted(id);
      return;
    }
    const pocket = ev.target.closest(".pocket");
    if (pocket && pocket.dataset.id) {
      ev.preventDefault(); ev.stopPropagation();
      const card = cardById(pocket.dataset.id) || (currentSetFromPage() || { cards: [] }).cards.find(c => c.id === pocket.dataset.id);
      if (card) openFocus(card.owned ? enrich(card) : card);
    }
  }, true);

  $("pagePrev").addEventListener("click", prevPage);
  $("pageNext").addEventListener("click", nextPage);
  if ($("dockPrev")) $("dockPrev").addEventListener("click", prevPage);
  if ($("dockNext")) $("dockNext").addEventListener("click", nextPage);
  document.addEventListener("keydown", ev => {
    if (focusOpen) return;
    if (ev.target.matches && ev.target.matches("input,select,textarea,button")) {
      if (ev.key === "Escape") { closeToc(); closeHits(); closeWish(); closeValue(); closeTrade(); closePack(); closeCenter(); }
      return;
    }
    if (hitsOpen) {
      if (ev.key === "Escape") { ev.preventDefault(); closeHits(); }
      return;
    }
    if (wishOpen) {
      if (ev.key === "Escape") { ev.preventDefault(); closeWish(); }
      return;
    }
    if (valueOpen) {
      if (ev.key === "Escape") { ev.preventDefault(); closeValue(); }
      return;
    }
    if (tradeOpen) {
      if (ev.key === "Escape") { ev.preventDefault(); closeTrade(); closePack(); closeCenter(); }
      return;
    }
    if (ev.key === "ArrowRight" || ev.key === "PageDown") { ev.preventDefault(); nextPage(); }
    if (ev.key === "ArrowLeft" || ev.key === "PageUp") { ev.preventDefault(); prevPage(); }
    if (ev.key === "Escape") { closeToc(); closeHits(); closeWish(); closeValue(); closeTrade(); closePack(); closeCenter(); }
  });

  $("contentsBtn").addEventListener("click", () => $("toc").hidden ? openToc() : closeToc());
  $("tocClose").addEventListener("click", closeToc);
  $("tocBackdrop").addEventListener("click", closeToc);
  $("toc").addEventListener("click", ev => {
    const jump = ev.target.closest("[data-jump]");
    if (jump) { ev.preventDefault(); jumpToSet(jump.dataset.jump); }
  });

  if (window.CenteringTool) window.CenteringTool.bind();
  if ($("hitsBtn")) $("hitsBtn").addEventListener("click", () => $("hits").hidden ? openHits() : closeHits());
  if ($("hitsClose")) $("hitsClose").addEventListener("click", closeHits);
  if ($("hitsBackdrop")) $("hitsBackdrop").addEventListener("click", closeHits);
  if ($("hits")) $("hits").addEventListener("click", ev => {
    const go = ev.target.closest("[data-jump-card]");
    if (go) { ev.preventDefault(); ev.stopPropagation(); jumpToCard(go.dataset.jumpCard); return; }
    const hit = ev.target.closest(".hit");
    if (hit && hit.dataset.id) {
      ev.preventDefault();
      const card = cardById(hit.dataset.id);
      if (card) openFocus(card);
    }
  });
  if ($("hitsGrid")) $("hitsGrid").addEventListener("keydown", ev => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const hit = ev.target.closest(".hit");
    if (!hit || !hit.dataset.id) return;
    ev.preventDefault();
    const card = cardById(hit.dataset.id);
    if (card) openFocus(card);
  });

  if ($("wishBtn")) $("wishBtn").addEventListener("click", () => $("wish").hidden ? openWish() : closeWish());
  if ($("wishClose")) $("wishClose").addEventListener("click", closeWish);
  if ($("wishBackdrop")) $("wishBackdrop").addEventListener("click", closeWish);
  const onWishClick = ev => {
    const star = ev.target.closest("[data-wish-star]");
    if (star) { ev.preventDefault(); ev.stopPropagation(); toggleWanted(star.dataset.wishStar); return; }
    const set = ev.target.closest("[data-wish-set]");
    if (set) { ev.preventDefault(); wishState.set = set.dataset.wishSet; renderWish(); return; }
    const scope = ev.target.closest("[data-wish-scope]");
    if (scope) { ev.preventDefault(); wishState.scope = scope.dataset.wishScope; renderWish(); return; }
    const min = ev.target.closest("[data-wish-min]");
    if (min) { ev.preventDefault(); wishState.min = Number(min.dataset.wishMin); renderWish(); return; }
    const go = ev.target.closest("[data-jump-card]");
    if (go) { ev.preventDefault(); ev.stopPropagation(); jumpToCard(go.dataset.jumpCard); return; }
    const item = ev.target.closest(".wish-item");
    if (item && item.dataset.id) {
      ev.preventDefault();
      const card = cardById(item.dataset.id);
      if (card) openFocus(card);
    }
  };
  if ($("wish")) $("wish").addEventListener("click", onWishClick);
  if ($("wishList")) $("wishList").addEventListener("keydown", ev => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const item = ev.target.closest(".wish-item");
    if (!item || !item.dataset.id) return;
    ev.preventDefault();
    const card = cardById(item.dataset.id);
    if (card) openFocus(card);
  });

  if ($("valueBtn")) $("valueBtn").addEventListener("click", () => $("value").hidden ? openValue() : closeValue());
  if ($("valueClose")) $("valueClose").addEventListener("click", closeValue);
  if ($("valueBackdrop")) $("valueBackdrop").addEventListener("click", closeValue);
  if ($("valueChartWrap")) $("valueChartWrap").addEventListener("pointerover", ev => {
    const hit = ev.target.closest("[data-snap]");
    if (!hit) return;
    const snaps = snapshots();
    const s = snaps[Number(hit.dataset.snap)];
    const tip = $("valueTip");
    if (s && tip) tip.textContent = `${snapLabel(s)} · ${money(s.ils, s.usd)} · ${s.unique || 0} unique`;
  });
  if ($("valueChartWrap")) $("valueChartWrap").addEventListener("click", ev => {
    const hit = ev.target.closest("[data-snap]");
    if (!hit) return;
    const snaps = snapshots();
    const s = snaps[Number(hit.dataset.snap)];
    const tip = $("valueTip");
    if (s && tip) tip.textContent = `${snapLabel(s)} · ${money(s.ils, s.usd)} · ${s.unique || 0} unique`;
  });

  if ($("tradeBtn")) $("tradeBtn").addEventListener("click", () => $("trade").hidden ? openTrade() : closeTrade());
  if ($("tradeClose")) $("tradeClose").addEventListener("click", closeTrade);
  if ($("tradeBackdrop")) $("tradeBackdrop").addEventListener("click", closeTrade);
  if ($("tradeShare")) $("tradeShare").addEventListener("click", shareTradeList);
  if ($("trade")) $("trade").addEventListener("click", ev => {
    const set = ev.target.closest("[data-trade-set]");
    if (set) { ev.preventDefault(); tradeState.set = set.dataset.tradeSet; renderTrade(); return; }
    const go = ev.target.closest("[data-jump-card]");
    if (go) { ev.preventDefault(); ev.stopPropagation(); jumpToCard(go.dataset.jumpCard); return; }
    const item = ev.target.closest(".trade-item");
    if (item && item.dataset.id) {
      ev.preventDefault();
      const card = cardById(item.dataset.id);
      if (card) openFocus(card);
    }
  });

  if ($("packBtn")) $("packBtn").addEventListener("click", () => $("pack").hidden ? openPack() : closePack());
  if ($("packClose")) $("packClose").addEventListener("click", closePack);
  if ($("packBackdrop")) $("packBackdrop").addEventListener("click", closePack);
  if ($("packExport")) $("packExport").addEventListener("click", exportAdds);
  if ($("packClear")) $("packClear").addEventListener("click", () => {
    if (!loadAdds().length) return;
    if (confirm("Clear every pack add saved on this device? The published album is unchanged.")) {
      saveAdds([]);
      location.reload();
    }
  });
  const onPackFiles = ev => { addPackFiles(ev.target.files || []); ev.target.value = ""; };
  if ($("packCamera")) $("packCamera").addEventListener("change", onPackFiles);
  if ($("packUpload")) $("packUpload").addEventListener("change", onPackFiles);
  if ($("pack")) $("pack").addEventListener("input", ev => {
    const inp = ev.target.closest(".pack-search");
    if (!inp) return;
    const shot = packQueue.find(s => s.uid === inp.dataset.shot);
    if (!shot || shot.done) return;
    clearTimeout(packSearchTimer);
    packSearchTimer = setTimeout(() => runPackSearch(shot, inp.value), 220);
  });
  if ($("pack")) $("pack").addEventListener("click", ev => {
    const drop = ev.target.closest("[data-drop-add]");
    if (drop) { ev.preventDefault(); dropAdd(Number(drop.dataset.dropAdd)); return; }
    const hit = ev.target.closest(".pack-hit");
    if (hit) {
      ev.preventDefault();
      const shot = packQueue.find(s => s.uid === hit.dataset.shot);
      const card = hit._card || allById.get(hit.dataset.cardId) || cardById(hit.dataset.cardId);
      if (shot && card) confirmPackCard(shot, card, hit);
    }
  });

  $("soundToggle").addEventListener("click", () => {
    soundOn = !soundOn;
    try { localStorage.setItem(LS_SOUND, soundOn ? "on" : "off"); } catch (e) {}
    renderHud();
    if (soundOn) playFlipSound();
  });

  $("focusClose").addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); closeFocus(); });
  $("focusBackdrop").addEventListener("click", ev => { ev.preventDefault(); closeFocus(); });
  if ($("focusMeta")) $("focusMeta").addEventListener("click", ev => {
    const star = ev.target.closest("[data-wish-star]");
    if (star) {
      ev.preventDefault(); ev.stopPropagation();
      toggleWanted(star.dataset.wishStar);
      const card = cardById(star.dataset.wishStar);
      if (card && focusOpen) fillFocus(card);
      return;
    }
    const go = ev.target.closest("[data-jump-card]");
    if (go) { ev.preventDefault(); ev.stopPropagation(); jumpToCard(go.dataset.jumpCard); return; }
    const measure = ev.target.closest("[data-center-card]");
    if (measure) {
      ev.preventDefault(); ev.stopPropagation();
      const card = cardById(measure.dataset.centerCard);
      openCenter({ card: card || { id: measure.dataset.centerCard } });
    }
  });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && window.CenteringTool && window.CenteringTool.state.open) {
      ev.preventDefault(); closeCenter(); return;
    }
    if (ev.key === "Escape" && focusOpen) closeFocus();
  });
  window.addEventListener("popstate", () => { if (focusOpen) closeFocus(true); });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const i = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
      mountBook(i);
    }, 220);
  });
}

init();
