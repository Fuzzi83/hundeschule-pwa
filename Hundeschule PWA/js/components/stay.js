// /js/components/stay.js
"use strict";

import {
  todayStr, nowTime, esc, genId, setv, gv, combineDateTime,
  parseHHMM, isSummer, toast
} from "../core/utils.js";
import { settings, customers, stays, visits, saveAll, getCustomerById } from "../core/storage.js";

/* ===========================================
 * UI: Collapse Check-in Bereich (optional)
 * Erwartete IDs in index.html (optional):
 *   stay_ci_head, stay_ci_body, stay_ci_arrow, stay_ci_hint
 * =========================================== */
const LS_STAY_CI_OPEN = "ui_stay_checkin_open";

function initStayCheckinCollapse() {
  const head = document.getElementById("stay_ci_head");
  const body = document.getElementById("stay_ci_body");
  const arrow = document.getElementById("stay_ci_arrow");
  if (!head || !body || !arrow) return;

  const saved = localStorage.getItem(LS_STAY_CI_OPEN);
  const open = (saved === null) ? true : (saved === "1");
  body.classList.toggle("hidden", !open);
  arrow.textContent = open ? "▾" : "▸";

  if (!head._bound) {
    head._bound = true;
    head.addEventListener("click", () => {
      const nowHidden = body.classList.toggle("hidden");
      arrow.textContent = nowHidden ? "▸" : "▾";
      localStorage.setItem(LS_STAY_CI_OPEN, nowHidden ? "0" : "1");
    });
  }
}

function setStayHint(text) {
  const el = document.getElementById("stay_ci_hint");
  if (el) el.textContent = text || "";
}

/* --------------------------------- Helpers --------------------------------- */
function ownerOptions() {
  return customers.map(c => `<option value="${esc(c.id)}">${esc(c.name || "—")}</option>`).join("");
}
function ensureDogList(cust) {
  return Array.isArray(cust?.dogs) ? cust.dogs : [];
}

function dogNameById(ownerId, dogId) {
  const c = getCustomerById(ownerId);
  const d = ensureDogList(c).find(x => x.id === dogId);
  return d?.name || "Hund";
}

function isDogInOpenStay(ownerId, dogId) {
  return (stays || []).some(s => !s.checkoutDate && s.customerId === ownerId && s.dogId === dogId);
}
function isDogInOpenDay(ownerId, dogId) {
  const today = todayStr();
  return (visits || []).some(v => v.customerId === ownerId && v.dogId === dogId && v.date === today && !v.checkoutAt);
}

/* ----------------------------------- UI ------------------------------------ */
export function renderStayPage() {
  initStayCheckinCollapse();

  const so  = document.getElementById("ps_owner");
  const sof = document.getElementById("ps_owner_filter");
  const dEl = document.getElementById("ps_in_date");
  const tEl = document.getElementById("ps_in_time");
  const listEl = document.getElementById("stayList");
  if (!so || !sof || !dEl || !tEl || !listEl) return;

  so.innerHTML  = `— Besitzer wählen —${ownerOptions()}`;
  sof.innerHTML = `<option value="all">Alle</option>${ownerOptions()}`;

  setv("ps_in_date", todayStr());
  setv("ps_in_time", nowTime());

  stayOwnerChanged();
  renderStayList();
}

