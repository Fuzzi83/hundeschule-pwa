// /js/components/day.js
"use strict";

import { todayStr, nowTime, esc, genId, setv, gv, combineDateTime, toast } from "../core/utils.js";
import { settings, customers, visits, saveAll, getCustomerById } from "../core/storage.js";

/* ===========================================
 * 10er‑Karten Helpers
 * =========================================== */
function ensureTenHistoryArray(cust) {
  if (!Array.isArray(cust.tenHistory)) cust.tenHistory = [];
  return cust.tenHistory;
}
function getPurchases(cust) {
  return ensureTenHistoryArray(cust)
    .filter(h => h.type === "purchase")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}
function getActiveCard(cust) {
  if (!cust) return null;
  const P = getPurchases(cust);
  for (let i = P.length - 1; i >= 0; i--) {
    const size = Number(P[i].size ?? settings.tenSize ?? 10);
    const used = Number(P[i].used ?? 0);
    if (used < size) return P[i];
  }
  return null;
}

/* ===========================================
 * Kleine Helfer
 * =========================================== */
function dogNameById(ownerId, dogId) {
  const c = getCustomerById(ownerId);
  const d = (c?.dogs ?? []).find(x => x.id === dogId);
  return d?.name || "Hund";
}

/**
 * Preisregel (Tageshunde):
 * - bis inkl. 4,5 h stundenweise (auf volle Stunden aufgerundet)
 * - > 4,5 h Tagespauschale
 */
function calcDayAmount(ciISO, coISO, isSecond) {
  if (!ciISO || !coISO) return { hours: 0, amount: 0 };
  const ci = new Date(ciISO), co = new Date(coISO);
  let ms = co - ci;
  if (!Number.isFinite(ms) || ms < 0) ms = 0;

  const mins = Math.round(ms / 60000);
  const hoursRoundedUp = Math.ceil(mins / 60);        // volle Stunden (aufgerundet)
  const hoursRaw = mins / 60;                         // exakte Stunden als Dezimal
  const hrRate = Number(isSecond ? (settings.dayHourlySecond ?? 0) : (settings.dayHourly ?? 0));
  const dayRate = Number(isSecond ? (settings.dayDailySecond ?? 0) : (settings.dayDaily ?? 0));

  const amount = (hoursRaw <= 4.5) ? (hoursRoundedUp * hrRate) : dayRate;
  return { hours: hoursRoundedUp, amount: Math.round(amount * 100) / 100 };
}

/* ===========================================
 * Rendering
 * =========================================== */
export function renderDayPage() {
  const sel = document.getElementById("d_owner_sel");
  const dateEl = document.getElementById("d_date");
  const timeEl = document.getElementById("d_time_in");
  const dogsEl = document.getElementById("d_dogs");
  if (!sel || !dateEl || !timeEl || !dogsEl) return;

  // Besitzerliste
  sel.innerHTML = `— Besitzer wählen —` + customers.map(c => `<option value="${esc(c.id)}">${esc(c.name || "—")}</option>`).join("");

  // Defaults
  setv("d_date", todayStr());
  setv("d_time_in", nowTime());

  dayOwnerChanged();
  renderDayList();
}

export function dayOwnerChanged() {
  const sel = document.getElementById("d_owner_sel");
  const dogsBox = document.getElementById("d_dogs");
  const tenWrap = document.getElementById("tenWrap");
  if (!sel || !dogsBox || !tenWrap) return;

  const ownerId = gv("d_owner_sel");
  const cust = getCustomerById(ownerId);

  if (!cust) {
    dogsBox.innerHTML = `<div class="muted">Kein Besitzer gewählt.</div>`;
    tenWrap.classList.add("hidden");
    return;
  }

  const dogs = Array.isArray(cust.dogs) ? cust.dogs : [];
  if (dogs.length === 0) {
    dogsBox.innerHTML = `<div class="muted">Dieser Besitzer hat noch keine Hunde.</div>`;
  } else {
    dogsBox.innerHTML = dogs.map((d, i) => `
      <label class="card">
        <input type="checkbox" name="d_dog" value="${esc(d.id)}" />
        <span>${esc(d.name || "Hund")}${i >= 1 ? " (2. Hund)" : ""}</span>
      </label>
    `).join("");
  }

  const card = getActiveCard(cust);
  if (card) {
    tenWrap.classList.remove("hidden");
    renderTenCirclesRO("tenCirclesDay", "tenInfoDay", card);
  } else {
    tenWrap.classList.add("hidden");
  }
}

