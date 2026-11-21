const B = window.BINDER;
const shekel = (n, d=0) => n == null ? "—" : "₪" + Number(n).toLocaleString("he-IL", {maximumFractionDigits:d, minimumFractionDigits:d});
const usd = (n) => n == null ? "" : "$" + Number(n).toLocaleString("en-US", {maximumFractionDigits:2, minimumFractionDigits: n>=10?0:2});
const ltr = (s) => `<span dir="ltr">${s}</span>`;

function valueLabel(v){
  if(!v || v.ils==null) return "אין מחיר";
  if(v.is_range && v.ils_low!=null) {
    const ils = `${shekel(v.ils_low,0)}–${shekel(v.ils_high,0).replace("₪","")}`;
    const dol = (v.usd_low!=null && v.usd_high!=null) ? ` (${usd(v.usd_low)}–${usd(v.usd_high)})` : "";
    return ltr(ils + dol);
  }
  return ltr(`${shekel(v.ils,0)} (${usd(v.usd)})`);
}

document.getElementById("title").textContent = B.meta.title;
document.getElementById("generated").textContent = `${B.meta.generated_at_label} · ${B.meta.fx_label}`;
document.getElementById("demoNote").textContent = B.meta.demo_note_he;

if(B.meta.collectr_portfolio_total_usd){
  const vis = (B.cards||[]).reduce((s,c)=> s + ((c.section!=="graded" && c.collectr_price_usd)? Number(c.collectr_price_usd):0), 0);
  const shown = B.meta.collectr_portfolio_total_usd;
  const gap = Math.round((shown-vis)*100)/100;
  document.getElementById("collectrGap").innerHTML =
    `ב-Collectr סך התיק Main הוצג כ-${ltr("$"+shown.toFixed(2))} (21 בנובמבר 2026). `+
    `סכום המחירים שנראו בצילומים הוא ${ltr("$"+vis.toFixed(2))}, כלומר פער של ${ltr("$"+Math.abs(gap).toFixed(2))} `+
    `בגלל קלפים שנחתכו בין צילומים או בלי מחיר גלוי. הפער הזה לא הושלם בניחוש.`;
}
if((B.review||[]).length){
  const box=document.getElementById("reviewBox");
  box.hidden=false;
  box.innerHTML = `<h2>ממתינים לאישור (${B.review.length})</h2><ul>` +
    B.review.map(r=>`<li><b>${r.name||r.likely_id||""}</b>${r.set_name? " · "+r.set_name:""}${r.number? " · "+r.number+"/076":""} — ${r.reason_he||""}</li>`).join("") +
    `</ul><p class="set-stats">לא הוספתי אותם לאוסף כדי לא לערבב קלפים לא בטוחים עם מה שכבר מזוהה.</p>`;
}


document.getElementById("share").textContent = B.share.how_he;

const T = B.totals;
document.getElementById("totals").innerHTML = `
  <div class="pill"><b>${ltr(T.has_range ? shekel(T.ils_low,0)+"–"+shekel(T.ils_high,0).replace("₪","") : shekel(T.ils,0))}</b><span>שווי אוסף מוערך</span></div>
  <div class="pill"><b>${ltr(usd(T.usd))}</b><span>בדולרים</span></div>
  <div class="pill"><b>${T.unique}</b><span>קלפים ייחודיים · ${T.copies} עותקים</span></div>
  <div class="pill"><b>${B.sets.length}</b><span>סטים במעקב</span></div>`;

/* tabs */
document.querySelectorAll(".tab").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("on", b===btn));
    document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("on", p.id==="panel-"+btn.dataset.tab));
  };
});

/* wishlist state: baked + localStorage */
const LS_KEY = "nextpull-wishlist";
function loadWanted(){
  const set = new Set(B.wishlist.map(w=>w.id));
  try{ JSON.parse(localStorage.getItem(LS_KEY)||"[]").forEach(id=>set.add(id)); }catch(e){}
  return set;
}
function saveWanted(set){
  localStorage.setItem(LS_KEY, JSON.stringify([...set]));
}
let wanted = loadWanted();

