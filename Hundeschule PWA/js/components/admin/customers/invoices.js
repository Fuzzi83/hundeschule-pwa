// /js/components/admin/customers/invoices.js
"use strict";

import { esc, toast } from "../../../core/utils.js";
import { visits, visitsTrash, stays, staysTrash, saveAll } from "../../../core/storage.js";
import { renderCustomerList } from "./list.js";

function byId(id){ return document.getElementById(id); }
function nowISO(){ return new Date().toISOString(); }
function fmtDate(iso){
  if(!iso) return "–";
  const d = new Date(iso);
  return isNaN(d) ? "–" : d.toLocaleDateString("de-DE");
}
function fmtEUR(n){
  return Number(n||0).toLocaleString("de-DE",{style:"currency",currency:"EUR"});
}
function parseEuro(s){
  const t = String(s||"").trim().replace(/\./g,"").replace(",",".");
  const n = Number(t);
  return isNaN(n) ? 0 : n;
}

function methodLabel(m){
  if(m==="cash") return "Bar";
  if(m==="invoice") return "Rechnung";
  if(m==="other") return "Sonstiges";
  if(m==="ten") return "10er";
  return m || "–";
}

function isActiveCard(card){
  return card.active === true &&
    (Number(card.fieldsTotal||0) - Number(card.fieldsUsed||0)) > 0;
}

function normalizeRows(cust){
  const open = [];
  const closed = [];

  (visits||[]).forEach(v=>{
    if(v.customerId !== cust.id) return;
    const payStatus = v.payStatus || (v.method==="ten" ? "paid" : "open");
    openOrClosed(payStatus, open, closed).push({
      src:"visit", id:v.id,
      date:v.date,
      label:v.title || "Tag",
      method:v.method || "cash",
      invoiceIssued: !!v.invoiceIssued,
      payStatus,
      amount:Number(v.price ?? v.amount ?? 0),
      ref:v
    });
  });

  (stays||[]).forEach(s=>{
    if(s.customerId !== cust.id) return;
    const payStatus = s.payStatus || "open";
    openOrClosed(payStatus, open, closed).push({
      src:"stay", id:s.id,
      date:(s.date || s.startDate || s.createdAt),
      label:s.title || "Pension",
      method:s.method || "invoice",
      invoiceIssued: !!s.invoiceIssued,
      payStatus,
      amount:Number(s.total ?? s.price ?? 0),
      ref:s
    });
  });

  (cust.cards||[]).forEach(k=>{
    const payStatus = k.payStatus || (k.method==="cash" ? "paid" : "open");
    // ✅ ohne "Karte:" prefix
    openOrClosed(payStatus, open, closed).push({
      src:"card", id:k.id,
      date:k.date,
      label:`${k.packName || "Karte"}`,
      method:k.method || "invoice",
      invoiceIssued: !!k.invoiceIssued,
      payStatus,
      amount:Number(k.pricePaid ?? 0),
      ref:k
    });
  });

  const sortFn = (a,b)=> String(b.date||"").localeCompare(String(a.date||""));
  open.sort(sortFn); closed.sort(sortFn);
  return { open, closed };
}

function openOrClosed(payStatus, open, closed){
  return (payStatus !== "paid") ? open : closed;
}

function updateHeaderHint(cust){
  const { open } = normalizeRows(cust);
  const el = byId("head_invoices");
  if(!el) return;
  if(open.length>0){
    el.className = "chip chip-red";
    el.textContent = "offene Positionen";
  }else{
    el.className = "";
    el.textContent = "";
  }
}

function sectionHtml(custId, title, key, arr){
  const lsKey = `cust_inv_${custId}_${key}`;
  let isOpen = true;
  try{
    const v = localStorage.getItem(lsKey);
    isOpen = v===null ? true : v==="1";
  }catch{}

  return `
    <div class="card-panel" style="margin-top:10px; padding:10px 12px">
      <div data-sec="${key}"
           style="display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;user-select:none">
        <div style="font-weight:800; display:flex; gap:8px; align-items:center">
          <span data-arr="${key}" style="font-weight:900">${isOpen?"▾":"▸"}</span>
          <span>${title}</span>
        </div>
        <div class="muted" style="font-size:12px">${arr.length}</div>
      </div>

      <div data-body="${key}" class="${isOpen?"":"hidden"}" style="margin-top:8px">
        ${arr.length ? arr.map(r=>rowHtml(r, key==="closed")).join("") : `<div class="muted">Keine Einträge.</div>`}
      </div>
    </div>
  `;
}

