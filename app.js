/* ============================================================
   QR Billing — prototype logic (vanilla JS, no framework)
   Data persists to localStorage so the demo keeps its state.
   ============================================================ */

/* ---------- Indian states (GST place of supply) ---------- */
const STATES = ["Andhra Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","Uttarakhand","West Bengal"];

/* ---------- Placeholder product image (offline-safe SVG) ---------- */
const CAT_COLORS = {
  Grocery:"#3E7C59", Dairy:"#C58A2E", Personal:"#3F6EA5", Snacks:"#B4531F",
  Beverage:"#7A4E86", Home:"#2E8B8B", Other:"#6E675B"
};
function placeholderImg(label, color){
  const initials = label.split(/\s+/).slice(0,2).map(w=>w[0]||"").join("").toUpperCase();
  const c = color || "#6E675B";
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='180' viewBox='0 0 240 180'>`+
    `<rect width='240' height='180' fill='${c}' opacity='0.10'/>`+
    `<rect x='0' y='0' width='240' height='180' fill='none'/>`+
    `<circle cx='120' cy='74' r='40' fill='${c}' opacity='0.18'/>`+
    `<text x='120' y='86' font-family='Segoe UI, sans-serif' font-size='40' font-weight='700' fill='${c}' text-anchor='middle'>${initials}</text>`+
    `<text x='120' y='150' font-family='Segoe UI, sans-serif' font-size='15' fill='${c}' opacity='0.75' text-anchor='middle'>${escapeXml(label.length>22?label.slice(0,21)+'…':label)}</text>`+
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
function escapeXml(s){ return String(s).replace(/[<>&'"]/g, c=>({ "<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[c])); }

/* ---------- Barcode helpers ---------- */
// India retail barcodes start with 890. This makes a plausible 13-digit EAN-style number.
function genBarcode(){ return "890" + Math.floor(1e9 + Math.random()*9e9).toString() + Math.floor(Math.random()*10); }
function drawBarcode(el, value, opts){
  if(typeof JsBarcode === "undefined" || !el || !value) return false;
  try { JsBarcode(el, String(value), Object.assign({ format:"CODE128", displayValue:false, height:34, width:1.6, margin:0, background:"transparent", lineColor:"#201D17" }, opts||{})); return true; }
  catch(e){ return false; }
}
function barcodeDataURL(value){
  if(typeof JsBarcode === "undefined" || !value) return "";
  try { const c=document.createElement("canvas"); JsBarcode(c, String(value), {format:"CODE128", displayValue:true, height:52, fontSize:15, margin:6, width:1.8}); return c.toDataURL("image/png"); }
  catch(e){ return ""; }
}
function findByCode(code){
  code=(code||"").trim(); if(!code) return null; const lc=code.toLowerCase();
  return state.products.find(p=> (p.barcode && String(p.barcode)===code) || (p.sku && p.sku.toLowerCase()===lc)) || null;
}
// Crisp PNG of a QR (drawn from modules, not the gif) — for downloading/printing.
function qrPngDataURL(text, scale, margin){
  if(typeof qrcode === "undefined" || !text) return "";
  scale = scale||8; margin = margin==null?4:margin;
  try{
    const q=qrcode(0,"M"); q.addData(text); q.make();
    const n=q.getModuleCount(), size=(n+margin*2)*scale;
    const c=document.createElement("canvas"); c.width=c.height=size; const x=c.getContext("2d");
    x.fillStyle="#fff"; x.fillRect(0,0,size,size); x.fillStyle="#000";
    for(let r=0;r<n;r++) for(let col=0;col<n;col++) if(q.isDark(r,col)) x.fillRect((col+margin)*scale,(r+margin)*scale,scale,scale);
    return c.toDataURL("image/png");
  }catch(e){ return ""; }
}
function slug(s){ return String(s||"code").trim().replace(/[^\w.-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48) || "code"; }
function downloadDataURL(url, name){
  if(!url){ toast("Image not available"); return; }
  const a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  toast("Downloaded "+name);
}

/* ---------- Seed data ---------- */
function seedProducts(){
  const p = [
    ["Aashirvaad Atta 5kg","ATT-5K",285,265,5,"Grocery",40,"8901030865278"],
    ["Tata Salt 1kg","SLT-1K",28,26,5,"Grocery",120,"8901030675423"],
    ["Amul Butter 500g","AMB-500",285,275,12,"Dairy",24,"8901020100125"],
    ["Colgate MaxFresh 150g","CLG-150",99,92,18,"Personal",60,"8901314010470"],
    ["Parle-G Biscuit 250g","PGB-250",30,28,18,"Snacks",8,"8901063011336"],
    ["Fortune Sunflower Oil 1L","OIL-1L",145,139,5,"Grocery",55,"8906007560012"],
    ["Dettol Handwash 200ml","DTL-200",99,85,18,"Personal",30,"8901396333333"],
    ["Bru Instant Coffee 100g","BRU-100",175,168,18,"Beverage",0,"8901030112233"],
    ["Maggi Noodles 12-pack","MAG-12",168,155,18,"Snacks",45,"8901058847284"],
    ["Surf Excel 1kg","SRF-1K",130,118,18,"Home",22,"8901030555667"],
  ];
  return p.map((r,i)=>({
    id: "p"+(i+1), title:r[0], sku:r[1], mrp:r[2], selling:r[3], gst:r[4], category:r[5], stock:r[6], barcode:r[7],
    img: placeholderImg(r[0], CAT_COLORS[r[5]])
  }));
}

/* ---------- Seed sample sales history (so Reports look real on first open) ---------- */
function seedInvoices(products){
  const names = ["Ravi Kumar","Anitha R","Suresh Babu","Priya M","Karthik S","Meena Devi","Walk-in customer","Vijay Anand","Lakshmi N","Ramesh","Deepa","Walk-in customer","Arjun P","Fathima","Walk-in customer"];
  const out = []; const now = new Date();
  const DAYS = 150;
  for(let d=DAYS; d>=0; d--){
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()-d, 11, 0, 0);
    const dow = day.getDay();
    // more bills on weekends, fewer very old; small random gaps
    const base = (dow===0||dow===6) ? 5 : 3;
    let n = Math.max(0, Math.round(base + (Math.random()*4-1.5)) - (d>90?1:0));
    if(Math.random()<0.08) n = 0; // occasional closed/slow day
    for(let k=0;k<n;k++){
      const count = 1 + Math.floor(Math.random()*4);
      const items = []; let taxable=0, tax=0, gross=0;
      for(let i=0;i<count;i++){
        const p = products[Math.floor(Math.random()*products.length)];
        const qty = 1 + Math.floor(Math.random()* (p.selling>150?2:5));
        const g = p.gst, sp = p.selling;
        const lg = sp*qty, lt = lg/(1+g/100), lx = lg-lt;
        items.push({title:p.title, sku:p.sku, qty, price:sp, gst:g, taxable:lt, tax:lx, gross:lg});
        taxable+=lt; tax+=lx; gross+=lg;
      }
      const ts = day.getTime() + k*1000*60*17;
      const dt = new Date(ts);
      out.push({
        number:"INV-", ts,
        date: dt.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),
        time: dt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
        template:"classic", inclusive:true, currency:"₹",
        customer:{ name: names[Math.floor(Math.random()*names.length)], phone:"", gstin:"", state:"Tamil Nadu" },
        items, taxable, tax, cgst:tax/2, sgst:tax/2, igst:0, inter:false,
        roundOff: Math.round(gross)-gross, grand: Math.round(gross)
      });
    }
  }
  out.sort((a,b)=>a.ts-b.ts);
  out.forEach((inv,i)=> inv.number = "INV-"+(1042 - out.length + i)); // live billing continues from 1042
  return out;
}

/* ---------- State ---------- */
const _seedProducts = seedProducts();
const DEFAULTS = {
  settings: {
    name:"Sri Balaji Traders", gstin:"33ABCDE1234F1Z5", phone:"+91 98765 43210",
    address:"12, Gandhi Market Road,\nCoimbatore, Tamil Nadu - 641001", email:"billing@sribalaji.in",
    state:"Tamil Nadu", prefix:"INV-", logo:"", terms:"Goods once sold will not be taken back. Thank you, visit again!",
    inclusive:true, qrPrice:true, defaultGst:18, currency:"₹", template:"classic", invSeq:1042
  },
  products: _seedProducts,
  invoices: seedInvoices(_seedProducts)
};

let state = load();
let cart = {};        // id -> qty
let currentView = "billing";
let pickFilter = { q:"", cat:"All" };
let anPeriod = "30";
let prodQuery = "";
let billMode = "scan";     // single billing mode (scan / quick-bill table)
let holds = [];            // parked bills
let customer = { name:"", phone:"", gstin:"", state:"" }; // collected at checkout (optional)

function load(){
  try {
    const raw = localStorage.getItem("qrbilling.v1");
    if(raw){ const d = JSON.parse(raw); return { settings:{...DEFAULTS.settings, ...d.settings}, products:d.products||DEFAULTS.products, invoices:d.invoices||[] }; }
  } catch(e){}
  return JSON.parse(JSON.stringify(DEFAULTS));
}
function save(){ localStorage.setItem("qrbilling.v1", JSON.stringify(state)); }
const S = () => state.settings;
const cur = () => S().currency || "₹";

/* ---------- Formatting ---------- */
function money(n){ return cur() + new Intl.NumberFormat("en-IN",{minimumFractionDigits:2, maximumFractionDigits:2}).format(Number(n)||0); }
function money0(n){ return cur() + new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Number(n)||0); }
function moneyShort(n){ n=Number(n)||0; const a=Math.abs(n);
  if(a>=1e7) return cur()+(n/1e7).toFixed(a>=1e8?0:1)+"Cr";
  if(a>=1e5) return cur()+(n/1e5).toFixed(a>=1e6?0:1)+"L";
  if(a>=1e3) return cur()+(n/1e3).toFixed(a>=1e4?0:1)+"k";
  return cur()+Math.round(n); }
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];

/* ---------- QR ---------- */
function qrDataURL(text, cell=4, margin=1){
  if(typeof qrcode === "undefined") return null;
  try{ const q = qrcode(0,"M"); q.addData(text); q.make(); return q.createDataURL(cell, margin); }
  catch(e){ try{ const q=qrcode(0,"L"); q.addData(text); q.make(); return q.createDataURL(cell,margin);}catch(_){ return null; } }
}
function productScanURL(p){
  const u = new URL("product-view.html", location.href);
  u.searchParams.set("t", p.title);
  u.searchParams.set("sku", p.sku||"");
  u.searchParams.set("sp", p.selling);
  u.searchParams.set("mrp", p.mrp);
  u.searchParams.set("g", p.gst);
  u.searchParams.set("inc", S().inclusive ? 1 : 0);
  u.searchParams.set("cur", cur());
  u.searchParams.set("biz", S().name);
  u.searchParams.set("price", S().qrPrice ? 1 : 0);
  // small image only (http url); placeholders are re-drawn on the view side by category color
  if(p.img && /^https?:/.test(p.img)) u.searchParams.set("img", p.img);
  else u.searchParams.set("c", CAT_COLORS[p.category]||"#6E675B");
  return u.toString();
}
function qrImg(p, cls){ const d = qrDataURL(productScanURL(p), 4, 0);
  return d ? `<img src="${d}" alt="QR ${escapeHtml(p.title)}" />`
           : `<div style="font-size:9px;color:#999;display:grid;place-items:center;height:100%">QR offline</div>`; }
function escapeHtml(s){ return String(s).replace(/[<>&"]/g,c=>({ "<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c])); }

/* ---------- GST math ---------- */
function lineCalc(p, qty){
  const g = Number(p.gst)||0, sp = Number(p.selling)||0;
  let taxable, tax, gross;
  if(S().inclusive){ gross = sp*qty; taxable = gross/(1+g/100); tax = gross - taxable; }
  else { taxable = sp*qty; tax = taxable*g/100; gross = taxable + tax; }
  return { g, taxable, tax, gross };
}
function billTotals(){
  const interState = false; // set by customer state at render time
  const items = Object.keys(cart).map(id=>{
    const p = state.products.find(x=>x.id===id); if(!p) return null;
    const qty = cart[id]; const c = lineCalc(p, qty);
    return { p, qty, ...c };
  }).filter(Boolean);
  const custState = customer.state;
  const inter = custState && custState !== S().state;
  let taxable=0, tax=0, gross=0, qtyTot=0;
  const byRate = {};
  items.forEach(it=>{ taxable+=it.taxable; tax+=it.tax; gross+=it.gross; qtyTot+=it.qty;
    byRate[it.g] = byRate[it.g] || {taxable:0,tax:0}; byRate[it.g].taxable+=it.taxable; byRate[it.g].tax+=it.tax; });
  const roundedGross = Math.round(gross);
  const roundOff = roundedGross - gross;
  return { items, taxable, tax, gross, grand:roundedGross, roundOff, qtyTot, inter,
           cgst: inter?0:tax/2, sgst: inter?0:tax/2, igst: inter?tax:0, byRate };
}

/* ============================================================
   Routing
   ============================================================ */
const TITLES = {
  billing:["New Bill","Scan or search products, then checkout the GST bill"],
  products:["Products","Add products, set prices and print QR labels"],
  invoices:["Invoices","Bills generated in this session"],
  analytics:["Reports & Analytics","Month-wise and date-wise sales"],
  settings:["Settings","Business details, tax rules and invoice format"]
};
function setView(v){
  currentView = v;
  $$(".view").forEach(el=> el.hidden = (el.id !== "view-"+v));
  $$("#nav .nav-item").forEach(b=> b.classList.toggle("active", b.dataset.view===v));
  $$("#mobile-nav button").forEach(b=> b.classList.toggle("active", b.dataset.view===v));
  $("#view-title").textContent = TITLES[v][0];
  $("#view-sub").textContent = TITLES[v][1];
  renderTopbar();
  if(v==="products") renderProducts();
  if(v==="invoices") renderInvoices();
  if(v==="analytics") renderAnalytics();
  if(v==="settings") renderSettings();
  if(v==="billing") setTimeout(focusScan, 60);
  window.scrollTo(0,0);
}
function renderTopbar(){
  const a = $("#topbar-actions");
  if(currentView==="products"){
    a.innerHTML = `<button class="btn btn-primary" id="btn-add-product"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg><span class="label">Add product</span></button>`;
    $("#btn-add-product").onclick = ()=> openProductModal();
  } else if(currentView==="settings"){
    a.innerHTML = `<button class="btn btn-primary" id="btn-save-settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg><span class="label">Save settings</span></button>`;
    $("#btn-save-settings").onclick = saveSettings;
  } else if(currentView==="billing"){
    a.innerHTML = `<span class="hint" style="display:flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--muted)"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${S().inclusive?"Prices incl. GST":"GST added at checkout"}</span>
      <button class="btn btn-sm" id="printer-chip" title="Connect the thermal printer (one-time)"></button>
      <button class="btn btn-sm" id="btn-shortcuts" title="Keyboard shortcuts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg><span class="label">Shortcuts</span></button>`;
    $("#btn-shortcuts").onclick = openShortcutsModal;
    $("#printer-chip").onclick = connectPrinter;
    updatePrinterChip();
    ensurePrinter();
  } else { a.innerHTML = ""; }
}

