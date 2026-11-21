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

const byId = new Map((B.cards || []).map(c => [c.id, c]));
function enrich(c) {
  if (!c) return c;
  const extra = byId.get(c.id);
  return extra ? Object.assign({}, c, extra, { owned: true }) : c;
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
      chunk.forEach(c => { if (c && c.id && c.owned && cardStarts[c.id] == null) cardStarts[c.id] = idx; });
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

function holoCard(src, alt, eager) {
  const attr = eager ? `src="${escapeHtml(src || "")}"` : `data-src="${escapeHtml(src || "")}" src=""`;
  return `<div class="card" title="${escapeHtml(alt || "")}">
    <div class="face"><img ${attr} alt="${escapeHtml(alt || "")}" decoding="async"></div>
    <div class="foil"></div><div class="sparkle"></div><div class="glare"></div><div class="edge"></div>
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
  if (owned) wrap.setAttribute("role", "button");
  const name = escapeHtml((card && card.name) || "");
  const num = escapeHtml((card && card.number) || "");
  const badge = rank ? `<span class="rank" aria-label="Rank ${rank}">${rank}</span>` : "";
  if (owned) {
    wrap.innerHTML = `
      ${badge}
      <div class="persp">${holoCard(card.art, card.name, false)}</div>
      <div class="meta">
        <span class="en">${name}</span>
        <small>${num}${card.quantity > 1 ? " · ×" + card.quantity : ""}</small>
        <div class="val">${valueLabel(card.value)}</div>
        ${storageChips(card)}
      </div>`;
  } else if (card && card.art) {
    const star = wanted.has(card.id) ? "★" : "☆";
    wrap.innerHTML = `
      <div class="persp">${holoCard(card.art, card.name, false)}</div>
      <div class="meta">
        <span class="en">${name}</span>
        <small>${num}</small>
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
      <div class="fan">${fan.map(c => holoCard(c.art, c.name, true)).join("")}</div>
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
    el.querySelectorAll("img[data-src]").forEach(img => { img.src = img.dataset.src; });
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
      if (!img.getAttribute("src")) img.src = img.dataset.src;
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
}

function jumpToCard(id) {
  if (!id || !pageFlip) return;
  const idx = cardStarts[id];
  closeFocus();
  closeHits();
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
      <div class="persp">${holoCard(c.art, c.name, true)}</div>
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
function enableTilt(el) {
  if (!el) return;
  el.addEventListener("pointermove", ev => {
    const r = el.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    el.style.setProperty("--mx", (x * 100) + "%");
    el.style.setProperty("--my", (y * 100) + "%");
    el.style.setProperty("--ry", ((x - .5) * 16) + "deg");
    el.style.setProperty("--rx", ((.5 - y) * 10) + "deg");
    el.style.setProperty("--o", "1");
    el.style.setProperty("--pos", (x * 80) + "%");
  });
  el.addEventListener("pointerleave", () => {
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--o", "0");
  });
}
function storageNote(c) {
  if (c.toploader && c.sleeve) return "One copy in a toploader and one in a sleeve.";
  if (c.toploader) return "Kept in a toploader.";
  if (c.sleeve) return "Kept in a sleeve.";
  return "";
}
function fillFocus(c) {
  const card = $("bigCard");
  card.className = "card big";
  card.innerHTML = `<div class="face"><img src="${escapeHtml(c.art || "")}" alt="${escapeHtml(c.name || "")}"></div>
    <div class="foil"></div><div class="sparkle"></div><div class="glare"></div><div class="edge"></div>`;
  enableTilt(card);
  const raw = c.price, g = c.graded_prices || {}, wg = c.worth_grading || {};
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
    ${cardStarts[c.id] != null ? `<div class="focus-actions"><button type="button" class="hud-btn" data-jump-card="${escapeHtml(c.id)}">Show in album</button></div>` : ""}
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
  } catch (e) {}
}

function init() {
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
      if (!id) return;
      if (wanted.has(id)) wanted.delete(id); else wanted.add(id);
      saveWanted(wanted);
      refreshWanted();
      return;
    }
    const pocket = ev.target.closest(".pocket.owned");
    if (pocket) {
      ev.preventDefault(); ev.stopPropagation();
      const id = pocket.dataset.id;
      const card = byId.get(id) || (currentSetFromPage() || { cards: [] }).cards.find(c => c.id === id);
      if (card) openFocus(enrich(card));
    }
  }, true);

  $("pagePrev").addEventListener("click", prevPage);
  $("pageNext").addEventListener("click", nextPage);
  if ($("dockPrev")) $("dockPrev").addEventListener("click", prevPage);
  if ($("dockNext")) $("dockNext").addEventListener("click", nextPage);
  document.addEventListener("keydown", ev => {
    if (focusOpen) return;
    if (ev.target.matches && ev.target.matches("input,select,textarea,button")) {
      if (ev.key === "Escape") { closeToc(); closeHits(); }
      return;
    }
    if (hitsOpen) {
      if (ev.key === "Escape") { ev.preventDefault(); closeHits(); }
      return;
    }
    if (ev.key === "ArrowRight" || ev.key === "PageDown") { ev.preventDefault(); nextPage(); }
    if (ev.key === "ArrowLeft" || ev.key === "PageUp") { ev.preventDefault(); prevPage(); }
    if (ev.key === "Escape") { closeToc(); closeHits(); }
  });

  $("contentsBtn").addEventListener("click", () => $("toc").hidden ? openToc() : closeToc());
  $("tocClose").addEventListener("click", closeToc);
  $("tocBackdrop").addEventListener("click", closeToc);
  $("toc").addEventListener("click", ev => {
    const jump = ev.target.closest("[data-jump]");
    if (jump) { ev.preventDefault(); jumpToSet(jump.dataset.jump); }
  });

  if ($("hitsBtn")) $("hitsBtn").addEventListener("click", () => $("hits").hidden ? openHits() : closeHits());
  if ($("hitsClose")) $("hitsClose").addEventListener("click", closeHits);
  if ($("hitsBackdrop")) $("hitsBackdrop").addEventListener("click", closeHits);
  if ($("hits")) $("hits").addEventListener("click", ev => {
    const go = ev.target.closest("[data-jump-card]");
    if (go) { ev.preventDefault(); ev.stopPropagation(); jumpToCard(go.dataset.jumpCard); return; }
    const hit = ev.target.closest(".hit");
    if (hit && hit.dataset.id) {
      ev.preventDefault();
      const card = byId.get(hit.dataset.id);
      if (card) openFocus(enrich(card));
    }
  });
  if ($("hitsGrid")) $("hitsGrid").addEventListener("keydown", ev => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const hit = ev.target.closest(".hit");
    if (!hit || !hit.dataset.id) return;
    ev.preventDefault();
    const card = byId.get(hit.dataset.id);
    if (card) openFocus(enrich(card));
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
    const go = ev.target.closest("[data-jump-card]");
    if (go) { ev.preventDefault(); ev.stopPropagation(); jumpToCard(go.dataset.jumpCard); }
  });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && focusOpen) closeFocus(); });
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
