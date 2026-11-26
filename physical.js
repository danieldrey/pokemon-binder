(function () {
  const B = window.BINDER || {};
  const P = B.physical || {};
  const sides = P.sides || [];
  const spreads = P.spreads || [];
  const counts = P.counts || {};
  let idx = 0;

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function renderMeta() {
    const tot = B.totals || {};
    if ($("hudMeta")) {
      $("hudMeta").innerHTML = `<b>${counts.sheets || 0}</b> דפים · <b>${counts.binder_copies || 0}</b> קלפים בבינדר`;
    }
    if ($("binderNote")) $("binderNote").textContent = (P.binder && P.binder.source_he) || "";
    if ($("layoutRule")) $("layoutRule").textContent = (P.binder && P.binder.layout_he) || "";
    if ($("capacityNote")) $("capacityNote").textContent = (P.binder && P.binder.capacity_he) || "";
    if ($("sleeveRule")) $("sleeveRule").textContent = (P.sleeve_rule && P.sleeve_rule.text_he) || "";
    if ($("stats")) {
      $("stats").innerHTML = [
        ["קלפים בכיסים", counts.binder_copies],
        ["עם סליב", counts.sleeved],
        ["בלי סליב", counts.unsleeved],
        ["צדדי דף", counts.sides],
        ["דפי קלסר", counts.sheets],
        ["כיסים ריקים בגבולות סט", counts.empty_pockets],
        ["עותקי טופלואדר", counts.toploader_unique ?? counts.toploader_copies],
        ["כיסים שמורים לחסרים", counts.placeholders_missing],
        ["כיסים שמורים לטופלואדר", counts.placeholders_toploader],
        ["כפולים באחסון", counts.storage_copies],
      ].map(([k, v]) => `<span class="phys-stat">${esc(k)}: <b>${esc(v)}</b></span>`).join("");
    }
  }

  function renderToploaders() {
    const grid = $("toploaderGrid");
    const list = P.toploaders || [];
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = "<p class='phys-box-lead'>אין קלפים מסומנים לטופלואדר.</p>";
      return;
    }
    grid.innerHTML = list.map((c) => {
      const img = c.art ? `<img src="${esc(c.art)}" alt="${esc(c.name)}" loading="lazy" decoding="async">` : "";
      const qty = (c.quantity || 1) > 1 ? `<div class="tl-qty">×${c.quantity}</div>` : "";
      const num = c.number ? `#${esc(c.number)}` : "";
      const usd = c.usd != null ? ` · $${Number(c.usd).toFixed(2)}` : "";
      return `<article class="tl-card">${img}<p class="tl-name">${esc(c.name)}</p>
        <p class="tl-meta">${esc(c.set_name || c.set_id || "")} ${num}${usd}</p>${qty}</article>`;
    }).join("");
  }


  function renderStorage() {
    const grid = $("storageGrid");
    const list = P.storage || [];
    const lead = $("storageLead");
    const section = $("storageSection");
    if (!grid) return;
    const extras = counts.storage_copies || 0;
    const unique = counts.storage_unique || list.length;
    if (lead) {
      lead.textContent = extras
        ? `${extras} עותקים עודפים של ${unique} קלפים. עותק אחד מכל מספר נשאר בבינדר או בטופלואדר, והשאר בקופסת האחסון.`
        : "אין כרגע עותקים כפולים להעביר לקופסת האחסון.";
    }
    if (!list.length) {
      grid.innerHTML = "";
      return;
    }
    grid.innerHTML = list.map((c) => {
      const img = c.art ? `<img src="${esc(c.art)}" alt="${esc(c.name)}" loading="lazy" decoding="async">` : "";
      const qty = `<div class="tl-qty">×${c.extra_copies || c.quantity || 1}</div>`;
      const num = c.number ? `#${esc(c.number)}` : "";
      const kept = c.kept_label_he || (c.kept_in === "toploader" ? "בקופסת הטופלואדרים" : "בבינדר");
      return `<article class="tl-card storage-card">${img}<p class="tl-name">${esc(c.name)}</p>
        <p class="tl-meta">${esc(c.set_name || c.set_id || "")} ${num}</p>
        <p class="tl-meta">עותק נבחר: ${esc(kept)}</p>${qty}</article>`;
    }).join("");
  }


  function pct(share) {
    if (share == null) return "";
    return `${Math.round(Number(share) * 1000) / 10}%`;
  }

  function renderSetTable() {
    const table = $("setTable");
    if (!table) return;
    const body = table.querySelector("tbody");
    if (!body) return;
    const rows = P.set_summaries || [];
    body.innerHTML = rows.map((s) => {
      const mode = s.expanded ? "מורחב, כל המספרים" : "צפוף, רק מה שיש";
      const reserved = s.expanded ? (s.reserved ?? ((s.placeholders_missing || 0) + (s.placeholders_toploader || 0))) : "—";
      return `<tr class="${s.expanded ? "expanded" : "compact"}">
        <td>${esc(s.set_name || s.set_id)}</td>
        <td>${esc(s.owned_unique)} <span class="share">${esc(pct(s.share))}</span></td>
        <td>${esc(s.set_size)}</td>
        <td>${esc(reserved)}</td>
        <td>${mode}</td>
      </tr>`;
    }).join("");
  }

  function renderJump() {
    const host = $("setJump");
    if (!host) return;
    const seen = new Map();
    sides.forEach((s) => {
      if (s.set_id && !seen.has(s.set_id)) seen.set(s.set_id, s);
    });
    host.innerHTML = [...seen.values()].map((s) => {
      const spreadAt = spreads.findIndex((sp) => sp.left === s.side_index || sp.right === s.side_index);
      return `<button type="button" data-spread="${spreadAt < 0 ? 0 : spreadAt}">${esc(s.set_name || s.set_id)}</button>`;
    }).join("");
    host.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => show(Number(btn.dataset.spread)));
    });
  }

  function pocketHtml(p, i) {
    if (!p) return `<div class="pocket empty" aria-label="כיס ריק ${i + 1}"></div>`;
    const kind = p.kind || "owned";
    const img = p.art ? `<img src="${esc(p.art)}" alt="${esc(p.name)}" loading="lazy" decoding="async">` : "";
    const num = p.number ? `#${esc(p.number)}` : "";
    if (kind === "missing") {
      return `<div class="pocket missing" aria-label="חסר ${esc(p.name)} ${num}">
        ${img}<span class="badge wait">חסר</span>
        <div class="cap"><b>${esc(p.name)}</b>${num}</div>
      </div>`;
    }
    if (kind === "toploader") {
      return `<div class="pocket toploader-slot" aria-label="${esc(p.name)} בטופלואדר">
        ${img}<span class="badge tl">בטופלואדר</span>
        <div class="cap"><b>${esc(p.name)}</b>${num}</div>
      </div>`;
    }
    const badge = p.sleeved
      ? `<span class="badge sleeve">סליב</span>`
      : `<span class="badge bare">בלי סליב</span>`;
    const copy = p.copies > 1 ? `<span class="copy">${p.copy}/${p.copies}</span>` : "";
    return `<div class="pocket filled">
      ${img}${badge}${copy}
      <div class="cap"><b>${esc(p.name)}</b>${num}</div>
    </div>`;
  }

  function sideHtml(side, fallback) {
    if (!side) {
      return `<div class="phys-side cover">${esc(fallback)}</div>`;
    }
    const pockets = (side.pockets || []).map((p, i) => pocketHtml(p, i)).join("");
    return `<div class="phys-side" data-side="${side.side_index}" data-set="${esc(side.set_id || "")}">
      <div class="phys-side-label">
        <span>${esc(side.label_he)}</span>
        <span class="set">${esc(side.set_name || "")}</span>
      </div>
      <div class="phys-grid">${pockets}</div>
    </div>`;
  }

  function show(next) {
    if (!spreads.length) return;
    idx = Math.max(0, Math.min(spreads.length - 1, next));
    const sp = spreads[idx];
    const left = sp.left ? sides[sp.left - 1] : null;
    const right = sp.right ? sides[sp.right - 1] : null;
    $("spreadHost").innerHTML = `<div class="phys-spread" data-spread="${esc(sp.id)}">
      ${sideHtml(left, "הכיסוי")}
      <div class="phys-rings" aria-hidden="true"></div>
      ${sideHtml(right, "הכיסוי האחורי")}
    </div>`;
    $("spreadStatus").textContent = `${sp.title_he}  ·  ${idx + 1} מתוך ${spreads.length}`;
    $("prevSpread").disabled = idx <= 0;
    $("nextSpread").disabled = idx >= spreads.length - 1;
  }

  function bind() {
    $("prevSpread").addEventListener("click", () => show(idx - 1));
    $("nextSpread").addEventListener("click", () => show(idx + 1));
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") show(idx + 1);
      if (e.key === "ArrowLeft") show(idx - 1);
    });
  }

  renderMeta();
  renderSetTable();
  renderToploaders();
  renderStorage();
  renderJump();
  bind();
  show(0);
})();
