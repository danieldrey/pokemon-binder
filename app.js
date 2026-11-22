const B = window.BINDER;
const ALBUM_ONLY = (()=>{
  try{
    const q=new URLSearchParams(location.search);
    if((q.get("view")||"").toLowerCase()==="album") return true;
  }catch(e){}
  if(/album\.html$/i.test(location.pathname||"")) return true;
  return document.body.classList.contains("view-album");
})();
if(ALBUM_ONLY) document.body.classList.add("view-album");
function el(id){ return document.getElementById(id); }
const shekel = (n, d=0) => n == null ? "—" : "₪" + Number(n).toLocaleString("he-IL", {maximumFractionDigits:d, minimumFractionDigits:d});
const usd = (n) => n == null ? "" : "$" + Number(n).toLocaleString("en-US", {maximumFractionDigits:2, minimumFractionDigits: n>=10?0:2});
const ltr = (s) => `<span dir="ltr">${s}</span>`;
function storageChips(c){
  let s="";
  if(c.toploader) s+=`<span class="chip toploader">Toploader</span>`;
  if(c.sleeve) s+=`<span class="chip sleeve">Sleeve</span>`;
  return s;
}
function storageNote(c){
  if(c.toploader && c.sleeve) return "עותק אחד בטופלוודר ועותק אחד בשרוול.";
  if(c.toploader) return "הקלף נשמר בטופלוודר.";
  if(c.sleeve) return "הקלף נשמר בשרוול פשוט.";
  return "";
}


function ilsPlaces(n){
  if(n==null) return 0;
  return Math.abs(Number(n)) < 10 ? 2 : 2;
}
function valueLabel(v){
  if(!v || v.ils==null) return "אין מחיר";
  if(v.is_range && v.ils_low!=null) {
    const d=2;
    const ils = `${shekel(v.ils_low,d)}–${shekel(v.ils_high,d).replace("₪","")}`;
    const dol = (v.usd_low!=null && v.usd_high!=null) ? ` (${usd(v.usd_low)}–${usd(v.usd_high)})` : "";
    return ltr(ils + dol);
  }
  return ltr(`${shekel(v.ils,ilsPlaces(v.ils))} (${usd(v.usd)})`);
}

if(el("title") && B.meta && !ALBUM_ONLY) el("title").textContent = B.meta.title;
if(el("generated")) el("generated").textContent = `${B.meta.generated_at_label} · ${B.meta.fx_label}`;
if(el("demoNote")) el("demoNote").textContent = B.meta.demo_note_he;

if(!ALBUM_ONLY && B.meta.collectr_portfolio_total_usd && el("collectrGap")){
  const vis = (B.cards||[]).reduce((s,c)=> s + ((c.section!=="graded" && c.collectr_price_usd)? Number(c.collectr_price_usd):0), 0);
  const shown = B.meta.collectr_portfolio_total_usd;
  const gap = Math.round((shown-vis)*100)/100;
  document.getElementById("collectrGap").innerHTML =
    `ב-Collectr סך התיק Main הוצג כ-${ltr("$"+shown.toFixed(2))} (21 בנובמבר 2026). `+
    `סכום המחירים שנראו בצילומים הוא ${ltr("$"+vis.toFixed(2))}, כלומר פער של ${ltr("$"+Math.abs(gap).toFixed(2))} `+
    `בגלל קלפים שנחתכו בין צילומים או בלי מחיר גלוי. הפער הזה לא הושלם בניחוש.`;
}
if(!ALBUM_ONLY && (B.review||[]).length && el("reviewBox")){
  const box=el("reviewBox");
  box.hidden=false;
  box.innerHTML = `<h2>ממתינים לאישור (${B.review.length})</h2><ul>` +
    B.review.map(r=>`<li><b>${r.name||r.likely_id||""}</b>${r.set_name? " · "+r.set_name:""}${r.number? " · "+r.number+"/076":""} — ${r.reason_he||""}</li>`).join("") +
    `</ul><p class="set-stats">לא הוספתי אותם לאוסף כדי לא לערבב קלפים לא בטוחים עם מה שכבר מזוהה.</p>`;
}