/* ============================================================
   Billing — product picker + cart
   ============================================================ */
function categories(){ return ["All", ...new Set(state.products.map(p=>p.category||"Other"))]; }
function renderPickCats(){
  if(!$("#pick-cats")) return;
  $("#pick-cats").innerHTML = categories().map(c=>
    `<button class="chip ${pickFilter.cat===c?"active":""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
  $$("#pick-cats .chip").forEach(b=> b.onclick=()=>{ pickFilter.cat=b.dataset.cat; renderPickCats(); renderPickGrid(); });
}
function stockBadge(p){
  if(p.stock===undefined || p.stock===null || p.stock==="") return "";
  const n = Number(p.stock);
  const cls = n<=0?"out":(n<=10?"low":"");
  const txt = n<=0?"Out of stock":(n<=10?`Low · ${n} left`:`${n} in stock`);
  return `<span class="stock-dot ${cls}">${txt}</span>`;
}
function renderPickGrid(){
  if(!$("#pick-grid")) return;
  const q = pickFilter.q.toLowerCase();
  const list = state.products.filter(p=>{
    const okCat = pickFilter.cat==="All" || (p.category||"Other")===pickFilter.cat;
    const okQ = !q || p.title.toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q);
    return okCat && okQ;
  });
  const grid = $("#pick-grid");
  if(!list.length){ grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>No products found</h3><p>Try another search or add a product.</p></div>`; return; }
  grid.innerHTML = list.map(p=>{
    const out = Number(p.stock)<=0 && p.stock!=="" && p.stock!==undefined && p.stock!==null;
    return `<div class="pcard">
      <img class="thumb" src="${p.img}" alt="${escapeHtml(p.title)}" onerror="this.src='${placeholderImg(p.title, CAT_COLORS[p.category]||'#6E675B')}'"/>
      <div class="pbody">
        <div class="ptitle">${escapeHtml(p.title)}</div>
        ${p.sku?`<div class="psku">${escapeHtml(p.sku)}</div>`:""}
        <div class="prow">
          <span class="pprice">${money(p.selling)}</span>
          ${p.mrp>p.selling?`<span class="pmrp">${money(p.mrp)}</span>`:""}
        </div>
        <div class="ptax">${p.gst}% GST ${S().inclusive?"incl.":"extra"}</div>
        ${stockBadge(p)}
        <button class="btn btn-primary btn-sm padd" data-add="${p.id}" ${out?"disabled":""}>
          ${cart[p.id]?`In bill · ${cart[p.id]}`:"Add to bill"}
        </button>
      </div>
    </div>`;
  }).join("");
  $$("#pick-grid [data-add]").forEach(b=> b.onclick=()=>{ addToCart(b.dataset.add); });
}
function addToCart(id){ cart[id]=(cart[id]||0)+1; renderPickGrid(); renderCart(); }
function setQty(id,q){ if(q<=0) delete cart[id]; else cart[id]=q; renderPickGrid(); renderCart(); }

function breakdownText(t){
  const parts = [`Taxable ${money(t.taxable)}`];
  if(t.tax>0){
    if(t.inter) parts.push(`IGST ${money(t.igst)}`);
    else { parts.push(`CGST ${money(t.cgst)}`); parts.push(`SGST ${money(t.sgst)}`); }
  }
  if(Math.abs(t.roundOff)>=0.005) parts.push(`Round off ${t.roundOff>=0?"+":"−"}${money(Math.abs(t.roundOff))}`);
  return parts.join("  ·  ");
}

function renderCart(){
  const t = billTotals();
  renderScanCart(t);
  updateActionBar(t);
  // sidebar/nav counts
  $("#nav-prod-count").textContent = state.products.length;
  $("#nav-inv-count").textContent = state.invoices.length;
  $("#side-biz").textContent = S().name || "Your Business";
  $("#side-gstin").textContent = "GSTIN " + (S().gstin || "—");
}
function updateActionBar(t){
  t = t || billTotals();
  if(!$("#ab-count")) return;
  $("#ab-count").textContent = `${t.qtyTot} item${t.qtyTot!==1?"s":""}`;
  $("#ab-break").innerHTML = t.items.length ? breakdownText(t) : "Scan or search to add items";
  $("#ab-total").textContent = money(t.grand);
  $("#ab-print").disabled = !t.items.length;
}

/* ============================================================
   Barcode scanner / POS mode
   ============================================================ */
let suggList = [], suggIndex = -1, lastAddedId = null;

function setBillMode(){ billMode="scan"; setScanStatus("Ready"); focusScan(); }
function focusScan(){ const el=$("#scan-input"); if(el){ setTimeout(()=>{ el.focus(); }, 40); } }
function setScanStatus(text, busy){ const el=$("#scan-status"); if(!el) return; el.textContent=text; el.classList.toggle("busy", !!busy); }

let _actx = null;
function beep(ok){
  try{ _actx = _actx || new (window.AudioContext||window.webkitAudioContext)();
    const o=_actx.createOscillator(), g=_actx.createGain();
    o.type="square"; o.frequency.value = ok?1400:320; g.gain.value=0.05;
    o.connect(g); g.connect(_actx.destination); o.start();
    o.stop(_actx.currentTime + (ok?0.06:0.16));
  }catch(e){}
}

