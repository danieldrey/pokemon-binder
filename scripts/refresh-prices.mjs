#!/usr/bin/env node
/**
 * Weekly price refresh for Daniel's Binder (GitHub Pages).
 * Fetches Bank of Israel FX and TCGdex market prices, updates data.js /
 * data.json, and appends a dated snapshot of the collection value.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TCGDEX = "https://api.tcgdex.net/v2";
const BOI = "https://www.boi.org.il/PublicApi/GetExchangeRate";
const UA = "NextPullIL-binder/1.0 (https://github.com/danieldrey/pokemon-binder)";
const CONCURRENCY = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, retries = 3) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.ok) return await res.json();
      last = new Error(`${url} -> HTTP ${res.status}`);
    } catch (err) {
      last = err;
    }
    await sleep(400 * (i + 1));
  }
  throw last;
}

async function fetchFx(fallback = 3.25) {
  const out = {
    usd_ils: fallback,
    eur_ils: null,
    usd_date: null,
    eur_date: null,
    source: "fallback",
    fetched_at: new Date().toISOString(),
  };
  try {
    const usd = await getJson(`${BOI}?key=USD`);
    out.usd_ils = Number(usd.currentExchangeRate);
    out.usd_date = String(usd.lastUpdate || "").slice(0, 10) || null;
    out.usd_last_update = usd.lastUpdate || null;
    out.source = "Bank of Israel";
  } catch (err) {
    out.usd_error = String(err);
  }
  try {
    const eur = await getJson(`${BOI}?key=EUR`);
    out.eur_ils = Number(eur.currentExchangeRate);
    out.eur_date = String(eur.lastUpdate || "").slice(0, 10) || null;
    out.eur_last_update = eur.lastUpdate || null;
  } catch (err) {
    out.eur_error = String(err);
  }
  return out;
}

function pickMarket(pricing, fx) {
  const empty = { usd: null, ils: null, currency_used: null, variant: null, source: null, source_updated: null, detail: null };
  if (!pricing) return empty;
  const tcg = pricing.tcgplayer || {};
  const variants = ["holofoil", "normal", "reverse", "reverse-holofoil", "unlimited-holofoil", "1st-edition-holofoil", "unlimited", "1st-edition"];
  for (const variant of variants) {
    const block = tcg[variant];
    if (!block || typeof block !== "object" || block.marketPrice == null) continue;
    const usd = Number(block.marketPrice);
    const updated = tcg.updated || null;
    return {
      usd: Math.round(usd * 100) / 100,
      ils: fx.usd_ils != null ? Math.round(usd * fx.usd_ils * 100) / 100 : null,
      currency_used: "USD",
      variant,
      source: "TCGplayer market via TCGdex",
      source_updated: updated ? String(updated).slice(0, 10) : null,
      source_updated_full: updated,
      detail: { low: block.lowPrice ?? null, mid: block.midPrice ?? null, high: block.highPrice ?? null, market: block.marketPrice },
    };
  }
  const cm = pricing.cardmarket || {};
  const eurVal = cm.trend ?? cm.avg ?? cm["trend-holo"] ?? cm["avg-holo"];
  if (eurVal != null && fx.eur_ils) {
    const eur = Number(eurVal);
    const ils = eur * Number(fx.eur_ils);
    const usd = fx.usd_ils ? ils / fx.usd_ils : null;
    const updated = cm.updated || null;
    const which = cm.trend != null ? "trend" : "avg";
    return {
      usd: usd != null ? Math.round(usd * 100) / 100 : null,
      ils: Math.round(ils * 100) / 100,
      currency_used: "EUR",
      variant: which,
      source: "Cardmarket via TCGdex (converted with Bank of Israel EUR and USD rates)",
      source_updated: updated ? String(updated).slice(0, 10) : null,
      source_updated_full: updated,
      detail: { eur, field: which },
    };
  }
  return empty;
}

function valueFromPrice(price) {
  const has = price && price.ils != null;
  return {
    usd: price?.usd ?? null,
    ils: price?.ils ?? null,
    usd_low: null, ils_low: null, usd_high: null, ils_high: null,
    is_range: false,
    kind: has ? "raw_market" : "missing",
    source: price?.source ?? null,
    source_updated: price?.source_updated ?? null,
  };
}

async function fetchCard(id) {
  let last;
  for (const lang of ["en", "ja"]) {
    try {
      const raw = await getJson(`${TCGDEX}/${lang}/cards/${id}`);
      raw._lang = lang;
      return raw;
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function applyPrice(card, price, rarity) {
  if (rarity && !card.rarity) card.rarity = rarity;
  if (!price || price.ils == null) return false;
  card.price = price;
  card.value = valueFromPrice(price);
  return true;
}

function sumOwned(cards) {
  let ils = 0, usd = 0, unique = 0, copies = 0, priced = 0;
  for (const c of cards) {
    const qty = c.quantity || 1;
    copies += qty;
    unique += 1;
    const v = c.value || {};
    if (v.ils != null) {
      ils += Number(v.ils) * qty;
      usd += Number(v.usd || 0) * qty;
      priced += qty;
    }
  }
  return {
    ils: Math.round(ils * 100) / 100,
    usd: Math.round(usd * 100) / 100,
    unique,
    copies,
    priced_copies: priced,
    ils_low: Math.round(ils * 100) / 100,
    ils_high: Math.round(ils * 100) / 100,
    has_range: false,
  };
}

function missingCost(cards) {
  let ils = 0, usd = 0, priced = 0, unpriced = 0;
  for (const c of cards) {
    const v = c.value || {};
    if (v.ils != null) {
      ils += Number(v.ils);
      usd += Number(v.usd || 0);
      priced++;
    } else unpriced++;
  }
  return {
    ils: Math.round(ils * 100) / 100,
    usd: Math.round(usd * 100) / 100,
    priced,
    unpriced,
    count: priced + unpriced,
  };
}

function jerusalemStamp(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, fractionalSecondDigits: undefined,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  // ISO offset for Asia/Jerusalem on this instant
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", timeZoneName: "shortOffset" })
    .formatToParts(d).find((p) => p.type === "timeZoneName")?.value || "GMT+2";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const off = m ? `${m[1]}${String(m[2]).padStart(2, "0")}:${m[3] || "00"}` : "+02:00";
  return { date, iso: `${date}T${parts.hour}:${parts.minute}:${parts.second}${off}` };
}

function loadBinder() {
  const text = readFileSync(join(ROOT, "data.js"), "utf8");
  const prefix = "window.BINDER = ";
  if (!text.startsWith(prefix)) throw new Error("data.js does not start with window.BINDER = ");
  const json = text.slice(prefix.length).replace(/;?\s*$/, "");
  return { prefix, data: JSON.parse(json) };
}

function writeBinder(prefix, data) {
  writeFileSync(join(ROOT, "data.js"), prefix + JSON.stringify(data) + "\n");
  writeFileSync(join(ROOT, "data.json"), JSON.stringify(data, null, 2) + "\n");
  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(join(ROOT, "data", "snapshots.json"), JSON.stringify({
    currency_note: "ILS values use the Bank of Israel representative USD and EUR rates captured with the snapshot.",
    snapshots: data.snapshots || [],
  }, null, 2) + "\n");
}

async function main() {
  const { prefix, data } = loadBinder();
  console.log("Loaded binder:", (data.cards || []).length, "owned,", (data.sets || []).length, "sets");
  const fx = await fetchFx(data.meta?.fx?.usd_ils || 3.25);
  console.log("FX", fx);

  const jobs = [];
  const seen = new Set();
  for (const c of data.cards || []) {
    if (c?.id && !seen.has(c.id)) { seen.add(c.id); jobs.push(c.id); }
  }
  for (const s of data.sets || []) {
    for (const c of s.cards || []) {
      if (c?.id && !seen.has(c.id)) { seen.add(c.id); jobs.push(c.id); }
    }
  }
  console.log("Pricing", jobs.length, "cards…");

  let ok = 0, fail = 0, priced = 0;
  const prices = new Map();
  await mapPool(jobs, CONCURRENCY, async (id, idx) => {
    try {
      const raw = await fetchCard(id);
      const price = pickMarket(raw.pricing, fx);
      prices.set(id, { price, rarity: raw.rarity || null });
      ok++;
      if (price.ils != null) priced++;
    } catch (err) {
      fail++;
      console.warn("fail", id, String(err));
    }
    if ((idx + 1) % 50 === 0 || idx + 1 === jobs.length) {
      console.log(`  ${idx + 1}/${jobs.length} ok=${ok} priced=${priced} fail=${fail}`);
    }
  });

  for (const c of data.cards || []) {
    const hit = prices.get(c.id);
    if (hit) applyPrice(c, hit.price, hit.rarity);
  }
  for (const s of data.sets || []) {
    let ils = 0, usd = 0;
    const missing = [];
    for (const c of s.cards || []) {
      const hit = prices.get(c.id);
      if (hit) applyPrice(c, hit.price, hit.rarity);
      if (c.owned) {
        const qty = c.quantity || 1;
        const v = c.value || {};
        if (v.ils != null) { ils += Number(v.ils) * qty; usd += Number(v.usd || 0) * qty; }
      } else {
        missing.push(c);
      }
    }
    s.value_ils = Math.round(ils * 100) / 100;
    s.value_usd = Math.round(usd * 100) / 100;
    s.complete_cost = missingCost(missing);
    s.complete_cost_note_he = null;
  }

  data.totals = sumOwned(data.cards || []);
  data.missing_cost = missingCost((data.sets || []).flatMap((s) => (s.cards || []).filter((c) => !c.owned)));
  data.meta = data.meta || {};
  data.meta.fx = { ...(data.meta.fx || {}), ...fx };
  const stamp = jerusalemStamp();
  data.meta.generated_at = stamp.iso;
  data.meta.generated_at_label = `${stamp.date} ${stamp.iso.slice(11, 16)} שעון ישראל`;
  data.meta.fx_label = `שער יציג בנק ישראל: $1 = ₪${Number(fx.usd_ils).toFixed(3)}` + (fx.usd_date ? ` (פורסם ${fx.usd_date})` : "");

  const snapshot = {
    date: stamp.date,
    captured_at: stamp.iso,
    ils: data.totals.ils,
    usd: data.totals.usd,
    unique: data.totals.unique,
    copies: data.totals.copies,
    priced_copies: data.totals.priced_copies,
    fx: { usd_ils: fx.usd_ils, eur_ils: fx.eur_ils, usd_date: fx.usd_date, source: fx.source },
    missing_ils: data.missing_cost.ils,
    missing_usd: data.missing_cost.usd,
    sets: (data.sets || []).map((s) => ({
      id: s.id, name: s.name, owned: s.owned, total: s.total, ils: s.value_ils, usd: s.value_usd,
    })),
  };
  const prev = (data.snapshots || []).filter((s) => s.date !== snapshot.date);
  data.snapshots = prev.concat([snapshot]);

  writeBinder(prefix, data);
  console.log("Wrote data.js / data.json / data/snapshots.json");
  console.log("Totals", data.totals, "missing", data.missing_cost, "snapshots", data.snapshots.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