function cardEl(c){
  const wrap = document.createElement("div");
  wrap.className = "pocket";
  const grade = c.grade ? `<span class="chip slab">${c.grade_company||""} ${c.grade}</span>` : "";
  const demo = c.demo ? `<span class="chip demo">דמו</span>` : "";
  wrap.innerHTML = `
    <div class="persp">${holoCard(c.art, c.name)}</div>
    <div class="meta">
      <span class="en">${c.name||""}</span>
      <small>${c.set_name||""} · ${c.number||""}${c.quantity>1?" · ×"+c.quantity:""}</small>
      <div class="val">${valueLabel(c.value)}</div>
      ${grade}${demo}
    </div>`;
  wrap.querySelector(".card").addEventListener("click", ()=>openFocus(c));
  enableTilt(wrap.querySelector(".card"));
  return wrap;
}
function holoCard(src, alt){
  return `<div class="card" title="${alt||""}">
    <div class="face"><img src="${src||""}" alt="${alt||""}"></div>
    <div class="foil"></div><div class="sparkle"></div><div class="glare"></div><div class="edge"></div>
  </div>`;
}
function enableTilt(el){
  el.addEventListener("pointermove", ev=>{
    const r = el.getBoundingClientRect();
    const x = (ev.clientX-r.left)/r.width, y=(ev.clientY-r.top)/r.height;
    el.style.setProperty("--mx", (x*100)+"%");
    el.style.setProperty("--my", (y*100)+"%");
    el.style.setProperty("--ry", ((x-.5)*16)+"deg");
    el.style.setProperty("--rx", ((.5-y)*10)+"deg");
    el.style.setProperty("--o", "1");
    el.style.setProperty("--pos", (x*80)+"%");
    el.classList.add("active");
  });
  el.addEventListener("pointerleave", ()=>{
    el.style.setProperty("--rx","0deg"); el.style.setProperty("--ry","0deg"); el.style.setProperty("--o","0");
    el.classList.remove("active");
  });
}

function visibleCards(){
  const q = (document.getElementById("q").value||"").trim().toLowerCase();
  const filter = document.getElementById("filter").value;
  const sort = document.getElementById("sort").value;
  let list = B.cards.filter(c=>{
    if(filter==="slabs" && !c.grade) return false;
    if(filter==="raw" && c.grade) return false;
    if(!q) return true;
    return [c.name,c.set_name,c.number,c.id].join(" ").toLowerCase().includes(q);
  });
  const byVal = c => c.value && c.value.ils!=null ? c.value.ils : -1;
  if(sort==="value") list.sort((a,b)=>byVal(b)-byVal(a));
  else if(sort==="set") list.sort((a,b)=>(a.set_name||"").localeCompare(b.set_name||"")||String(a.number).localeCompare(String(b.number),undefined,{numeric:true}));
  else if(sort==="name") list.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  else {
    // binder order: slabs first, then by set/number
    list = [...list.filter(c=>c.grade), ...list.filter(c=>!c.grade)];
  }
  return list;
}

function renderPage(title, chunk, sub){
  const page=document.createElement("section");
  page.className="binder-page";
  page.innerHTML = `<div class="page-label"><span>${title}</span><span>${sub|| (chunk.length+" קלפים")}</span></div>`;
  const grid=document.createElement("div");
  grid.className="grid-3";
  chunk.forEach(c=>grid.appendChild(cardEl(c)));
  const fill = Math.ceil(chunk.length/9)*9 || 9;
  for(let k=chunk.length;k<fill;k++){
    const e=document.createElement("div"); e.className="pocket empty"; e.textContent="כיס ריק"; grid.appendChild(e);
  }
  page.appendChild(grid);
  return page;
}

function renderPages(){
  const list = visibleCards();
  const root = document.getElementById("pages");
  root.innerHTML = "";
  if(!list.length){ root.innerHTML = "<p class='demo-note'>אין קלפים מתאימים.</p>"; return; }
  const sort = document.getElementById("sort").value;
  if(sort==="binder"){
    const slabs=list.filter(c=>c.grade);
    const rest=list.filter(c=>!c.grade);
    if(slabs.length) root.appendChild(renderPage("סלאבים מדורגים", slabs));
    for(let i=0;i<rest.length;i+=9){
      const n=Math.floor(i/9)+1;
      root.appendChild(renderPage("קלפים שנבדק שוויים · עמוד "+n, rest.slice(i,i+9)));
    }
    return;
  }
  for(let i=0;i<list.length;i+=9){
    root.appendChild(renderPage("עמוד "+(Math.floor(i/9)+1), list.slice(i,i+9)));
  }
}
["sort","filter","q"].forEach(id=>document.getElementById(id).addEventListener("input", renderPages));
renderPages();