/* ---------- Type-ahead suggestions ---------- */
function suggestMatches(q){
  q=q.trim().toLowerCase(); if(!q) return [];
  return state.products.filter(p=> p.title.toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q) || (p.barcode||"").includes(q)).slice(0,7);
}
function renderSuggest(){
  const box=$("#suggest"); if(!box) return;
  const q=$("#scan-input").value;
  suggList = suggestMatches(q);
  if(!q.trim()){ hideSuggest(); return; }
  if(!suggList.length){ box.hidden=false; box.innerHTML=`<div class="sg-empty">No match — a barcode scan will still add it</div>`; suggIndex=-1; return; }
  if(suggIndex>=suggList.length || suggIndex<0) suggIndex=0;
  box.hidden=false;
  box.innerHTML = suggList.map((p,i)=>`
    <div class="sg ${i===suggIndex?'active':''}" data-sg="${p.id}">
      <img src="${p.img}" alt="" onerror="this.src='${placeholderImg(p.title, CAT_COLORS[p.category]||'#6E675B')}'"/>
      <div class="sg-b"><div class="sg-n">${escapeHtml(p.title)}</div>
        <div class="sg-m">${escapeHtml(p.sku||p.barcode||"")} · ${money(p.selling)}${(p.stock!==""&&p.stock!=null)?` · ${Number(p.stock)<=0?"out of stock":p.stock+" in stock"}`:""}</div></div>
      <div class="sg-add">Add</div>
    </div>`).join("");
  $$("#suggest [data-sg]").forEach(el=> el.onclick=()=>{ const p=state.products.find(x=>x.id===el.dataset.sg); if(p) addScan(p); });
}
function hideSuggest(){ const box=$("#suggest"); if(box){ box.hidden=true; box.innerHTML=""; } suggIndex=-1; suggList=[]; }
function moveSuggest(d){ if(!suggList.length) return; suggIndex=(suggIndex+d+suggList.length)%suggList.length; renderSuggest(); }

/* ---------- Add via scan or pick ---------- */
function addScan(p){
  addToCart(p.id); beep(true); setScanStatus("Added "+(p.sku||p.title)); lastAddedId=p.id;
  $("#scan-input").value=""; hideSuggest(); focusScan();
}
function scanEnter(){
  const v=$("#scan-input").value.trim(); if(!v) return;
  const exact = findByCode(v);
  if(exact){ addScan(exact); return; }            // exact barcode/SKU → scan path
  const pick = suggList[suggIndex>=0?suggIndex:0]; // else take highlighted / first suggestion
  if(pick){ addScan(pick); return; }
  beep(false); setScanStatus("No match for “"+v+"”", true); toast("No product for "+v);
  const el=$("#scan-input"); el.select&&el.select();
}
function renderScanCart(t){
  const tb=$("#scan-cart-tbody"); if(!tb) return;
  if(!t.items.length){ tb.innerHTML=`<tr class="bill-empty"><td colspan="7"><div class="empty-state" style="padding:40px 12px;"><h3>No items yet</h3><p>Scan a barcode or type a product name to start the bill.</p></div></td></tr>`; return; }
  tb.innerHTML = t.items.map((it,i)=>`
    <tr data-row="${it.p.id}" class="${it.p.id===lastAddedId?'just-added':''}">
      <td class="mono" style="color:var(--muted);">${i+1}</td>
      <td><div class="tt" style="font-weight:600;">${escapeHtml(it.p.title)}</div><div class="ts mono">${escapeHtml(it.p.barcode||it.p.sku||"")}</div></td>
      <td class="right mono">${money(it.p.selling)}</td>
      <td style="text-align:center;"><input type="number" class="qty-input" data-qty="${it.p.id}" value="${it.qty}" min="0" step="1" inputmode="numeric" aria-label="Quantity for ${escapeHtml(it.p.title)}"/></td>
      <td class="right mono">${it.g}%</td>
      <td class="right mono amt" style="font-weight:700;">${money(it.gross)}</td>
      <td><button class="icon-btn danger" data-rm="${it.p.id}" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12"/></svg></button></td>
    </tr>`).join("");
  $$("#scan-cart-tbody [data-qty]").forEach(inp=>{
    inp.oninput = ()=> setQtyLive(inp.dataset.qty, inp.value);
    inp.onfocus = ()=> inp.select();
    inp.onkeydown = (e)=>{
      if(e.key==="Enter"){ e.preventDefault(); focusScan(); }
      else if(e.key==="Delete"){ e.preventDefault(); setQty(inp.dataset.qty, 0); focusScan(); }
    };
  });
  $$("#scan-cart-tbody [data-rm]").forEach(b=>b.onclick=()=>{ setQty(b.dataset.rm, 0); focusScan(); });
}
// live qty edit without rebuilding the table (keeps keyboard focus in the number field)
function setQtyLive(id, v){
  v = parseInt(v, 10);
  if(isNaN(v)) return;
  if(v<=0){ setQty(id, 0); focusScan(); return; }
  cart[id] = v;
  const p = state.products.find(x=>x.id===id); if(!p) return;
  const row = $(`#scan-cart-tbody tr[data-row="${id}"]`);
  if(row){ const amt=row.querySelector(".amt"); if(amt) amt.textContent = money(lineCalc(p, v).gross); }
  updateActionBar();
}

/* ---------- Held bills ---------- */
function holdBill(){
  const t = billTotals(); if(!t.items.length){ toast("Nothing to hold"); return; }
  holds.push({ id:Date.now(), cart:{...cart}, total:t.grand, count:t.qtyTot, name:$("#cust-name").value.trim() });
  resetBill(); renderHolds(); toast("Bill held");
}
function renderHolds(){
  const s=$("#holds-strip"); if(!s) return;
  if(!holds.length){ s.hidden=true; s.innerHTML=""; return; }
  s.hidden=false;
  s.innerHTML = `<span class="hint" style="align-self:center;">Held bills:</span>` + holds.map(h=>
    `<button class="hold-chip" data-hold="${h.id}">${escapeHtml(h.name||"Bill")} · ${money0(h.total)} <span style="color:var(--muted)">(${h.count})</span> <span class="x" data-del="${h.id}" title="Discard">✕</span></button>`).join("");
  $$("#holds-strip [data-hold]").forEach(b=> b.onclick=(e)=>{ if(e.target.closest("[data-del]")) return; resumeHold(+b.dataset.hold); });
  $$("#holds-strip [data-del]").forEach(b=> b.onclick=(e)=>{ e.stopPropagation(); holds=holds.filter(h=>h.id!=b.dataset.del); renderHolds(); });
}
function resumeHold(id){
  const h=holds.find(x=>x.id===id); if(!h) return;
  if(Object.keys(cart).length && !confirm("Replace the current bill with the held one?")) return;
  cart={...h.cart}; if(h.name) $("#cust-name").value=h.name;
  holds=holds.filter(x=>x.id!==id); renderHolds(); renderPickGrid(); renderCart();
  toast("Bill resumed");
}

/* ============================================================
   Keyboard shortcuts (native-app feel — great for the Windows build)
   ============================================================ */
const SHORTCUTS = [
  ["F2", "Focus the scan box"],
  ["F4", "Checkout + customer details"],
  ["F6", "Hold current bill"],
  ["F7", "Resume last held bill"],
  ["F8", "Save invoice (chosen format)"],
  ["F9", "Checkout — Cash / UPI → print"],
  ["Enter", "Add scanned / highlighted item"],
  ["↑ ↓", "Move through suggestions"],
  ["Alt + 1…5", "Switch tabs"],
  ["Ctrl + P", "Print open invoice · Esc close"],
  ["?", "Show this help"],
];
function openShortcutsModal(){
  openModal(`
    <div class="modal" style="max-width:460px;">
      <div class="modal-head"><h3>Keyboard shortcuts</h3><button class="btn btn-ghost btn-sm close" data-close>✕</button></div>
      <div class="modal-body">
        <div class="sc-list">
          ${SHORTCUTS.map(([k,d])=>`<div class="sc-row"><kbd class="sc-key">${k}</kbd><span>${d}</span></div>`).join("")}
        </div>
        <div class="hint" style="margin-top:14px;">Function keys work like a native billing counter — no mouse needed. A hardware barcode scanner (USB/Bluetooth) types the code and presses Enter automatically.</div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" data-close>Got it</button></div>
    </div>`);
}
function handleShortcut(e){
  // Alt + number → tabs (works anywhere)
  if(e.altKey && !e.ctrlKey){
    const map={"1":"billing","2":"products","3":"invoices","4":"analytics","5":"settings"};
    if(map[e.key]){ e.preventDefault(); location.hash=map[e.key]; setView(map[e.key]); return; }
  }
  const modalOpen = !$("#modal-root").hidden;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||"");
  // "?" help (not while typing)
  if(e.key==="?" && !typing){ e.preventDefault(); openShortcutsModal(); return; }
  // Function keys — act even while typing (native-app feel), only on billing view
  if(currentView==="billing" && !modalOpen){
    switch(e.key){
      case "F2": e.preventDefault(); focusScan(); return;
      case "F4": e.preventDefault(); openCheckout(true); return;
      case "F6": e.preventDefault(); holdBill(); return;
      case "F7": e.preventDefault(); if(holds.length) resumeHold(holds[holds.length-1].id); else toast("No held bills"); return;
      case "F8": e.preventDefault(); generateInvoice(); return;
      case "F9": e.preventDefault(); openCheckout(); return;
    }
  }
}

/* ============================================================
   Products table + add/edit modal
   ============================================================ */