function rowHtml(r, allowDelete){
  const method = methodLabel(r.method);
  const showIssued = (r.method !== "other");
  const issued = showIssued ? (r.invoiceIssued ? "Ja" : "Nein") : "–";

  return `
    <div class="card-panel" data-edit="${r.src}:${r.id}" style="padding:8px 10px; margin-top:6px; cursor:pointer">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start">
        <div style="min-width:0">
          <div style="font-weight:700; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
            ${esc(r.label)}
          </div>
          <div class="muted" style="font-size:12px; margin-top:2px">
            ${fmtDate(r.date)} · ${esc(method)}
            ${showIssued ? ` · Rechnung: ${issued}` : ``}
          </div>
        </div>

        <div style="display:flex; gap:8px; align-items:center">
          <div style="font-weight:800; font-size:13px; white-space:nowrap">${fmtEUR(r.amount)}</div>
          ${allowDelete ? `
            <button type="button" data-del="${r.src}:${r.id}" title="Löschen"
                    style="padding:5px 7px; border-radius:8px; border:1px solid #e3e3e3; background:#fff; cursor:pointer">
              🗑️
            </button>
          ` : ``}
        </div>
      </div>
    </div>
  `;
}

function getObj(cust, src, id){
  if(src==="card") return (cust.cards||[]).find(x=>x.id===id) || null;
  if(src==="visit") return (visits||[]).find(x=>x.id===id) || null;
  if(src==="stay") return (stays||[]).find(x=>x.id===id) || null;
  return null;
}

function setAmount(obj, src, amount){
  if(src==="card") obj.pricePaid = amount;
  else if(src==="visit"){
    if(obj.price !== undefined) obj.price = amount;
    else obj.amount = amount;
  }else if(src==="stay"){
    if(obj.total !== undefined) obj.total = amount;
    else obj.price = amount;
  }
}

function getAmount(obj, src){
  if(src==="card") return Number(obj.pricePaid ?? 0);
  if(src==="visit") return Number(obj.price ?? obj.amount ?? 0);
  if(src==="stay") return Number(obj.total ?? obj.price ?? 0);
  return 0;
}

function removeObj(cust, src, id){
  if(src==="card"){
    const card = (cust.cards||[]).find(x=>x.id===id);
    if(card && isActiveCard(card)){
      toast("Aktive Karte kann nicht gelöscht werden.");
      return false;
    }
    const i=(cust.cards||[]).findIndex(x=>x.id===id);
    if(i>=0) cust.cards.splice(i,1);
    return true;
  }
  if(src==="visit"){
    const i=(visits||[]).findIndex(x=>x.id===id);
    if(i>=0){
      const v=visits[i];
      visits.splice(i,1);
      (visitsTrash||[]).unshift({...v, deletedAt: nowISO()});
      return true;
    }
  }
  if(src==="stay"){
    const i=(stays||[]).findIndex(x=>x.id===id);
    if(i>=0){
      const s=stays[i];
      stays.splice(i,1);
      (staysTrash||[]).unshift({...s, deletedAt: nowISO()});
      return true;
    }
  }
  return false;
}

