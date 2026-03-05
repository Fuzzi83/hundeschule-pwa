// admin-customers.js — Block 1/2
// Stand: 2026-02-24
// Ziele: Pixelgenauer Dialog (wie Screenshot), kein Abschneiden, persistenter Accordion-Zustand pro Kunde,
// Kundenliste mit Badges, Kartenpanel (Aktiv + Buchen + Historie), Rechnungen, Stempel-UI.

// ==== Core (globale Funktionen/Objekte aus deinen Core-Dateien) ====
import { esc, genId, toast, setv, gv } from "../../core/utils.js";
import {
  settings, customers, customersTrash,
  visits, visitsTrash, stays, staysTrash,
  saveAll, getCustomerById
} from "../../core/storage.js";
import { listPacksForStay, getPackById } from "../../core/hourpacks.js";

// ==== State ====
let editCustomerId = null;

// ==== Helpers ====
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function nowISO(){ return new Date().toISOString(); }
function byId(id){ return document.getElementById(id); }
function fmtEUR(n){ const x = Number(n||0); return x.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function euro(n){ const x = Number(n||0); return x.toLocaleString('de-DE', {style:'currency', currency:'EUR'}); }
function fmtDate(iso){ const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('de-DE'); }

// ===== CSS – einmalig injizieren (ohne overflow:hidden in Bodies!) =====
(function insertStylesOnce(){
  if (document.getElementById("adminCustomersStylesFixed")) return;
  const css = `
  :root{
    --bg:#fff; --muted:#666; --border:#dfdfdf; --head:#f4efe3; --soft:#faf7f0;
    --accent:#2b2b2b; --err:#b3261e; --warn:#ef6c00; --ok:#0a7f2e; --blue:#1565c0;
  }
  /* Dialog-Overlay + Container */
  #dlg_customer{ position:fixed; inset:0; display:none; z-index:9999; }
  #dlg_customer.show{ display:block; }
  #dlg_customer .backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.35); }
  #dlg_customer .dlg{
    position:absolute; top:28px; left:50%; transform:translateX(-50%);
    width:min(980px, calc(100vw - 40px)); max-height:calc(100vh - 56px);
    background:var(--bg); border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.25);
    padding:18px 20px 22px; overflow:visible; /* wichtig: nichts abschneiden */
  }
  #dlg_customer h3{ margin:0 0 12px; font-size:22px; font-weight:800; }

  /* Accordion – wie Screenshot */
  .acc{ border:1px solid var(--border); border-radius:12px; background:#fff; margin:12px 0; overflow:visible; }
  .acc-head{
    display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;
    padding:12px 14px; background:var(--head); border-bottom:1px solid var(--border); border-radius:12px;
  }
  .acc-title{ font-weight:800; color:#222; }
  .acc-sub{ color:#1f4d96; font-weight:600; margin-left:8px; }
  .acc-arrow{ color:#777; }
  .acc-body{ padding:14px; overflow:visible; }
  .acc-body.hidden{ display:none; } /* kein overflow:hidden */

  /* Grid-Form 100% Breite */
  .fg2, .fg3, .fg4{ display:grid; gap:10px 12px; }
  .fg2{ grid-template-columns: 1fr 1fr; }
  .fg3{ grid-template-columns: 1fr 1fr 1fr; }
  .fg4{ grid-template-columns: 1fr 1fr 1fr 1fr; }
  .fg2 label, .fg3 label, .fg4 label{ display:flex; flex-direction:column; gap:6px; }
  .fg2 input, .fg2 select, .fg2 textarea,
  .fg3 input, .fg3 select, .fg3 textarea,
  .fg4 input, .fg4 select, .fg4 textarea{
    width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid var(--border); border-radius:8px; background:#fff;
  }
  .muted{ color:var(--muted); }
  .btn{ display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:#fff; cursor:pointer; }
  .btn.primary{ background:#2b2b2b; color:#fff; border-color:#2b2b2b; }
  .btn.danger{ background:#fff0f0; color:#a30000; border-color:#ffc3c3; }

  /* Kundenliste */
  .cust-row{ cursor:pointer; border:1px solid var(--border); border-radius:12px; padding:12px; background:#fff; }
  .cust-row:hover{ background:#faf9f7; }
  .cust-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
  .cust-name{ font-weight:800; }
  .chip{ display:inline-block; padding:3px 8px; border-radius:999px; font-size:12px; line-height:1; border:1px solid transparent; }
  .chip-red{ background:#ffe9e7; color:#b50000; border-color:#ffc9c3; }
  .chip-blue{ background:#e6f0ff; color:#0d47a1; border-color:#c8ddff; }
  .chip-yellow{ background:#fff4d6; color:#8a6d00; border-color:#ffe3a1; }

  /* Kartenpanel (Stempel) */
  .card-panel{ background:#fff; border:1px solid var(--border); border-radius:10px; padding:12px; }
  .stamp-row{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin:8px 0; }
  .stamp{
    width:34px; height:34px; border-radius:50%; font-weight:700;
    display:flex; align-items:center; justify-content:center;
    border:2px solid #cfcfcf; color:#666; background:#fff; cursor:pointer; user-select:none;
    transition: transform .12s ease;
  }
  .stamp:hover{ transform:scale(1.12); }
  .stamp.used{ background:#ff9f3d; border-color:#ff9f3d; color:#fff; }
  .stamp-info{ margin-top:6px; color:#555; }

  /* Tabellen */
  table.clean{ width:100%; border-collapse:collapse; }
  table.clean th, table.clean td{ padding:8px 10px; border-bottom:1px solid #eee; text-align:left; }
  tr.open-row{ background:#fff7e9; } /* offene Rechnungen hell-orange */

  /* Signature */
  .sig-wrap{ display:flex; align-items:flex-end; gap:10px; }
  .sig-cv{ border:1px dashed #bbb; border-radius:8px; background:#fff; width:100%; height:160px; touch-action:none; }
  `;
  const style = document.createElement('style');
  style.id = "adminCustomersStylesFixed";
  style.textContent = css;
  document.head.appendChild(style);
})();

// ===== Accordion Persistenz (pro Kunde!) =====
function accKeyForCustomer(customerId){ return `cust_acc_state_${customerId}`; }
function loadAccState(customerId){
  try { const raw = localStorage.getItem(accKeyForCustomer(customerId)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveAccState(customerId, obj){
  try { localStorage.setItem(accKeyForCustomer(customerId), JSON.stringify(obj||{})); } catch {}
}
function defaultAccState(){ return { kunde:'open', hunde:'open', karten:'open', rechnungen:'closed' }; }
function applyAccSection(root, secKey, open){
  const blk = root.querySelector(`.acc[data-sec="${secKey}"]`);
  if(!blk) return;
  const head = blk.querySelector('.acc-head');
  const body = blk.querySelector('.acc-body');
  if(open){ body.classList.remove('hidden'); head.querySelector('.acc-arrow').textContent = '▾'; }
  else { body.classList.add('hidden'); head.querySelector('.acc-arrow').textContent = '▸'; }
}

// ===== Kundenliste ===========================================================
function renderCustomerList(containerId='custList'){
  const wrap = byId(containerId);
  if(!wrap) return;
  const q = (gv('cust_search') || '').toLowerCase();
  const list = customers.filter(c => {
    if(!q) return true;
    const nm = (c.name||'').toLowerCase();
    const dogNames = (c.dogs||[]).map(d => (d.name||'').toLowerCase());
    return nm.includes(q) || dogNames.some(x => x.includes(q));
  });

  wrap.innerHTML = list.map(c => {
    const dogs = (c.dogs||[]).map(d=>esc(d.name||'')).filter(Boolean).join(', ');
    const hasActive = (c.cards||[]).some(k => k.active);
    const openCardsInv = (c.cards||[]).some(k => k.method==='invoice' && !k.invoiceIssued);
    const openVisits = (visits||[]).some(v => v.customerId===c.id && v.method!=='ten' && v.payStatus!=='paid');
    const openStays  = (stays||[]).some(s => s.customerId===c.id && s.payStatus!=='paid');
    const hasOpen = openCardsInv || openVisits || openStays;
    const addr = c.address||{};
    const addrLine = [addr.street, addr.houseNo, addr.zip, addr.city].filter(Boolean).join(' ');

    return `
      <div class="cust-row" onclick="openCustomer('${c.id}')">
        <div class="cust-top">
          <div class="cust-name">${esc(c.name||'')}</div>
          <div class="badges">
            ${hasOpen ? `<span class="chip chip-red">offene Rechnung</span>` : ``}
            ${hasActive ? `<span class="chip chip-blue">10er frei</span>` : `<span class="chip chip-yellow">keine freie Karte</span>`}
          </div>
        </div>
        <div class="muted" style="margin-top:4px">
          Hunde: ${dogs || '–'} · St-Nr.: ${esc(c.taxId || c.vatId || '—')} ${addrLine ? ' · '+esc(addrLine) : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ===== SIGNATUR (vor openCustomerDlg deklariert!) ============================
function initSignaturePad(){
  const cv = byId('c_signature_canvas');
  if(!cv || cv._padInit) return;
  cv._padInit = true;

  const ctx = cv.getContext('2d');
  let drawing = false, last=null;
  const pos = e => {
    const r = cv.getBoundingClientRect();
    const t = e.touches && e.touches[0];
    return { x:(t?.clientX ?? e.clientX)-r.left, y:(t?.clientY ?? e.clientY)-r.top };
  };
  const start = e => {
    if (cv.style.pointerEvents==='none') return;
    e.preventDefault(); drawing=true; last=pos(e); ctx.beginPath(); ctx.moveTo(last.x,last.y);
  };
  const move = e => {
    if(!drawing) return;
    const p=pos(e); ctx.lineTo(p.x,p.y); ctx.lineWidth=2; ctx.lineCap='round'; ctx.strokeStyle='#111'; ctx.stroke();
  };
  const end = ()=>{ drawing=false; };
  cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  cv.addEventListener('touchstart', start, {passive:false}); cv.addEventListener('touchmove', move, {passive:false}); window.addEventListener('touchend', end);

  const clearBtn = byId('btn_sig_clear');
  if (clearBtn) clearBtn.addEventListener('click', ()=> { const w=cv.width,h=cv.height; const tmp=cv.cloneNode(); cv.replaceWith(tmp); tmp.id='c_signature_canvas'; tmp.className='sig-cv'; tmp.width=w; tmp.height=h; document.getElementById('sig_canvas_holder').appendChild(tmp); });
}
function requireAgbForSignature(){
  const cb = byId('c_terms_accept');
  const cv = byId('c_signature_canvas');
  if(!cv) return;
  if(cb && cb.checked){ cv.style.pointerEvents='auto'; cv.style.opacity='1'; }
  else { cv.style.pointerEvents='none'; cv.style.opacity='.6'; }
}

// ====== Packs – robust normalisieren ========================================
function normalizePacks(){
  // Versuch 1: onlyActive
  let packs = [];
  try { packs = listPacksForStay({onlyActive:true}) || []; } catch { packs = []; }
  if (!Array.isArray(packs) || packs.length===0){
    try { packs = listPacksForStay() || []; } catch { packs = []; }
  }
  // Mapping auf {id,name,fields,price}
  return (packs||[]).map(p => ({
    id: p.id,
    name: p.name || p.title || 'Paket',
    fields: Number(p.felder ?? p.fieldsTotal ?? p.fields ?? 10),
    price: Number(p.preis ?? p.price ?? 0)
  }));
}

// ====== Dialog HTML ==========================================================
function buildCustomerDialogHTML(c){
  const dogsSummary = (c.dogs||[]).map(d=>d.name).filter(Boolean).join(', ') || '';
  return `
    <div class="backdrop"></div>
    <div class="dlg">
      <h3>Kundendaten bearbeiten</h3>

      <!-- Kunde -->
      <div class="acc" data-sec="kunde">
        <div class="acc-head"><div class="acc-title">Kunde <span class="acc-sub" id="head_name">${esc(c.name||'')}</span></div><div class="acc-arrow">▾</div></div>
        <div class="acc-body">
          <div class="fg3">
            <label>Name <input id="c_name" type="text" value="${esc(c.name||'')}"></label>
            <label>MwSt.-Nr <input id="c_taxId" type="text" value="${esc(c.taxId || c.vatId || '')}"></label>
            <label>Telefon <input id="c_phone" type="text" value="${esc(c.phone||'')}"></label>
            <label>E-Mail <input id="c_email" type="email" value="${esc(c.email||'')}"></label>
            <label>Notfallkontakt <input id="c_emergency" type="text" value="${esc(c.emergencyContact||'')}"></label>
            <label>Tierarzt <input id="c_vet" type="text" value="${esc(c.vet||'')}"></label>
          </div>
          <div class="fg4" style="margin-top:6px">
            <label>Straße <input id="c_addr_street" type="text" value="${esc(c.address?.street||'')}"></label>
            <label>Nr <input id="c_addr_no" type="text" value="${esc(c.address?.houseNo||'')}"></label>
            <label>PLZ <input id="c_addr_zip" type="text" value="${esc(c.address?.zip||'')}"></label>
            <label>Ort <input id="c_addr_city" type="text" value="${esc(c.address?.city||'')}"></label>
          </div>

          <div class="fg2" style="margin-top:8px">
            <label><input id="c_terms_accept" type="checkbox" ${c.termsAccepted?'checked':''}> AGB akzeptiert</label>
            <div>
              ${settings?.agbUrl ? `<a class="btn" href="${esc(settings.agbUrl)}" target="_blank" rel="noopener">AGB öffnen</a>` : `<span class="muted">AGB-Link kann in settings.agbUrl hinterlegt werden</span>`}
            </div>
          </div>

          <div style="margin-top:8px">
            <div class="muted">Signatur</div>
            <div class="sig-wrap" id="sig_canvas_holder">
              <canvas id="c_signature_canvas" class="sig-cv" width="900" height="160"></canvas>
              <button class="btn" id="btn_sig_clear">Unterschrift löschen</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Hunde -->
      <div class="acc" data-sec="hunde">
        <div class="acc-head"><div class="acc-title">Hunde <span class="acc-sub" id="head_dogs">${esc(dogsSummary)}</span></div><div class="acc-arrow">▾</div></div>
        <div class="acc-body">
          <div id="c_dogs"></div>
          <button class="btn" id="btn_add_dog" style="margin-top:8px">Hund hinzufügen</button>
        </div>
      </div>

      <!-- Karten -->
      <div class="acc" data-sec="karten">
        <div class="acc-head"><div class="acc-title">Karten</div><div class="acc-arrow">▾</div></div>
        <div class="acc-body">
          <div id="cards_active"></div>

          <div class="card-panel" style="margin-top:12px">
            <div class="fg4">
              <label>Paket
                <select id="card_pack_sel"></select>
              </label>
              <label>Preis (€)
                <input id="card_price" type="text" placeholder="0,00">
              </label>
              <label>Zahlart
                <select id="card_method">
                  <option value="cash">Bar</option>
                  <option value="invoice">Rechnung</option>
                  <option value="other">Sonstiges</option>
                </select>
              </label>
              <label id="card_invoice_wrap" style="display:none">
                Rechnung ausgestellt?
                <select id="card_invoice_issued">
                  <option value="no">Nein</option>
                  <option value="yes">Ja</option>
                </select>
              </label>
            </div>
            <button class="btn primary" id="btn_buy_card" style="margin-top:8px">Karte buchen</button>
            <div id="buy_ok" style="display:none; color:#0a7f2e; font-weight:700; margin-top:6px">✔ Karte erfolgreich gebucht!</div>
          </div>

          <div style="margin-top:12px">
            <div class="muted" style="font-weight:700; margin-bottom:6px">Historie</div>
            <div id="cards_history"></div>
          </div>
        </div>
      </div>

      <!-- Rechnungen -->
      <div class="acc" data-sec="rechnungen">
        <div class="acc-head"><div class="acc-title">Rechnungen</div><div class="acc-arrow">▾</div></div>
        <div class="acc-body">
          <div id="inv_list"></div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; gap:8px; margin-top:10px">
        <button class="btn danger" id="btn_delete">Löschen</button>
        <div style="display:flex; gap:8px">
          <button class="btn" id="btn_cancel">Abbrechen</button>
          <button class="btn primary" id="btn_save">Speichern</button>
        </div>
      </div>
    </div>
  `;
}

// ==== Hunde-Editor (mit Ja/Nein Feldern wie in deiner älteren Fassung) ====
function addDogRow(d){
  const wrap = byId('c_dogs');
  const id = d?.id || genId();
  const card = document.createElement('div');
  card.className = 'card-panel';
  card.dataset.dogId = id;
  card.innerHTML = `
    <div class="fg4">
      <label>Name <input name="dog_name" value="${esc(d?.name||'')}"></label>
      <label>Rasse <input name="dog_breed" value="${esc(d?.breed||'')}"></label>
      <label>Geschlecht
        <select name="dog_sex">
          <option value="m"${d?.sex==='m'?' selected':''}>männlich</option>
          <option value="w"${d?.sex==='w'?' selected':''}>weiblich</option>
        </select>
      </label>
      <label>Alter <input name="dog_age" value="${esc(d?.age||'')}"></label>

      <label>Chip-ID <input name="dog_chip" value="${esc(d?.chipId||'')}"></label>
      <label>Kastriert?
        <select name="dog_neutered">
          <option value="no"${!d?.neutered?' selected':''}>nein</option>
          <option value="yes"${d?.neutered?' selected':''}>ja</option>
        </select>
      </label>
      <label>Sozial?
        <select name="dog_social">
          <option value="no"${!d?.social?' selected':''}>nein</option>
          <option value="yes"${d?.social?' selected':''}>ja</option>
        </select>
      </label>
      <label>Futter verteidigt?
        <select name="dog_foodGuarding">
          <option value="no"${!d?.foodGuarding?' selected':''}>nein</option>
          <option value="yes"${d?.foodGuarding?' selected':''}>ja</option>
        </select>
      </label>

      <label>Angst (Gewitter/Feuerwerk)?
        <select name="dog_fear">
          <option value="no"${!d?.fearStormFireworks?' selected':''}>nein</option>
          <option value="yes"${d?.fearStormFireworks?' selected':''}>ja</option>
        </select>
      </label>
      <label>Fütterung <textarea name="dog_feedNotes">${esc(d?.feedingNotes||'')}</textarea></label>
      <label>Leckerlies?
        <select name="dog_treats">
          <option value="no"${!d?.treatsAllowed?' selected':''}>nein</option>
          <option value="yes"${d?.treatsAllowed?' selected':''}>ja</option>
        </select>
      </label>
      <label>Allergien <textarea name="dog_allergies">${esc(d?.allergiesMedsNotes||'')}</textarea></label>
    </div>
    <div style="text-align:right; margin-top:6px">
      <button class="btn danger" onclick="this.closest('.card-panel').remove()">Entfernen</button>
    </div>
  `;
  wrap.appendChild(card);
}

// ==== Stempel-Renderer (shared) =============================================
function renderStamps(card, container, cust){
  const row = document.createElement('div');
  row.className = 'stamp-row';
  for(let i=0;i<card.fieldsTotal;i++){
    const used = i < (card.fieldsUsed||0);
    const el = document.createElement('div');
    el.className = 'stamp ' + (used?'used':'');
    el.textContent = used ? '✓' : String(i+1);
    el.addEventListener('click', ()=>{
      if (i < card.fieldsUsed) card.fieldsUsed = i; else card.fieldsUsed = i+1;
      if (card.fieldsUsed >= card.fieldsTotal){ card.fieldsUsed = card.fieldsTotal; card.active = false; }
      saveAll(); renderCards(cust); renderCustomerList();
    });
    row.appendChild(el);
  }
  const info = document.createElement('div');
  info.className = 'stamp-info';
  info.textContent = `Genutzt ${card.fieldsUsed||0}/${card.fieldsTotal||0} · Rest ${Math.max(0,(card.fieldsTotal||0)-(card.fieldsUsed||0))}`;
  container.innerHTML = '';
  container.appendChild(row);
  container.appendChild(info);
}
``
// admin-customers.js — Block 2/2

// ==== Karten rendern / Historie =============================================
function renderCards(cust){
  const activeHost = byId('cards_active');
  const histHost = byId('cards_history');
  if(!activeHost || !histHost) return;

  const active = (cust.cards||[]).filter(k=>k.active);
  const hist   = (cust.cards||[]).filter(k=>!k.active).sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  // Aktive
  activeHost.innerHTML = '';
  if(active.length===0){
    activeHost.innerHTML = `<div class="muted">Keine aktive Karte.</div>`;
  }else{
    active.forEach(card=>{
      const box = document.createElement('div');
      box.className = 'card-panel';
      const methodLabel = card.method==='cash' ? 'Bar' : (card.method==='invoice' ? 'Rechnung' : 'Sonstiges');
      const inv = (card.method==='invoice') ? (card.invoiceIssued ? ' · Rechnung ausgestellt' : ' · Rechnung offen') : '';
      box.innerHTML = `
        <div style="font-weight:800; margin-bottom:6px">Aktive ${esc(card.packName||'Karte')}</div>
        <div class="stamps"></div>
        <div class="stamp-info">Preis: ${euro(card.pricePaid||0)} · Methode: ${methodLabel}${inv}</div>
      `;
      activeHost.appendChild(box);
      renderStamps(card, box.querySelector('.stamps'), cust);
    });
  }

  // Historie
  histHost.innerHTML = '';
  if(hist.length===0){
    histHost.innerHTML = `<div class="muted">Keine verbrauchten Karten.</div>`;
  }else{
    const tbl = document.createElement('table');
    tbl.className = 'clean';
    const rows = hist.map(k => `
      <tr>
        <td>${fmtDate(k.date)}</td>
        <td>${esc(k.packName||'')}</td>
        <td>${k.fieldsUsed||0}/${k.fieldsTotal||0}</td>
        <td>${euro(k.pricePaid||0)}</td>
        <td>${k.method==='invoice' ? (k.invoiceIssued?'Rechnung ausgestellt':'Rechnung offen') : (k.method==='cash'?'Bar':'Sonstiges')}</td>
        <td><button class="btn danger" data-del="${k.id}">Löschen</button></td>
      </tr>
    `).join('');
    tbl.innerHTML = `<thead><tr><th>Datum</th><th>Karte</th><th>Verbrauch</th><th>Preis</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody>`;
    histHost.appendChild(tbl);
    tbl.querySelectorAll('button[data-del]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(!confirm('Diese Karte wirklich löschen?')) return;
        const idx = (cust.cards||[]).findIndex(x=>x.id===btn.dataset.del);
        if(idx>=0){ cust.cards.splice(idx,1); saveAll(); renderCards(cust); renderCustomerList(); }
      });
    });
  }
}
window.renderCards = renderCards; // optionaler Export für Altstellen

// ==== Karten kaufen ==========================================================
function buyHourPack(){
  if(!editCustomerId){ toast('Bitte zuerst den Kunden speichern.'); return; }
  const cust = getCustomerById(editCustomerId); if(!cust) return;
  const sel = byId('card_pack_sel'); const priceEl = byId('card_price');
  const methodSel = byId('card_method'); const invSel = byId('card_invoice_issued');
  const packId = sel?.value || '';
  const pack = getPackById ? getPackById(packId) : null;

  if(!pack){ toast('Bitte Paket wählen.'); return; }

  // Variante A: maximal 1 aktive Karte pro packId
  if((cust.cards||[]).some(k=>k.active && k.packId===pack.id)){
    toast('Diese Karte ist noch aktiv. Bitte zuerst aufbrauchen.'); return;
  }

  const price = Number(String(priceEl.value||'0').replace(',', '.'))||0;
  const method = methodSel.value;
  const invoiceIssued = (method==='invoice') ? ((invSel?.value||'no')==='yes') : false;
  const totalFields = Number(pack.felder ?? pack.fieldsTotal ?? pack.fields ?? 10);

  const card = {
    id: genId(),
    packId: pack.id,
    packName: pack.name || pack.title || 'Karte',
    fieldsTotal: totalFields,
    fieldsUsed: 0,
    pricePaid: price,
    method, invoiceIssued,
    date: nowISO(),
    active: true
  };
  cust.cards = cust.cards || [];
  cust.cards.push(card);
  saveAll(); renderCards(cust); renderCustomerList();
  const ok = byId('buy_ok'); if(ok) { ok.style.display='block'; setTimeout(()=>ok.style.display='none', 2200); }
}
window.buyHourPack = buyHourPack;

// ==== Rechnungen (visits + stays + Karten „invoice“) =========================
function renderInvoices(cust){
  const host = byId('inv_list'); if(!host) return;
  const rowsOpen = [], rowsPaid = [];

  // visits
  (visits||[]).forEach(v=>{
    if(v.customerId!==cust.id) return;
    const isOpen = (v.method!=='ten' && v.payStatus!=='paid');
    const row = {src:'visit', id:v.id, date:v.date, label:v.title||'Tag', amount:Number(v.price||v.amount||0), status:isOpen?'offen':'bezahlt'};
    (isOpen?rowsOpen:rowsPaid).push(row);
  });

  // stays
  (stays||[]).forEach(s=>{
    if(s.customerId!==cust.id) return;
    const isOpen = (s.payStatus!=='paid');
    const row = {src:'stay', id:s.id, date:(s.date||s.startDate||s.createdAt), label:s.title||'Pension', amount:Number(s.total||s.price||0), status:isOpen?'offen':'bezahlt'};
    (isOpen?rowsOpen:rowsPaid).push(row);
  });

  // Karten mit method=invoice → Anzeige/Verbuchen/Löschen
  (cust.cards||[]).forEach(k=>{
    if(k.method==='invoice'){
      const isOpen = !k.invoiceIssued;
      const row = {src:'card', id:k.id, date:k.date, label:`Karte: ${k.packName}`, amount:Number(k.pricePaid||0), status:isOpen?'offen':'ausgestellt'};
      (isOpen?rowsOpen:rowsPaid).push(row);
    }
  });

  const tbl = (title, arr, isOpen)=>`
    <div class="card-panel" style="margin-top:8px">
      <div style="font-weight:800; margin-bottom:6px">${title}</div>
      <table class="clean">
        <thead><tr><th>Datum</th><th>Eintrag</th><th>Preis</th><th>Status</th><th>Aktionen</th></tr></thead>
        <tbody>
          ${arr.map(r=>`
            <tr class="${isOpen?'open-row':''}">
              <td>${fmtDate(r.date)}</td>
              <td>${esc(r.label)}</td>
              <td>${euro(r.amount)}</td>
              <td>${r.status}</td>
              <td>
                ${isOpen?`<button class="btn" data-pay="${r.src}:${r.id}">bezahlt</button>`:''}
                <button class="btn" data-edit="${r.src}:${r.id}">Bearb.</button>
                <button class="btn danger" data-del="${r.src}:${r.id}">Löschen</button>
              </td>
            </tr>
          `).join('')}
          ${arr.length?'' : `<tr><td colspan="5" class="muted">Keine Einträge.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  host.innerHTML = `${tbl('Offene Einträge', rowsOpen, true)}${rowsPaid.length?tbl('Abgeschlossen', rowsPaid, false):''}`;

  host.querySelectorAll('button[data-pay]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const [src,id]=b.dataset.pay.split(':');
      if(src==='visit'){ const v=(visits||[]).find(x=>x.id===id); if(v) v.payStatus='paid'; }
      else if(src==='stay'){ const s=(stays||[]).find(x=>x.id===id); if(s) s.payStatus='paid'; }
      else if(src==='card'){ const k=(cust.cards||[]).find(x=>x.id===id); if(k) k.invoiceIssued=true; }
      saveAll(); renderInvoices(cust); renderCustomerList();
    });
  });
  host.querySelectorAll('button[data-del]').forEach(b=>{
    b.addEventListener('click', ()=>{
      if(!confirm('Eintrag wirklich löschen?')) return;
      const [src,id]=b.dataset.del.split(':');
      if(src==='visit'){
        const i=(visits||[]).findIndex(x=>x.id===id); if(i>=0){ const v=visits[i]; visits.splice(i,1); (visitsTrash||[]).unshift({...v, deletedAt:nowISO()}); }
      }else if(src==='stay'){
        const i=(stays||[]).findIndex(x=>x.id===id); if(i>=0){ const s=stays[i]; stays.splice(i,1); (staysTrash||[]).unshift({...s, deletedAt:nowISO()}); }
      }else if(src==='card'){
        const i=(cust.cards||[]).findIndex(x=>x.id===id); if(i>=0) cust.cards.splice(i,1);
      }
      saveAll(); renderInvoices(cust); renderCustomerList();
    });
  });
  host.querySelectorAll('button[data-edit]').forEach(b=>{
    b.addEventListener('click', ()=> toast('Bearbeiten (Stub)'));
  });
}

// ==== Dialog Öffnen/Schließen ===============================================
function openCustomer(id){
  const c = getCustomerById(id);
  if(!c){ toast('Kunde nicht gefunden.'); return; }
  editCustomerId = id;

  // Overlay host
  let host = byId('dlg_customer');
  if(!host){
    host = document.createElement('div');
    host.id = 'dlg_customer';
    document.body.appendChild(host);
  }
  host.className = 'show';
  host.innerHTML = buildCustomerDialogHTML(c);

  // Accordion Persistenz pro Kunde
  const state = loadAccState(c.id) || defaultAccState();
  ['kunde','hunde','karten','rechnungen'].forEach(sec => applyAccSection(host, sec, (state[sec]||'open')==='open'));
  $$('.acc-head', host).forEach(head=>{
    head.addEventListener('click', ()=>{
      const blk = head.closest('.acc'); const key = blk.dataset.sec;
      const body = blk.querySelector('.acc-body'); const arr = head.querySelector('.acc-arrow');
      const hidden = body.classList.toggle('hidden'); arr.textContent = hidden ? '▸' : '▾';
      const s = loadAccState(c.id) || defaultAccState(); s[key] = hidden ? 'closed' : 'open'; saveAccState(c.id, s);
    });
  });

  // Hunde init
  const dogsWrap = byId('c_dogs'); dogsWrap.innerHTML = '';
  (c.dogs||[]).forEach(d => addDogRow(d));
  byId('btn_add_dog').addEventListener('click', ()=> addDogRow(null));
  byId('c_name').addEventListener('input', ()=> { const el=byId('head_name'); if(el) el.textContent = byId('c_name').value||''; });
  const syncDogsHeader = ()=>{ const cc=getCustomerById(editCustomerId); byId('head_dogs').textContent=(cc.dogs||[]).map(d=>d.name).filter(Boolean).join(', '); };
  $('#c_dogs').addEventListener('input', (e)=>{ if(e.target.name==='dog_name'){ const c0=getCustomerById(editCustomerId); const rows=$$('#c_dogs .card-panel'); c0.dogs = rows.map(div=>{
    const val=n=>div.querySelector(`[name="${n}"]`)?.value?.trim()||'';
    const yes=n=>(div.querySelector(`[name="${n}"]`)?.value||'no')==='yes';
    return { id:div.dataset.dogId, name:val('dog_name'), breed:val('dog_breed'), sex:val('dog_sex'), age:val('dog_age'),
      chipId:val('dog_chip'), neutered:yes('dog_neutered'), social:yes('dog_social'), foodGuarding:yes('dog_foodGuarding'),
      fearStormFireworks:yes('dog_fear'), feedingNotes:val('dog_feedNotes'), treatsAllowed:yes('dog_treats'), allergiesMedsNotes:val('dog_allergies') };
  }); saveAll(); syncDogsHeader(); } });

  // Signatur + AGB
  initSignaturePad();
  requireAgbForSignature();
  byId('c_terms_accept').addEventListener('change', requireAgbForSignature);

  // Packs
  const packs = normalizePacks(); // robustes Mapping
  const packSel = byId('card_pack_sel');
  packSel.innerHTML = packs.map(p => `<option value="${p.id}" data-price="${p.price}">${esc(p.name)} (${p.fields}×)</option>`).join('');
  const priceEl = byId('card_price');
  const applyPrice = () => { const o=packSel.selectedOptions[0]; priceEl.value = (o?Number(o.dataset.price||0):0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  packSel.addEventListener('change', applyPrice); applyPrice();

  const methodSel = byId('card_method'); const invWrap = byId('card_invoice_wrap');
  const syncInv = ()=>{ invWrap.style.display = (methodSel.value==='invoice') ? '' : 'none'; };
  methodSel.addEventListener('change', syncInv); syncInv();

  byId('btn_buy_card').addEventListener('click', buyHourPack);

  // Render Karten/Rechnungen
  renderCards(c);
  renderInvoices(c);

  // Buttons unten
  byId('btn_cancel').addEventListener('click', closeCustomerDlg);
  byId('btn_delete').addEventListener('click', deleteCustomer);
  byId('btn_save').addEventListener('click', saveCustomer);
}

function openNewCustomer(){
  const c = {
    id: genId(),
    name:'', taxId:'', vatId:'', phone:'', email:'',
    address:{street:'', houseNo:'', zip:'', city:''},
    emergencyContact:'', vet:'', dogs:[], cards:[],
    termsAccepted:false, signature:''
  };
  customers.push(c); saveAll();
  openCustomer(c.id);
}

function closeCustomerDlg(){
  const host = byId('dlg_customer'); if(host){ host.classList.remove('show'); host.innerHTML=''; }
  renderCustomerList();
}

// ==== Speichern/Löschen ======================================================
function saveCustomer(){
  if(!editCustomerId) return;
  const c = getCustomerById(editCustomerId); if(!c) return;
  c.name = (gv('c_name')||'').trim();
  const tax = (gv('c_taxId')||'').trim(); c.taxId = tax; c.vatId = tax; // beides setzen
  c.phone = gv('c_phone')||''; c.email = gv('c_email')||'';
  c.emergencyContact = gv('c_emergency')||''; c.vet = gv('c_vet')||'';
  c.address = { street:gv('c_addr_street')||'', houseNo:gv('c_addr_no')||'', zip:gv('c_addr_zip')||'', city:gv('c_addr_city')||'' };
  c.termsAccepted = !!byId('c_terms_accept').checked;

  // Signatur (wenn nicht leer)
  const cv = byId('c_signature_canvas');
  if(cv && cv.toDataURL){
    try{
      const blank = document.createElement('canvas'); blank.width=cv.width; blank.height=cv.height;
      if(cv.toDataURL() !== blank.toDataURL()){ c.signature = cv.toDataURL('image/png'); }
    }catch{}
  }
  saveAll(); toast('Kunde gespeichert.');
  const hn = byId('head_name'); if(hn) hn.textContent = c.name||'';
}

function deleteCustomer(){
  if(!editCustomerId) return;
  const c = getCustomerById(editCustomerId); if(!c) return;
  if(!confirm('Kunden wirklich löschen?')) return;
  const ts = nowISO();
  customersTrash.push({...c, deletedAt:ts});
  const idx = customers.findIndex(x=>x.id===c.id); if(idx>=0) customers.splice(idx,1);
  for(let i=visits.length-1;i>=0;i--){ if(visits[i].customerId===c.id){ visitsTrash.push({...visits[i], deletedAt:ts}); visits.splice(i,1); } }
  for(let i=stays.length-1;i>=0;i--){ if(stays[i].customerId===c.id){ staysTrash.push({...stays[i], deletedAt:ts}); stays.splice(i,1); } }
  saveAll(); closeCustomerDlg();
}

// ==== Checkout-Stempel (extern) ==============================================
function renderCheckoutStamps(containerId, customer){
  const cont = typeof containerId==='string' ? byId(containerId) : containerId;
  if(!cont || !customer) return;
  const active = (customer.cards||[]).filter(k=>k.active);
  if(active.length===0){ cont.insertAdjacentHTML('beforeend', `<div class="muted">Keine aktive Karte gefunden.</div>`); return; }
  active.forEach(card=>{
    const box = document.createElement('div'); box.className = 'card-panel'; box.style.marginTop='8px';
    box.innerHTML = `<div style="font-weight:700; margin-bottom:4px">Stempelkarten</div><div class="stamps"></div>`;
    cont.appendChild(box);
    renderStamps(card, box.querySelector('.stamps'), customer);
  });
}

// ==== Kundenliste initial (falls nötig extern aufrufen) ======================
window.renderCustomerList = renderCustomerList;

// ==== Exports am window (wie gefordert) ======================================
window.openCustomer           = openCustomer;
window.openNewCustomer        = openNewCustomer;
window.closeCustomerDlg       = closeCustomerDlg;
window.saveCustomer           = saveCustomer;
window.deleteCustomer         = deleteCustomer;
window.addDogRow              = addDogRow;
window.initSignaturePad       = initSignaturePad;
window.requireAgbForSignature = requireAgbForSignature;
window.buyHourPack            = buyHourPack;
window.renderCheckoutStamps   = renderCheckoutStamps;