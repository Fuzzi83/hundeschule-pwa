// /js/components/stay.js
"use strict"; // ES‑Modul; Inline-Handler werden unten via window gebunden.

import {
  todayStr, nowTime, esc, genId, setv, gv, combineDateTime,
  parseHHMM, isSummer, toast
} from "../core/utils.js";
import { settings, customers, stays, saveAll, getCustomerById } from "../core/storage.js";

/* --------------------------------- Helpers --------------------------------- */
function ownerOptions() {
  return customers.map(c => `<option value="${esc(c.id)}">${esc(c.name || "—")}</option>`).join("");
}
function ensureDogList(cust) {
  return Array.isArray(cust?.dogs) ? cust.dogs : [];
}

/* ----------------------------------- UI ------------------------------------ */
export function renderStayPage() {
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
  if (!cust) { box.innerHTML = `<div class="muted">Kein Besitzer gewählt.</div>`; return; }

  const dogs = ensureDogList(cust);
  if (dogs.length === 0) { box.innerHTML = `<div class="muted">Dieser Besitzer hat noch keine Hunde.</div>`; return; }

  const items = dogs.map((d, i) => `
    <label class="card">
      <input type="checkbox" name="ps_dog" value="${esc(d.id)}" />
      <span>${esc(d.name || "Hund")}${i >= 1 ? " (2. Hund)" : ""}</span>
    </label>
  `).join("");

  box.innerHTML = items;
}

/* -------------------------------- Check‑in --------------------------------- */
export function stayCheckInMulti() {
  const ownerId = gv("ps_owner");
  const cust = getCustomerById(ownerId);
  if (!cust) { toast("Bitte Besitzer wählen."); return; }

  const di = gv("ps_in_date") || todayStr();
  const ti = gv("ps_in_time") || nowTime();
  const chosen = [...document.querySelectorAll("#ps_dogs input[name='ps_dog']:checked")].map(i => i.value);
  if (chosen.length === 0) { toast("Bitte mindestens einen Hund auswählen."); return; }

  chosen.forEach((dogId, idx) => {
    let s = stays.find(x => !x.checkoutDate && x.customerId === ownerId && x.dogId === dogId);
    const ciISO = combineDateTime(di, ti).toISOString();
    if (s) {
      s.checkinAt = ciISO;
      s.isSecond = idx >= 1;
    } else {
      stays.push({
        id: genId(),
        customerId: ownerId,
        dogId,
        checkinAt: ciISO,
        checkoutDate: null,
        isSecond: idx >= 1,
        price: 0,
        method: null,       // "cash" | "invoice"
        payStatus: "open"   // "open" | "paid"
      });
    }
  });

  saveAll();
  renderStayList();
}

/* --------------------------- Liste: offene Stays ---------------------------- */
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

  // Gruppierung nach Besitzer
  const byOwner = new Map();
  for (const s of L) {
    if (!byOwner.has(s.customerId)) byOwner.set(s.customerId, []);
    byOwner.get(s.customerId).push(s);
  }

  const out = [];
  for (const [ownerId, rows] of byOwner.entries()) {
    const c = getCustomerById(ownerId);
    out.push(`
      <div class="space row between">
        <h3>${esc(c?.name || "Besitzer")}</h3>
        <button class="btn" onclick="openStayCheckoutMulti('${ownerId}')">Check‑out</button>
      </div>
    `);

    for (const s of rows) {
      const d = ensureDogList(c).find(dd => dd.id === s.dogId);
      const ciDate = new Date(s.checkinAt);
      out.push(`
        <div class="row between card" style="align-items:center">
          <div><strong>${esc(d?.name || "Hund")}${s.isSecond ? " (2. Hund)" : ""}</strong></div>
          <div class="muted">seit ${ciDate.toLocaleDateString()} ${ciDate.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</div>
        </div>
      `);
    }
  }
  wrap.innerHTML = out.join("");
}

