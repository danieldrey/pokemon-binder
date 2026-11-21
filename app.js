const B = window.BINDER;
const shekel = (n, d=0) => n == null ? "—" : "₪" + Number(n).toLocaleString("he-IL", {maximumFractionDigits:d, minimumFractionDigits:d});
const usd = (n) => n == null ? "" : "$" + Number(n).toLocaleString("en-US", {maximumFractionDigits:2, minimumFractionDigits: n>=10?0:2});
const ltr = (s) => `<span dir="ltr">${s}</span>`;

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
  <div class="pill"><b>${ltr(T.has_range ? shekel(T.ils_low,2)+"–"+shekel(T.ils_high,2).replace("₪","") : shekel(T.ils,2))}</b><span>שווי אוסף מוערך</span></div>
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
  const toploader = c.toploader ? `<span class="chip toploader">Toploader</span>` : "";
  wrap.innerHTML = `
    <div class="persp">${holoCard(c.art, c.name)}</div>
    <div class="meta">
      <span class="en">${c.name||""}</span>
      <small>${c.set_name||""} · ${c.number||""}${c.quantity>1?" · ×"+c.quantity:""}</small>
      <div class="val">${valueLabel(c.value)}</div>
      ${grade}${demo}${toploader}
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
        <div class="set-stats">${ltr(String(s.owned))} מתוך ${ltr(String(s.total))} · ${s.pct}%${s.official!==s.total?` · ${ltr(s.owned+"/"+s.official)} במספור הרשמי (${s.pct_official}%)`:""} · ${s.missing_count} חסרים</div>
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
    fig.querySelector(".want-btn").onclick=()=>{ wanted.delete(it.id); saveWanted(wanted); renderSets(); renderWishlist(); refreshAlbumWanted(); };
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
      <span>מצב</span><b>${c.grade? (c.grade_company+" "+c.grade) : (c.condition||"NM")}${c.toploader? " · Toploader":""}</b>
      <span>שווי באוסף</span><b>${valueLabel(c.value)}</b>
      <span>Raw NM</span><b>${raw && raw.ils!=null ? ltr(shekel(raw.ils,0)+" ("+usd(raw.usd)+")") : "—"}</b>
      <span>מקור raw</span><b>${(raw && raw.source)||"—"}${(raw && raw.source_updated)?" · "+raw.source_updated:""}</b>
      <span>PSA 9 / 10</span><b>${g.available? "יש מחיר" : "אין מקור חינמי זמין"}</b>
      <span>CGC 9</span><b>${g.cgc9? ltr(shekel(g.cgc9.ils_low,0)+"–"+shekel(g.cgc9.ils_high,0).replace("₪",""))+" (הערכה ידנית)" : "אין מקור חינמי זמין"}</b>
      <span>משתלם לדרג?</span><b class="${wg.status==="unlikely"?"bad":"warn"}">${wg.label_he||"—"}</b>
    </div>
    <p class="set-stats">${wg.detail_he||""}</p>
    ${c.toploader? `<p class="set-stats"><span class="chip toploader">Toploader</span> הקלף נשמר בטופלוודר.</p>`:""}
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


/* ===== Flip-through album =====
   The chrome is RTL Hebrew, but the book itself turns like a physical LTR binder:
   the next page is to the right, swipe left or press ArrowRight to go forward.
*/
function isMobileBook(){
  return window.matchMedia("(max-width: 800px)").matches;
}

let currentSetId = null;
let albumPages = [];
let pageIndex = 0;
let flipping = false;

function collectionCard(id){
  return (B.cards||[]).find(c=>c.id===id) || null;
}

function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function buildAlbumPages(set){
  const pages=[{type:"cover", set}];
  const cards=set.cards||[];
  let pageNo=1;
  for(let i=0;i<cards.length;i+=9){
    const chunk=cards.slice(i,i+9);
    pages.push({
      type:"grid",
      pageNo,
      from:i+1,
      to:i+chunk.length,
      cards:chunk
    });
    pageNo++;
  }
  return pages;
}

function albumPocket(c){
  const wrap=document.createElement("div");
  const owned=!!c.owned;
  wrap.className="pocket "+(owned?"owned":"missing")+(c.art?"":" ghost");
  wrap.dataset.id=c.id||"";
  const name=escapeHtml(c.name||"");
  const num=escapeHtml(c.number||"");
  if(owned){
    wrap.innerHTML=`
      <div class="persp">${holoCard(c.art, c.name)}</div>
      <div class="meta">
        <span class="en">${name}</span>
        <small>${num}${c.quantity>1?" · ×"+c.quantity:""}</small>
        <div class="val">${valueLabel(c.value)}</div>
        ${c.toploader? `<span class="chip toploader">Toploader</span>`:""}
      </div>`;
    const card=wrap.querySelector(".card");
    if(card) enableTilt(card);
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
  return wrap;
}

function renderLeaf(page, side){
  const leaf=document.createElement("div");
  leaf.className="leaf "+(side||"")+(page?"":" blank");
  if(isMobileBook() && side==="left") leaf.classList.add("hidden-mobile");
  const inner=document.createElement("div");
  inner.className="page-inner";
  if(!page){
    leaf.appendChild(inner);
    return leaf;
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
    leaf.appendChild(inner);
    return leaf;
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
  leaf.appendChild(inner);
  return leaf;
}

function spreadFor(index){
  if(isMobileBook()){
    return {left:null, right:albumPages[index]||null, single:true};
  }
  const i=index - (index%2);
  return {left:albumPages[i]||null, right:albumPages[i+1]||null, single:false};
}

function renderSpread(){
  const stage=document.getElementById("bookStage");
  const spread=spreadFor(pageIndex);
  stage.innerHTML="";
  if(spread.single){
    const leaf=renderLeaf(spread.right, "right");
    leaf.style.width="100%";
    stage.appendChild(leaf);
  } else {
    stage.appendChild(renderLeaf(spread.left, "left"));
    stage.appendChild(renderLeaf(spread.right, "right"));
  }
  updatePager();
}

function pageCountLabel(){
  const n=albumPages.length;
  if(!n) return "";
  if(isMobileBook()){
    const p=albumPages[pageIndex];
    if(p && p.type==="cover") return `כריכה · 1 מתוך ${n}`;
    return `עמוד ${pageIndex+1} מתוך ${n}`;
  }
  const left=pageIndex+1;
  const right=Math.min(pageIndex+2, n);
  const l=albumPages[pageIndex];
  const r=albumPages[pageIndex+1];
  const name= (p)=>{
    if(!p) return "";
    if(p.type==="cover") return "כריכה";
    return "עמוד "+p.pageNo;
  };
  if(!r) return `${name(l)} מתוך ${n} עמודים`;
  return `${name(l)} – ${name(r)} · ${n} עמודים`;
}

function updatePager(){
  const n=albumPages.length;
  const max = isMobileBook()? n-1 : (n%2===0? n-2 : n-1 - ((n-1)%2===0?0:0));
  // desktop last even index
  const last = isMobileBook()? Math.max(0,n-1) : Math.max(0, n-1 - ((n-1)%2));
  document.getElementById("pagePrev").disabled = pageIndex<=0 || flipping;
  document.getElementById("pageNext").disabled = pageIndex>=last || flipping;
  document.getElementById("pageCounter").textContent = pageCountLabel();
}

function clampIndex(i){
  const n=albumPages.length;
  if(n<=0) return 0;
  if(isMobileBook()) return Math.max(0, Math.min(i, n-1));
  i = i - (i%2);
  const last = Math.max(0, n % 2 === 0 ? n-2 : n-1);
  // if n is 5 (0..4), last even left is 4 (right blank). last = n-1 if odd, n-2 if even? 
  // n=5 pages: spreads (0,1)(2,3)(4,blank) last=4
  // n=4 pages: spreads (0,1)(2,3) last=2
  const lastEven = (n%2===0)? n-2 : n-1;
  return Math.max(0, Math.min(i, lastEven));
}

function animateFlip(from, to){
  if(flipping || from===to) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce){
    pageIndex=to;
    renderSpread();
    return;
  }
  flipping=true;
  updatePager();
  const stage=document.getElementById("bookStage");
  const mobile=isMobileBook();
  const goingForward=to>from;
  const flipper=document.createElement("div");
  const front=document.createElement("div");
  front.className="flip-face flip-front";
  const back=document.createElement("div");
  back.className="flip-face flip-back";
  flipper.appendChild(front);
  flipper.appendChild(back);

  if(mobile){
    flipper.className="flipper right";
    flipper.style.width="100%";
    if(goingForward){
      front.appendChild(renderLeaf(albumPages[from], "right"));
      front.firstChild.style.width="100%";
      back.appendChild(renderLeaf(albumPages[to], "right"));
      back.firstChild.style.width="100%";
    } else {
      front.appendChild(renderLeaf(albumPages[to], "right"));
      front.firstChild.style.width="100%";
      back.appendChild(renderLeaf(albumPages[from], "right"));
      back.firstChild.style.width="100%";
      flipper.style.transform="rotateY(-180deg)";
    }
    // put the destination page underneath
    stage.innerHTML="";
    const under=renderLeaf(albumPages[goingForward?to:from], "right");
    under.style.width="100%";
    stage.appendChild(under);
    stage.appendChild(flipper);
  } else {
    const cur=spreadFor(from);
    const nxt=spreadFor(to);
    if(goingForward){
      flipper.className="flipper right";
      front.appendChild(renderLeaf(cur.right, "right"));
      back.appendChild(renderLeaf(nxt.left, "left"));
      stage.innerHTML="";
      stage.appendChild(renderLeaf(cur.left, "left"));
      stage.appendChild(renderLeaf(nxt.right, "right"));
      stage.appendChild(flipper);
    } else {
      flipper.className="flipper left";
      front.appendChild(renderLeaf(cur.left, "left"));
      back.appendChild(renderLeaf(nxt.right, "right"));
      stage.innerHTML="";
      stage.appendChild(renderLeaf(nxt.left, "left"));
      stage.appendChild(renderLeaf(cur.right, "right"));
      stage.appendChild(flipper);
    }
  }

  const finish=()=>{
    pageIndex=to;
    flipping=false;
    renderSpread();
  };
  const start=()=>{
    const cls = goingForward? "turning-forward" : "turning-back";
    if(mobile && !goingForward){
      // return from -180 to 0
      flipper.style.transition="transform .7s cubic-bezier(.2,.7,.2,1)";
      requestAnimationFrame(()=>{ flipper.style.transform="rotateY(0deg)"; });
    } else {
      flipper.classList.add(cls);
    }
  };
  let done=false;
  const once=()=>{ if(done) return; done=true; finish(); };
  flipper.addEventListener("transitionend", ev=>{
    if(ev.target!==flipper) return;
    once();
  });
  requestAnimationFrame(()=>requestAnimationFrame(start));
  setTimeout(once, 850);
}

function goToPage(i){
  if(flipping) return;
  const to=clampIndex(i);
  if(to===pageIndex) return;
  animateFlip(pageIndex, to);
}
function nextPage(){ goToPage(pageIndex + (isMobileBook()?1:2)); }
function prevPage(){ goToPage(pageIndex - (isMobileBook()?1:2)); }

function currentSet(){
  return (B.sets||[]).find(s=>s.id===currentSetId) || (B.sets||[])[0] || null;
}

function renderAlbumStatus(){
  const s=currentSet();
  const box=document.getElementById("albumStatus");
  if(!s){ box.innerHTML=""; return; }
  box.innerHTML = `<div class="set-head">
      <div>
        <h2 style="margin:0;font-size:22px">${escapeHtml(s.name||"")}</h2>
        <div class="set-stats">${ltr(String(s.owned))} מתוך ${ltr(String(s.total))} · ${s.pct}%${s.official!==s.total?` · ${ltr(s.owned+"/"+s.official)} במספור הרשמי (${s.pct_official}%)`:""} · ${s.missing_count} חסרים</div>
        ${s.partial? `<div class="partial">${s.partial_note_he||"מעקב חלקי"}</div>`:""}
      </div>
      <div>
        <div class="pill" style="min-width:auto;padding:8px 12px"><b>${s.value_ils!=null?ltr(shekel(s.value_ils,2)): "—"}</b><span>שווי הסט באוסף${s.value_usd!=null? " · "+usd(s.value_usd):""}</span></div>
      </div>
    </div>
    <p class="album-hint">האלבום נפתח משמאל לימין, כמו בינדר פיזי. בעמוד אפשר להחליק, ובמחשב גם עם החצים.</p>`;
}

function renderSetPicker(){
  const root=document.getElementById("setPicker");
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

function selectSet(id, keepPage){
  const s=(B.sets||[]).find(x=>x.id===id);
  if(!s) return;
  currentSetId=s.id;
  albumPages=buildAlbumPages(s);
  if(!keepPage) pageIndex=0;
  else pageIndex=clampIndex(pageIndex);
  renderSetPicker();
  renderAlbumStatus();
  renderSpread();
}

function refreshAlbumWanted(){
  document.querySelectorAll("#bookStage .pocket.missing, #bookStage .pocket.ghost").forEach(p=>{
    const id=p.dataset.id;
    const on=wanted.has(id);
    p.classList.toggle("wanted-pocket", on);
    const btn=p.querySelector(".want-btn");
    if(btn) btn.textContent=on?"★":"☆";
  });
}

function initAlbum(){
  const sets=B.sets||[];
  if(!sets.length){
    document.getElementById("bookStage").innerHTML="<p class='demo-note'>אין עדיין סטים באלבום.</p>";
    return;
  }
  if(!currentSetId) currentSetId=sets[0].id;
  const stage=document.getElementById("bookStage");
  stage.addEventListener("click", ev=>{
    if(flipping) return;
    const btn=ev.target.closest(".want-btn");
    if(btn){
      ev.preventDefault(); ev.stopPropagation();
      const id=btn.closest(".pocket").dataset.id;
      if(!id) return;
      if(wanted.has(id)) wanted.delete(id); else wanted.add(id);
      saveWanted(wanted);
      refreshAlbumWanted();
      renderSets(); renderWishlist();
      return;
    }
    const pocket=ev.target.closest(".pocket.owned");
    if(pocket){
      const id=pocket.dataset.id;
      const card=collectionCard(id) || ((currentSet()||{}).cards||[]).find(c=>c.id===id);
      if(card) openFocus(card);
    }
  });
  document.getElementById("pagePrev").addEventListener("click", prevPage);
  document.getElementById("pageNext").addEventListener("click", nextPage);
  document.addEventListener("keydown", ev=>{
    if(focusOpen) return;
    if(ev.target.matches && ev.target.matches("input,select,textarea")) return;
    const binderOn=document.getElementById("panel-binder").classList.contains("on");
    if(!binderOn) return;
    if(ev.key==="ArrowRight" || ev.key==="PageDown"){ ev.preventDefault(); nextPage(); }
    if(ev.key==="ArrowLeft" || ev.key==="PageUp"){ ev.preventDefault(); prevPage(); }
  });
  const book=document.getElementById("book");
  let sx=0, sy=0, tracking=false;
  book.addEventListener("touchstart", ev=>{
    if(focusOpen || flipping) return;
    const t=ev.changedTouches[0];
    sx=t.clientX; sy=t.clientY; tracking=true;
  }, {passive:true});
  book.addEventListener("touchend", ev=>{
    if(!tracking) return;
    tracking=false;
    const t=ev.changedTouches[0];
    const dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.2){
      if(dx<0) nextPage(); else prevPage();
    }
  }, {passive:true});
  window.addEventListener("resize", ()=>{
    if(flipping) return;
    pageIndex=clampIndex(pageIndex);
    renderSpread();
  });
  selectSet(currentSetId);
}

initAlbum();

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
