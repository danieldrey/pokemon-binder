/* Shareable trade list of extra copies (quantity > 1). */
const B = window.BINDER || {};
const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const shekel = (n, d = 2) => n == null ? "—" :
  "₪" + Number(n).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const usd = (n) => n == null ? "" :
  "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: n >= 10 ? 0 : 2 });
const money = (ils, dollars) => ils == null ? "—" : `${shekel(ils)}${dollars != null ? " (" + usd(dollars) + ")" : ""}`;
const cardValueIls = (c) => (c && c.value && c.value.ils != null) ? Number(c.value.ils) : -1;
const extrasOf = (c) => Math.max(0, (c.quantity || 1) - 1);

const rarityMap = {
  "Illustration rare": "IR",
  "Special illustration rare": "SAR",
  "Ultra Rare": "UR",
  "Double rare": "ex",
  "Pikachu Rare": "Pikachu Rare",
  "RGB Rare": "RGB",
  "Mega Hyper Rare": "MHR",
  "Hyper Rare": "HR",
};
const rarityLabel = (c) => rarityMap[(c && c.rarity) || ""] || (c && c.rarity) || "";

const state = { set: "all" };

function allDuplicates() {
  return (B.cards || []).filter(c => extrasOf(c) > 0);
}

function tradeCards() {
  let cards = allDuplicates();
  if (state.set !== "all") cards = cards.filter(c => c.set_id === state.set);
  cards.sort((a, b) => extrasOf(b) - extrasOf(a) || cardValueIls(b) - cardValueIls(a) ||
    String(a.name).localeCompare(String(b.name)));
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

async function shareList() {
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

function render() {
  const cards = tradeCards();
  const all = allDuplicates();
  const extras = cards.reduce((s, c) => s + extrasOf(c), 0);
  const setsWithDups = [...new Set(all.map(c => c.set_id))];
  const setChips = [`<button type="button" class="wish-chip" data-set="all" aria-pressed="${state.set === "all" ? "true" : "false"}">All sets</button>`]
    .concat((B.sets || []).filter(s => setsWithDups.includes(s.id)).map(s =>
      `<button type="button" class="wish-chip" data-set="${escapeHtml(s.id)}" aria-pressed="${state.set === s.id ? "true" : "false"}">${escapeHtml(s.name)}</button>`
    )).join("");
  if ($("tradeFilters")) $("tradeFilters").innerHTML = `<div class="wish-row" role="toolbar" aria-label="Filter by set">${setChips}</div>`;
  if ($("tradeLead")) {
    $("tradeLead").textContent = cards.length
      ? `${cards.length} cards · ${extras} extra ${extras === 1 ? "copy" : "copies"} to trade. One copy of each stays in the album.`
      : "No extra copies in this filter.";
  }
  const root = $("tradeList");
  if (!root) return;
  if (!cards.length) {
    root.innerHTML = `<p class="wish-empty">No duplicates to trade${state.set === "all" ? " yet" : " in this set"}.</p>`;
    return;
  }
  root.innerHTML = cards.map(c => {
    const rare = rarityLabel(c);
    const extra = extrasOf(c);
    return `<article class="wish-item trade-item">
      <img src="${escapeHtml(c.art || "")}" alt="" width="52" height="72">
      <div>
        <h3 class="wish-name">${escapeHtml(c.name || "")}${rare ? `<span class="wish-rare">${escapeHtml(rare)}</span>` : ""}</h3>
        <p class="wish-meta">${escapeHtml(c.set_name || "")} · ${escapeHtml(c.number || "")}</p>
      </div>
      <div class="wish-side">
        <p class="wish-val">${valueOrDash(c)}</p>
        <p class="trade-extras">×${c.quantity} · ${extra} extra${extra === 1 ? "" : "s"}</p>
      </div>
    </article>`;
  }).join("");
}

function valueOrDash(c) {
  const v = c.value || {};
  return v.ils != null ? money(v.ils, v.usd) : "—";
}

function init() {
  render();
  if ($("tradeFilters")) $("tradeFilters").addEventListener("click", ev => {
    const btn = ev.target.closest("[data-set]");
    if (!btn) return;
    state.set = btn.dataset.set;
    render();
  });
  if ($("shareBtn")) $("shareBtn").addEventListener("click", shareList);
}

init();