if(el("share")) el("share").innerHTML = (B.share && (B.share.how_he||"")) + (B.share && B.share.album_url ? ` <a href="album.html">קישור לאלבום בלבד</a>.` : "");

const T = B.totals;
if(el("totals")) el("totals").innerHTML = `
  <div class="pill"><b>${ltr(T.has_range ? shekel(T.ils_low,2)+"–"+shekel(T.ils_high,2).replace("₪","") : shekel(T.ils,2))}</b><span>שווי אוסף מוערך</span></div>
  <div class="pill"><b>${ltr(usd(T.usd))}</b><span>בדולרים</span></div>
  <div class="pill"><b>${T.unique}</b><span>קלפים ייחודיים · ${T.copies} עותקים</span></div>
  <div class="pill"><b>${B.sets.length}</b><span>סטים במעקב</span></div>`;

/* tabs */
if(!ALBUM_ONLY) document.querySelectorAll(".tab").forEach(btn=>{
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
  const storage = storageChips(c);
  wrap.innerHTML = `
    <div class="persp">${holoCard(c.art, c.name)}</div>
    <div class="meta">
      <span class="en">${c.name||""}</span>
      <small>${c.set_name||""} · ${c.number||""}${c.quantity>1?" · ×"+c.quantity:""}</small>
      <div class="val">${valueLabel(c.value)}</div>
      ${grade}${demo}${storage}
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
    if(filter==="toploader" && !c.toploader) return false;
    if(filter==="sleeve" && !c.sleeve) return false;
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
if(!ALBUM_ONLY) ["sort","filter","q"].forEach(id=>{ const n=el(id); if(n) n.addEventListener("input", renderPages); });
if(!ALBUM_ONLY && el("pages")) renderPages();

function renderSets(){
  const root=document.getElementById("sets");
  root.innerHTML="";
  B.sets.forEach(s=>{
    const block=document.createElement("article");
    block.className="set-block";
    block.innerHTML = `<div class="set-head">
      <div>
        <h2>${s.name}</h2>
        <div class="set-stats">${ltr(String(s.owned_official!=null?s.owned_official:s.owned))} מתוך ${ltr(String(s.official||s.total))} במספור הרשמי (${s.pct_official}%) · ${ltr(String(s.owned))} מתוך ${ltr(String(s.total))} כולל סודיים · ${(s.missing_official!=null?s.missing_official:s.missing_count)} חסרים בסט הרגיל</div>
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
          renderSets(); renderWishlist(); refreshAlbumWanted();
        };
      }
      grid.appendChild(fig);
    });
    block.appendChild(grid);
    root.appendChild(block);
  });
}
if(!ALBUM_ONLY && el("sets")) renderSets();

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
    fig.querySelector(".want-btn").onclick=()=>{ wanted.delete(it.id); saveWanted(wanted); renderSets(); renderWishlist(); refreshAlbumWanted(); };
    root.appendChild(fig);
  });
}
if(!ALBUM_ONLY && el("wishlist")) renderWishlist();

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
      <span>מצב</span><b>${c.grade? (c.grade_company+" "+c.grade) : (c.condition||"NM")}${c.toploader? " · Toploader":""}${c.sleeve? " · Sleeve":""}</b>
      <span>שווי באוסף</span><b>${valueLabel(c.value)}</b>
      <span>Raw NM</span><b>${raw && raw.ils!=null ? ltr(shekel(raw.ils,0)+" ("+usd(raw.usd)+")") : "—"}</b>
      <span>מקור raw</span><b>${(raw && raw.source)||"—"}${(raw && raw.source_updated)?" · "+raw.source_updated:""}</b>
      <span>PSA 9 / 10</span><b>${g.available? "יש מחיר" : "אין מקור חינמי זמין"}</b>
      <span>CGC 9</span><b>${g.cgc9? ltr(shekel(g.cgc9.ils_low,0)+"–"+shekel(g.cgc9.ils_high,0).replace("₪",""))+" (הערכה ידנית)" : "אין מקור חינמי זמין"}</b>
      <span>משתלם לדרג?</span><b class="${wg.status==="unlikely"?"bad":"warn"}">${wg.label_he||"—"}</b>
    </div>
    <p class="set-stats">${wg.detail_he||""}</p>
    ${storageNote(c)? `<p class="set-stats">${storageChips(c)} ${storageNote(c)}</p>`:""}
    ${c.id_note_he? `<p class="set-stats">${c.id_note_he}</p>`:""}
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