function renderSets(){
  const root=document.getElementById("sets");
  root.innerHTML="";
  B.sets.forEach(s=>{
    const block=document.createElement("article");
    block.className="set-block";
    block.innerHTML = `<div class="set-head">
      <div>
        <h2>${s.name}</h2>
        <div class="set-stats">${s.owned} מתוך ${s.total} · ${s.pct}%${s.official!==s.total?` · ${s.owned}/${s.official} במספור הרשמי (${s.pct_official}%)`:""} · ${s.missing_count} חסרים</div>
        ${s.partial? `<div class="partial">${s.partial_note_he||"מעקב חלקי"}</div>`:""}
      </div>
      <div class="bar" style="flex:1;max-width:280px"><i style="width:${Math.min(100,s.pct)}%"></i></div>
    </div>
    <div class="set-stats" style="margin-bottom:10px">${s.complete_cost_note_he||""}</div>`;
    const grid=document.createElement("div");
    grid.className="missing-grid";
    s.cards.forEach(c=>{
      const fig=document.createElement("figure");
      const isWanted = wanted.has(c.id);
      fig.className="mini"+(c.owned?" owned":"")+(isWanted?" wanted":"");
      fig.innerHTML = `<img src="${c.art||""}" alt="${c.name||""}" loading="lazy">
        <figcaption>${c.number} ${c.name||""}</figcaption>
        ${c.owned?"":`<button class="want-btn" title="סמן כמבוקש">${isWanted?"★":"☆"}</button>`}`;
      if(!c.owned){
        fig.querySelector(".want-btn").onclick=ev=>{
          ev.stopPropagation();
          if(wanted.has(c.id)) wanted.delete(c.id); else wanted.add(c.id);
          saveWanted(wanted);
          renderSets(); renderWishlist();
        };
      }
      grid.appendChild(fig);
    });
    block.appendChild(grid);
    root.appendChild(block);
  });
}
renderSets();

function renderWishlist(){
  // combine baked prices with wanted set
  const byId = Object.fromEntries((B.wishlist||[]).map(w=>[w.id,w]));
  const allIds = new Set([...wanted, ...Object.keys(byId)]);
  const items=[];
  B.sets.forEach(s=>s.cards.forEach(c=>{ if(allIds.has(c.id) && !c.owned) items.push({...c, set_name:s.name, price:(byId[c.id]||{}).price}); }));
  // wanted ids not in tracked sets
  allIds.forEach(id=>{
    if(!items.some(i=>i.id===id) && byId[id]) items.push(byId[id]);
  });
  let ils=0, usdSum=0, miss=0;
  items.forEach(it=>{
    const p=it.price||{};
    if(p.ils!=null){ ils+=p.ils; usdSum+=p.usd||0; } else miss++;
  });
  document.getElementById("wishHead").innerHTML = `
    <div><b>${ltr(shekel(ils,0))}</b> <span class="set-stats">${ltr("("+usd(usdSum)+")")} · ${items.length} קלפים מבוקשים${miss?` · ל-${miss} אין מחיר`:""}</span></div>
    <p class="set-stats">הסכום הוא הערכת שוק raw (Near Mint) לפי TCGplayer דרך TCGdex, לא מחיר קנייה בישראל. הסימון נשמר בדפדפן זה.</p>`;
  const root=document.getElementById("wishlist");
  root.innerHTML="";
  if(!items.length){ root.innerHTML="<p class='demo-note'>עוד לא סומנו קלפים מבוקשים. בהשלמת סטים אפשר ללחוץ על כוכב ליד קלף חסר.</p>"; return; }
  items.forEach(it=>{
    const fig=document.createElement("figure");
    fig.className="mini wanted";
    const p=it.price||{};
    fig.innerHTML=`<img src="${it.art||""}" alt="${it.name||""}">
      <figcaption>${it.name||it.id}<br>${p.ils!=null?shekel(p.ils,0):"אין מחיר"}</figcaption>
      <button class="want-btn">★</button>`;
    fig.querySelector(".want-btn").onclick=()=>{ wanted.delete(it.id); saveWanted(wanted); renderSets(); renderWishlist(); };
    root.appendChild(fig);
  });
}
renderWishlist();

const focusBox=document.getElementById("focus");
const focusBackdrop=document.getElementById("focusBackdrop");
const focusCloseBtn=document.getElementById("focusClose");
let focusOpen=false;
let focusScrollY=0;

function lockBody(){
  focusScrollY=window.scrollY||window.pageYOffset||0;
  document.body.classList.add("focus-lock");
  document.body.style.top=`-${focusScrollY}px`;
}
function unlockBody(){
  document.body.classList.remove("focus-lock");
  document.body.style.top="";
  window.scrollTo(0, focusScrollY);
}

