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

/* ---------- Seed data ---------- */
function seedProducts(){
  const p = [
    ["Aashirvaad Atta 5kg","ATT-5K",285,265,5,"Grocery",40],
    ["Tata Salt 1kg","SLT-1K",28,26,5,"Grocery",120],
    ["Amul Butter 500g","AMB-500",285,275,12,"Dairy",24],
    ["Colgate MaxFresh 150g","CLG-150",99,92,18,"Personal",60],
    ["Parle-G Biscuit 250g","PGB-250",30,28,18,"Snacks",8],
    ["Fortune Sunflower Oil 1L","OIL-1L",145,139,5,"Grocery",55],
    ["Dettol Handwash 200ml","DTL-200",99,85,18,"Personal",30],
    ["Bru Instant Coffee 100g","BRU-100",175,168,18,"Beverage",0],
    ["Maggi Noodles 12-pack","MAG-12",168,155,18,"Snacks",45],
    ["Surf Excel 1kg","SRF-1K",130,118,18,"Home",22],
  ];
  return p.map((r,i)=>({
    id: "p"+(i+1), title:r[0], sku:r[1], mrp:r[2], selling:r[3], gst:r[4], category:r[5], stock:r[6],
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
  const custState = $("#cust-state") ? $("#cust-state").value : "";
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
  billing:["New Bill","Pick products and generate a GST invoice"],
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
    a.innerHTML = `<span class="hint" style="display:flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--muted)"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${S().inclusive?"Prices incl. GST":"GST added at checkout"}</span>`;
  } else { a.innerHTML = ""; }
}

/* ============================================================
   Billing — product picker + cart
   ============================================================ */
function categories(){ return ["All", ...new Set(state.products.map(p=>p.category||"Other"))]; }
function renderPickCats(){
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

function renderCart(){
  const t = billTotals();
  $("#cart-count").textContent = `${t.qtyTot} item${t.qtyTot!==1?"s":""}`;
  const lines = $("#cart-lines");
  if(!t.items.length){
    lines.innerHTML = `<div class="cart-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg>
      <div>No items yet.<br/>Tap a product to start billing.</div></div>`;
  } else {
    lines.innerHTML = t.items.map(it=>`
      <div class="line">
        <div>
          <div class="lt">${escapeHtml(it.p.title)}</div>
          <div class="lsub">${money(it.p.selling)} × ${it.qty} · ${it.g}% GST</div>
        </div>
        <div class="lamt">${money(it.gross)}</div>
        <div class="qty">
          <button data-dec="${it.p.id}">−</button><span>${it.qty}</span><button data-inc="${it.p.id}">+</button>
        </div>
        <button class="icon-btn danger lremove" data-rm="${it.p.id}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12"/></svg>
        </button>
      </div>`).join("");
    $$("#cart-lines [data-inc]").forEach(b=>b.onclick=()=>setQty(b.dataset.inc, cart[b.dataset.inc]+1));
    $$("#cart-lines [data-dec]").forEach(b=>b.onclick=()=>setQty(b.dataset.dec, cart[b.dataset.dec]-1));
    $$("#cart-lines [data-rm]").forEach(b=>b.onclick=()=>setQty(b.dataset.rm, 0));
  }

  const taxLabel = t.inter
    ? `<div class="trow"><span>IGST</span><span class="tval">${money(t.igst)}</span></div>`
    : `<div class="trow"><span>CGST</span><span class="tval">${money(t.cgst)}</span></div>
       <div class="trow"><span>SGST</span><span class="tval">${money(t.sgst)}</span></div>`;
  $("#cart-totals").innerHTML = `
    <div class="trow"><span>Taxable value</span><span class="tval">${money(t.taxable)}</span></div>
    ${t.tax>0?taxLabel:""}
    ${Math.abs(t.roundOff)>=0.005?`<div class="trow muted"><span>Round off</span><span class="tval">${t.roundOff>=0?"+":"−"}${money(Math.abs(t.roundOff)).replace(cur(),cur())}</span></div>`:""}
    <div class="trow grand"><span>Total ${S().inclusive?"":"payable"}</span><span class="tval">${money(t.grand)}</span></div>`;
  $("#btn-generate").disabled = !t.items.length;

  // sidebar/nav counts
  $("#nav-prod-count").textContent = state.products.length;
  $("#nav-inv-count").textContent = state.invoices.length;
  $("#side-biz").textContent = S().name || "Your Business";
  $("#side-gstin").textContent = "GSTIN " + (S().gstin || "—");
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
          <div class="ts">${p.sku?escapeHtml(p.sku)+" · ":""}${escapeHtml(p.category||"Other")}</div></div>
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
          <div class="field"><label>SKU / Barcode <span class="opt">(optional)</span></label><input class="input mono" id="pm-sku" value="${p?escapeHtml(p.sku||""):""}" placeholder="ATT-5K"/></div>
          <div class="field"><label>Category</label><input class="input" id="pm-cat" list="pm-cats" value="${p?escapeHtml(p.category||"Other"):"Grocery"}"/>
            <datalist id="pm-cats">${cats.map(c=>`<option value="${escapeHtml(c)}">`).join("")}</datalist></div>
          <div class="field"><label>MRP (${cur()})</label><input class="input" id="pm-mrp" type="number" min="0" step="0.01" value="${p?p.mrp:""}" placeholder="0.00"/></div>
          <div class="field"><label>Selling price (${cur()})</label><input class="input" id="pm-sell" type="number" min="0" step="0.01" value="${p?p.selling:""}" placeholder="0.00"/></div>
          <div class="field"><label>GST rate</label>
            <select class="select" id="pm-gst">${[0,5,12,18,28].map(r=>`<option value="${r}" ${p? (p.gst==r?"selected":"") : (S().defaultGst==r?"selected":"")}>${r}%</option>`).join("")}</select></div>
          <div class="field"><label>Stock qty <span class="opt">(optional)</span></label><input class="input" id="pm-stock" type="number" min="0" value="${p&&p.stock!==""&&p.stock!==undefined&&p.stock!==null?p.stock:""}" placeholder="—"/></div>
        </div>
        <div class="hint" style="margin-top:12px;">A unique QR code is generated automatically. Scanning it shows the product image, title, selling price &amp; MRP.</div>
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
      mrp, selling:sell, gst:Number($("#pm-gst").value),
      stock: stockRaw===""?"":Number(stockRaw), img
    };
    if(p){ Object.assign(p, rec); toast("Product updated"); }
    else { rec.id = "p"+Date.now(); state.products.push(rec); toast("Product added"); }
    save(); closeModal(); renderProducts(); renderPickGrid(); renderPickCats(); renderCart();
  };
}

/* ---------- QR modal + scan preview ---------- */
function openQRModal(id){
  const p = state.products.find(x=>x.id===id); if(!p) return;
  const big = qrDataURL(productScanURL(p), 6, 2);
  openModal(`
    <div class="modal" style="max-width:420px;">
      <div class="modal-head"><h3>Product QR</h3><button class="btn btn-ghost btn-sm close" data-close>✕</button></div>
      <div class="modal-body" style="text-align:center;">
        <div style="background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;display:inline-block;">
          ${big?`<img src="${big}" alt="QR" style="width:220px;height:220px;image-rendering:pixelated;"/>`:"QR unavailable offline"}
        </div>
        <div style="margin-top:14px;font-weight:650;">${escapeHtml(p.title)}</div>
        <div class="hint">${money(p.selling)} · MRP ${money(p.mrp)}</div>
        <div class="hint" style="margin-top:10px;">Print this label for the shelf. Customers scan it to see the image, title &amp; price.</div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>Close</button>
        <button class="btn" id="qr-preview">Preview scan</button>
        <button class="btn btn-primary" id="qr-print">Print label</button>
      </div>
    </div>`);
  $("#qr-preview").onclick = ()=> previewScan(id);
  $("#qr-print").onclick = ()=> window.open(productScanURL(p), "_blank");
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

function generateInvoice(){
  const t = billTotals();
  if(!t.items.length){ toast("Add at least one product"); return; }
  const now = new Date();
  const number = (S().prefix||"INV-") + (S().invSeq);
  const inv = {
    number, ts: now.getTime(),
    date: now.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),
    time: now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
    template: S().template, inclusive: S().inclusive, currency: cur(),
    business: {...S()},
    customer: {
      name:$("#cust-name").value.trim(), phone:$("#cust-phone").value.trim(),
      gstin:$("#cust-gstin").value.trim(), state:$("#cust-state").value || S().state
    },
    items: t.items.map(it=>({ title:it.p.title, sku:it.p.sku, hsn:it.p.hsn||"", qty:it.qty, price:it.p.selling, gst:it.g, taxable:it.taxable, tax:it.tax, gross:it.gross })),
    taxable:t.taxable, tax:t.tax, cgst:t.cgst, sgst:t.sgst, igst:t.igst, inter:t.inter, roundOff:t.roundOff, grand:t.grand, byRate:t.byRate
  };
  state.settings.invSeq += 1;
  state.invoices.push(inv);
  save();
  openInvoiceModal(inv);
  // reset bill
  cart = {}; $("#cust-name").value=""; $("#cust-phone").value=""; $("#cust-gstin").value="";
  renderPickGrid(); renderCart();
  toast("Invoice "+number+" generated");
}

function openInvoiceModal(inv){
  openModal(`
    <div class="modal wide">
      <div class="modal-head">
        <h3>Invoice ${escapeHtml(inv.number)}</h3>
        <select class="select" id="inv-tpl-switch" style="width:auto;margin-left:10px;">
          <option value="classic" ${inv.template==="classic"?"selected":""}>Classic</option>
          <option value="modern" ${inv.template==="modern"?"selected":""}>Modern</option>
          <option value="thermal" ${inv.template==="thermal"?"selected":""}>Thermal 80mm</option>
        </select>
        <button class="btn btn-ghost btn-sm close" data-close style="margin-left:auto;">✕</button>
      </div>
      <div class="modal-body" style="padding:0;">
        <div class="invoice-scroll" id="print-area">${renderInvoiceHTML(inv, inv.template)}</div>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>Close</button>
        <button class="btn btn-accent" id="inv-print">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>
          Print / Save PDF
        </button>
      </div>
    </div>`);
  $("#inv-tpl-switch").onchange = (e)=>{ $("#print-area").innerHTML = renderInvoiceHTML(inv, e.target.value); };
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
        <div class="inv-words">${amountWords(inv.grand)}</div>
        <div class="inv-qr">${invQR(inv)}</div>
        <hr class="dashed"/>
        <div class="center inv-muted">${escapeHtml(b.terms||"Thank you!")}</div>
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
  $("#s-state").innerHTML = opts;
  $("#cust-state").innerHTML = `<option value="">Same state</option>`+opts;
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
  $("#cust-state").value = "";
  // nav
  $$("#nav .nav-item").forEach(b=> b.onclick=()=>setView(b.dataset.view));
  $$("#mobile-nav button").forEach(b=> b.onclick=()=>setView(b.dataset.view));
  // billing
  $("#pick-search").oninput = (e)=>{ pickFilter.q=e.target.value; renderPickGrid(); };
  $("#prod-search").oninput = (e)=>{ prodQuery=e.target.value; renderProducts(); };
  $("#cust-state").onchange = renderCart;
  $("#cart-clear").onclick = ()=>{ cart={}; renderPickGrid(); renderCart(); };
  $("#btn-generate").onclick = generateInvoice;
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

  renderPickCats(); renderPickGrid(); renderCart(); renderTopbar();
  const views = ["billing","products","invoices","analytics","settings"];
  const deep = location.hash.replace("#","");
  setView(views.includes(deep) ? deep : "billing");
  window.addEventListener("hashchange", ()=>{ const h=location.hash.replace("#",""); if(views.includes(h)) setView(h); });
}
document.addEventListener("DOMContentLoaded", init);