export function stayOwnerChanged() {
  const ownerId = gv("ps_owner");
  const box = document.getElementById("ps_dogs");
  if (!box) return;

  const cust = getCustomerById(ownerId);
  if (!cust) {
    box.innerHTML = `<div class="muted">Kein Besitzer gewählt.</div>`;
    setStayHint("");
    return;
  }

  const dogs = ensureDogList(cust);
  if (dogs.length === 0) {
    box.innerHTML = `<div class="muted">Dieser Besitzer hat noch keine Hunde.</div>`;
    setStayHint(`${cust.name || "Besitzer"}: keine Hunde`);
    return;
  }

  if (dogs.length === 1) {
    const d = dogs[0];
    box.innerHTML = `
      <div class="card" style="padding:10px 12px">
        <strong>${esc(d.name || "Hund")}</strong>
        <input type="checkbox" name="ps_dog" value="${esc(d.id)}" checked style="display:none">
      </div>
      <div class="muted" style="margin-top:6px">1 Hund – wird automatisch eingecheckt.</div>
    `;
    setStayHint(`${cust.name || "Besitzer"} · 1 Hund`);
    return;
  }

  box.innerHTML = dogs.map(d => `
    <label class="card" style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none">
      <input type="checkbox" name="ps_dog" value="${esc(d.id)}" style="width:18px;height:18px" />
      <span>${esc(d.name || "Hund")}</span>
    </label>
  `).join("");

  setStayHint(`${cust.name || "Besitzer"} · ${dogs.length} Hunde`);
}

/* -------------------------------- Check-in --------------------------------- */
export function stayCheckInMulti() {
  const ownerId = gv("ps_owner");
  const cust = getCustomerById(ownerId);
  if (!cust) { toast("Bitte Besitzer wählen."); return; }

  const di = gv("ps_in_date") || todayStr();
  const ti = gv("ps_in_time") || nowTime();
  const chosen = [...document.querySelectorAll("#ps_dogs input[name='ps_dog']:checked")].map(i => i.value);
  if (chosen.length === 0) { toast("Bitte mindestens einen Hund auswählen."); return; }

  const blocked = [];
  const ok = [];

  for (const dogId of chosen) {
    if (isDogInOpenStay(ownerId, dogId)) {
      blocked.push(`${dogNameById(ownerId, dogId)} (ist bereits in Pension)`);
      continue;
    }
    if (isDogInOpenDay(ownerId, dogId)) {
      blocked.push(`${dogNameById(ownerId, dogId)} (ist bereits Tageshund)`);
      continue;
    }
    ok.push(dogId);
  }

  if (blocked.length) toast(blocked.join("\n"));
  if (ok.length === 0) return;

  ok.forEach((dogId, idx) => {
    const ciISO = combineDateTime(di, ti).toISOString();
    stays.push({
      id: genId(),
      customerId: ownerId,
      dogId,
      checkinAt: ciISO,
      checkoutDate: null,
      isSecond: idx >= 1,
      price: 0,
      method: null,       // cash | invoice | other
      payStatus: "open",  // open | paid
      invoiceIssued: false
    });
  });

  saveAll();
  renderStayList();
}

/* --------------------------- Liste: offene Stays ---------------------------- */
/* ✅ Nur Hundename (Flat list), Klick öffnet Checkout für Besitzer */
export function renderStayList() {
  const wrap = document.getElementById("stayList");
  const of = gv("ps_owner_filter") || "all";
  if (!wrap) return;

  let L = stays.filter(s => !s.checkoutDate);
  if (of !== "all") L = L.filter(s => s.customerId === of);

  if (L.length === 0) {
    wrap.innerHTML = `<div class="muted">Keine offenen Aufenthalte.</div>`;
    return;
  }

  L = L.sort((a,b)=> (a.customerId + a.dogId).localeCompare(b.customerId + b.dogId));

  wrap.innerHTML = L.map(s => `
    <div class="row between card"
         style="align-items:center; cursor:pointer"
         onclick="openStayCheckoutMulti('${esc(s.customerId)}')">
      <div><strong>${esc(dogNameById(s.customerId, s.dogId))}</strong></div>
    </div>
  `).join("");
}