function openEditDialog(cust, row){
  let host = document.getElementById("inv_edit_dlg");
  if(!host){
    host = document.createElement("div");
    host.id = "inv_edit_dlg";
    document.body.appendChild(host);
  }

  const obj = getObj(cust, row.src, row.id);
  if(!obj){ toast("Eintrag nicht gefunden."); return; }

  const method = obj.method || row.method || "invoice";
  const payStatus = obj.payStatus || row.payStatus || "open";
  const invoiceIssued = !!obj.invoiceIssued;
  const amount = getAmount(obj, row.src);

  host.className = "show";
  host.innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.25); z-index:220000" id="inv_backdrop"></div>
    <div style="
      position:fixed; left:50%; top:50%; transform:translate(-50%,-50%);
      width:min(92vw,520px);
      background:#fff; border-radius:16px; padding:14px; z-index:220001;
      box-shadow:0 10px 30px rgba(0,0,0,.2)
    ">
      <div style="font-weight:900; margin-bottom:6px">${esc(row.label)}</div>
      <div class="muted" style="font-size:12px; margin-bottom:12px">${fmtDate(row.date)}</div>

      <div style="display:grid; gap:10px">
        <label>Betrag (€)
          <input id="inv_amount" type="text"
                 value="${String(amount).toLocaleString("de-DE",{minimumFractionDigits:2, maximumFractionDigits:2})}">
        </label>

        <label>Status
          <select id="inv_status">
            <option value="open" ${payStatus!=="paid"?"selected":""}>offen</option>
            <option value="paid" ${payStatus==="paid"?"selected":""}>bezahlt</option>
          </select>
        </label>

        <label>Zahlart
          <select id="inv_method">
            <option value="cash" ${method==="cash"?"selected":""}>Bar</option>
            <option value="invoice" ${method==="invoice"?"selected":""}>Rechnung</option>
            <option value="other" ${method==="other"?"selected":""}>Sonstiges</option>
          </select>
        </label>

        <label id="inv_issued_wrap">Rechnung ausgestellt?
          <select id="inv_issued">
            <option value="no" ${!invoiceIssued?"selected":""}>Nein</option>
            <option value="yes" ${invoiceIssued?"selected":""}>Ja</option>
          </select>
        </label>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px">
        <button class="btn" type="button" id="inv_cancel">Abbrechen</button>
        <button class="btn primary" type="button" id="inv_save">Speichern</button>
      </div>
    </div>
  `;

  const close = ()=>{
    host.className = "";
    host.innerHTML = "";
  };

  const methodSel = host.querySelector("#inv_method");
  const wrap = host.querySelector("#inv_issued_wrap");
  const issuedSel = host.querySelector("#inv_issued");

  const applyIssuedVisibility = ()=>{
    const m = methodSel?.value || "invoice";
    if(m === "other"){
      if(wrap) wrap.style.display = "none";
      if(issuedSel) issuedSel.value = "no";
    }else{
      if(wrap) wrap.style.display = "";
    }
  };
  methodSel?.addEventListener("change", applyIssuedVisibility);
  applyIssuedVisibility();

  host.querySelector("#inv_backdrop")?.addEventListener("click", close);
  host.querySelector("#inv_cancel")?.addEventListener("click", close);

  host.querySelector("#inv_save")?.addEventListener("click", ()=>{
    const st = host.querySelector("#inv_status")?.value || "open";
    const me = methodSel?.value || "invoice";
    const iss = (me === "other") ? false : ((issuedSel?.value || "no") === "yes");
    const amt = parseEuro(host.querySelector("#inv_amount")?.value || "0");

    obj.payStatus = st;
    obj.method = me;
    obj.invoiceIssued = iss;
    setAmount(obj, row.src, amt);

    saveAll();
    renderInvoices(cust);
    renderCustomerList();
    toast("Gespeichert");
    close();
  });

  host.querySelector("#inv_backdrop")?.addEventListener("click", close);
}

export function renderInvoices(cust){
  const host = byId("inv_list");
  if(!host) return;

  const { open, closed } = normalizeRows(cust);
  updateHeaderHint(cust);

  host.innerHTML = `
    ${sectionHtml(cust.id, "Offen", "open", open)}
    ${sectionHtml(cust.id, "Abgeschlossen", "closed", closed)}
  `;

  // section toggle
  host.querySelectorAll("[data-sec]").forEach(h=>{
    h.addEventListener("click", ()=>{
      const key = h.getAttribute("data-sec");
      const body = host.querySelector(`[data-body="${key}"]`);
      const arr = host.querySelector(`[data-arr="${key}"]`);
      if(!body || !arr) return;
      const hidden = body.classList.toggle("hidden");
      arr.textContent = hidden ? "▸" : "▾";
      try{ localStorage.setItem(`cust_inv_${cust.id}_${key}`, hidden ? "0" : "1"); }catch{}
    });
  });

  // delete (only closed)
  host.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      if(!confirm("Eintrag wirklich löschen?")) return;
      const [src,id] = btn.getAttribute("data-del").split(":");
      const ok = removeObj(cust, src, id);
      if(ok){
        saveAll();
        renderInvoices(cust);
        renderCustomerList();
        toast("Gelöscht");
      }
    });
  });

  // row click -> edit dialog
  host.querySelectorAll("[data-edit]").forEach(rowEl=>{
    rowEl.addEventListener("click", ()=>{
      const [src,id] = rowEl.getAttribute("data-edit").split(":");
      const obj = getObj(cust, src, id);
      if(!obj) return;

      const row = {
        src, id,
        date: obj.date || obj.startDate || obj.createdAt,
        label: (src==="card")
          ? `${obj.packName || "Karte"}`
          : (obj.title || "Eintrag"),
        method: obj.method || "invoice",
        invoiceIssued: !!obj.invoiceIssued,
        payStatus: obj.payStatus || "open",
        amount: getAmount(obj, src),
      };

      openEditDialog(cust, row);
    });
  });
}