/* ===== Flip-through album (StPageFlip) =====
   Chrome is RTL Hebrew; the book itself turns like a physical LTR binder.
   Drag a corner or swipe to curl the page. Arrow keys and the side buttons also work.
*/
const LS_SOUND = "nextpull-album-sound";
let currentSetId = null;
let albumPages = [];
let pageFlip = null;
let flipping = false;
let soundOn = false;
try{ soundOn = localStorage.getItem(LS_SOUND)==="on"; }catch(e){}

function collectionCard(id){
  return (B.cards||[]).find(c=>c.id===id) || null;
}
function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function useSpreadLayout(){
  const w=window.innerWidth, h=window.innerHeight;
  return w>=700 || w>h; // desktop, tablet, or phone landscape
}
function buildAlbumPages(set){
  const pages=[{type:"cover", set}];
  const cards=set.cards||[];
  let pageNo=1;
  for(let i=0;i<cards.length;i+=9){
    const chunk=cards.slice(i,i+9);
    pages.push({type:"grid", pageNo, from:i+1, to:i+chunk.length, cards:chunk});
    pageNo++;
  }
  pages.push({type:"back", set});
  return pages;
}
function albumPocket(c){
  const wrap=document.createElement("div");
  const owned=!!c.owned;
  wrap.className="pocket "+(owned?"owned":"missing")+(c.art?"":" ghost");
  wrap.dataset.id=c.id||"";
  if(owned) wrap.setAttribute("role","button");
  const name=escapeHtml(c.name||"");
  const num=escapeHtml(c.number||"");
  if(owned){
    wrap.innerHTML=`
      <div class="persp">${holoCard(c.art, c.name)}</div>
      <div class="meta">
        <span class="en">${name}</span>
        <small>${num}${c.quantity>1?" · ×"+c.quantity:""}</small>
        <div class="val">${valueLabel(c.value)}</div>
        ${storageChips(c)}
      </div>`;
  } else if(c.art){
    const star = wanted.has(c.id)?"★":"☆";
    wrap.innerHTML=`
      <div class="persp">${holoCard(c.art, c.name)}</div>
      <div class="meta">
        <span class="en">${name}</span>
        <small>${num}</small>
      </div>
      <button type="button" class="want-btn" title="סמן כמבוקש" aria-label="סמן כמבוקש">${star}</button>`;
    if(wanted.has(c.id)) wrap.classList.add("wanted-pocket");
  } else {
    const star = wanted.has(c.id)?"★":"☆";
    wrap.innerHTML=`
      <div class="silhouette">${num}<br>${name||"אין תמונה"}</div>
      <div class="meta"><span class="en">${name}</span><small>${num}</small></div>
      <button type="button" class="want-btn" title="סמן כמבוקש" aria-label="סמן כמבוקש">${star}</button>`;
    if(wanted.has(c.id)) wrap.classList.add("wanted-pocket");
  }
  // Eager-load art on nearby pages later; default lazy for the rest
  wrap.querySelectorAll("img").forEach(img=>{ img.loading="lazy"; img.decoding="async"; });
  return wrap;
}
function fillPageEl(el, page){
  el.innerHTML="";
  const inner=document.createElement("div");
  inner.className="page-inner";
  if(!page || page.type==="back"){
    el.classList.add("back-cover");
    const s=(page && page.set) || {};
    inner.innerHTML = `<div class="cover-page">
      <img class="logo sm" src="logo.png" alt="">
      <h2>${escapeHtml((s && s.name) || "Next Pull IL")}</h2>
    </div>`;
    el.appendChild(inner);
    return el;
  }
  if(page.type==="cover"){
    const s=page.set;
    inner.innerHTML = `<div class="cover-page">
      ${s.logo? `<img class="set-logo" src="${escapeHtml(s.logo)}" alt="">`:""}
      <h2>${escapeHtml(s.name||"")}</h2>
      <div class="cover-count">${ltr((s.owned||0)+" / "+(s.total||0))}</div>
      <div class="bar"><i style="width:${Math.min(100,s.pct||0)}%"></i></div>
      <div class="set-stats">${s.value_ils!=null? ltr(shekel(s.value_ils,2)+" ("+usd(s.value_usd)+")") : ""}</div>
    </div>`;
    el.appendChild(inner);
    return el;
  }
  inner.innerHTML = `<div class="page-label"><span>עמוד ${page.pageNo}</span><span>${ltr(page.from+"–"+page.to)}</span></div>`;
  const grid=document.createElement("div");
  grid.className="grid-3";
  for(let i=0;i<9;i++){
    const c=page.cards[i];
    if(!c){
      const e=document.createElement("div");
      e.className="pocket empty-slot";
      grid.appendChild(e);
    } else grid.appendChild(albumPocket(c));
  }
  inner.appendChild(grid);
  el.appendChild(inner);
  return el;
}
function buildPageElements(pages){
  return pages.map((page,i)=>{
    const el=document.createElement("div");
    el.className="stf-page leaf"+(page && page.type==="cover"?" cover":"")+(page && page.type==="back"?" back-cover":"");
    if(i===0 || i===pages.length-1) el.dataset.density="hard";
    fillPageEl(el, page);
    return el;
  });
}
function preloadAround(pages, index){
  const loadPage=(page)=>{
    if(!page) return;
    const urls=[];
    if(page.set && page.set.logo) urls.push(page.set.logo);
    (page.cards||[]).forEach(c=>{ if(c.art) urls.push(c.art); });
    urls.forEach(src=>{ const im=new Image(); im.decoding="async"; im.src=src; });
  };
  for(let i=index-2;i<=index+3;i++) loadPage(pages[i]);
  const rest=()=>{ pages.forEach((p,i)=>{ if(i<index-2||i>index+3) loadPage(p); }); };
  if(window.requestIdleCallback) requestIdleCallback(rest,{timeout:2000});
  else setTimeout(rest, 300);
}
function playFlipSound(){
  if(!soundOn) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return;
    if(!playFlipSound.ctx) playFlipSound.ctx=new AC();
    const ctx=playFlipSound.ctx;
    if(ctx.state==="suspended") ctx.resume();
    const len=Math.floor(ctx.sampleRate*0.16);
    const buf=ctx.createBuffer(1,len,ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/len*7);
    const src=ctx.createBufferSource();
    src.buffer=buf;
    const f=ctx.createBiquadFilter();
    f.type="bandpass"; f.frequency.value=1400; f.Q.value=0.6;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.16);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
  }catch(e){}
}
function updateSoundToggle(){
  const btn=el("soundToggle");
  if(!btn) return;
  btn.setAttribute("aria-pressed", soundOn?"true":"false");
  btn.textContent = soundOn? "קול: פועל":"קול: כבוי";
}
function bookSize(){
  const wrap=el("binderFrame") || el("bookHost");
  const chrome=document.querySelector(".album-chrome");
  const bottom=document.querySelector(".album-bottom");
  const availW=Math.max(280, (wrap? wrap.clientWidth : window.innerWidth) - 8);
  const topH=(chrome? chrome.getBoundingClientRect().height : 0) + (bottom? bottom.getBoundingClientRect().height : 56) + 32;
  const availH=Math.max(320, window.innerHeight - topH);
  const spread=useSpreadLayout();
  // One page aspect: 3x3 cards ~ 0.72 (w/h)
  const pageAspect=0.72;
  let pageW, pageH;
  if(spread){
    pageW=Math.min(560, Math.floor(availW/2)-4);
    pageH=Math.floor(pageW/pageAspect);
    if(pageH>availH){ pageH=availH; pageW=Math.floor(pageH*pageAspect); }
  } else {
    pageW=Math.min(420, availW-8);
    pageH=Math.floor(pageW/pageAspect);
    if(pageH>availH){ pageH=availH; pageW=Math.floor(pageH*pageAspect); }
  }
  pageW=Math.max(180, pageW);
  pageH=Math.max(260, pageH);
  return {pageW, pageH, spread};
}
function currentSet(){
  return (B.sets||[]).find(s=>s.id===currentSetId) || (B.sets||[])[0] || null;
}
function renderAlbumStatus(){
  const s=currentSet();
  const box=el("albumStatus");
  if(!box || !s) return;
  const share = ALBUM_ONLY? "" : "";
  box.innerHTML = `<div class="set-head">
      <div>
        <h2 style="margin:0;font-size:${ALBUM_ONLY?18:22}px">${escapeHtml(s.name||"")}</h2>
        <div class="set-stats">${ltr(String(s.owned))} מתוך ${ltr(String(s.total))} · ${s.pct}%</div>
      </div>
      <div class="pill" style="min-width:auto;padding:8px 12px"><b>${s.value_ils!=null?ltr(shekel(s.value_ils,2)): "—"}</b><span>שווי הסט${s.value_usd!=null? " · "+usd(s.value_usd):""}</span></div>
    </div>`;
}
function renderSetPicker(){
  const root=el("setPicker");
  if(!root) return;
  root.innerHTML="";
  (B.sets||[]).forEach(s=>{
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="set-chip"+(s.id===currentSetId?" on":"");
    btn.innerHTML=`<b>${escapeHtml(s.name||s.id)}</b><small>${ltr((s.owned||0)+"/"+(s.total||0))}</small>`;
    btn.onclick=()=>selectSet(s.id);
    root.appendChild(btn);
  });
}
function pageCountLabel(){
  if(!pageFlip) return "";
  const n=pageFlip.getPageCount();
  const i=pageFlip.getCurrentPageIndex();
  const mode=pageFlip.getOrientation && pageFlip.getOrientation();
  const spread = mode!=="portrait" && useSpreadLayout();
  const name=p=>{
    if(!p) return "";
    if(p.type==="cover") return "כריכה";
    if(p.type==="back") return "כריכה אחורית";
    return "עמוד "+p.pageNo;
  };
  if(spread){
    const l=albumPages[i], r=albumPages[i+1];
    if(!r) return `${name(l)} · ${n} עמודים`;
    return `${name(l)} – ${name(r)} · ${n} עמודים`;
  }
  return `${name(albumPages[i]) || ("עמוד "+(i+1))} · ${i+1} מתוך ${n}`;
}
function updatePager(){
  if(!pageFlip) return;
  const i=pageFlip.getCurrentPageIndex();
  const n=pageFlip.getPageCount();
  if(el("pagePrev")) el("pagePrev").disabled = i<=0 || flipping;
  if(el("pageNext")) el("pageNext").disabled = i>=n-1 || flipping;
  if(el("pageCounter")) el("pageCounter").textContent = pageCountLabel();
  const portrait = (pageFlip.getOrientation && pageFlip.getOrientation()==="portrait") || !useSpreadLayout();
  document.body.classList.toggle("portrait-book", !!portrait);
  preloadAround(albumPages, i);
}
function destroyBook(){
  if(pageFlip){
    try{ pageFlip.destroy(); }catch(e){}
    pageFlip=null;
  }
  const host=el("bookHost");
  if(host) host.innerHTML='<div id="book"></div>';
}
function mountBook(startPage){
  if(typeof St==="undefined" || !St.PageFlip){
    const host=el("bookHost");
    if(host) host.innerHTML="<p class='demo-note'>ספריית הדפדוף לא נטענה.</p>";
    return;
  }
  destroyBook();
  const pages=buildPageElements(albumPages);
  const book=el("book");
  pages.forEach(pg=>book.appendChild(pg));
  const {pageW, pageH, spread}=bookSize();
  const host=el("bookHost");
  if(host){
    host.style.width=(spread?pageW*2:pageW)+"px";
    host.style.maxWidth="100%";
  }
  document.body.classList.toggle("portrait-book", !spread);
  pageFlip=new St.PageFlip(book, {
    width: pageW,
    height: pageH,
    size: "stretch",
    minWidth: 160,
    maxWidth: 700,
    minHeight: 240,
    maxHeight: 1100,
    drawShadow: true,
    maxShadowOpacity: 0.7,
    flippingTime: 800,
    usePortrait: !spread,
    showCover: false, // two-page spread: cover | first cards
    autoSize: true,
    mobileScrollSupport: true,
    swipeDistance: 24,
    clickEventForward: true,
    useMouseEvents: true,
    disableFlipByClick: true,
    showPageCorners: true,
    startZIndex: 1,
    startPage: Math.max(0, Math.min(startPage||0, albumPages.length-1))
  });
  pageFlip.on("flip", ev=>{
    flipping=false;
    updatePager();
  });
  pageFlip.on("changeState", ev=>{
    const st=ev.data;
    flipping = (st==="flipping" || st==="user_fold");
    if(st==="flipping") playFlipSound();
    if(st==="read"){ flipping=false; updatePager(); }
  });
  pageFlip.on("changeOrientation", ()=> updatePager());
  pageFlip.loadFromHTML(pages);
  try{ window.__pageFlip = pageFlip; }catch(e){}
  buildRings();
  updatePager();
  preloadAround(albumPages, pageFlip.getCurrentPageIndex());
}
function buildRings(){
  const ringBox=el("binderRings");
  if(!ringBox) return;
  ringBox.innerHTML="";
  const spine=document.createElement("div");
  spine.className="binder-spine";
  const frame=el("binderFrame");
  if(frame && !frame.querySelector(".binder-spine")) frame.appendChild(spine);
  for(let i=0;i<8;i++){
    const d=document.createElement("i");
    ringBox.appendChild(d);
  }
}
function selectSet(id, keepPage){
  const s=(B.sets||[]).find(x=>x.id===id) || (B.sets||[])[0];
  if(!s) return;
  currentSetId=s.id;
  albumPages=buildAlbumPages(s);
  let start=0;
  if(keepPage && pageFlip) start=pageFlip.getCurrentPageIndex();
  // honor ?set=
  renderSetPicker();
  renderAlbumStatus();
  mountBook(keepPage? start : 0);
  // update URL set param on the share page without adding history spam
  if(ALBUM_ONLY){
    try{
      const u=new URL(location.href);
      u.searchParams.set("set", currentSetId);
      history.replaceState(history.state, "", u);
    }catch(e){}
  }
}
function refreshAlbumWanted(){
  document.querySelectorAll("#book .pocket.missing, #book .pocket.ghost, #bookHost .pocket.missing").forEach(p=>{
    const id=p.dataset.id;
    const on=wanted.has(id);
    p.classList.toggle("wanted-pocket", on);
    const btn=p.querySelector(".want-btn");
    if(btn) btn.textContent=on?"★":"☆";
  });
}
function nextPage(){ if(pageFlip) pageFlip.flipNext("bottom"); }
function prevPage(){ if(pageFlip) pageFlip.flipPrev("bottom"); }

