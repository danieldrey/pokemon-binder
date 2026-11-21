/* Centering / pre-grade tool (client-side).
 *
 * This is a centering-only estimate, not a surface / corners / edges grade
 * and not an official PSA, BGS, CGC, or TAG grade.
 *
 * Published front/back centering tolerances cited in THRESHOLDS below:
 *   PSA  https://www.psacard.com/gradingstandards
 *        (PSA 10 is official: 55/45 front, 75/25 back. Lower PSA grades
 *        use the widely published 60/40, 65/35, 70/30, 80/20 front and
 *        90/10 back tables used by centering tools.)
 *   BGS  Beckett Pristine 10 is 50/50 front and 55/45 back
 *        (hobby write-ups e.g. SI Hobby U; 9.5 / 9 / 8 tables as commonly
 *        published at https://www.centeringcheck.com/grading-standards).
 *   CGC  https://www.cgcgrading.com/grading-scales/
 *        Pristine 10 = 50/50; Gem Mint 10 = 55/45 front, 75/25 back;
 *        Mint 9 = 60/40 front, 90/10 back (published on sports/non-sports).
 *   TAG  https://taggrading.com/pages/rubric  (TCG back numbers)
 *        Pristine 10 ≈ 51/49 front, 52/48 back;
 *        Gem Mint 10 ≈ 55/45 front, 65/35 back;
 *        Mint 9 ≈ 60/40 front, 75/25 back.
 *
 * Standard TCG card size used for millimetre labels: 63.0 × 88.0 mm.
 */