function fillFocus(c){
  const card=document.getElementById("bigCard");
  card.className="card big";
  card.innerHTML = `<div class="face"><img src="${c.art||""}" alt="${c.name||""}"></div><div class="foil"></div><div class="sparkle"></div><div class="glare"></div><div class="edge"></div>`;
  enableTilt(card);
  const raw = c.price;
  const g = c.graded_prices||{};
  const wg = c.worth_grading||{};
  document.getElementById("focusMeta").innerHTML = `
    <h3 id="focusHeading">${c.name||""}</h3>
    <div class="kv">
      <span>סט</span><b>${c.set_name||""} · ${c.number||""}</b>
      <span>מצב</span><b>${c.grade? (c.grade_company+" "+c.grade) : (c.condition||"NM")}</b>
      <span>שווי באוסף</span><b>${valueLabel(c.value)}</b>
      <span>Raw NM</span><b>${raw && raw.ils!=null ? ltr(shekel(raw.ils,0)+" ("+usd(raw.usd)+")") : "—"}</b>
      <span>מקור raw</span><b>${(raw && raw.source)||"—"}${(raw && raw.source_updated)?" · "+raw.source_updated:""}</b>
      <span>PSA 9 / 10</span><b>${g.available? "יש מחיר" : "אין מקור חינמי זמין"}</b>
      <span>CGC 9</span><b>${g.cgc9? ltr(shekel(g.cgc9.ils_low,0)+"–"+shekel(g.cgc9.ils_high,0).replace("₪",""))+" (הערכה ידנית)" : "אין מקור חינמי זמין"}</b>
      <span>משתלם לדרג?</span><b class="${wg.status==="unlikely"?"bad":"warn"}">${wg.label_he||"—"}</b>
    </div>
    <p class="set-stats">${wg.detail_he||""}</p>
    ${c.manual_value_note? `<p class="set-stats">${c.manual_value_note}</p>`:""}
  `;
}

function openFocus(c){
  fillFocus(c);
  if(!focusOpen){
    lockBody();
    focusBox.hidden=false;
    focusOpen=true;
    history.pushState({binderFocus:true, id:c.id||c.name||""}, "", "#card");
    focusCloseBtn.focus();
  }
}

function closeFocus(fromPop){
  if(!focusOpen) return;
  focusOpen=false;
  focusBox.hidden=true;
  unlockBody();
  if(!fromPop && history.state && history.state.binderFocus){
    history.back();
  }
}

focusCloseBtn.addEventListener("click", ev=>{ ev.preventDefault(); ev.stopPropagation(); closeFocus(); });
focusBackdrop.addEventListener("click", ev=>{ ev.preventDefault(); closeFocus(); });
focusBackdrop.addEventListener("pointerup", ev=>{
  if(ev.target===focusBackdrop) closeFocus();
});
document.addEventListener("keydown", ev=>{
  if(ev.key==="Escape" && focusOpen){ ev.preventDefault(); closeFocus(); }
});
window.addEventListener("popstate", ()=>{
  if(focusOpen) closeFocus(true);
});
if(location.hash==="#card"){
  history.replaceState(null, "", location.pathname + location.search);
}

/* tools tab copy */
document.getElementById("gradedCard").innerHTML = `
  <h2>שווי מדורג</h2>
  <p>${B.graded_sources.notes_he}</p>
  <ul>${(B.graded_sources.manual_examples||[]).map(e=>`<li><b>${e.label}</b> — ${e.note_he}</li>`).join("")}</ul>
  <p>עלות דירוג מישראל שמשמשת להערכה: <b>${B.grading.israel_psa_fee_label}</b>. ${B.grading.note_he}</p>
  <p class="set-stats">${B.grading.israel_psa_fee_source}</p>`;
document.getElementById("pregradeCard").innerHTML = `
  <h2>הערכת דירוג מתמונה</h2>
  <p>אפשר למדוד מרכוז מתמונה של קלף בודד (יחס שוליים ימין/שמאל ולמעלה/למטה) ולהשוות לסובלנות הרשמית של PSA לחזית. זה <b>לא</b> ציון PSA או CGC.</p>
  <p>פינות, קצוות ומשטח הם הערכה גסה בלבד, והולו או שרוול מטעים אותה. כשתשלח תמונה חזיתית חדה של קלף, אפשר להריץ את המדידה ולהחזיר תקרת מרכוז (למשל «בטווח PSA 9 למרכוז בלבד»).</p>
  <p class="set-stats">פקודה: <code>python build_binder.py pregrade photo.jpg</code></p>`;
document.getElementById("dealsCard").innerHTML = `
  <h2>דילים למוצרים אטומים</h2>
  <p>${B.deals.notes_he}</p>
  <ul>${B.deals.sources.map(s=>`<li><b>${s.name}</b> — ${s.note_he}</li>`).join("")}</ul>`;