function initAlbum(){
  const sets=B.sets||[];
  if(!sets.length){
    const host=el("bookHost");
    if(host) host.innerHTML="<p class='demo-note'>אין עדיין סטים באלבום.</p>";
    return;
  }
  const q=(()=>{ try{ return new URLSearchParams(location.search).get("set"); }catch(e){ return null; } })();
  currentSetId = (q && sets.some(s=>s.id===q)) ? q : sets[0].id;

  const host=el("bookHost") || el("book");
  if(host){
    host.addEventListener("click", ev=>{
      const btn=ev.target.closest(".want-btn");
      if(btn){
        ev.preventDefault(); ev.stopPropagation();
        const id=btn.closest(".pocket").dataset.id;
        if(!id) return;
        if(wanted.has(id)) wanted.delete(id); else wanted.add(id);
        saveWanted(wanted);
        refreshAlbumWanted();
        if(typeof renderSets==="function" && !ALBUM_ONLY) renderSets();
        if(typeof renderWishlist==="function" && !ALBUM_ONLY) renderWishlist();
        return;
      }
      const pocket=ev.target.closest(".pocket.owned");
      if(pocket){
        ev.preventDefault(); ev.stopPropagation();
        const id=pocket.dataset.id;
        const card=collectionCard(id) || ((currentSet()||{}).cards||[]).find(c=>c.id===id);
        if(card) openFocus(card);
      }
    }, true);
  }
  if(el("pagePrev")) el("pagePrev").addEventListener("click", prevPage);
  if(el("pageNext")) el("pageNext").addEventListener("click", nextPage);
  document.addEventListener("keydown", ev=>{
    if(focusOpen) return;
    if(ev.target.matches && ev.target.matches("input,select,textarea")) return;
    const binderOn=ALBUM_ONLY || (el("panel-binder") && el("panel-binder").classList.contains("on"));
    if(!binderOn) return;
    if(ev.key==="ArrowRight" || ev.key==="PageDown"){ ev.preventDefault(); nextPage(); }
    if(ev.key==="ArrowLeft" || ev.key==="PageUp"){ ev.preventDefault(); prevPage(); }
  });
  updateSoundToggle();
  if(el("soundToggle")){
    el("soundToggle").addEventListener("click", ()=>{
      soundOn=!soundOn;
      try{ localStorage.setItem(LS_SOUND, soundOn?"on":"off"); }catch(e){}
      updateSoundToggle();
      if(soundOn) playFlipSound();
    });
  }
  let resizeTimer=0;
  window.addEventListener("resize", ()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=> selectSet(currentSetId, true), 220);
  });
  selectSet(currentSetId);
}