/* -------------------------- Preis-/Nachtberechnung -------------------------- */
function nightsBreakdown(ciISO, coISO, isSecond) {
  const ci = new Date(ciISO);
  const co = new Date(coISO);
  if (!(ci.valueOf()) || !(co.valueOf()) || co <= ci) {
    return { nSummer: 0, nWinter: 0, rateSum: 0, rateWin: 0, amount: 0 };
  }

  const days = [];
  let d = new Date(ci.toDateString());
  const end = new Date(co.toDateString());
  while (d < end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  const nSummer = days.filter(x => isSummer(x)).length;
  const nWinter = days.length - nSummer;

  const rateSum = Number(isSecond ? (settings.nightSecondSummer ?? 0) : (settings.nightSummer ?? 0));
  const rateWin = Number(isSecond ? (settings.nightSecondWinter ?? 0) : (settings.nightWinter ?? 0));

  const amount = nSummer * rateSum + nWinter * rateWin;
  return { nSummer, nWinter, rateSum, rateWin, amount };
}

function surchargeForStay(ciISO, coISO) {
  const ci = new Date(ciISO);
  const co = new Date(coISO);

  const { h: eh, m: em } = parseHHMM(settings.earlyThreshold ?? "07:00");
  const eLimit = new Date(ci); eLimit.setHours(eh, em, 0, 0);

  const { h: lh, m: lm } = parseHHMM(settings.lateThreshold ?? "18:00");
  const lLimit = new Date(co); lLimit.setHours(lh, lm, 0, 0);

  let early = 0, late = 0;
  if (ci < eLimit) {
    early = Number(isSummer(ci) ? (settings.earlyFeeSummer ?? 0) : (settings.earlyFeeWinter ?? 0));
  }
  if (co > lLimit) {
    late  = Number(isSummer(co) ? (settings.lateFeeSummer  ?? 0) : (settings.lateFeeWinter  ?? 0));
  }
  return { early, late };
}

/* ------------------------------ Check-out Dialog ---------------------------- */
let stayCtx = null; // {ownerId, rows:[{id,dogId,inDate,inTime,outDate,outTime,isSecond,amount,selected}]}

export function openStayCheckoutMulti(ownerId) {
  const oid = ownerId || gv("ps_owner_filter") || gv("ps_owner");
  const cust = getCustomerById(oid);
  if (!cust) { toast("Bitte Besitzer wählen."); return; }

  const opens = stays.filter(s => !s.checkoutDate && s.customerId === oid);
  if (opens.length === 0) { toast("Keine offenen Aufenthalte."); return; }

  stayCtx = {
    ownerId: oid,
    rows: opens.map((s, i) => {
      const ci = new Date(s.checkinAt);
      return {
        id: s.id,
        dogId: s.dogId,
        isSecond: i >= 1,
        selected: true,
        inDate: s.checkinAt.slice(0, 10),
        inTime: ci.toTimeString().slice(0, 5),
        outDate: todayStr(),
        outTime: nowTime(),
        amount: 0
      };
    })
  };

  renderStayCheckoutDialogMulti();
  document.getElementById("dlg_stay_checkout")?.classList.remove("hidden");
}

export function renderStayCheckoutDialogMulti() {
  const body = document.getElementById("stayCheckoutBody");
  const cust = getCustomerById(stayCtx?.ownerId);
  if (!body || !cust || !stayCtx) return;

  body.innerHTML = "";
  let total = 0;

  stayCtx.rows.forEach(r => {
    const ciISO = combineDateTime(r.inDate,  r.inTime).toISOString();
    const coISO = combineDateTime(r.outDate, r.outTime).toISOString();

    const br = nightsBreakdown(ciISO, coISO, r.isSecond);
    const sur = surchargeForStay(ciISO, coISO);
    r.amount = Math.round((br.amount + sur.early + sur.late) * 100) / 100;

    if (r.selected) total += r.amount;

    const dog = ensureDogList(cust).find(d => d.id === r.dogId);

    const sec = document.createElement("div");
    sec.className = "card";
    sec.innerHTML = `
      <div class="row between" style="gap:12px; align-items:center">
        <div><strong>${esc(dog?.name || "Hund")}</strong></div>
        <label style="display:flex; align-items:center; gap:8px; margin:0">
          <input type="checkbox" ${r.selected ? "checked" : ""} onchange="toggleStayEntry('${r.id}', this.checked)" />
          berücksichtigen
        </label>
      </div>

      <div class="muted" style="margin:4px 0">Sommer/Winter-Nacht · Früh/Spät-Zuschläge</div>

      <div class="fg3">
        <label>CI Datum <input id="sci_${r.id}"     type="date" value="${esc(r.inDate)}"  onchange="onStayRowDateChange('${r.id}')" /></label>
        <label>CI Uhrzeit <input id="sci_t_${r.id}" type="time" value="${esc(r.inTime)}"  onchange="onStayRowTimeChange('${r.id}')" /></label>
        <label>CO Datum <input id="sco_${r.id}"     type="date" value="${esc(r.outDate)}" onchange="onStayRowDateChange('${r.id}')" /></label>
        <label>CO Uhrzeit <input id="sco_t_${r.id}" type="time" value="${esc(r.outTime)}" onchange="onStayRowTimeChange('${r.id}')" /></label>
        <label>Betrag (€) <input id="sam_${r.id}" value="${r.amount.toFixed(2)}" onchange="recomputeStayTotals()"></label>
      </div>

      <div class="muted" style="margin-top:6px">
        Sommer-Nächte: ${br.nSummer} × ${br.rateSum.toFixed(2)} €, Winter-Nächte: ${br.nWinter} × ${br.rateWin.toFixed(2)} €;
        Zuschläge: ${(sur.early + sur.late).toFixed(2)} €
      </div>
    `;
    body.appendChild(sec);
  });

  const footer = document.createElement("div");
  footer.className = "card";
  footer.innerHTML = `
    <div class="fg3">
      <label>Zahlart
        <select id="st_method_all" onchange="updateStayPayDefaults();">
          <option value="invoice">Rechnung</option>
          <option value="cash">Bar</option>
          <option value="other">Sonstiges</option>
        </select>
      </label>

      <div id="st_invoice_wrap">
        <label>Rechnung erstellt?
          <select id="st_invoice_issued">
            <option value="no">Nein</option>
            <option value="yes">Ja</option>
          </select>
        </label>
      </div>

      <label>Status
        <select id="st_status_all">
          <option value="open">offen</option>
          <option value="paid">bezahlt</option>
        </select>
      </label>

      <div style="align-self:end"><strong id="st_total">Summe gesamt: ${total.toFixed(2)} €</strong></div>
    </div>
  `;
  body.appendChild(footer);

  updateStayPayDefaults();
  recomputeStayTotals();
}

export function toggleStayEntry(id, checked) {
  const r = stayCtx?.rows.find(x => x.id === id);
  if (!r) return;
  r.selected = !!checked;
  recomputeStayTotals();
}

export function recomputeStayTotals() {
  if (!stayCtx) return;
  let total = 0;
  for (const r of stayCtx.rows) {
    if (!r.selected) continue;
    const el = document.getElementById(`sam_${r.id}`);
    total += Number((el && el.value) || 0);
  }
  const t = document.getElementById("st_total");
  if (t) {
    const cnt = stayCtx.rows.filter(x => x.selected).length;
    t.textContent = (cnt > 1)
      ? `Summe (${cnt} Hunde): ${total.toFixed(2)} €`
      : `Summe gesamt: ${total.toFixed(2)} €`;
  }
}

export function updateStayPayDefaults() {
  const method = document.getElementById("st_method_all")?.value || "invoice";
  const invWrap = document.getElementById("st_invoice_wrap");
  const invSel  = document.getElementById("st_invoice_issued");
  const stSel   = document.getElementById("st_status_all");

  if (method === "other") {
    if (invWrap) invWrap.style.display = "none";
    if (invSel) invSel.value = "no";
    if (stSel) stSel.value = "paid";
    return;
  }

  if (invWrap) invWrap.style.display = "block";
  if (invSel) invSel.value = "no";

  if (method === "cash") {
    if (stSel) stSel.value = "paid";
  } else {
    if (stSel) stSel.value = "open";
  }
}

export function onStayRowDateChange(id) {
  const ri = stayCtx?.rows.find(x => x.id === id);
  if (!ri) return;
  const ci = document.getElementById(`sci_${id}`);
  const co = document.getElementById(`sco_${id}`);
  if (ci) ri.inDate  = ci.value || ri.inDate;
  if (co) ri.outDate = co.value || ri.outDate;
  recomputeStayRow(id);
}

export function onStayRowTimeChange(id) {
  const ri = stayCtx?.rows.find(x => x.id === id);
  if (!ri) return;
  const ci = document.getElementById(`sci_t_${id}`);
  const co = document.getElementById(`sco_t_${id}`);
  if (ci) ri.inTime  = ci.value || ri.inTime;
  if (co) ri.outTime = co.value || ri.outTime;
  recomputeStayRow(id);
}

export function recomputeStayRow(id) {
  const ri = stayCtx?.rows.find(x => x.id === id);
  if (!ri) return;

  const ciISO = combineDateTime(ri.inDate,  ri.inTime).toISOString();
  const coISO = combineDateTime(ri.outDate, ri.outTime).toISOString();

  const br = nightsBreakdown(ciISO, coISO, ri.isSecond);
  const sur = surchargeForStay(ciISO, coISO);
  const amount = Math.round((br.amount + sur.early + sur.late) * 100) / 100;
  ri.amount = amount;

  const a = document.getElementById(`sam_${id}`);
  if (a) a.value = amount.toFixed(2);

  recomputeStayTotals();
}

export function closeStayCheckout() {
  document.getElementById("dlg_stay_checkout")?.classList.add("hidden");
  stayCtx = null;
}

export function saveStayCheckoutMulti() {
  if (!stayCtx) return;

  const method = document.getElementById("st_method_all")?.value || "invoice";
  const status = document.getElementById("st_status_all")?.value || "open";
  const invoiceIssued = (document.getElementById("st_invoice_issued")?.value || "no") === "yes";

  const selected = stayCtx.rows.filter(r => r.selected);
  if (selected.length === 0) {
    toast("Bitte mindestens einen Hund auswählen.");
    return;
  }

  selected.forEach(r => {
    const s = stays.find(x => x.id === r.id);
    if (!s) return;

    const ciISO = combineDateTime(r.inDate,  r.inTime).toISOString();
    const coISO = combineDateTime(r.outDate, r.outTime).toISOString();

    s.checkinAt = ciISO;
    s.checkoutDate = coISO;

    const val = Number(document.getElementById(`sam_${r.id}`)?.value || r.amount || 0);
    s.price = Math.round(val * 100) / 100;

    s.method = method;
    s.payStatus = (status === "paid" ? "paid" : "open");
    s.invoiceIssued = (method === "other") ? false : !!invoiceIssued;
  });

  saveAll();
  renderStayList();
  closeStayCheckout();
}

/* ---------------------------- Window-Bindings ---------------------------- */
window.renderStayPage = renderStayPage;
window.stayOwnerChanged = stayOwnerChanged;
window.stayCheckInMulti = stayCheckInMulti;
window.renderStayList = renderStayList;
window.openStayCheckoutMulti = openStayCheckoutMulti;
window.renderStayCheckoutDialogMulti = renderStayCheckoutDialogMulti;
window.onStayRowDateChange = onStayRowDateChange;
window.onStayRowTimeChange = onStayRowTimeChange;
window.recomputeStayRow = recomputeStayRow;
window.toggleStayEntry = toggleStayEntry;
window.recomputeStayTotals = recomputeStayTotals;
window.updateStayPayDefaults = updateStayPayDefaults;
window.closeStayCheckout = closeStayCheckout;
window.saveStayCheckoutMulti = saveStayCheckoutMulti;

export default {};