function renderProducts(){
  const q = prodQuery.toLowerCase().trim();
  const list = state.products.filter(p=> !q || p.title.toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q) || (p.category||"").toLowerCase().includes(q));
  $("#prod-sub").textContent = q ? `${list.length} of ${state.products.length} products` : `${state.products.length} products · manage pricing and QR codes`;
  const tb = $("#prod-tbody");
  if(!state.products.length){ tb.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>No products yet</h3><p>Add your first product to generate its QR.</p></div></td></tr>`; return; }
  if(!list.length){ tb.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>No products match “${escapeHtml(prodQuery)}”</h3><p>Try a different name, SKU or category.</p></div></td></tr>`; return; }
  tb.innerHTML = list.map(p=>`
    <tr>
      <td>
        <div class="tprod">
          <img src="${p.img}" alt="" onerror="this.src='${placeholderImg(p.title, CAT_COLORS[p.category]||'#6E675B')}'"/>
          <div><div class="tt">${escapeHtml(p.title)}</div>
          <div class="ts">${p.sku?escapeHtml(p.sku)+" · ":""}${escapeHtml(p.category||"Other")}</div>
          ${p.barcode?`<div class="ts mono" style="display:flex;align-items:center;gap:5px;"><svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" fill="none"><path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/></svg>${escapeHtml(p.barcode)}</div>`:""}</div>
        </div>
      </td>
      <td class="right mono">${money(p.mrp)}</td>
      <td class="right mono">${money(p.selling)}</td>
      <td class="right"><span class="tag">${p.gst}%</span></td>
      <td class="right mono">${(p.stock===""||p.stock===undefined||p.stock===null)?"—":p.stock}</td>
      <td style="text-align:center;"><div class="qr-mini" data-qr="${p.id}" title="View QR" style="cursor:pointer;margin:0 auto;">${qrImg(p)}</div></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-scan="${p.id}" title="Preview scan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/></svg></button>
          <button class="icon-btn" data-edit="${p.id}" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
          <button class="icon-btn danger" data-del="${p.id}" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12"/></svg></button>
        </div>
      </td>
    </tr>`).join("");
  $$("#prod-tbody [data-edit]").forEach(b=>b.onclick=()=>openProductModal(b.dataset.edit));
  $$("#prod-tbody [data-del]").forEach(b=>b.onclick=()=>{ if(confirm("Delete this product?")){ state.products=state.products.filter(p=>p.id!==b.dataset.del); delete cart[b.dataset.del]; save(); renderProducts(); renderCart(); toast("Product deleted"); }});
  $$("#prod-tbody [data-scan]").forEach(b=>b.onclick=()=>previewScan(b.dataset.scan));
  $$("#prod-tbody [data-qr]").forEach(b=>b.onclick=()=>openQRModal(b.dataset.qr));
}

function openProductModal(id){
  const p = id ? state.products.find(x=>x.id===id) : null;
  const cats = [...new Set(state.products.map(x=>x.category||"Other"))];
  openModal(`
    <div class="modal">
      <div class="modal-head"><h3>${p?"Edit product":"Add product"}</h3>
        <button class="btn btn-ghost btn-sm close" data-close>✕</button></div>
      <div class="modal-body">
        <div class="img-pick" style="margin-bottom:16px;">
          <img class="img-preview" id="pm-preview" src="${p?p.img:placeholderImg('New Product','#6E675B')}" alt=""/>
          <div style="flex:1;">
            <div class="field"><label>Product image <span class="opt">(URL or upload)</span></label>
              <input class="input" id="pm-img" placeholder="Paste image URL…" value="${p&&/^https?:/.test(p.img)?escapeHtml(p.img):""}"/></div>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <label class="btn btn-sm" style="cursor:pointer;">Upload<input type="file" id="pm-file" accept="image/*" hidden/></label>
              <span class="hint" style="align-self:center;">JPG/PNG, shown on cards, QR &amp; invoice.</span>
            </div>
          </div>
        </div>
        <div class="form-grid">
          <div class="field span"><label>Product title</label><input class="input" id="pm-title" value="${p?escapeHtml(p.title):""}" placeholder="e.g. Aashirvaad Atta 5kg"/></div>
          <div class="field"><label>SKU <span class="opt">(optional)</span></label><input class="input mono" id="pm-sku" value="${p?escapeHtml(p.sku||""):""}" placeholder="ATT-5K"/></div>
          <div class="field span"><label>Barcode <span class="opt">— scanned at billing</span></label>
            <div style="display:flex;gap:8px;align-items:stretch;">
              <input class="input mono" id="pm-barcode" value="${p?escapeHtml(p.barcode||""):""}" placeholder="Scan or type, or click Generate" style="flex:1;"/>
              <button type="button" class="btn btn-sm" id="pm-gen-bc">Generate</button>
            </div>
            <div class="barcode-box" id="pm-bc-preview" style="margin-top:8px;display:none;"><svg id="pm-bc-svg"></svg></div>
          </div>
          <div class="field"><label>Category</label><input class="input" id="pm-cat" list="pm-cats" value="${p?escapeHtml(p.category||"Other"):"Grocery"}"/>
            <datalist id="pm-cats">${cats.map(c=>`<option value="${escapeHtml(c)}">`).join("")}</datalist></div>
          <div class="field"><label>MRP (${cur()})</label><input class="input" id="pm-mrp" type="number" min="0" step="0.01" value="${p?p.mrp:""}" placeholder="0.00"/></div>
          <div class="field"><label>Selling price (${cur()})</label><input class="input" id="pm-sell" type="number" min="0" step="0.01" value="${p?p.selling:""}" placeholder="0.00"/></div>
          <div class="field"><label>GST rate</label>
            <select class="select" id="pm-gst">${[0,5,12,18,28].map(r=>`<option value="${r}" ${p? (p.gst==r?"selected":"") : (S().defaultGst==r?"selected":"")}>${r}%</option>`).join("")}</select></div>
          <div class="field"><label>Stock qty <span class="opt">(optional)</span></label><input class="input" id="pm-stock" type="number" min="0" value="${p&&p.stock!==""&&p.stock!==undefined&&p.stock!==null?p.stock:""}" placeholder="—"/></div>
        </div>
        <div class="hint" style="margin-top:12px;">A unique <strong>QR</strong> (customer scans → sees image, title &amp; price) and a <strong>barcode</strong> (shop owner scans → adds to bill) are generated automatically.</div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-primary" id="pm-save">${p?"Save changes":"Add product"}</button>
      </div>
    </div>`);

  let uploadedImg = p ? p.img : "";
  const refreshPreview = ()=>{
    const url = $("#pm-img").value.trim();
    const title = $("#pm-title").value.trim() || "New Product";
    const cat = $("#pm-cat").value.trim() || "Other";
    if(url){ $("#pm-preview").src = url; uploadedImg = url; }
    else if(!uploadedImg || !/^data:/.test(uploadedImg)){ const ph = placeholderImg(title, CAT_COLORS[cat]||"#6E675B"); $("#pm-preview").src = ph; uploadedImg = ph; }
  };
  $("#pm-img").oninput = refreshPreview;
  $("#pm-title").oninput = ()=>{ if(!$("#pm-img").value.trim() && !/^data:image\/(png|jpe?g)/.test(uploadedImg)) refreshPreview(); };
  $("#pm-cat").oninput = ()=>{ if(!$("#pm-img").value.trim() && !/^data:image\/(png|jpe?g)/.test(uploadedImg)) refreshPreview(); };
  $("#pm-file").onchange = (e)=>{ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ uploadedImg=r.result; $("#pm-preview").src=r.result; $("#pm-img").value=""; }; r.readAsDataURL(f); };

  // barcode preview
  const drawPm = ()=>{ const v=$("#pm-barcode").value.trim(); const box=$("#pm-bc-preview"); const svg=$("#pm-bc-svg");
    if(v && drawBarcode(svg, v, {displayValue:true, height:46, fontSize:13, width:1.8, margin:4})) box.style.display="inline-block";
    else box.style.display="none"; };
  drawPm();
  $("#pm-barcode").oninput = drawPm;
  $("#pm-gen-bc").onclick = ()=>{ $("#pm-barcode").value = genBarcode(); drawPm(); };

  $("#pm-save").onclick = ()=>{
    const title = $("#pm-title").value.trim();
    if(!title){ toast("Enter a product title"); return; }
    const sell = parseFloat($("#pm-sell").value)||0;
    const mrp = parseFloat($("#pm-mrp").value)|| sell;
    const cat = $("#pm-cat").value.trim() || "Other";
    const img = $("#pm-img").value.trim() || uploadedImg || placeholderImg(title, CAT_COLORS[cat]||"#6E675B");
    const stockRaw = $("#pm-stock").value.trim();
    const rec = {
      title, sku:$("#pm-sku").value.trim(), category:cat,
      barcode: $("#pm-barcode").value.trim() || genBarcode(),
      mrp, selling:sell, gst:Number($("#pm-gst").value),
      stock: stockRaw===""?"":Number(stockRaw), img
    };
    if(p){ Object.assign(p, rec); toast("Product updated"); }
    else { rec.id = "p"+Date.now(); state.products.push(rec); toast("Product added"); }
    save(); closeModal(); renderProducts(); renderPickGrid(); renderPickCats(); renderCart();
  };
}

/* ---------- Product label (QR + barcode) modal + scan preview ---------- */
function openQRModal(id){
  const p = state.products.find(x=>x.id===id); if(!p) return;
  const big = qrDataURL(productScanURL(p), 6, 2);
  openModal(`
    <div class="modal" style="max-width:440px;">
      <div class="modal-head"><h3>Product label</h3><button class="btn btn-ghost btn-sm close" data-close>✕</button></div>
      <div class="modal-body" style="text-align:center;">
        <div style="font-weight:700;font-size:16px;">${escapeHtml(p.title)}</div>
        <div class="hint" style="margin-bottom:14px;">${money(p.selling)} · MRP ${money(p.mrp)}</div>
        <div style="display:flex;gap:16px;justify-content:center;align-items:flex-start;flex-wrap:wrap;">
          <div style="text-align:center;">
            <div style="background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px;display:inline-block;">
              ${big?`<img src="${big}" alt="QR" style="width:150px;height:150px;image-rendering:pixelated;"/>`:"QR offline"}
            </div>
            <div class="hint" style="margin-top:6px;">QR — customer scans for price</div>
            <button class="btn btn-sm" id="dl-qr" style="margin-top:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/></svg>Download QR</button>
          </div>
          <div style="text-align:center;">
            <div class="barcode-box" style="padding:12px;"><svg id="ql-bc"></svg></div>
            <div class="hint" style="margin-top:6px;">Barcode — shop scans to bill</div>
            <button class="btn btn-sm" id="dl-bc" style="margin-top:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/></svg>Download barcode</button>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>Close</button>
        <button class="btn" id="qr-preview">Preview scan</button>
        <button class="btn btn-primary" id="qr-print">Print label</button>
      </div>
    </div>`);
  drawBarcode($("#ql-bc"), p.barcode, {displayValue:true, height:80, fontSize:14, width:1.9, margin:4});
  const nm = slug(p.sku || p.title);
  $("#dl-qr").onclick = ()=> downloadDataURL(qrPngDataURL(productScanURL(p), 8, 4), nm+"-qr.png");
  $("#dl-bc").onclick = ()=> downloadDataURL(barcodeDataURL(p.barcode), nm+"-barcode.png");
  $("#qr-preview").onclick = ()=> previewScan(id);
  $("#qr-print").onclick = ()=> printLabel(p);
}
function printLabel(p){
  const qr = qrDataURL(productScanURL(p), 6, 1) || "";
  const bc = barcodeDataURL(p.barcode);
  const w = window.open("", "_blank", "width=420,height=560");
  if(!w){ toast("Allow pop-ups to print labels"); return; }
  w.document.write(`<!doctype html><html><head><title>Label — ${escapeHtml(p.title)}</title>
    <style>body{font-family:'Segoe UI',sans-serif;text-align:center;padding:18px;margin:0;color:#201D17}
    .n{font-weight:700;font-size:17px} .p{font-size:24px;font-weight:800;margin:4px 0} .m{color:#726A5C;font-size:13px}
    .row{display:flex;gap:14px;justify-content:center;align-items:center;margin-top:12px}
    img{max-width:100%}</style></head>
    <body onload="setTimeout(()=>{print();},150)">
      <div class="n">${escapeHtml(p.title)}</div>
      <div class="p">${money(p.selling)}</div>
      <div class="m">MRP ${money(p.mrp)} · incl. ${p.gst}% GST</div>
      <div class="row">${qr?`<img src="${qr}" width="130" height="130"/>`:""}${bc?`<img src="${bc}"/>`:`<div>${escapeHtml(p.barcode||"")}</div>`}</div>
      <div class="m" style="margin-top:10px;">${escapeHtml(S().name||"")}</div>
    </body></html>`);
  w.document.close();
}
function previewScan(id){ const p=state.products.find(x=>x.id===id); if(p) window.open(productScanURL(p), "_blank","width=430,height=800"); }

/* ============================================================
   Invoices
   ============================================================ */
function renderInvoices(){
  const tb = $("#inv-tbody");
  if(!state.invoices.length){ tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M14 2v6h6"/></svg><h3>No invoices yet</h3><p>Generate a bill from the New Bill tab.</p></div></td></tr>`; return; }
  const recent = state.invoices.slice().reverse().slice(0,100);
  tb.innerHTML = recent.map(inv=>`
    <tr>
      <td class="mono">${escapeHtml(inv.number)}</td>
      <td>${escapeHtml(inv.customer.name||"Walk-in customer")}</td>
      <td>${inv.date} <span class="hint">${inv.time||""}</span></td>
      <td class="right mono">${inv.items.reduce((a,i)=>a+i.qty,0)}</td>
      <td class="right mono">${money(inv.grand)}</td>
      <td><div class="row-actions"><button class="btn btn-sm" data-open="${inv.number}">View / Print</button></div></td>
    </tr>`).join("") + (state.invoices.length>100?`<tr><td colspan="6" class="hint" style="text-align:center;padding:12px;">Showing 100 most recent of ${state.invoices.length} invoices.</td></tr>`:"");
  $$("#inv-tbody [data-open]").forEach(b=>b.onclick=()=>{ const inv=state.invoices.find(i=>i.number===b.dataset.open); openInvoiceModal(inv); });
}

function commitInvoice(payment){
  const t = billTotals();
  if(!t.items.length){ toast("Cart is empty — scan or add an item"); return null; }
  const now = new Date();
  const number = (S().prefix||"INV-") + (S().invSeq);
  const inv = {
    number, ts: now.getTime(), payment: payment||null,
    date: now.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),
    time: now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
    template: S().template, inclusive: S().inclusive, currency: cur(),
    business: {...S()},
    customer: {
      name:customer.name.trim(), phone:customer.phone.trim(),
      gstin:customer.gstin.trim(), state:customer.state || S().state
    },
    items: t.items.map(it=>({ title:it.p.title, sku:it.p.sku, hsn:it.p.hsn||"", qty:it.qty, price:it.p.selling, gst:it.g, taxable:it.taxable, tax:it.tax, gross:it.gross })),
    taxable:t.taxable, tax:t.tax, cgst:t.cgst, sgst:t.sgst, igst:t.igst, inter:t.inter, roundOff:t.roundOff, grand:t.grand, byRate:t.byRate
  };
  state.settings.invSeq += 1;
  state.invoices.push(inv);
  save();
  return inv;
}
function resetBill(){
  cart = {}; customer = { name:"", phone:"", gstin:"", state:"" };
  renderPickGrid(); renderCart(); focusScan();
}
/* ============================================================
   Direct thermal printing — Web Serial → ESC/POS (NO print dialog)
   The app opens the printer's port itself (Chrome/Edge, https/localhost).
   ============================================================ */