initAlbum();


/* tools tab copy */
if(!ALBUM_ONLY && el("gradedCard")) el("gradedCard").innerHTML = `
  <h2>שווי מדורג</h2>
  <p>${B.graded_sources.notes_he}</p>
  <ul>${(B.graded_sources.manual_examples||[]).map(e=>`<li><b>${e.label}</b> — ${e.note_he}</li>`).join("")}</ul>
  <p>עלות דירוג מישראל שמשמשת להערכה: <b>${B.grading.israel_psa_fee_label}</b>. ${B.grading.note_he}</p>
  <p class="set-stats">${B.grading.israel_psa_fee_source}</p>`;
if(!ALBUM_ONLY && el("pregradeCard")) el("pregradeCard").innerHTML = `
  <h2>הערכת דירוג מתמונה</h2>
  <p>אפשר למדוד מרכוז מתמונה של קלף בודד (יחס שוליים ימין/שמאל ולמעלה/למטה) ולהשוות לסובלנות הרשמית של PSA לחזית. זה <b>לא</b> ציון PSA או CGC.</p>
  <p>פינות, קצוות ומשטח הם הערכה גסה בלבד, והולו או שרוול מטעים אותה. כשתשלח תמונה חזיתית חדה של קלף, אפשר להריץ את המדידה ולהחזיר תקרת מרכוז (למשל «בטווח PSA 9 למרכוז בלבד»).</p>
  <p class="set-stats">פקודה: <code>python build_binder.py pregrade photo.jpg</code></p>`;
if(!ALBUM_ONLY && el("dealsCard")) el("dealsCard").innerHTML = `
  <h2>דילים למוצרים אטומים</h2>
  <p>${B.deals.notes_he}</p>
  <ul>${B.deals.sources.map(s=>`<li><b>${s.name}</b> — ${s.note_he}</li>`).join("")}</ul>`;