function renderTenCirclesRO(containerId, infoId, card) {
  const container = document.getElementById(containerId);
  const info = document.getElementById(infoId);
  if (!container) return;
  container.innerHTML = "";

  if (!card) {
    if (info) info.textContent = "Keine aktive Karte.";
    return;
  }

  const total = Number(card.size ?? settings.tenSize ?? 10);
  const used = Number(card.used ?? 0);

  for (let i = 0; i < total; i++) {
    const d = document.createElement("div");
    d.className = "circle small " + (i < used ? "filled" : "");
    d.textContent = (i < used ? "✓" : String(i + 1));
    container.appendChild(d);
  }
  if (info) info.textContent = `Genutzt: ${used}/${total} · Rest: ${Math.max(0, total - used)}`;
}

/* ===========================================
 * Check‑in (Tag)
 * =========================================== */
export function dayCheckInMulti() {
  const ownerId = gv("d_owner_sel");
  const date = gv("d_date") || todayStr();
  const tIn = gv("d_time_in") || nowTime();

  const cust = getCustomerById(ownerId);
  if (!cust) {
    toast("Bitte Besitzer wählen.");
    return;
  }

  const chosen = [...document.querySelectorAll("#d_dogs input[name='d_dog']:checked")].map(i => i.value);
  if (chosen.length === 0) {
    toast("Bitte mindestens einen Hund auswählen.");
    return;
  }

  chosen.forEach(dogId => {
    let v = visits.find(x => x.customerId === ownerId && x.dogId === dogId && x.date === date);
    const ciISO = combineDateTime(date, tIn).toISOString();
    if (v) {
      v.checkinAt = ciISO;
      v.checkoutAt = null;
      v.method = null;
      v.payStatus = "open";
      v.charged = 0;
    } else {
      visits.push({
        id: genId(),
        customerId: ownerId,
        dogId,
        date,
        checkinAt: ciISO,
        checkoutAt: null,
        method: null,
        payStatus: "open",
        charged: 0
      });
    }
  });

  saveAll();
  renderDayList();
}

/* ===========================================
 * Liste „Heute“
 * =========================================== */