/* -------------------------- Preis-/Nachtberechnung -------------------------- */
function nightsBreakdown(ciISO, coISO, isSecond) {
  const ci = new Date(ciISO);
  const co = new Date(coISO);
  if (!(ci.valueOf()) || !(co.valueOf()) || co <= ci) {
    return { nSummer: 0, nWinter: 0, rateSum: 0, rateWin: 0, amount: 0 };
  }

  // Nächte zählen: jede Mitternacht im Intervall [ci..co)
  const days = [];
  let d = new Date(ci.toDateString());         // Start: 00:00 des CI‑Tages
  const end = new Date(co.toDateString());     // Ende: 00:00 des CO‑Tages
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

/* ------------------------------ Check‑out Dialog ---------------------------- */
let stayCtx = null; // {ownerId, rows:[{id,dogId,inDate,inTime,outDate,outTime,isSecond,amount}]}

export function openStayCheckoutMulti(ownerId) {
  const oid = ownerId || gv("ps_owner_filter") || gv("ps_owner");
  const cust = getCustomerById(oid);
  if (!cust) { toast("Bitte Besitzer wählen."); return; }

  const opens = stays.filter(s => !s.checkoutDate && s.customerId === oid);
  if (opens.length === 0) { toast("Keine offenen Aufenthalte."); return; }

  stayCtx = {
    ownerId: oid,
    rows: opens.map(s => {
      const ci = new Date(s.checkinAt);
      return {
        id: s.id,
        dogId: s.dogId,
        isSecond: !!s.isSecond,
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
    total += r.amount;

    const dog = ensureDogList(cust).find(d => d.id === r.dogId);
    const sec = document.createElement("div");
    sec.className = "card";
    sec.innerHTML = `
      <div><strong>${esc(dog?.name || "Hund")}${r.isSecond ? " (2. Hund)" : ""}</strong></div>
      <div class="muted" style="margin:4px 0">Sommer/Winter‑Nacht · Früh/Spät‑Zuschläge</div>

      <div class="fg3">
        <label>CI Datum <input id="sci_${r.id}"   type="date" value="${esc(r.inDate)}"  onchange="onStayRowDateChange('${r.id}')" /></label>
        <label>CI Uhrzeit <input id="sci_t_${r.id}" type="time" value="${esc(r.inTime)}"  onchange="onStayRowTimeChange('${r.id}')" /></label>
        <label>CO Datum <input id="sco_${r.id}"   type="date" value="${esc(r.outDate)}" onchange="onStayRowDateChange('${r.id}')" /></label>
        <label>CO Uhrzeit <input id="sco_t_${r.id}" type="time" value="${esc(r.outTime)}" onchange="onStayRowTimeChange('${r.id}')" /></label>
        <label>Betrag (€) <input id="sam_${r.id}"  value="${r.amount.toFixed(2)}"></label>
      </div>
      <div class="muted" style="margin-top:6px">
        Sommer‑Nächte: ${br.nSummer} × ${br.rateSum.toFixed(2)} €, Winter‑Nächte: ${br.nWinter} × ${br.rateWin.toFixed(2)} €;
        Zuschläge: ${(sur.early + sur.late).toFixed(2)} €
      </div>
    `;
    body.appendChild(sec);
  });

  const footer = document.createElement("div");
  footer.className = "card";
  footer.innerHTML = `
    <div class="fg3">
      <label>Zahlart
        <select id="st_method_all">
          <option value="invoice">Rechnung</option>
          <option value="cash">Bar</option>
        </select>
      </label>
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

  // Summe neu
  let total = 0;
  for (const r of (stayCtx?.rows || [])) {
    const el = document.getElementById(`sam_${r.id}`);
    total += Number((el && el.value) || 0);
  }
  const t = document.getElementById("st_total");
  if (t) t.textContent = `Summe gesamt: ${total.toFixed(2)} €`;
}

export function closeStayCheckout() {
  document.getElementById("dlg_stay_checkout")?.classList.add("hidden");
  stayCtx = null;
}

export function saveStayCheckoutMulti() {
  if (!stayCtx) return;

  const method = document.getElementById("st_method_all")?.value || "invoice";
  const status = document.getElementById("st_status_all")?.value || "open";

  stayCtx.rows.forEach(r => {
    const s = stays.find(x => x.id === r.id);
    if (!s) return;

    const ciISO = combineDateTime(r.inDate,  r.inTime).toISOString();
    const coISO = combineDateTime(r.outDate, r.outTime).toISOString();

    s.checkinAt = ciISO;
    s.checkoutDate = coISO;

    const val = Number(document.getElementById(`sam_${r.id}`)?.value || r.amount || 0);
    s.price = Math.round(val * 100) / 100;

    s.method = method;                     // "cash" | "invoice"
    s.payStatus = (status === "paid" ? "paid" : "open");
  });

  saveAll();
  renderStayList();
  closeStayCheckout();
}

/* ---------------------------- Window‑Bindings ---------------------------- */
window.renderStayPage = renderStayPage;
window.stayOwnerChanged = stayOwnerChanged;
window.stayCheckInMulti = stayCheckInMulti;
window.renderStayList = renderStayList;
window.openStayCheckoutMulti = openStayCheckoutMulti;
window.renderStayCheckoutDialogMulti = renderStayCheckoutDialogMulti;
window.onStayRowDateChange = onStayRowDateChange;
window.onStayRowTimeChange = onStayRowTimeChange;
window.recomputeStayRow = recomputeStayRow;
window.closeStayCheckout = closeStayCheckout;
window.saveStayCheckoutMulti = saveStayCheckoutMulti;

export default {};