let serialPort = null, printerReady = false;
const serialSupported = ()=> ("serial" in navigator);

async function connectPrinter(){
  if(!serialSupported()){ toast("Open the app in Chrome/Edge over https to connect the printer"); return false; }
  try{
    serialPort = await navigator.serial.requestPort();      // first time: pick "BlueTooth Printer" / COM4
    await serialPort.open({ baudRate: 9600 });
    printerReady = true; updatePrinterChip(); toast("Printer connected — prints are now one-click & silent");
    return true;
  }catch(e){ printerReady=false; updatePrinterChip(); return false; }
}
async function ensurePrinter(){
  if(printerReady && serialPort && serialPort.writable) return true;
  if(!serialSupported()) return false;
  try{
    const ports = await navigator.serial.getPorts();        // silently reuse an already-granted port
    if(ports && ports.length){
      serialPort = ports[0];
      if(!serialPort.writable) await serialPort.open({ baudRate: 9600 });
      printerReady = true; updatePrinterChip(); return true;
    }
  }catch(e){}
  printerReady = false; updatePrinterChip(); return false;
}
async function printReceipt(inv){
  const ok = await ensurePrinter(); if(!ok) return false;
  try{
    const w = serialPort.writable.getWriter();
    try{ await w.write(escposReceipt(inv)); } finally { w.releaseLock(); }
    return true;
  }catch(e){ printerReady=false; updatePrinterChip(); toast("Print failed — reconnect the printer"); return false; }
}
function updatePrinterChip(){
  const el = document.getElementById("printer-chip"); if(!el) return;
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>`;
  el.innerHTML = icon + (printerReady ? "<span class='label'>Printer ready</span>" : "<span class='label'>Connect printer</span>");
  el.classList.toggle("ok", printerReady);
}
// ESC/POS byte stream for a 58mm printer (32 chars/line, ASCII only)
function escposReceipt(inv){
  const W=32, enc=new TextEncoder(), out=[];
  const raw=a=>{ for(const b of a) out.push(b); };
  const t=s=>{ for(const b of enc.encode(s)) out.push(b); };
  const nl=()=>out.push(0x0A);
  const ln=s=>{ t(s); nl(); };
  const clean=s=>String(s).replace(/₹/g,"Rs ").replace(/[^\x20-\x7E]/g," ").replace(/\s+$/,"");
  const m=n=>"Rs "+new Intl.NumberFormat("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
  const wrap=s=>{ s=clean(s).trim(); const w=[]; let cur=""; s.split(/\s+/).forEach(word=>{ if((cur+" "+word).trim().length>W){ if(cur) w.push(cur); cur=word.length>W?word.slice(0,W):word; } else cur=(cur?cur+" ":"")+word; }); if(cur) w.push(cur); return w.length?w:[""]; };
  const lr=(l,r)=>{ l=clean(l); r=clean(r); if(l.length+r.length>=W) l=l.slice(0,Math.max(0,W-r.length-1)); return l+" ".repeat(Math.max(1,W-l.length-r.length))+r; };
  raw([0x1B,0x40]);                                   // init
  raw([0x1B,0x61,0x01]); raw([0x1B,0x45,0x01]); raw([0x1D,0x21,0x11]); // center, bold, double
  ln(clean(inv.business.name));
  raw([0x1D,0x21,0x00]); raw([0x1B,0x45,0x00]);       // normal
  inv.business.address.split("\n").forEach(a=> wrap(a).forEach(ln));
  ln("GSTIN: "+clean(inv.business.gstin));
  ln(clean(inv.business.phone));
  raw([0x1B,0x61,0x00]);                              // left
  ln("-".repeat(W));
  ln(clean(inv.number)); ln(inv.date+"  "+inv.time);
  if(inv.customer && inv.customer.name) ln("To: "+clean(inv.customer.name)+(inv.customer.phone?" "+clean(inv.customer.phone):""));
  ln("-".repeat(W));
  inv.items.forEach(it=>{ wrap(it.title).forEach(ln); ln(lr(`${it.qty} x ${m(it.price)} ${it.gst}%`, m(it.gross))); });
  ln("-".repeat(W));
  ln(lr("Taxable", m(inv.taxable)));
  if(inv.inter) ln(lr("IGST", m(inv.igst)));
  else { ln(lr("CGST", m(inv.cgst))); ln(lr("SGST", m(inv.sgst))); }
  raw([0x1B,0x45,0x01]); ln(lr("TOTAL", m(inv.grand))); raw([0x1B,0x45,0x00]);
  if(inv.payment) ln(lr("Paid via", inv.payment.mode==="upi"?"UPI":"Cash"));
  ln("-".repeat(W));
  wrap(amountWords(inv.grand)).forEach(ln);
  ln("-".repeat(W));
  raw([0x1B,0x61,0x01]);                              // center
  wrap(inv.business.terms||"Thank you!").forEach(ln);
  nl(); nl(); nl(); nl(); nl();                       // feed room to tear off
  raw([0x1D,0x56,0x42,0x00]);                         // partial cut (ignored if no cutter)
  return new Uint8Array(out);
}

// opts: { print:true } prints; opts.template display template; opts.payment {mode}
async function generateInvoice(opts){
  opts = opts || {};
  const inv = commitInvoice(opts.payment); if(!inv) return;
  if(opts.print){
    const sent = await printReceipt(inv);              // direct ESC/POS — no dialog
    if(sent){ resetBill(); toast("Invoice "+inv.number+" printed"); return; }
    openInvoiceModal(inv, opts.template);              // fallback: browser dialog if not connected yet
    setTimeout(()=>window.print(), 220);
    resetBill();
    toast("Tip: click ‘Connect printer’ once for silent one-click printing");
    return;
  }
  openInvoiceModal(inv, opts.template);
  resetBill();
  toast("Invoice "+inv.number+" saved");
}

// Checkout: pick Cash/UPI, optional customer details, then print the thermal receipt
function openCheckout(expandCust){
  const t = billTotals();
  if(!t.items.length){ toast("Cart is empty — scan an item"); return; }
  let mode = "cash";
  const stateOpts = `<option value="">Same state (${escapeHtml(S().state)})</option>` +
    STATES.map(s=>`<option value="${s}" ${customer.state===s?"selected":""}>${s}</option>`).join("");
  openModal(`
    <div class="modal" style="max-width:440px;">
      <div class="modal-head"><h3>Checkout</h3><button class="btn btn-ghost btn-sm close" data-close>✕</button></div>
      <div class="modal-body">
        <div class="pay-total"><span>Amount payable</span><b>${money(t.grand)}</b></div>

        <div class="section-title" style="margin:16px 0 8px;">Payment method</div>
        <div class="pay-methods">
          <label class="pay-radio"><input type="radio" name="paymode" value="cash" checked/><span>Cash</span></label>
          <label class="pay-radio"><input type="radio" name="paymode" value="upi"/><span>UPI</span></label>
        </div>

        <div class="pay-cust">
          <button type="button" class="cust-toggle" id="co-cust-toggle" aria-expanded="${expandCust?"true":"false"}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>
            <span>Customer details <span class="opt">(optional)</span></span>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div class="cust-fields" id="co-cust-fields" ${expandCust?"":"hidden"}>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <input class="input" id="cust-name" placeholder="Customer name" value="${escapeHtml(customer.name)}"/>
              <input class="input" id="cust-phone" placeholder="Phone" value="${escapeHtml(customer.phone)}"/>
            </div>
            <div style="display:grid; grid-template-columns:1fr 150px; gap:10px; margin-top:10px;">
              <input class="input" id="cust-gstin" placeholder="Customer GSTIN (B2B)" value="${escapeHtml(customer.gstin)}"/>
              <select class="select" id="cust-state" title="Place of supply">${stateOpts}</select>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-accent" id="pay-confirm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>
          Confirm &amp; Print <kbd>Enter</kbd>
        </button>
      </div>
    </div>`);

  $$('input[name="paymode"]').forEach(r=> r.onchange=()=>{ mode=r.value; });
  $("#cust-name").oninput  = e=> customer.name  = e.target.value;
  $("#cust-phone").oninput = e=> customer.phone = e.target.value;
  $("#cust-gstin").oninput = e=> customer.gstin = e.target.value;
  $("#cust-state").onchange = e=> customer.state = e.target.value;
  $("#co-cust-toggle").onclick = ()=>{ const f=$("#co-cust-fields"); const open=f.hidden; f.hidden=!open; $("#co-cust-toggle").setAttribute("aria-expanded", open); };

  const confirm = ()=>{ closeModal(); generateInvoice({print:true, template:"thermal", payment:{mode}}); };
  $("#pay-confirm").onclick = confirm;
  const modalEl = $("#modal-root .modal");
  if(modalEl) modalEl.onkeydown = (e)=>{ if(e.key==="Enter" && document.activeElement.tagName!=="SELECT"){ e.preventDefault(); confirm(); } };
  if(expandCust){ setTimeout(()=>{ const n=$("#cust-name"); if(n) n.focus(); }, 40); }
}

// Sets the print page size/margins to match the template (thermal 58mm vs A4)
function setPrintPage(tpl){
  let st = document.getElementById("print-page");
  if(!st){ st = document.createElement("style"); st.id = "print-page"; document.head.appendChild(st); }
  // Thermal: keep the driver's own 58mm paper, just kill the page margin (the 12mm margin was squishing it).
  // Do NOT set @page size — "58mm auto" makes some ESC/POS drivers print nothing.
  st.textContent = (tpl==="thermal")
    ? "@media print{ @page{ margin:0; } }"
    : "@media print{ @page{ size:A4; margin:12mm; } }";
}
function openInvoiceModal(inv, tplOverride){
  const tpl0 = tplOverride || inv.template;
  setPrintPage(tpl0);
  openModal(`
    <div class="modal wide">
      <div class="modal-head">
        <h3>Invoice ${escapeHtml(inv.number)}</h3>
        <select class="select" id="inv-tpl-switch" style="width:auto;margin-left:10px;">
          <option value="classic" ${tpl0==="classic"?"selected":""}>Classic</option>
          <option value="modern" ${tpl0==="modern"?"selected":""}>Modern</option>
          <option value="thermal" ${tpl0==="thermal"?"selected":""}>Thermal 80mm</option>
        </select>
        <button class="btn btn-ghost btn-sm close" data-close style="margin-left:auto;">✕</button>
      </div>
      <div class="modal-body" style="padding:0;">
        <div class="invoice-scroll" id="print-area">${renderInvoiceHTML(inv, tpl0)}</div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>Close</button>
        <button class="btn btn-accent" id="inv-print">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>
          Print / Save PDF <kbd>Ctrl+P</kbd>
        </button>
      </div>
    </div>`);
  $("#inv-tpl-switch").onchange = (e)=>{ setPrintPage(e.target.value); $("#print-area").innerHTML = renderInvoiceHTML(inv, e.target.value); };
  $("#inv-print").onclick = ()=> window.print();
}

/* ---------- Invoice renderers ---------- */
function taxSummaryRows(inv){
  return Object.keys(inv.byRate).sort((a,b)=>a-b).map(r=>{
    const b=inv.byRate[r]; return `<tr><td>${r}%</td><td class="r">${money(b.taxable)}</td><td class="r">${money(b.tax)}</td></tr>`;
  }).join("");
}
function invItemsRows(inv, thermal){
  return inv.items.map((it,i)=> thermal
    ? `<tr><td>${escapeHtml(it.title)}<br/><span class="inv-muted">${it.qty} × ${money(it.price)} · ${it.gst}%</span></td><td class="r">${money(it.gross)}</td></tr>`
    : `<tr><td>${i+1}</td><td>${escapeHtml(it.title)}${it.sku?`<br/><span class="inv-muted" style="font-size:11px">${escapeHtml(it.sku)}</span>`:""}</td><td class="r">${it.qty}</td><td class="r">${money(it.price)}</td><td class="r">${it.gst}%</td><td class="r">${money(it.gross)}</td></tr>`
  ).join("");
}
function invQR(inv){ const d = qrDataURL(`${inv.number}|${inv.business.gstin}|${money(inv.grand)}`, 4, 0); return d?`<img src="${d}" alt="QR"/>`:""; }
function payLine(inv){
  if(!inv.payment) return "";
  return `<div class="inv-tot-row"><span>Paid via</span><span>${inv.payment.mode==="upi"?"UPI":"Cash"}</span></div>`;
}

function renderInvoiceHTML(inv, tpl){
  const b = inv.business, c = inv.customer;
  const taxLabel = inv.inter
    ? `<div class="inv-tot-row"><span>IGST</span><span>${money(inv.igst)}</span></div>`
    : `<div class="inv-tot-row"><span>CGST</span><span>${money(inv.cgst)}</span></div><div class="inv-tot-row"><span>SGST</span><span>${money(inv.sgst)}</span></div>`;
  const logo = b.logo ? `<img src="${b.logo}" alt="" style="height:46px;border-radius:6px;"/>` : "";

  if(tpl==="thermal"){
    return `<div class="invoice tpl-thermal">
      <div class="inv-pad">
        <div class="center">
          <div class="inv-title">${escapeHtml(b.name)}</div>
          <div class="inv-muted" style="white-space:pre-line;">${escapeHtml(b.address)}</div>
          <div class="inv-muted">GSTIN: ${escapeHtml(b.gstin)}</div>
          <div class="inv-muted">${escapeHtml(b.phone)}</div>
        </div>
        <hr class="dashed"/>
        <div class="trow2"><span>${inv.number}</span><span>${inv.date} ${inv.time}</span></div>
        ${c.name?`<div class="trow2"><span>To: ${escapeHtml(c.name)}</span><span>${escapeHtml(c.phone)}</span></div>`:""}
        <hr class="dashed"/>
        <table class="inv-table"><tbody>${invItemsRows(inv,true)}</tbody></table>
        <hr class="dashed"/>
        <div class="trow2"><span>Taxable</span><span>${money(inv.taxable)}</span></div>
        ${inv.inter?`<div class="trow2"><span>IGST</span><span>${money(inv.igst)}</span></div>`:`<div class="trow2"><span>CGST</span><span>${money(inv.cgst)}</span></div><div class="trow2"><span>SGST</span><span>${money(inv.sgst)}</span></div>`}
        ${Math.abs(inv.roundOff)>=0.005?`<div class="trow2"><span>Round off</span><span>${inv.roundOff>=0?"+":"−"}${money(Math.abs(inv.roundOff))}</span></div>`:""}
        <hr class="dashed"/>
        <div class="trow2" style="font-size:15px;font-weight:700;"><span>TOTAL</span><span>${money(inv.grand)}</span></div>
        ${inv.payment?`<div class="trow2"><span>Paid via</span><span>${inv.payment.mode==="upi"?"UPI":"Cash"}</span></div>`:""}
        <div class="inv-words">${amountWords(inv.grand)}</div>
        <div class="inv-qr">${invQR(inv)}</div>
        <hr class="dashed"/>
        <div class="center inv-muted">${escapeHtml(b.terms||"Thank you!")}</div>
        <div class="tail-space"></div>
      </div></div>`;
  }

  if(tpl==="modern"){
    return `<div class="invoice tpl-modern"><div class="inv-pad">
      <div class="inv-head">
        <div>${logo}<div class="inv-badge">Tax Invoice</div>
          <div class="inv-title">${escapeHtml(b.name)}</div>
          <div class="inv-muted" style="white-space:pre-line;margin-top:2px;">${escapeHtml(b.address)}</div>
          <div class="inv-muted">GSTIN ${escapeHtml(b.gstin)} · ${escapeHtml(b.phone)}</div>
        </div>
        <div style="text-align:right;">
          <div class="inv-muted">Invoice No.</div><div style="font-weight:700;font-size:15px;">${escapeHtml(inv.number)}</div>
          <div class="inv-muted" style="margin-top:8px;">Date</div><div style="font-weight:600;">${inv.date}</div>
          <div class="inv-qr" style="margin-left:auto;margin-top:10px;">${invQR(inv)}</div>
        </div>
      </div>
      <hr class="inv-hr"/>
      <div class="inv-muted">Billed to</div>
      <div style="font-weight:650;">${escapeHtml(c.name||"Walk-in customer")}</div>
      <div class="inv-muted">${[c.phone, c.gstin?("GSTIN "+c.gstin):"", "Place of supply: "+escapeHtml(c.state)].filter(Boolean).join(" · ")}</div>
      <table class="inv-table"><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">Amount</th></tr></thead>
        <tbody>${invItemsRows(inv,false)}</tbody></table>
      <hr class="inv-hr"/>
      <div style="display:flex;gap:24px;align-items:flex-start;">
        <div style="flex:1;">
          <div class="inv-muted" style="font-weight:600;margin-bottom:4px;">Tax summary</div>
          <table class="inv-table" style="margin-top:0;"><thead><tr><th>Rate</th><th class="r">Taxable</th><th class="r">Tax</th></tr></thead><tbody>${taxSummaryRows(inv)}</tbody></table>
        </div>
        <div class="inv-tot-box">
          <div class="inv-tot-row"><span class="inv-muted">Taxable value</span><span>${money(inv.taxable)}</span></div>
          ${taxLabel}
          ${Math.abs(inv.roundOff)>=0.005?`<div class="inv-tot-row"><span class="inv-muted">Round off</span><span>${inv.roundOff>=0?"+":"−"}${money(Math.abs(inv.roundOff))}</span></div>`:""}
          <div class="inv-tot-row g"><span>Total</span><span>${money(inv.grand)}</span></div>
          ${payLine(inv)}
        </div>
      </div>
      <div class="inv-words"><strong>In words:</strong> ${amountWords(inv.grand)}</div>
      <hr class="inv-hr"/>
      <div class="inv-muted" style="font-size:11.5px;">${escapeHtml(b.terms||"")}</div>
    </div></div>`;
  }

  /* classic */
  return `<div class="invoice tpl-classic">
    <div class="inv-band">
      <div style="display:flex;align-items:center;gap:12px;">${logo}
        <div><div class="inv-title">${escapeHtml(b.name)}</div>
        <div style="font-size:12px;opacity:.9;">GSTIN ${escapeHtml(b.gstin)} · ${escapeHtml(b.phone)}</div></div>
      </div>
      <div style="text-align:right;"><div style="font-size:13px;opacity:.85;">TAX INVOICE</div>
        <div style="font-weight:700;">${escapeHtml(inv.number)}</div><div style="font-size:12px;opacity:.85;">${inv.date} · ${inv.time}</div></div>
    </div>
    <div class="inv-pad">
      <div class="inv-grid2">
        <div><div class="inv-muted" style="font-weight:600;">From</div>
          <div style="font-weight:600;">${escapeHtml(b.name)}</div>
          <div class="inv-muted" style="white-space:pre-line;">${escapeHtml(b.address)}</div></div>
        <div><div class="inv-muted" style="font-weight:600;">Bill to</div>
          <div style="font-weight:600;">${escapeHtml(c.name||"Walk-in customer")}</div>
          <div class="inv-muted">${[c.phone, c.gstin?("GSTIN "+c.gstin):""].filter(Boolean).join(" · ")}</div>
          <div class="inv-muted">Place of supply: ${escapeHtml(c.state)}</div></div>
      </div>
      <table class="inv-table"><thead><tr><th>#</th><th>Item &amp; HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">GST</th><th class="r">Amount</th></tr></thead>
        <tbody>${invItemsRows(inv,false)}</tbody></table>
      <hr class="inv-hr"/>
      <div style="display:flex;gap:24px;align-items:flex-start;">
        <div style="flex:1;">
          <div class="inv-qr">${invQR(inv)}</div>
          <div class="inv-words" style="margin-top:8px;"><strong>Amount in words:</strong><br/>${amountWords(inv.grand)}</div>
        </div>
        <div class="inv-tot-box">
          <div class="inv-tot-row"><span>Taxable value</span><span>${money(inv.taxable)}</span></div>
          ${taxLabel}
          ${Math.abs(inv.roundOff)>=0.005?`<div class="inv-tot-row"><span>Round off</span><span>${inv.roundOff>=0?"+":"−"}${money(Math.abs(inv.roundOff))}</span></div>`:""}
          <div class="inv-tot-row g"><span>Grand Total</span><span>${money(inv.grand)}</span></div>
          ${payLine(inv)}
        </div>
      </div>
      <hr class="inv-hr"/>
      <div class="inv-grid2" style="align-items:end;">
        <div class="inv-muted" style="font-size:11.5px;">${escapeHtml(b.terms||"")}</div>
        <div style="text-align:right;"><div style="height:38px;"></div><div style="border-top:1px solid #bbb;display:inline-block;padding-top:4px;font-size:12px;">Authorised signatory</div></div>
      </div>
    </div></div>`;
}

/* ---------- Amount in words (Indian) ---------- */
function amountWords(n){
  n = Math.round(n);
  if(n===0) return "Zero rupees only";
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const two=(x)=> x<20?ones[x]:tens[Math.floor(x/10)]+(x%10?" "+ones[x%10]:"");
  const three=(x)=> (x>=100? ones[Math.floor(x/100)]+" Hundred"+(x%100?" ":""):"")+(x%100?two(x%100):"");
  let out="", cr=Math.floor(n/10000000); n%=10000000;
  let lk=Math.floor(n/100000); n%=100000; let th=Math.floor(n/1000); n%=1000;
  if(cr) out+=three(cr)+" Crore "; if(lk) out+=three(lk)+" Lakh "; if(th) out+=three(th)+" Thousand ";
  if(n) out+=three(n);
  return out.trim().replace(/\s+/g," ")+" rupees only";
}

/* ============================================================
   Analytics / Reports
   ============================================================ */
function ymd(ts){ const d=new Date(ts); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function periodRange(){
  const now = new Date(); let start, end = now.getTime(), label;
  if(anPeriod==="month"){ start = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); label = now.toLocaleDateString("en-IN",{month:"long",year:"numeric"}); }
  else if(anPeriod==="30"){ start = now.getTime() - 30*864e5; label = "Last 30 days"; }
  else if(anPeriod==="year"){ start = new Date(now.getFullYear(),0,1).getTime(); label = String(now.getFullYear()); }
  else { start = 0; label = "All time"; }
  return { start, end, label };
}
function inPeriod(){ const {start,end}=periodRange(); return state.invoices.filter(i=> i.ts>=start && i.ts<=end); }
function sumField(list,f){ return list.reduce((a,i)=>a+(i[f]||0),0); }
function itemCount(list){ return list.reduce((a,i)=>a+i.items.reduce((s,x)=>s+x.qty,0),0); }

function renderAnalytics(){
  const list = inPeriod();
  const {label} = periodRange();
  const sales = sumField(list,"grand"), gst = sumField(list,"tax"), taxable = sumField(list,"taxable");
  const count = list.length, avg = count?sales/count:0, items = itemCount(list);

  // delta vs previous equal-length period
  let deltaHTML = "";
  if(anPeriod!=="all"){
    const {start,end}=periodRange(); const span=end-start;
    const prev = state.invoices.filter(i=> i.ts>=start-span && i.ts<start);
    const prevSales = sumField(prev,"grand");
    if(prevSales>0){ const pct=Math.round((sales-prevSales)/prevSales*100);
      deltaHTML = `<div class="kd ${pct>=0?"up":"down"}">${pct>=0?"▲":"▼"} ${Math.abs(pct)}% vs previous</div>`; }
  }

  $("#kpi-row").innerHTML = `
    <div class="kpi accent">
      <div class="kl">Total sales</div>
      <div class="kv">${money0(sales)}</div>
      ${deltaHTML || `<div class="kd">${label}</div>`}
    </div>
    <div class="kpi"><div class="kl">Invoices</div><div class="kv">${count}</div><div class="kd">${items} items sold</div></div>
    <div class="kpi"><div class="kl">Average bill</div><div class="kv">${money0(avg)}</div><div class="kd">per invoice</div></div>
    <div class="kpi"><div class="kl">GST collected</div><div class="kv">${money0(gst)}</div><div class="kd">on ${money0(taxable)} taxable</div></div>`;

  renderMonthlyBars();
  renderDailyBars();
  renderTopProducts(list);
  renderDailyTable(list);
}

function renderMonthlyBars(){
  const now = new Date(); const buckets=[];
  for(let m=7;m>=0;m--){ const d=new Date(now.getFullYear(), now.getMonth()-m, 1);
    buckets.push({ key:d.getFullYear()+"-"+d.getMonth(), label:d.toLocaleDateString("en-IN",{month:"short"}), y:d.getFullYear(), mo:d.getMonth(), total:0 }); }
  state.invoices.forEach(inv=>{ const d=new Date(inv.ts); const b=buckets.find(x=>x.y===d.getFullYear()&&x.mo===d.getMonth()); if(b) b.total+=inv.grand; });
  const max = Math.max(1, ...buckets.map(b=>b.total));
  $("#month-bars").innerHTML = buckets.map(b=>`
    <div class="bar" title="${b.label}: ${money(b.total)}">
      <div class="bv">${b.total?moneyShort(b.total):""}</div>
      <div class="col"><div class="fill" style="height:${Math.round(b.total/max*100)}%"></div></div>
      <div class="bl">${b.label}</div>
    </div>`).join("");
}

function renderDailyBars(){
  const now = new Date(); const days=[];
  let from, count;
  if(anPeriod==="month"){ const dim=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); count=now.getDate(); from=new Date(now.getFullYear(),now.getMonth(),1); $("#daily-sub").textContent = now.toLocaleDateString("en-IN",{month:"long"})+" · day-wise"; }
  else { count=30; from=new Date(now.getFullYear(),now.getMonth(),now.getDate()-29); $("#daily-sub").textContent = "Last 30 days · day-wise"; }
  const map = {};
  state.invoices.forEach(inv=>{ map[ymd(inv.ts)] = (map[ymd(inv.ts)]||0)+inv.grand; });
  for(let i=0;i<count;i++){ const d=new Date(from.getFullYear(),from.getMonth(),from.getDate()+i);
    days.push({ d, total: map[ymd(d.getTime())]||0 }); }
  const max = Math.max(1, ...days.map(x=>x.total));
  $("#daily-bars").innerHTML = days.map(x=>`
    <div class="bar" title="${x.d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}: ${money(x.total)}">
      <div class="col"><div class="fill" style="height:${Math.round(x.total/max*100)}%"></div></div>
      <div class="bl">${x.d.getDate()}</div>
    </div>`).join("");
}

function renderTopProducts(list){
  const agg = {};
  list.forEach(inv=> inv.items.forEach(it=>{ agg[it.title]=agg[it.title]||{rev:0,qty:0}; agg[it.title].rev+=it.gross; agg[it.title].qty+=it.qty; }));
  const rows = Object.entries(agg).sort((a,b)=>b[1].rev-a[1].rev).slice(0,6);
  const max = Math.max(1, ...rows.map(r=>r[1].rev));
  const box = $("#top-products");
  if(!rows.length){ box.innerHTML = `<div class="hint" style="padding:20px 0;text-align:center;">No sales in this period.</div>`; return; }
  box.innerHTML = rows.map(([name,v])=>`
    <div class="top-item">
      <div class="tn">${escapeHtml(name)}</div>
      <div class="tv">${money0(v.rev)}</div>
      <div class="tq">${v.qty} sold</div>
      <div class="tbar"><span style="width:${Math.round(v.rev/max*100)}%"></span></div>
    </div>`).join("");
}

function renderDailyTable(list){
  const map = {};
  list.forEach(inv=>{ const k=ymd(inv.ts); map[k]=map[k]||{count:0,items:0,taxable:0,tax:0,sales:0};
    map[k].count++; map[k].items+=inv.items.reduce((s,x)=>s+x.qty,0); map[k].taxable+=inv.taxable; map[k].tax+=inv.tax; map[k].sales+=inv.grand; });
  let keys = Object.keys(map).sort().reverse();
  const cap = 62; const truncated = keys.length>cap; keys = keys.slice(0,cap);
  const tb = $("#daily-tbody");
  if(!keys.length){ tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>No sales in this period</h3></div></td></tr>`; return; }
  tb.innerHTML = keys.map(k=>{ const r=map[k]; const d=new Date(k+"T00:00:00");
    return `<tr>
      <td>${d.toLocaleDateString("en-IN",{weekday:"short",day:"2-digit",month:"short",year:"numeric"})}</td>
      <td class="right mono">${r.count}</td>
      <td class="right mono">${r.items}</td>
      <td class="right mono">${money(r.taxable)}</td>
      <td class="right mono">${money(r.tax)}</td>
      <td class="right mono" style="font-weight:700;">${money(r.sales)}</td>
    </tr>`; }).join("") + (truncated?`<tr><td colspan="6" class="hint" style="text-align:center;padding:12px;">Showing most recent ${cap} days.</td></tr>`:"");
}