export function renderDayList() {
  const list = document.getElementById("dayList");
  if (!list) return;

  const today = todayStr();
  const L = visits
    .filter(v => v.date === today && !v.checkoutAt)
    .sort((a, b) => (a.customerId + a.dogId).localeCompare(b.customerId + b.dogId));

  if (L.length === 0) {
    list.innerHTML = `<div class="muted">Heute keine offenen Tageshunde.</div>`;
    return;
  }

  const byOwner = new Map();
  for (const v of L) {
    if (!byOwner.has(v.customerId)) byOwner.set(v.customerId, []);
    byOwner.get(v.customerId).push(v);
  }

  const out = [];
  for (const [ownerId, rows] of byOwner.entries()) {
    const c = getCustomerById(ownerId);
    out.push(`
      <div class="space row between">
        <h3>${esc(c?.name || "Besitzer")}</h3>
        <button class="btn" onclick="openDayCheckout()">Check‑out</button>
      </div>
    `);

    for (const v of rows) {
      const dog = (c?.dogs ?? []).find(d => d.id === v.dogId);
      const t = v.checkinAt && new Date(v.checkinAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      out.push(`
        <div class="row between card" style="align-items:center">
          <div><strong>${esc(dog?.name || "Hund")}</strong></div>
          <div class="muted">CI: ${esc(t || "-")}</div>
        </div>
      `);
    }
  }
  list.innerHTML = out.join("");
}

/* ===========================================
 * Check‑out (Dialog)
 * =========================================== */
let dayCtx = null;

export function openDayCheckout(visitId) {
  const fallbackDate = gv("d_date") || todayStr();
  let ownerId = gv("d_owner_sel") || "";
  let date = fallbackDate;

  if (visitId) {
    const v = visits.find(x => x.id === visitId);
    if (v) {
      ownerId = v.customerId;
      date = v.date || fallbackDate;
    }
  }

  const opens = visits.filter(x => x.customerId === ownerId && x.date === date && !x.checkoutAt);
  if (opens.length === 0) {
    toast("Keine offenen Einträge für diesen Besitzer/Tag.");
    return;
  }

  dayCtx = {
    cid: ownerId,
    date,
    entries: opens.map((x, i) => {
      const ci = x.checkinAt ? new Date(x.checkinAt) : combineDateTime(date, nowTime());
      return {
        visitId: x.id,
        dogId: x.dogId,
        selected: true,
        isSecond: i >= 1,
        ciDate: (x.checkinAt || "").slice(0, 10) || date,
        ciTime: ci.toTimeString().slice(0, 5),
        coDate: date,
        coTime: nowTime()
      };
    }),
    _stampSet: new Set()
  };

  renderDayCheckoutDialog();
  document.getElementById("dlg_day_checkout")?.classList.remove("hidden");
}

export function renderDayCheckoutDialog() {
  const body = document.getElementById("dayCheckoutBody");
  if (!body || !dayCtx) return;
  body.innerHTML = "";

  dayCtx.entries.forEach(e => {
    const ciISO = combineDateTime(e.ciDate, e.ciTime).toISOString();
    const coISO = combineDateTime(e.coDate, e.coTime).toISOString();
    const calc = calcDayAmount(ciISO, coISO, e.isSecond);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="row between" style="gap:12px; align-items:center">
        <div><strong>${esc(dogNameById(dayCtx.cid, e.dogId))}${e.isSecond ? " (2. Hund)" : ""}</strong></div>
        <label><input type="checkbox" checked onchange="toggleEntry('${e.visitId}', this.checked)" /> berücksichtigen</label>
      </div>

      <div class="fg3" style="margin-top:8px">
        <label>CI Datum <input id="d_ci_d_${e.visitId}" type="date" value="${esc(e.ciDate)}" onchange="onDayRowChange('${e.visitId}')" /></label>
        <label>CI Uhrzeit <input id="d_ci_t_${e.visitId}" type="time" value="${esc(e.ciTime)}" onchange="onDayRowChange('${e.visitId}')" /></label>
        <label>CO Datum <input id="d_co_d_${e.visitId}" type="date" value="${esc(e.coDate)}" onchange="onDayRowChange('${e.visitId}')" /></label>
        <label>CO Uhrzeit <input id="d_co_t_${e.visitId}" type="time" value="${esc(e.coTime)}" onchange="onDayRowChange('${e.visitId}')" /></label>
      </div>

      <div class="fg3" style="margin-top:8px">
        <label>Stunden (gerundet) <input id="hrs_${e.visitId}" value="${calc.hours}" readonly></label>
        <label>Betrag (€) <input id="amt_${e.visitId}" value="${calc.amount.toFixed(2)}" ${/* frei änderbar bei Bar/Rechnung */""}></label>
      </div>
      <div class="muted" style="margin-top:4px">Stundenregel bis 4,5 h → danach Tagespauschale</div>
    `;
    body.appendChild(card);
  });

  const pay = document.createElement("div");
  pay.className = "card";
  pay.innerHTML = `
    <div class="fg3">
      <label>Zahlart
        <select id="dc_method" onchange="updatePayVisibility(); updateTotals();">
          <option value="ten">10er‑Karte</option>
          <option value="cash">Bar</option>
          <option value="invoice">Rechnung</option>
        </select>
      </label>
      <div id="dc_status_wrap">
        <label>Status
          <select id="dc_status" onchange="updateTotals()">
            <option value="open">offen</option>
            <option value="paid">bezahlt</option>
          </select>
        </label>
      </div>
      <div style="align-self:end"><strong id="dc_total"></strong></div>
    </div>
  `;
  body.appendChild(pay);

  const owner = getCustomerById(dayCtx.cid);
  const card = getActiveCard(owner);
  if (card) {
    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.id = "tenWrapCheckout";
    wrap.innerHTML = `
      <h3>10er‑Karte</h3>
      <div id="tenCirCheckout" class="circles" style="margin-top:4px"></div>
      <div id="tenCirInfo" class="muted" style="margin-top:4px"></div>
      <div class="muted" style="margin-top:8px">Zum Speichern mit 10er‑Karte mindestens 1 Feld stempeln.</div>
    `;
    body.appendChild(wrap);
    renderTenCirclesEditable(card, document.getElementById("tenCirCheckout"), document.getElementById("tenCirInfo"));
  }

  updatePayVisibility();
  updateTotals();
}

export function onDayRowChange(visitId) {
  const e = dayCtx?.entries.find(x => x.visitId === visitId);
  if (!e) return;

  const ciD = document.getElementById(`d_ci_d_${visitId}`);
  const ciT = document.getElementById(`d_ci_t_${visitId}`);
  const coD = document.getElementById(`d_co_d_${visitId}`);
  const coT = document.getElementById(`d_co_t_${visitId}`);

  if (ciD) e.ciDate = ciD.value || e.ciDate;
  if (ciT) e.ciTime = ciT.value || e.ciTime;
  if (coD) e.coDate = coD.value || e.coDate;
  if (coT) e.coTime = coT.value || e.coTime;

  const calc = calcDayAmount(
    combineDateTime(e.ciDate, e.ciTime).toISOString(),
    combineDateTime(e.coDate, e.coTime).toISOString(),
    e.isSecond
  );

  const h = document.getElementById(`hrs_${visitId}`);
  if (h) h.value = String(calc.hours);

  const a = document.getElementById(`amt_${visitId}`);
  if (a) a.value = calc.amount.toFixed(2);

  updateTotals();
}

export function renderTenCirclesEditable(card, container, info) {
  if (!container || !dayCtx) return;
  container.innerHTML = "";

  const total = Number(card.size ?? settings.tenSize ?? 10);
  const used = Number(card.used ?? 0);

  for (let i = 0; i < total; i++) {
    const d = document.createElement("div");
    const stampedNew = dayCtx._stampSet.has(i);
    d.className = "circle " + (i < used ? "filled" : stampedNew ? "selected" : "");
    d.textContent = (i < used ? "✓" : (i + 1));
    d.onclick = () => {
      if (i < used) return; // bereits verbraucht
      if (dayCtx._stampSet.has(i)) dayCtx._stampSet.delete(i);
      else dayCtx._stampSet.add(i);
      renderTenCirclesEditable(card, container, info);
      updateTotals();
    };
    container.appendChild(d);
  }
  if (info) info.textContent = `Neu stempeln: ${dayCtx._stampSet.size} · Bereits gestempelt: ${used} · Rest: ${Math.max(0, total - used)}`;
}

export function updatePayVisibility() {
  const method = document.getElementById("dc_method")?.value || "ten";
  const tenSec = document.getElementById("tenWrapCheckout");
  if (tenSec) tenSec.style.display = method === "ten" ? "block" : "none";

  const stWrap = document.getElementById("dc_status_wrap");
  if (stWrap) {
    stWrap.style.display = method === "ten" ? "none" : "block";
    if (method === "ten") {
      const s = document.getElementById("dc_status");
      if (s) s.value = "paid";
    }
  }
}

export function updateTotals() {
  const method = document.getElementById("dc_method")?.value || "ten";
  let total = 0;

  if (method !== "ten") {
    for (const e of (dayCtx?.entries || [])) {
      if (!e.selected) continue;
      const val = Number(document.getElementById(`amt_${e.visitId}`)?.value || 0);
      total += Math.round(val * 100) / 100;
    }
  }

  const tEl = document.getElementById("dc_total");
  if (tEl) tEl.textContent = (method === "ten") ? "Zahlart: 10er‑Karte" : `Summe gesamt: ${total.toFixed(2)} €`;
}

export function toggleEntry(visitId, checked) {
  const e = dayCtx?.entries.find(x => x.visitId === visitId);
  if (e) {
    e.selected = !!checked;
    updateTotals();
  }
}

export function closeDayCheckout() {
  document.getElementById("dlg_day_checkout")?.classList.add("hidden");
  dayCtx = null;
}

export function saveDayCheckout() {
  if (!dayCtx) return;

  const owner = getCustomerById(dayCtx.cid);
  const selected = dayCtx.entries.filter(x => x.selected);
  if (selected.length === 0) {
    toast("Bitte mindestens einen Hund auswählen.");
    return;
  }

  const method = document.getElementById("dc_method")?.value || "ten";
  const status = document.getElementById("dc_status")?.value || "open";

  let activeCard = null;
  if (method === "ten") {
    activeCard = getActiveCard(owner);
    if (!activeCard) {
      toast("Keine aktive 10er‑Karte vorhanden.");
      return;
    }
    if ((dayCtx._stampSet?.size || 0) < 1) {
      toast("Bitte mindestens ein Feld abstempeln.");
      return;
    }
    // Optional: Sicherstellen, dass mind. so viele Stempel gesetzt sind wie ausgewählte Einträge
    if (dayCtx._stampSet.size < selected.length) {
      toast(`Bitte mindestens ${selected.length} Feld(er) für die ${selected.length} Einträge stempeln.`);
      return;
    }
  }

  const usedVisitIds = [];

  for (const e of selected) {
    const v = visits.find(x => x.id === e.visitId);
    if (!v) continue;

    const ciISO = combineDateTime(e.ciDate, e.ciTime).toISOString();
    const coISO = combineDateTime(e.coDate, e.coTime).toISOString();

    v.checkinAt = ciISO;
    v.checkoutAt = coISO;
    v.date = e.ciDate;

    if (method === "ten") {
      v.method = "ten";
      v.payStatus = "paid";
      v.charged = 0;
      usedVisitIds.push(v.id);
    } else {
      v.method = method;                           // "cash" | "invoice"
      v.payStatus = (status === "paid" ? "paid" : "open");
      v.charged = Math.round(Number(document.getElementById(`amt_${e.visitId}`)?.value || 0) * 100) / 100;
    }
  }

  if (method === "ten" && activeCard) {
    const total = Number(activeCard.size ?? settings.tenSize ?? 10);
    const used = Number(activeCard.used ?? 0);
    const add = Math.min(dayCtx._stampSet.size, Math.max(0, total - used));
    activeCard.used = Math.min(total, used + add);

    ensureTenHistoryArray(owner).push({
      id: genId(),
      type: "use",
      date: new Date().toISOString(),
      count: add,
      visitIds: usedVisitIds
    });
  }

  saveAll();
  renderDayList();
  closeDayCheckout();
}

/* ===========================================
 * Window‑Bindings
 * =========================================== */
window.renderDayPage = renderDayPage;
window.dayOwnerChanged = dayOwnerChanged;
window.dayCheckInMulti = dayCheckInMulti;
window.renderDayList = renderDayList;
window.openDayCheckout = openDayCheckout;
window.renderDayCheckoutDialog = renderDayCheckoutDialog;
window.onDayRowChange = onDayRowChange;
window.renderTenCirclesEditable = renderTenCirclesEditable;
window.updatePayVisibility = updatePayVisibility;
window.updateTotals = updateTotals;
window.toggleEntry = toggleEntry;
window.closeDayCheckout = closeDayCheckout;
window.saveDayCheckout = saveDayCheckout;

export default {};