(function (global) {
  const LS_KEY = "np-centering-v1";
  const CARD_W_MM = 63;
  const CARD_H_MM = 88;
  const EPS = 0.15;

  // max = largest allowed share of a pair (55 means 55/45 or better).
  const THRESHOLDS = {
    PSA: {
      source: "https://www.psacard.com/gradingstandards",
      front: [
        { grade: 10, max: 55 },
        { grade: 9, max: 60 },
        { grade: 8, max: 65 },
        { grade: 7, max: 70 },
        { grade: 6, max: 80 },
        { grade: 5, max: 85 },
        { grade: 4, max: 85 },
        { grade: 3, max: 90 },
        { grade: 1, max: 100 },
      ],
      back: [
        { grade: 10, max: 75 },
        { grade: 9, max: 90 },
        { grade: 8, max: 90 },
        { grade: 7, max: 90 },
        { grade: 6, max: 90 },
        { grade: 1, max: 100 },
      ],
    },
    BGS: {
      source: "Beckett Pristine 10 = 50/50 front, 55/45 back; lower grades as commonly published",
      front: [
        { grade: 10, max: 50 },
        { grade: 9.5, max: 55 },
        { grade: 9, max: 55 },
        { grade: 8, max: 60 },
        { grade: 7, max: 65 },
        { grade: 6, max: 70 },
        { grade: 5, max: 75 },
        { grade: 4, max: 80 },
        { grade: 3, max: 85 },
        { grade: 1, max: 100 },
      ],
      back: [
        { grade: 10, max: 55 },
        { grade: 9.5, max: 60 },
        { grade: 9, max: 70 },
        { grade: 8, max: 80 },
        { grade: 7, max: 90 },
        { grade: 6, max: 95 },
        { grade: 1, max: 100 },
      ],
    },
    CGC: {
      source: "https://www.cgcgrading.com/grading-scales/",
      front: [
        { grade: "10P", max: 50, numeric: 10, label: "10 Pristine" },
        { grade: 10, max: 55 },
        { grade: 9.5, max: 55 },
        { grade: 9, max: 60 },
        { grade: 8, max: 65 },
        { grade: 7, max: 70 },
        { grade: 6, max: 75 },
        { grade: 5, max: 80 },
        { grade: 4, max: 85 },
        { grade: 1, max: 100 },
      ],
      back: [
        { grade: "10P", max: 50, numeric: 10, label: "10 Pristine" },
        { grade: 10, max: 75 },
        { grade: 9.5, max: 75 },
        { grade: 9, max: 90 },
        { grade: 8, max: 90 },
        { grade: 7, max: 90 },
        { grade: 6, max: 90 },
        { grade: 1, max: 100 },
      ],
    },
    TAG: {
      source: "https://taggrading.com/pages/rubric",
      front: [
        { grade: "10P", max: 51, numeric: 10, label: "10 Pristine" },
        { grade: 10, max: 55 },
        { grade: 9, max: 60 },
        { grade: 8.5, max: 63 },
        { grade: 8, max: 65 },
        { grade: 7.5, max: 68 },
        { grade: 7, max: 70 },
        { grade: 6.5, max: 73 },
        { grade: 6, max: 75 },
        { grade: 5, max: 80 },
        { grade: 4, max: 85 },
        { grade: 3, max: 90 },
        { grade: 1, max: 100 },
      ],
      back: [
        { grade: "10P", max: 52, numeric: 10, label: "10 Pristine" },
        { grade: 10, max: 65 },
        { grade: 9, max: 75 },
        { grade: 8.5, max: 85 },
        { grade: 8, max: 95 },
        { grade: 1, max: 100 },
      ],
    },
  };

  function majorShare(a, b) {
    const t = a + b;
    if (t <= 0) return 50;
    return (100 * Math.max(a, b)) / t;
  }

  function ratioParts(a, b) {
    const t = a + b;
    if (t <= 0) return [50, 50];
    const first = Math.round((100 * a) / t);
    return [first, 100 - first];
  }

  function ratioLabel(a, b) {
    const [x, y] = ratioParts(a, b);
    return x + "/" + y;
  }

  function gradeForShare(share, table) {
    for (const row of table) {
      if (share <= row.max + EPS) {
        return {
          grade: row.grade,
          numeric: row.numeric != null ? row.numeric : row.grade,
          label: row.label || String(row.grade),
          max: row.max,
        };
      }
    }
    const last = table[table.length - 1];
    return {
      grade: last.grade,
      numeric: last.numeric != null ? last.numeric : last.grade,
      label: last.label || String(last.grade),
      max: last.max,
    };
  }

  function sideGrade(borders, side) {
    const lr = majorShare(borders.left, borders.right);
    const tb = majorShare(borders.top, borders.bottom);
    const worst = Math.max(lr, tb);
    const out = {};
    for (const company of Object.keys(THRESHOLDS)) {
      const table = THRESHOLDS[company][side === "back" ? "back" : "front"];
      out[company] = Object.assign({ share: worst, lr, tb }, gradeForShare(worst, table));
    }
    return out;
  }

  function combineGrades(frontBorders, backBorders) {
    const front = frontBorders ? sideGrade(frontBorders, "front") : null;
    const back = backBorders ? sideGrade(backBorders, "back") : null;
    const combined = {};
    for (const company of Object.keys(THRESHOLDS)) {
      if (front && back) {
        const f = front[company];
        const b = back[company];
        const worse = f.numeric <= b.numeric ? f : b;
        combined[company] = {
          grade: worse.grade,
          numeric: worse.numeric,
          label: worse.label,
          front: f.grade,
          back: b.grade,
          limitedBy: f.numeric <= b.numeric ? "front" : "back",
        };
      } else if (front) {
        combined[company] = Object.assign({ frontOnly: true }, front[company]);
      } else if (back) {
        combined[company] = Object.assign({ backOnly: true }, back[company]);
      }
    }
    return { front, back, combined };
  }

  function measureFromGuides(g, imgW, imgH) {
    const outerW = Math.max(1, g.r1 - g.l1);
    const outerH = Math.max(1, g.b1 - g.t1);
    const left = Math.max(0, g.l2 - g.l1);
    const right = Math.max(0, g.r1 - g.r2);
    const top = Math.max(0, g.t2 - g.t1);
    const bottom = Math.max(0, g.b1 - g.b2);
    const lr = ratioParts(left, right);
    const tb = ratioParts(top, bottom);
    return {
      left, right, top, bottom,
      lr, tb,
      lr_label: lr[0] + "/" + lr[1],
      tb_label: tb[0] + "/" + tb[1],
      lr_major: round1(majorShare(left, right)),
      tb_major: round1(majorShare(top, bottom)),
      borders_mm: {
        left: round2((left / outerW) * CARD_W_MM),
        right: round2((right / outerW) * CARD_W_MM),
        top: round2((top / outerH) * CARD_H_MM),
        bottom: round2((bottom / outerH) * CARD_H_MM),
      },
      image: { w: imgW, h: imgH },
    };
  }

  function round1(n) { return Math.round(n * 10) / 10; }
  function round2(n) { return Math.round(n * 100) / 100; }

  function defaultGuides(w, h) {
    // Typical even TCG coloured border (~5.5% of each side).
    const mx = w * 0.055;
    const my = h * 0.05;
    return { l1: 0, r1: w, t1: 0, b1: h, l2: mx, r2: w - mx, t2: my, b2: h - my };
  }

  function isGradingCandidate(card) {
    if (!card) return false;
    const s = (card.worth_grading && card.worth_grading.status) || "";
    return s === "need_graded_price" || s === "consider" || s === "candidate" || s === "worth_it" || s === "yes";
  }

  /* ---------- image helpers / auto-detect ---------- */

  function detectGuides(img) {
    const maxSide = 900;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(2, Math.round(img.width * scale));
    const h = Math.max(2, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const outer = findOuterRect(data, w, h);
    const inner = walkInner(data, w, h, outer);
    const inv = 1 / scale;
    return {
      l1: outer.l * inv,
      r1: outer.r * inv,
      t1: outer.t * inv,
      b1: outer.b * inv,
      l2: inner.l * inv,
      r2: inner.r * inv,
      t2: inner.t * inv,
      b2: inner.b * inv,
    };
  }

  function lumAt(data, w, x, y) {
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  function findOuterRect(data, w, h) {
    // If the card already fills the frame, use the image bounds.
    // Otherwise, trim uniform background (desk / paper) by walking in
    // from each side until the luminance leaves the edge-band average.
    const band = Math.max(2, Math.round(Math.min(w, h) * 0.015));
    function edgeMean(side) {
      let s = 0, n = 0;
      if (side === "l") {
        for (let y = 0; y < h; y++) for (let x = 0; x < band; x++) { s += lumAt(data, w, x, y); n++; }
      } else if (side === "r") {
        for (let y = 0; y < h; y++) for (let x = w - band; x < w; x++) { s += lumAt(data, w, x, y); n++; }
      } else if (side === "t") {
        for (let y = 0; y < band; y++) for (let x = 0; x < w; x++) { s += lumAt(data, w, x, y); n++; }
      } else {
        for (let y = h - band; y < h; y++) for (let x = 0; x < w; x++) { s += lumAt(data, w, x, y); n++; }
      }
      return n ? s / n : 0;
    }
    function variance(side, mean) {
      let s = 0, n = 0;
      const run = (x, y) => { const d = lumAt(data, w, x, y) - mean; s += d * d; n++; };
      if (side === "l") { for (let y = 0; y < h; y++) for (let x = 0; x < band; x++) run(x, y); }
      else if (side === "r") { for (let y = 0; y < h; y++) for (let x = w - band; x < w; x++) run(x, y); }
      else if (side === "t") { for (let y = 0; y < band; y++) for (let x = 0; x < w; x++) run(x, y); }
      else { for (let y = h - band; y < h; y++) for (let x = 0; x < w; x++) run(x, y); }
      return n ? s / n : 0;
    }
    const means = { l: edgeMean("l"), r: edgeMean("r"), t: edgeMean("t"), b: edgeMean("b") };
    const busy = ["l", "r", "t", "b"].some(s => variance(s, means[s]) > 180);
    if (busy) return { l: 0, r: w, t: 0, b: h };

    const thresh = 28;
    function walk(side) {
      const mean = means[side];
      const limit = Math.floor((side === "l" || side === "r" ? w : h) * 0.22);
      for (let i = 0; i < limit; i++) {
        let acc = 0, n = 0;
        if (side === "l") { for (let y = 0; y < h; y += 2) { acc += lumAt(data, w, i, y); n++; } if (Math.abs(acc / n - mean) > thresh) return i; }
        if (side === "r") { for (let y = 0; y < h; y += 2) { acc += lumAt(data, w, w - 1 - i, y); n++; } if (Math.abs(acc / n - mean) > thresh) return w - i; }
        if (side === "t") { for (let x = 0; x < w; x += 2) { acc += lumAt(data, w, x, i); n++; } if (Math.abs(acc / n - mean) > thresh) return i; }
        if (side === "b") { for (let x = 0; x < w; x += 2) { acc += lumAt(data, w, x, h - 1 - i); n++; } if (Math.abs(acc / n - mean) > thresh) return h - i; }
      }
      return null;
    }
    const l = walk("l"), r = walk("r"), t = walk("t"), b = walk("b");
    if (l == null || r == null || t == null || b == null || r - l < w * 0.5 || b - t < h * 0.5) {
      return { l: 0, r: w, t: 0, b: h };
    }
    // A cropped card already fills the frame: the corners are the printed
    // border, not a desk, so walking in would steal the real outer edge.
    if (cornersLookLikeCardBorder(data, w, h, means)) {
      return { l: 0, r: w, t: 0, b: h };
    }
    return { l, r, t, b };
  }

  function patchMean(data, w, x0, y0, size) {
    let s = 0, n = 0;
    for (let y = y0; y < y0 + size; y++) {
      for (let x = x0; x < x0 + size; x++) {
        if (x >= 0 && y >= 0 && x < w) { s += lumAt(data, w, x, y); n++; }
      }
    }
    return n ? s / n : 0;
  }

  function cornersLookLikeCardBorder(data, w, h, means) {
    const s = Math.max(4, Math.round(Math.min(w, h) * 0.03));
    const corners = [
      patchMean(data, w, 0, 0, s),
      patchMean(data, w, w - s, 0, s),
      patchMean(data, w, 0, h - s, s),
      patchMean(data, w, w - s, h - s, s),
    ];
    const avg = corners.reduce((a, b) => a + b, 0) / 4;
    const spread = Math.max(...corners) - Math.min(...corners);
    if (spread > 24) return false;
    // Corners agree with the mid-edge band (a printed border all around).
    const edgeAvg = (means.l + means.r + means.t + means.b) / 4;
    return Math.abs(avg - edgeAvg) < 18;
  }

  function walkInner(data, w, h, outer) {
    const ow = outer.r - outer.l;
    const oh = outer.b - outer.t;
    const maxInX = Math.floor(ow * 0.18);
    const maxInY = Math.floor(oh * 0.16);
    function borderMean(side) {
      let s = 0, n = 0;
      const depth = Math.max(2, Math.round((side === "l" || side === "r" ? ow : oh) * 0.012));
      if (side === "l") {
        for (let x = outer.l; x < outer.l + depth; x++) for (let y = outer.t; y < outer.b; y += 2) { s += lumAt(data, w, x, y); n++; }
      } else if (side === "r") {
        for (let x = outer.r - depth; x < outer.r; x++) for (let y = outer.t; y < outer.b; y += 2) { s += lumAt(data, w, x, y); n++; }
      } else if (side === "t") {
        for (let y = outer.t; y < outer.t + depth; y++) for (let x = outer.l; x < outer.r; x += 2) { s += lumAt(data, w, x, y); n++; }
      } else {
        for (let y = outer.b - depth; y < outer.b; y++) for (let x = outer.l; x < outer.r; x += 2) { s += lumAt(data, w, x, y); n++; }
      }
      return n ? s / n : 0;
    }
    function walk(side, mean) {
      const thresh = 22;
      if (side === "l") {
        for (let i = 2; i < maxInX; i++) {
          const x = outer.l + i;
          let acc = 0, n = 0;
          for (let y = outer.t + Math.floor(oh * 0.15); y < outer.b - Math.floor(oh * 0.15); y += 2) { acc += lumAt(data, w, x, y); n++; }
          if (n && Math.abs(acc / n - mean) > thresh) return x;
        }
        return outer.l + ow * 0.055;
      }
      if (side === "r") {
        for (let i = 2; i < maxInX; i++) {
          const x = outer.r - 1 - i;
          let acc = 0, n = 0;
          for (let y = outer.t + Math.floor(oh * 0.15); y < outer.b - Math.floor(oh * 0.15); y += 2) { acc += lumAt(data, w, x, y); n++; }
          if (n && Math.abs(acc / n - mean) > thresh) return x + 1;
        }
        return outer.r - ow * 0.055;
      }
      if (side === "t") {
        for (let i = 2; i < maxInY; i++) {
          const y = outer.t + i;
          let acc = 0, n = 0;
          for (let x = outer.l + Math.floor(ow * 0.15); x < outer.r - Math.floor(ow * 0.15); x += 2) { acc += lumAt(data, w, x, y); n++; }
          if (n && Math.abs(acc / n - mean) > thresh) return y;
        }
        return outer.t + oh * 0.05;
      }
      for (let i = 2; i < maxInY; i++) {
        const y = outer.b - 1 - i;
        let acc = 0, n = 0;
        for (let x = outer.l + Math.floor(ow * 0.15); x < outer.r - Math.floor(ow * 0.15); x += 2) { acc += lumAt(data, w, x, y); n++; }
        if (n && Math.abs(acc / n - mean) > thresh) return y + 1;
      }
      return outer.b - oh * 0.05;
    }
    const l = walk("l", borderMean("l"));
    const r = walk("r", borderMean("r"));
    const t = walk("t", borderMean("t"));
    const b = walk("b", borderMean("b"));
    if (r - l < ow * 0.55 || b - t < oh * 0.55) {
      return {
        l: outer.l + ow * 0.055,
        r: outer.r - ow * 0.055,
        t: outer.t + oh * 0.05,
        b: outer.b - oh * 0.05,
      };
    }
    return { l, r, t, b };
  }

  /* ---------- persistence ---------- */

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; }
  }
  function storeSaved(arr) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  /* ---------- UI state ---------- */

  const state = {
    open: false,
    card: null,
    side: "front",
    front: null, // { img, url, guides, measure }
    back: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    rotate: 0,
    drag: null,
    forceBack: false,
  };

  function $(id) { return document.getElementById(id); }

  function currentSlot() { return state[state.side]; }

  function wantsBack() {
    // Unlinked photos can measure both sides. A known cheap card only
    // asks for the back if it might be worth grading, or if the user
    // explicitly chooses "measure the back anyway".
    if (!state.card) return true;
    return isGradingCandidate(state.card) || state.forceBack;
  }

  function render() {
    const empty = $("centerEmpty");
    const work = $("centerWork");
    const slot = currentSlot();
    if (empty) empty.hidden = !!slot;
    if (work) work.hidden = !slot;
    const toggleBack = $("centerSideBack");
    const backHint = $("centerBackHint");
    const needBack = wantsBack();
    if (toggleBack) {
      toggleBack.disabled = !needBack && !state.back;
      toggleBack.setAttribute("aria-disabled", toggleBack.disabled ? "true" : "false");
    }
    if (backHint) {
      if (!state.card) {
        backHint.hidden = true;
      } else if (needBack && !state.back) {
        backHint.hidden = false;
        backHint.textContent = "This card may be worth grading — photograph the back too. The final estimate uses both sides.";
        backHint.className = "center-hint warn";
      } else if (!needBack) {
        backHint.hidden = false;
        backHint.innerHTML = "Back centering is only asked for cards that might be worth grading. <button type=\"button\" class=\"center-inline\" id=\"centerForceBack\">Measure the back anyway</button>";
        backHint.className = "center-hint";
        const btn = $("centerForceBack");
        if (btn) btn.onclick = () => { state.forceBack = true; state.side = "back"; syncSideButtons(); render(); };
      } else {
        backHint.hidden = true;
      }
    }
    const title = $("centerCardLabel");
    if (title) {
      title.textContent = state.card
        ? ((state.card.name || state.card.id) + (state.card.set_name ? " · " + state.card.set_name : "") + (state.card.number ? " · " + state.card.number : ""))
        : "No card selected — you can still measure a photo";
    }
    drawStage();
    renderMetrics();
    renderSaved();
  }

  function syncSideButtons() {
    const f = $("centerSideFront");
    const b = $("centerSideBack");
    if (f) f.setAttribute("aria-pressed", state.side === "front" ? "true" : "false");
    if (b) b.setAttribute("aria-pressed", state.side === "back" ? "true" : "false");
  }

  function drawStage() {
    const canvas = $("centerCanvas");
    const slot = currentSlot();
    if (!canvas || !slot || !slot.img) return;
    const wrap = $("centerStage");
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.max(200, rect.width);
    const cssH = Math.max(220, rect.height);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const img = slot.img;
    const rot = ((state.rotate % 360) + 360) % 360;
    const swapped = rot === 90 || rot === 270;
    const iw = swapped ? img.height : img.width;
    const ih = swapped ? img.width : img.height;
    const fit = Math.min(cssW / iw, cssH / ih);
    const scale = fit * state.zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const ox = (cssW - dw) / 2 + state.panX;
    const oy = (cssH - dh) / 2 + state.panY;
    slot.view = { ox, oy, scale, cssW, cssH, iw, ih, rot };

    ctx.save();
    ctx.translate(ox + dw / 2, oy + dh / 2);
    ctx.rotate(rot * Math.PI / 180);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const g = slot.guides;
    const p = toView(slot, g.l1, g.t1);
    const q = toView(slot, g.r1, g.b1);
    const i0 = toView(slot, g.l2, g.t2);
    const i1 = toView(slot, g.r2, g.b2);
    drawBox(ctx, p.x, p.y, q.x, q.y, "#7CFF6B", 2);
    drawBox(ctx, i0.x, i0.y, i1.x, i1.y, "#E8C36A", 2);
    const handles = handleList(slot);
    for (const hnd of handles) {
      ctx.beginPath();
      ctx.arc(hnd.x, hnd.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = hnd.kind === "outer" ? "#7CFF6B" : "#E8C36A";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#111";
      ctx.stroke();
    }
  }

  function drawBox(ctx, x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  }

  function toView(slot, ix, iy) {
    const v = slot.view;
    return { x: v.ox + ix * v.scale, y: v.oy + iy * v.scale };
  }
  function fromView(slot, vx, vy) {
    const v = slot.view;
    return { x: (vx - v.ox) / v.scale, y: (vy - v.oy) / v.scale };
  }

  function handleList(slot) {
    const g = slot.guides;
    const midX = (g.l1 + g.r1) / 2;
    const midY = (g.t1 + g.b1) / 2;
    const midX2 = (g.l2 + g.r2) / 2;
    const midY2 = (g.t2 + g.b2) / 2;
    const pts = [
      { key: "t1", kind: "outer", ix: midX, iy: g.t1 },
      { key: "b1", kind: "outer", ix: midX, iy: g.b1 },
      { key: "l1", kind: "outer", ix: g.l1, iy: midY },
      { key: "r1", kind: "outer", ix: g.r1, iy: midY },
      { key: "t2", kind: "inner", ix: midX2, iy: g.t2 },
      { key: "b2", kind: "inner", ix: midX2, iy: g.b2 },
      { key: "l2", kind: "inner", ix: g.l2, iy: midY2 },
      { key: "r2", kind: "inner", ix: g.r2, iy: midY2 },
    ];
    return pts.map(p => {
      const v = toView(slot, p.ix, p.iy);
      return Object.assign(p, v);
    });
  }

  function renderMetrics() {
    const slot = currentSlot();
    const mEl = $("centerMetrics");
    const gEl = $("centerGrades");
    if (!mEl || !gEl) return;
    if (!slot || !slot.img) {
      mEl.innerHTML = "";
      gEl.innerHTML = "";
      return;
    }
    const m = measureFromGuides(slot.guides, slot.img.width, slot.img.height);
    slot.measure = m;
    const frontM = state.front && state.front.measure;
    const backM = state.back && state.back.measure;
    const pred = combineGrades(
      frontM && { left: frontM.left, right: frontM.right, top: frontM.top, bottom: frontM.bottom },
      backM && { left: backM.left, right: backM.right, top: backM.top, bottom: backM.bottom }
    );
    state.prediction = pred;
    const sideLabel = state.side === "back" ? "Back" : "Front";
    mEl.innerHTML = `
      <div class="center-ratio"><span>L/R</span><b id="centerLR">${m.lr_label}</b></div>
      <div class="center-ratio"><span>T/B</span><b id="centerTB">${m.tb_label}</b></div>
      <div class="center-mm" id="centerMM">
        ${sideLabel} borders:
        L ${m.borders_mm.left.toFixed(2)} mm ·
        R ${m.borders_mm.right.toFixed(2)} mm ·
        T ${m.borders_mm.top.toFixed(2)} mm ·
        B ${m.borders_mm.bottom.toFixed(2)} mm
      </div>`;
    const use = (frontM && backM) ? pred.combined : (state.side === "back" ? pred.back : pred.front);
    const mode = (frontM && backM) ? "Front + back" : (sideLabel + " only");
    const companies = ["TAG", "BGS", "CGC", "PSA"];
    gEl.innerHTML = `<p class="center-grades-label">${mode} · centering only</p><div class="center-grade-row">` +
      companies.map(c => {
        const g = use[c];
        const sub = (frontM && backM && pred.combined[c])
          ? `F ${fmtGrade(pred.combined[c].front)} · B ${fmtGrade(pred.combined[c].back)}`
          : "";
        return `<div class="center-grade" data-company="${c}">
          <span>${c}</span><b>${fmtGrade(g.grade)}</b>
          ${sub ? `<em>${sub}</em>` : ""}
        </div>`;
      }).join("") + `</div>`;
  }

  function fmtGrade(g) {
    if (g == null) return "—";
    if (g === "10P") return "10P";
    return String(g);
  }

  function renderSaved() {
    const el = $("centerSaved");
    if (!el) return;
    const rows = loadSaved();
    if (!rows.length) { el.innerHTML = ""; return; }
    el.innerHTML = `<h3>Saved on this device</h3>` + rows.slice().reverse().map((r, idx) => {
      const i = rows.length - 1 - idx;
      const g = r.grades || {};
      return `<div class="center-saved-row" data-saved="${i}">
        <div><b>${escapeHtml(r.name || r.id || "Untitled")}</b>
        <span>${escapeHtml(r.front && r.front.lr_label || "—")} · ${escapeHtml(r.front && r.front.tb_label || "—")}${r.back ? " · back " + escapeHtml(r.back.lr_label) : ""}</span>
        <span>PSA ${fmtGrade(g.PSA)} · BGS ${fmtGrade(g.BGS)} · CGC ${fmtGrade(g.CGC)} · TAG ${fmtGrade(g.TAG)}</span></div>
        <button type="button" class="hud-btn quiet" data-forget="${i}">Remove</button>
      </div>`;
    }).join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setImage(fileOrUrl, side) {
    const url = typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl);
    const img = new Image();
    img.onload = () => {
      let guides;
      try { guides = detectGuides(img); } catch (e) { guides = defaultGuides(img.width, img.height); }
      state[side] = { img, url, guides, measure: null };
      state.side = side;
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      state.rotate = 0;
      syncSideButtons();
      render();
    };
    img.onerror = () => { console.warn("centering: failed to load image"); };
    img.src = url;
  }

  function hitHandle(slot, x, y) {
    const hs = handleList(slot);
    let best = null, bestD = 22;
    for (const h of hs) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  }

  function pointerPos(ev, canvas) {
    const r = canvas.getBoundingClientRect();
    const t = ev.touches ? ev.touches[0] : ev;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function bindStage() {
    const canvas = $("centerCanvas");
    if (!canvas || canvas.dataset.bound) return;
    canvas.dataset.bound = "1";
    let lastPinch = null;
    const down = ev => {
      const slot = currentSlot();
      if (!slot || !slot.view) return;
      if (ev.touches && ev.touches.length === 2) {
        lastPinch = pinchInfo(ev);
        ev.preventDefault();
        return;
      }
      const p = pointerPos(ev, canvas);
      const h = hitHandle(slot, p.x, p.y);
      if (h) {
        state.drag = { key: h.key, x: p.x, y: p.y };
        ev.preventDefault();
      } else if (state.zoom > 1.02) {
        state.drag = { pan: true, x: p.x, y: p.y, panX: state.panX, panY: state.panY };
        ev.preventDefault();
      }
    };
    const move = ev => {
      const slot = currentSlot();
      if (!slot) return;
      if (ev.touches && ev.touches.length === 2) {
        const info = pinchInfo(ev);
        if (lastPinch) {
          const mid = { x: info.x, y: info.y };
          const factor = info.dist / lastPinch.dist;
          zoomAt(mid, factor);
        }
        lastPinch = info;
        ev.preventDefault();
        return;
      }
      if (!state.drag) return;
      const p = pointerPos(ev, canvas);
      if (state.drag.pan) {
        state.panX = state.drag.panX + (p.x - state.drag.x);
        state.panY = state.drag.panY + (p.y - state.drag.y);
        drawStage();
        ev.preventDefault();
        return;
      }
      const imgPt = fromView(slot, p.x, p.y);
      const g = slot.guides;
      const key = state.drag.key;
      if (key === "l1") g.l1 = Math.min(imgPt.x, g.l2 - 2);
      else if (key === "r1") g.r1 = Math.max(imgPt.x, g.r2 + 2);
      else if (key === "t1") g.t1 = Math.min(imgPt.y, g.t2 - 2);
      else if (key === "b1") g.b1 = Math.max(imgPt.y, g.b2 + 2);
      else if (key === "l2") g.l2 = Math.max(g.l1 + 2, Math.min(imgPt.x, g.r2 - 4));
      else if (key === "r2") g.r2 = Math.min(g.r1 - 2, Math.max(imgPt.x, g.l2 + 4));
      else if (key === "t2") g.t2 = Math.max(g.t1 + 2, Math.min(imgPt.y, g.b2 - 4));
      else if (key === "b2") g.b2 = Math.min(g.b1 - 2, Math.max(imgPt.y, g.t2 + 4));
      renderMetrics();
      drawStage();
      ev.preventDefault();
    };
    const up = () => { state.drag = null; lastPinch = null; };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    canvas.addEventListener("wheel", ev => {
      ev.preventDefault();
      const p = pointerPos(ev, canvas);
      zoomAt(p, ev.deltaY < 0 ? 1.08 : 1 / 1.08);
    }, { passive: false });
  }

  function pinchInfo(ev) {
    const a = ev.touches[0], b = ev.touches[1];
    return {
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    };
  }

  function zoomAt(pt, factor) {
    const next = Math.max(1, Math.min(6, state.zoom * factor));
    // Keep the point under the fingers roughly stable.
    const k = next / state.zoom;
    const canvas = $("centerCanvas");
    const r = canvas.getBoundingClientRect();
    const cx = r.width / 2, cy = r.height / 2;
    state.panX = pt.x - cx - (pt.x - cx - state.panX) * k;
    state.panY = pt.y - cy - (pt.y - cy - state.panY) * k;
    state.zoom = next;
    if (state.zoom === 1) { state.panX = 0; state.panY = 0; }
    drawStage();
  }

  function saveCurrent() {
    const frontM = state.front && state.front.measure;
    if (!frontM) return;
    const backM = state.back && state.back.measure;
    if (wantsBack() && !backM) {
      const go = confirm("This card may be worth grading. Measure the back before saving? Click Cancel to save the front only.");
      if (go) { state.side = "back"; syncSideButtons(); render(); return; }
    }
    const pred = combineGrades(
      frontM && { left: frontM.left, right: frontM.right, top: frontM.top, bottom: frontM.bottom },
      backM && { left: backM.left, right: backM.right, top: backM.top, bottom: backM.bottom }
    );
    const grades = {};
    const src = (frontM && backM) ? pred.combined : pred.front;
    for (const c of Object.keys(src)) grades[c] = src[c].grade;
    const row = {
      id: state.card && state.card.id || null,
      name: state.card && state.card.name || null,
      saved_at: new Date().toISOString(),
      front: pickMeasure(frontM),
      back: backM ? pickMeasure(backM) : null,
      grades,
      disclaimer: "Centering-only estimate, not surface/corners/edges, and not an official grade.",
    };
    const all = loadSaved().filter(r => !(row.id && r.id === row.id));
    all.push(row);
    storeSaved(all);
    renderSaved();
    const toast = $("centerToast");
    if (toast) {
      toast.hidden = false;
      toast.textContent = "Saved on this device";
      setTimeout(() => { toast.hidden = true; }, 1800);
    }
  }

  function pickMeasure(m) {
    return {
      lr_label: m.lr_label,
      tb_label: m.tb_label,
      lr: m.lr,
      tb: m.tb,
      borders_mm: m.borders_mm,
    };
  }

  function exportSaved() {
    const blob = new Blob([JSON.stringify({ schema: "nextpull-centering/v1", saved: loadSaved() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "centering-estimates.json";
    a.click();
  }

  function fillCardSelect() {
    const sel = $("centerCardSelect");
    if (!sel) return;
    const cards = ((global.BINDER || {}).cards || []).filter(c => c && c.id);
    const cur = state.card && state.card.id || "";
    sel.innerHTML = `<option value="">Not linked to a card</option>` +
      cards.map(c => `<option value="${escapeHtml(c.id)}"${c.id === cur ? " selected" : ""}>${escapeHtml((c.name || c.id) + " · " + (c.number || "") )}</option>`).join("");
  }

  function onCardPicked(id) {
    const cards = ((global.BINDER || {}).cards || []);
    state.card = cards.find(c => c.id === id) || null;
    state.forceBack = false;
    render();
  }

  function open(opts) {
    const el = $("center");
    if (!el) return;
    if (typeof global.closeToc === "function") global.closeToc();
    ["hits", "wish", "value", "trade", "pack"].forEach(id => {
      const n = $(id);
      if (n) n.hidden = true;
    });
    if (opts && opts.card) state.card = opts.card;
    if (opts && opts.side) state.side = opts.side;
    el.hidden = false;
    state.open = true;
    if ($("centerBtn")) $("centerBtn").setAttribute("aria-expanded", "true");
    fillCardSelect();
    syncSideButtons();
    render();
    bindStage();
    if ($("centerClose")) $("centerClose").focus();
    requestAnimationFrame(() => drawStage());
  }

  function close() {
    const el = $("center");
    if (!el || el.hidden) return;
    el.hidden = true;
    state.open = false;
    if ($("centerBtn")) $("centerBtn").setAttribute("aria-expanded", "false");
  }

  function bind() {
    if ($("centerBtn")) $("centerBtn").addEventListener("click", () => $("center").hidden ? open() : close());
    if ($("centerClose")) $("centerClose").addEventListener("click", close);
    if ($("centerBackdrop")) $("centerBackdrop").addEventListener("click", close);
    const cam = $("centerCamera");
    const up = $("centerUpload");
    if (cam) cam.addEventListener("change", ev => { const f = ev.target.files && ev.target.files[0]; if (f) setImage(f, state.side); ev.target.value = ""; });
    if (up) up.addEventListener("change", ev => { const f = ev.target.files && ev.target.files[0]; if (f) setImage(f, state.side); ev.target.value = ""; });
    if ($("centerSideFront")) $("centerSideFront").addEventListener("click", () => { state.side = "front"; syncSideButtons(); render(); });
    if ($("centerSideBack")) $("centerSideBack").addEventListener("click", () => {
      if (!wantsBack() && !state.back) return;
      state.side = "back";
      syncSideButtons();
      render();
    });
    if ($("centerAuto")) $("centerAuto").addEventListener("click", () => {
      const slot = currentSlot();
      if (!slot || !slot.img) return;
      try { slot.guides = detectGuides(slot.img); } catch (e) { slot.guides = defaultGuides(slot.img.width, slot.img.height); }
      render();
    });
    if ($("centerResetZoom")) $("centerResetZoom").addEventListener("click", () => { state.zoom = 1; state.panX = 0; state.panY = 0; drawStage(); });
    if ($("centerRotLeft")) $("centerRotLeft").addEventListener("click", () => { state.rotate = (state.rotate + 270) % 360; drawStage(); });
    if ($("centerRotRight")) $("centerRotRight").addEventListener("click", () => { state.rotate = (state.rotate + 90) % 360; drawStage(); });
    if ($("centerSave")) $("centerSave").addEventListener("click", saveCurrent);
    if ($("centerExport")) $("centerExport").addEventListener("click", exportSaved);
    if ($("centerCardSelect")) $("centerCardSelect").addEventListener("change", ev => onCardPicked(ev.target.value));
    if ($("centerSaved")) $("centerSaved").addEventListener("click", ev => {
      const forget = ev.target.closest("[data-forget]");
      if (forget) {
        const all = loadSaved();
        all.splice(Number(forget.dataset.forget), 1);
        storeSaved(all);
        renderSaved();
      }
    });
    window.addEventListener("resize", () => { if (state.open) drawStage(); });
  }

  global.CenteringTool = {
    THRESHOLDS,
    majorShare,
    ratioParts,
    ratioLabel,
    measureFromGuides,
    combineGrades,
    sideGrade,
    isGradingCandidate,
    detectGuides,
    defaultGuides,
    predictFromRatios(front, back) {
      const toB = r => r && {
        left: r.lr[0], right: r.lr[1], top: r.tb[0], bottom: r.tb[1],
      };
      return combineGrades(toB(front), toB(back));
    },
    setGuidesForTest(side, guides, width, height) {
      const prev = state[side] || {};
      const img = prev.img && prev.img.width ? prev.img : { width: width || 630, height: height || 880 };
      state[side] = {
        img, url: prev.url || "",
        guides, measure: measureFromGuides(guides, img.width || width || 630, img.height || height || 880),
        view: prev.view || null,
      };
      state.side = side;
      render();
      return state[side].measure;
    },
    loadImageForTest(url, side) { return new Promise(res => { setImage(url, side || "front"); const t = setInterval(() => { if (state[side || "front"] && state[side || "front"].img) { clearInterval(t); res(state[side || "front"]); } }, 40); }); },
    open, close, bind, state, loadSaved,
  };
})(window);