/* ============================================================
   Settings
   ============================================================ */
function fillStateSelects(){
  const opts = STATES.map(s=>`<option value="${s}">${s}</option>`).join("");
  if($("#s-state")) $("#s-state").innerHTML = opts;   // customer state select lives in the checkout dialog now
}
function renderSettings(){
  const s = S();
  $("#s-name").value=s.name; $("#s-gstin").value=s.gstin; $("#s-phone").value=s.phone;
  $("#s-address").value=s.address; $("#s-email").value=s.email; $("#s-state").value=s.state;
  $("#s-prefix").value=s.prefix; $("#s-logo").value=s.logo; $("#s-terms").value=s.terms;
  $("#s-default-gst").value=s.defaultGst; $("#s-currency").value=s.currency;
  $("#s-inclusive").setAttribute("aria-checked", s.inclusive);
  $("#s-qr-price").setAttribute("aria-checked", s.qrPrice);
  $("#s-logo-preview").src = s.logo || placeholderImg(s.name||"Logo", "#17624B");
  $$("#template-row .template-card").forEach(c=> c.setAttribute("aria-pressed", c.dataset.tpl===s.template));
  renderTemplateThumbs();
}
function renderTemplateThumbs(){
  const mini = (tpl)=>{
    if(tpl==="thermal") return `<div style="font-family:monospace;font-size:6px;padding:8px 10px;text-align:center;line-height:1.5;color:#333;"><b>${escapeHtml(S().name||"SHOP")}</b><div style="border-top:1px dashed #999;margin:4px 0;"></div>Item ....... 100<br/>Item ....... 250<div style="border-top:1px dashed #999;margin:4px 0;"></div><b>TOTAL 350</b><div style="width:26px;height:26px;background:conic-gradient(#000 25%,#fff 0);margin:5px auto;"></div></div>`;
    if(tpl==="modern") return `<div style="padding:9px 11px;font-size:6px;color:#333;"><div style="color:#B4531F;font-weight:700;letter-spacing:1px;">TAX INVOICE</div><b style="color:#0E4A38;font-size:9px;">${escapeHtml(S().name||"Business")}</b><div style="border-top:1px solid #eee;margin:5px 0;"></div><div style="display:flex;justify-content:space-between;">Item A<span>₹100</span></div><div style="display:flex;justify-content:space-between;">Item B<span>₹250</span></div><div style="border-top:1px solid #eee;margin:5px 0;"></div><div style="display:flex;justify-content:space-between;font-weight:700;">Total<span>₹350</span></div></div>`;
    return `<div style="font-size:6px;color:#333;"><div style="background:#17624B;color:#fff;padding:6px 9px;font-weight:700;">${escapeHtml(S().name||"Business")}<span style="float:right;font-weight:400;">INVOICE</span></div><div style="padding:8px 9px;"><div style="background:#f3efe6;padding:2px 4px;display:flex;justify-content:space-between;"><span>Item</span><span>Amt</span></div><div style="display:flex;justify-content:space-between;padding:1px 4px;">Item A<span>100</span></div><div style="display:flex;justify-content:space-between;padding:1px 4px;">Item B<span>250</span></div><div style="text-align:right;border-top:2px solid #222;margin-top:4px;padding-top:2px;font-weight:700;">₹350.00</div></div></div>`;
  };
  $("#tv-classic").innerHTML = mini("classic");
  $("#tv-modern").innerHTML = mini("modern");
  $("#tv-thermal").innerHTML = mini("thermal");
}
function saveSettings(){
  const s = S();
  s.name=$("#s-name").value.trim(); s.gstin=$("#s-gstin").value.trim(); s.phone=$("#s-phone").value.trim();
  s.address=$("#s-address").value.trim(); s.email=$("#s-email").value.trim(); s.state=$("#s-state").value;
  s.prefix=$("#s-prefix").value.trim()||"INV-"; s.logo=$("#s-logo").value.trim(); s.terms=$("#s-terms").value.trim();
  s.defaultGst=Number($("#s-default-gst").value); s.currency=$("#s-currency").value.trim()||"₹";
  s.inclusive = $("#s-inclusive").getAttribute("aria-checked")==="true";
  s.qrPrice = $("#s-qr-price").getAttribute("aria-checked")==="true";
  save(); renderCart(); renderPickGrid(); renderTopbar(); toast("Settings saved");
}

/* ============================================================
   Modal + toast helpers
   ============================================================ */
function openModal(html){ const r=$("#modal-root"); r.innerHTML=html; r.hidden=false;
  $$("[data-close]",r).forEach(b=> b.onclick=closeModal);
  r.onclick=(e)=>{ if(e.target===r) closeModal(); };
}
function closeModal(){ const r=$("#modal-root"); r.hidden=true; r.innerHTML=""; }
function toast(msg){ const w=$("#toast-wrap"); const t=document.createElement("div"); t.className="toast";
  t.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 5 5L20 7"/></svg>${escapeHtml(msg)}`;
  w.appendChild(t); setTimeout(()=>{ t.style.opacity="0"; t.style.transition="opacity .3s"; setTimeout(()=>t.remove(),300); }, 2200);
}

/* ============================================================
   Wire up
   ============================================================ */
function init(){
  fillStateSelects();
  // nav
  $$("#nav .nav-item").forEach(b=> b.onclick=()=>setView(b.dataset.view));
  $$("#mobile-nav button").forEach(b=> b.onclick=()=>setView(b.dataset.view));
  // billing
  $("#prod-search").oninput = (e)=>{ prodQuery=e.target.value; renderProducts(); };

  // scanner input: hardware scanner types the code + Enter; typing shows suggestions
  const si=$("#scan-input");
  if(si){
    si.oninput = renderSuggest;
    si.onkeydown = (e)=>{
      if(e.key==="Enter"){ e.preventDefault(); scanEnter(); }
      else if(e.key==="ArrowDown"){ e.preventDefault(); moveSuggest(1); }
      else if(e.key==="ArrowUp"){ e.preventDefault(); moveSuggest(-1); }
      else if(e.key==="Escape"){ hideSuggest(); }
    };
    si.onblur = ()=> setTimeout(hideSuggest, 150);
  }
  $("#scan-add").onclick = scanEnter;
  $("#scan-clear").onclick = ()=>{ cart={}; renderCart(); focusScan(); };

  // sticky action bar → checkout (Cash / UPI) then print thermal receipt
  $("#ab-print").onclick = openCheckout;

  // analytics period toggle
  $$("#period-seg button").forEach(b=> b.onclick=()=>{ anPeriod=b.dataset.period; $$("#period-seg button").forEach(x=>x.classList.toggle("active",x===b)); renderAnalytics(); });
  // settings toggles + template
  document.addEventListener("click",(e)=>{
    const sw = e.target.closest(".switch");
    if(sw){ const v = sw.getAttribute("aria-checked")!=="true"; sw.setAttribute("aria-checked", v); }
    const tc = e.target.closest(".template-card");
    if(tc){ $$("#template-row .template-card").forEach(c=>c.setAttribute("aria-pressed", c===tc)); S().template=tc.dataset.tpl; renderTemplateThumbs(); }
  });
  // esc closes modal
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeModal(); });
  // native-app keyboard shortcuts (function keys, Alt+number)
  document.addEventListener("keydown", handleShortcut);
  // keyboard-wedge: in scan mode, any stray key focuses the scan box so no scan is lost
  document.addEventListener("keydown",(e)=>{
    if(billMode!=="scan" || currentView!=="billing" || !$("#modal-root").hidden) return;
    if(e.ctrlKey||e.altKey||e.metaKey) return;
    const tag=(document.activeElement||{}).tagName||"";
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if(e.key.length===1){ focusScan(); }
  });

  renderPickCats(); renderPickGrid(); renderCart(); renderTopbar(); renderHolds();
  const views = ["billing","products","invoices","analytics","settings"];
  const go = (h)=>{ if(h==="scan"){ setView("billing"); setBillMode("scan"); } else if(views.includes(h)) setView(h); };
  const deep = location.hash.replace("#","");
  if(deep==="scan") go("scan"); else setView(views.includes(deep) ? deep : "billing");
  window.addEventListener("hashchange", ()=>{ go(location.hash.replace("#","")); });
}
document.addEventListener("DOMContentLoaded", init);
