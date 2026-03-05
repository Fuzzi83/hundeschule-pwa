// /js/components/day.js
"use strict";

import { todayStr, nowTime, esc, genId, setv, gv, combineDateTime, toast } from "../core/utils.js";
import { settings, customers, visits, stays, saveAll, getCustomerById } from "../core/storage.js";

/* -------------------------------
   Helpers
-------------------------------- */
function ensureDayDefaults() {
  if (settings.dayHourly == null) settings.dayHourly = 0;
  if (settings.dayHourlySecond == null) settings.dayHourlySecond = 0;
  if (settings.dayDaily == null) settings.dayDaily = 0;
  if (settings.dayDailySecond == null) settings.dayDailySecond = 0;
}
function byId(id) { return document.getElementById(id); }
function clampHalfSteps(x) {
  x = Number(x || 0);
  if (!Number.isFinite(x) || x < 0) x = 0;
  return Math.round(x * 2) / 2;
}

function timeHHMM(iso) {
  if (!iso) return "--:--";
  try { return new Date(iso).toTimeString().slice(0, 5); } catch { return "--:--"; }
}
function fmtEUR(n) {
  return Number(n || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/* -------------------------------
   Domain helpers
-------------------------------- */
function dogNameById(ownerId, dogId) {
  const c = getCustomerById(ownerId);
  const d = (c?.dogs ?? []).find(x => x.id === dogId);
  return d?.name || "Hund";
}

function ownerFreq() {
  const m = new Map();
  (visits || []).forEach(v => {
    if (!v?.customerId) return;
    m.set(v.customerId, (m.get(v.customerId) || 0) + 1);
  });
  return m;
}

function isDogInOpenStay(customerId, dogId) {
  return (stays || []).some(s => s.customerId === customerId && s.dogId === dogId && !s.checkoutAt);
}

function isDogInOpenDay(customerId, dogId, date) {
  return (visits || []).some(v => v.customerId === customerId && v.dogId === dogId && v.date === date && !v.checkoutAt);
}

/* -------------------------------
   Pricing
-------------------------------- */
function calcDayAmount(ciISO, coISO, isSecond) {
  ensureDayDefaults();
  if (!ciISO || !coISO) return { hoursRounded: 0, hoursRaw: 0, amount: 0, mins: 0 };

  const ci = new Date(ciISO), co = new Date(coISO);
  let ms = co - ci;
  if (!Number.isFinite(ms) || ms < 0) ms = 0;

  const mins = Math.round(ms / 60000);
  const hoursRaw = mins / 60;

  const hoursRounded = Math.ceil(mins / 60);
  const hrRate = Number(isSecond ? (settings.dayHourlySecond ?? 0) : (settings.dayHourly ?? 0));
  const dayRate = Number(isSecond ? (settings.dayDailySecond ?? 0) : (settings.dayDaily ?? 0));

  const amount = (hoursRaw <= 4.5) ? (hoursRounded * hrRate) : dayRate;
  return { hoursRounded, hoursRaw, amount: Math.round(amount * 100) / 100, mins };
}

function calcExplain(ciISO, coISO, isSecond) {
  const calc = calcDayAmount(ciISO, coISO, isSecond);
  const hrRate = Number(isSecond ? (settings.dayHourlySecond ?? 0) : (settings.dayHourly ?? 0));
  const dayRate = Number(isSecond ? (settings.dayDailySecond ?? 0) : (settings.dayDaily ?? 0));

  let explain = "";
  if (calc.hoursRaw <= 4.5) explain = `${calc.hoursRounded} × ${fmtEUR(hrRate)} = ${fmtEUR(calc.amount)}`;
  else explain = `Tagespauschale ab 4,5 Std.: ${fmtEUR(dayRate)}`;
  return { calc, explain };
}

/* -------------------------------
   Cards
-------------------------------- */
function cardRemaining(card) {
  const total = Number(card?.fieldsTotal || 0);
  const used = Number(card?.fieldsUsed || 0);
  return Math.max(0, total - used);
}
function isActiveNotEmpty(card) {
  return !!card?.active && cardRemaining(card) > 0;
}
function activeCardsForCustomer(cust) {
  return (cust?.cards || []).filter(isActiveNotEmpty);
}
function autoPickCardIfSingle(owner, entry) {
  if (entry.cardId) return;
  const cards = activeCardsForCustomer(owner);
  if (cards.length === 1) entry.cardId = cards[0].id;
}

/* -------------------------------
   Last method per customer
-------------------------------- */
function lastMethodKey(customerId) { return `day_last_method_${customerId || "x"}`; }
function getLastMethod(customerId) {
  try { return localStorage.getItem(lastMethodKey(customerId)) || null; } catch { return null; }
}
function setLastMethod(customerId, method) {
  try { if (customerId) localStorage.setItem(lastMethodKey(customerId), method || ""); } catch { }
}

/* =========================================================
   ✅ REMOVE "Filter Besitzer" under checked-in list
   ========================================================= */
function removeCheckedInOwnerFilter() {
  const ids = [
    "d_owner_filter",
    "day_owner_filter",
    "day_ownerFilter",
    "owner_filter",
    "ownerFilter",
    "dayFilterOwner",
    "filterOwner",
  ];
  for (const id of ids) {
    const el = byId(id);
    if (el) {
      const wrap = el.closest("label") || el.closest(".fg") || el.parentElement;
      if (wrap) wrap.remove(); else el.remove();
      return;
    }
  }

  const labels = [...document.querySelectorAll("label")];
  for (const lab of labels) {
    const t = (lab.textContent || "").trim().toLowerCase();
    if (t.includes("filter besitzer")) {
      lab.remove();
      return;
    }
  }

  const headers = [...document.querySelectorAll("h1,h2,h3,h4,strong,div,span")];
  const h = headers.find(n => (n.textContent || "").trim().toLowerCase() === "eingecheckte hunde");
  if (h) {
    const section = h.closest("section") || h.parentElement;
    if (section) {
      const candidates = [...section.querySelectorAll("label,.fg,.row,.card,div")];
      const hit = candidates.find(n => (n.textContent || "").trim().toLowerCase().includes("filter besitzer"));
      if (hit) hit.remove();
    }
  }
}

/* =========================================================
   CHECK-IN Accordion UI (Kundendialog-Style)
   ========================================================= */
function checkinKey() { return "day_checkin_open_v2"; }
function getCheckinOpen() {
  try {
    const v = localStorage.getItem(checkinKey());
    return v === null ? true : v === "1";
  } catch { return true; }
}
function setCheckinOpen(open) {
  try { localStorage.setItem(checkinKey(), open ? "1" : "0"); } catch { }
}

function cssCheckinOnce() {
  if (byId("day_checkin_ui_css")) return;
  const st = document.createElement("style");
  st.id = "day_checkin_ui_css";
  st.textContent = `
    .day-acc-row{
      display:flex; align-items:center; justify-content:space-between;
      gap:12px; cursor:pointer; user-select:none;
      padding:12px 14px;
      border-radius:14px;
      background: rgba(0,0,0,.04);
      border: 1px solid rgba(0,0,0,.08);
      margin-bottom: 12px;
    }
    .day-acc-row .day-acc-title{ font-weight:800; }
    .day-acc-row .day-acc-arrow{
      display:flex; align-items:center; justify-content:center;
      width:28px; height:28px; border-radius:10px;
      background:#fff; border:1px solid rgba(0,0,0,.10);
      font-weight:900;
    }
    .day-acc-body{ margin-top: 4px; }
    .day-dt-row{ display:flex; gap:10px; flex-wrap:wrap; }
    .day-dt-row > *{ flex:1; min-width:160px; }

    #dlg_day_owner_pick .dlg{
      width: min(520px, calc(100vw - 24px));
      max-width: calc(100vw - 24px);
      box-sizing: border-box;
    }
    #dlg_day_owner_pick .dlg *{ box-sizing: border-box; }
  `;
  document.head.appendChild(st);
}

function hideCheckoutButtons() {
  const hide = (el) => { try { el.style.display = "none"; } catch {} };
  [...document.querySelectorAll("button,a")].forEach(el => {
    const t = (el.textContent || "").trim().toLowerCase();
    if (t === "check-out" || t === "checkout" || t === "check out") hide(el);
  });
  [...document.querySelectorAll("button,a")].forEach(el => {
    const id = (el.id || "").toLowerCase();
    const cls = (el.className || "").toLowerCase();
    const act = (el.getAttribute?.("data-action") || "").toLowerCase();
    if (id.includes("checkout") || cls.includes("checkout") || act.includes("checkout")) hide(el);
  });
}

function findCheckinCard() {
  const dateEl = byId("d_date");
  const timeEl = byId("d_time_in");
  const ownerSel = byId("d_owner_sel");
  const dogsBox = byId("d_dogs");
  if (!dateEl || !timeEl || !ownerSel || !dogsBox) return null;

  const cand =
    dateEl.closest(".card") ||
    dateEl.closest("section") ||
    dateEl.closest(".panel") ||
    dateEl.parentElement;

  if (cand && cand.contains(ownerSel) && cand.contains(dogsBox)) return cand;

  let n = dateEl.parentElement;
  for (let i = 0; i < 10 && n; i++) {
    if (n.contains(timeEl) && n.contains(ownerSel) && n.contains(dogsBox)) return n;
    n = n.parentElement;
  }
  return cand || null;
}

function findExistingCheckinHeader(container) {
  const nodes = [...container.querySelectorAll("h1,h2,h3,h4,strong,div,span,p")];
  const hit = nodes.find(n => {
    const txt = (n.textContent || "").trim().toLowerCase();
    if (txt !== "check-in" && txt !== "checkin") return false;
    if (n.querySelector && n.querySelector("input,select,textarea,button")) return false;
    return true;
  });
  return hit || null;
}

function ensureDateTimeRow(container) {
  const dateEl = byId("d_date");
  const timeEl = byId("d_time_in");
  if (!dateEl || !timeEl) return;

  const dateWrap = dateEl.parentElement;
  const timeWrap = timeEl.parentElement;
  if (!dateWrap || !timeWrap) return;

  if (dateWrap.parentElement?.classList?.contains("day-dt-row")) return;

  const row = document.createElement("div");
  row.className = "day-dt-row";

  const parent = dateWrap.parentElement;
  if (!parent) return;

  parent.insertBefore(row, dateWrap);
  row.appendChild(dateWrap);
  row.appendChild(timeWrap);
}

function normalizeCheckinTimeLabel() {
  const t = byId("d_time_in");
  if (!t) return;
  const lab = t.closest("label");
  if (!lab) return;

  const nodes = [...lab.childNodes];
  const textNode = nodes.find(n => n.nodeType === Node.TEXT_NODE && (n.textContent || "").trim().length);
  if (textNode) {
    const txt = (textNode.textContent || "").replace(/\(.*?\)/g, "").trim();
    textNode.textContent = txt.toLowerCase().includes("zeit") ? "Check-in" : txt;
  }
}

function hideInlineOwnerSearchField(container) {
  if (!container) return;
  const inputs = [...container.querySelectorAll("input")];
  inputs.forEach(inp => {
    const ph = (inp.getAttribute("placeholder") || "").toLowerCase();
    if (ph.includes("besitzer suchen")) {
      const wrap = inp.closest("label") || inp.parentElement;
      if (wrap) wrap.style.display = "none";
      inp.style.display = "none";
    }
  });
}

function applyCheckinAccordionUI() {
  cssCheckinOnce();
  const container = findCheckinCard();
  if (!container) return;

  if (container.dataset.dayCheckinAccApplied !== "1") {
    container.dataset.dayCheckinAccApplied = "1";

    let headerSource = findExistingCheckinHeader(container);
    let headerBlock = headerSource ? (headerSource.closest(".row") || headerSource) : null;

    if (headerBlock) {
      [...headerBlock.querySelectorAll("button")].forEach(b => {
        const t = (b.textContent || "").trim().toLowerCase();
        if (t === "zuklappen" || t === "aufklappen") b.remove();
      });
    }

    const accRow = document.createElement("div");
    accRow.className = "day-acc-row";
    accRow.id = "day_checkin_acc_row";

    const title = document.createElement("div");
    title.className = "day-acc-title";
    title.textContent = "Check-in";

    if (headerSource) {
      try { headerSource.remove(); } catch {}
      if (headerBlock && headerBlock !== headerSource) {
        const txt = (headerBlock.textContent || "").trim().toLowerCase();
        if (txt === "check-in" || txt === "checkin") {
          try { headerBlock.remove(); } catch {}
        }
      }
    }

    const arrow = document.createElement("div");
    arrow.className = "day-acc-arrow";
    arrow.id = "day_checkin_acc_arrow";
    arrow.textContent = "›";

    accRow.appendChild(title);
    accRow.appendChild(arrow);

    const body = document.createElement("div");
    body.className = "day-acc-body";
    body.id = "day_checkin_acc_body";

    const kids = [...container.childNodes];
    container.innerHTML = "";
    container.appendChild(accRow);
    container.appendChild(body);
    kids.forEach(k => body.appendChild(k));

    accRow.addEventListener("click", () => {
      const open = !getCheckinOpen();
      setCheckinOpen(open);
      applyCheckinAccordionUI();
    });
  }

  const body = byId("day_checkin_acc_body");
  const arrow = byId("day_checkin_acc_arrow");
  if (!body || !arrow) return;

  const open = getCheckinOpen();
  body.style.display = open ? "" : "none";
  arrow.style.transform = open ? "rotate(90deg)" : "rotate(0deg)";

  ensureDateTimeRow(body);
  normalizeCheckinTimeLabel();
  hideInlineOwnerSearchField(body);

  hideCheckoutButtons();
}

/* -------------------------------
   Owner picker (Select -> Dialog)
-------------------------------- */
function enhanceOwnerSelectWithPicker(selectEl, sortedCustomers) {
  if (!selectEl || selectEl.dataset.pickerBound === "1") return;
  selectEl.dataset.pickerBound = "1";

  selectEl.style.display = "none";

  const wrap = document.createElement("div");
  wrap.className = "day-owner-picker";
  wrap.style.position = "relative";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "inputlike";
  btn.style.width = "100%";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "space-between";
  btn.style.gap = "10px";
  btn.style.padding = "10px 12px";
  btn.style.borderRadius = "10px";
  btn.style.border = "1px solid #d0d7de";
  btn.style.background = "#fff";
  btn.style.fontSize = "16px";
  btn.style.cursor = "pointer";

  const labelSpan = document.createElement("span");
  labelSpan.textContent = "— Besitzer wählen —";
  labelSpan.style.flex = "1";
  labelSpan.style.textAlign = "left";

  const arrow = document.createElement("span");
  arrow.textContent = "▾";
  arrow.style.opacity = "0.8";

  btn.appendChild(labelSpan);
  btn.appendChild(arrow);
  wrap.appendChild(btn);

  selectEl.insertAdjacentElement("afterend", wrap);

  function syncLabel() {
    const v = selectEl.value || "";
    const c = (sortedCustomers || []).find(x => x.id === v) || getCustomerById(v);
    labelSpan.textContent = c?.name ? c.name : "— Besitzer wählen —";
  }
  syncLabel();

  const dlgId = "dlg_day_owner_pick";
  function ensureDlg() {
    let dlgWrap = byId(dlgId);
    if (dlgWrap) return dlgWrap;

    dlgWrap = document.createElement("div");
    dlgWrap.id = dlgId;
    dlgWrap.className = "dlg-wrap hidden";
    dlgWrap.innerHTML = `
      <div class="dlg">
        <h3>Besitzer wählen</h3>
        <div class="fg3" style="margin-top:8px">
          <label>Suche
            <input id="day_owner_search" type="text" placeholder="Name suchen..." />
          </label>
        </div>
        <div class="divider"></div>
        <div id="day_owner_list" style="max-height:55vh; overflow:auto"></div>
        <div class="actions-sticky" style="display:flex; justify-content:flex-end; gap:8px">
          <button class="btn outline" type="button" onclick="document.getElementById('${dlgId}').classList.add('hidden')">Abbrechen</button>
        </div>
      </div>
    `;
    document.body.appendChild(dlgWrap);
    return dlgWrap;
  }

  function renderOwnerList(filter) {
    const list = byId("day_owner_list");
    if (!list) return;
    const q = String(filter || "").trim().toLowerCase();

    const rows = (sortedCustomers || []).filter(c => {
      if (!q) return true;
      return String(c.name || "").toLowerCase().includes(q);
    });

    if (rows.length === 0) {
      list.innerHTML = `<div class="muted">Keine Treffer.</div>`;
      return;
    }

    list.innerHTML = rows.map(c => `
      <div class="card" style="padding:10px 12px; margin:8px 0; cursor:pointer"
           data-owner-id="${esc(c.id)}">
        <strong>${esc(c.name || "—")}</strong>
      </div>
    `).join("");

    // bind clicks (no inline onclick)
    [...list.querySelectorAll("[data-owner-id]")].forEach(el => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-owner-id") || "";
        selectEl.value = id;
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        syncLabel();
        byId(dlgId)?.classList.add("hidden");
      });
    });
  }

  btn.addEventListener("click", () => {
    const dlgWrap = ensureDlg();
    dlgWrap.classList.remove("hidden");
    const inp = byId("day_owner_search");
    if (inp && !inp.dataset.bound) {
      inp.dataset.bound = "1";
      inp.addEventListener("input", () => renderOwnerList(inp.value));
    }
    if (inp) {
      inp.value = "";
      setTimeout(() => { try { inp.focus(); } catch {} }, 0);
    }
    renderOwnerList("");
  });

  selectEl.addEventListener("change", () => {
    syncLabel();
  });
}

/* =========================================================
   Render Day Page
   ========================================================= */
export function renderDayPage() {
  const sel = byId("d_owner_sel");
  const dateEl = byId("d_date");
  const timeEl = byId("d_time_in");
  const dogsEl = byId("d_dogs");
  if (!sel || !dateEl || !timeEl || !dogsEl) return;

  const freq = ownerFreq();
  const sorted = (customers || []).slice().sort((a, b) => {
    const fa = freq.get(a.id) || 0, fb = freq.get(b.id) || 0;
    if (fb !== fa) return fb - fa;
    return String(a.name || "").localeCompare(String(b.name || ""), "de");
  });

  sel.innerHTML =
    `<option value="">— Besitzer wählen —</option>` +
    sorted.map(c => `<option value="${esc(c.id)}">${esc(c.name || "—")}</option>`).join("");

  enhanceOwnerSelectWithPicker(sel, sorted);

  if (!dateEl.value) setv("d_date", todayStr());
  if (!timeEl.value) setv("d_time_in", nowTime());

  dayOwnerChanged();
  renderDayList();

  removeCheckedInOwnerFilter();
  applyCheckinAccordionUI();
}

export function dayOwnerChanged() {
  const ownerId = gv("d_owner_sel");
  const dogsBox = byId("d_dogs");
  if (!dogsBox) return;

  const cust = getCustomerById(ownerId);
  if (!cust) {
    dogsBox.innerHTML = `<div class="muted">Kein Besitzer gewählt.</div>`;
    return;
  }

  const dogs = Array.isArray(cust.dogs) ? cust.dogs : [];
  if (dogs.length === 0) {
    dogsBox.innerHTML = `<div class="muted">Dieser Besitzer hat noch keine Hunde.</div>`;
    return;
  }

  if (dogs.length === 1) {
    const d = dogs[0];
    dogsBox.innerHTML = `
      <div class="card" style="padding:10px 12px">
        <strong>${esc(d.name || "Hund")}</strong>
        <input type="checkbox" name="d_dog" value="${esc(d.id)}" checked style="display:none">
      </div>
    `;
    return;
  }

  dogsBox.innerHTML = dogs.map(d => `
    <label class="card" style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none">
      <input type="checkbox" name="d_dog" value="${esc(d.id)}" style="width:18px;height:18px">
      <span>${esc(d.name || "Hund")}</span>
    </label>
  `).join("");
}

/* =========================================================
   Check-in
   ========================================================= */
export function dayCheckInMulti() {
  ensureDayDefaults();

  const ownerId = gv("d_owner_sel");
  const date = gv("d_date") || todayStr();
  const tIn = gv("d_time_in") || nowTime();

  if (!ownerId) { toast("Bitte Besitzer wählen."); return; }

  const cust = getCustomerById(ownerId);
  if (!cust) { toast("Besitzer nicht gefunden."); return; }

  const dogIds = [...document.querySelectorAll('input[name="d_dog"]:checked')].map(x => x.value);

  if (dogIds.length === 0) { toast("Bitte Hund(e) auswählen."); return; }

  const ok = [];
  const blocked = [];

  for (const dogId of dogIds) {
    if (isDogInOpenStay(ownerId, dogId)) { blocked.push(`${dogNameById(ownerId, dogId)} (ist bereits in Pension)`); continue; }
    if (isDogInOpenDay(ownerId, dogId, date)) { blocked.push(`${dogNameById(ownerId, dogId)} (ist bereits eingecheckt)`); continue; }
    ok.push(dogId);
  }

  if (blocked.length) toast(blocked.join("\n"));
  if (ok.length === 0) return;

  const ciISO = combineDateTime(date, tIn).toISOString();

  ok.forEach(dogId => {
    visits.push({
      id: genId(),
      customerId: ownerId,
      dogId,
      date,
      checkinAt: ciISO,
      checkoutAt: null,

      method: null,
      payStatus: "open",
      charged: 0,
      invoiceIssued: false,
      cardId: null,
      cardUsed: 0
    });
  });

  saveAll();
  renderDayList();
}

/* =========================================================
   List (today)  ✅ NO inline onclick anymore
   ========================================================= */
export function renderDayList() {
  const list = byId("dayList");
  if (!list) return;

  const date = gv("d_date") || todayStr();
  const open = (visits || [])
    .filter(v => v.date === date && !v.checkoutAt)
    .sort((a, b) => (a.checkinAt || "").localeCompare(b.checkinAt || ""));

  if (open.length === 0) {
    list.innerHTML = `<div class="muted">Heute keine offenen Tageshunde.</div>`;
    removeCheckedInOwnerFilter();
    return;
  }

  list.innerHTML = open.map(v => {
    const c = getCustomerById(v.customerId);
    const ownerName = c?.name || "";
    return `
      <div class="day-row card"
           data-visit-id="${esc(v.id)}"
           style="display:flex; justify-content:space-between; align-items:center; cursor:pointer">
        <div>
          <strong>${esc(dogNameById(v.customerId, v.dogId))}</strong>
          <div class="muted" style="margin-top:2px">${esc(ownerName)}</div>
        </div>
        <div class="muted">CI: ${esc(timeHHMM(v.checkinAt))}</div>
      </div>
    `;
  }).join("");

  // ✅ bind click handlers after render
  [...list.querySelectorAll("[data-visit-id]")].forEach(el => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-visit-id");
      openDayCheckout(id);
    });
  });

  removeCheckedInOwnerFilter();
}

/* =========================================================
   Checkout dialog + Card stamps (unchanged)
   ========================================================= */
let dayCtx = null;

function applyMethodDefaults(entry) {
  if (entry.method === "invoice") { entry.invoiceIssued = true; entry.payStatus = "open"; }
  else if (entry.method === "cash") { entry.invoiceIssued = true; entry.payStatus = "paid"; }
  else if (entry.method === "card") { entry.invoiceIssued = false; entry.payStatus = "paid"; entry.charged = 0; }
  else { entry.invoiceIssued = false; entry.payStatus = "paid"; }
}

function cssOnce() {
  if (byId("day_checkout_css")) return;
  const st = document.createElement("style");
  st.id = "day_checkout_css";
  st.textContent = `
    #dlg_day_checkout .dc-stamp-row{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin:8px 0; }
    #dlg_day_checkout .dc-stamp-wrap{ position:relative; display:inline-flex; align-items:center; justify-content:center; }
    #dlg_day_checkout .dc-stamp{
      width:34px; height:34px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-weight:800; border:2px solid #f59e0b;
      color:#f59e0b; background:#fff; user-select:none;
    }
    #dlg_day_checkout .dc-stamp.clickable{ cursor:pointer; }
    #dlg_day_checkout .dc-stamp.clickable:hover{ transform: scale(1.12); }
    #dlg_day_checkout .dc-stamp.used{
      border-color:#cfcfcf; color:#9b9b9b; background:#f0f0f0;
    }
    #dlg_day_checkout .dc-stamp.base-half{
      border-color:#cfcfcf; color:#9b9b9b; background:#f0f0f0;
      background: linear-gradient(90deg, #f0f0f0 50%, #fff 50%);
    }
    #dlg_day_checkout .dc-stamp.sel{
      background:#f59e0b; color:#fff;
    }
    #dlg_day_checkout .dc-stamp.sel-half{
      background: linear-gradient(90deg, #f59e0b 50%, #fff 50%);
      color:#f59e0b;
    }
    #dlg_day_checkout .dc-stamp.mix-half{
      border-color:#cfcfcf; color:#9b9b9b;
      background: linear-gradient(90deg, #cfcfcf 50%, #f59e0b 50%);
    }
    #dlg_day_checkout .dc-half-btn{
      position:absolute; right:-6px; bottom:-6px;
      width:18px; height:18px; border-radius:6px;
      display:flex; align-items:center; justify-content:center;
      font-size:12px; font-weight:900;
      border:1px solid rgba(0,0,0,.12);
      background:#fff;
      cursor:pointer;
    }
    #dlg_day_checkout .dc-half-btn:hover{ transform:scale(1.06); }
    #dlg_day_checkout .mini-grid{display:flex; gap:10px; flex-wrap:wrap}
    #dlg_day_checkout .mini-grid > *{flex:1; min-width:180px}
    #dlg_day_checkout .hrline{height:1px; background: var(--border,#ddd); margin:10px 0}
    #dlg_day_checkout .calc-note{ margin-top:6px; font-size:12px; opacity:.75 }
  `;
  document.head.appendChild(st);
}

function ensurePreviewMap() {
  if (!dayCtx) return;
  if (!dayCtx.previewAddByCard) dayCtx.previewAddByCard = {};
}
function getPreviewAdd(cardId) {
  ensurePreviewMap();
  return clampHalfSteps(dayCtx.previewAddByCard[cardId] || 0);
}
function setPreviewAdd(cardId, add) {
  ensurePreviewMap();
  dayCtx.previewAddByCard[cardId] = clampHalfSteps(add);
  (dayCtx.entries || []).forEach(e => {
    if (e.method === "card" && e.cardId === cardId) e.cardPreviewAdd = clampHalfSteps(add);
  });
}
function previewUsed(baseUsed, previewAdd) {
  return clampHalfSteps(Number(baseUsed || 0) + clampHalfSteps(previewAdd));
}
function currentStampIndex(previewUsedVal) {
  return Math.floor(Number(previewUsedVal || 0));
}

export function openDayCheckout(visitId) {
  cssOnce();

  let ownerId = gv("d_owner_sel") || "";
  let date = gv("d_date") || todayStr();

  if (visitId) {
    const v = (visits || []).find(x => x.id === visitId);
    if (v) { ownerId = v.customerId; date = v.date || date; }
  }

  const open = (visits || []).filter(v => v.customerId === ownerId && v.date === date && !v.checkoutAt);
  if (open.length === 0) { toast("Keine offenen Einträge für diesen Besitzer/Tag."); return; }

  const last = getLastMethod(ownerId);

  dayCtx = {
    cid: ownerId,
    date,
    previewAddByCard: {},
    entries: open.map((v, idx) => {
      const ci = v.checkinAt ? new Date(v.checkinAt) : combineDateTime(date, nowTime());
      const e = {
        visitId: v.id,
        dogId: v.dogId,
        isSecond: idx >= 1,

        ciDate: (v.checkinAt || "").slice(0, 10) || date,
        ciTime: ci.toTimeString().slice(0, 5),

        coDate: date,
        coTime: nowTime(),

        method: (last || "cash"),
        invoiceIssued: true,
        payStatus: "paid",
        charged: 0,

        cardId: null,
        cardPreviewAdd: 0
      };
      applyMethodDefaults(e);
      recalcEntry(idx);
      return e;
    })
  };

  if (last === "card") {
    const owner = getCustomerById(ownerId);
    for (const e of dayCtx.entries) {
      autoPickCardIfSingle(owner, e);
      e.charged = 0;
      e.cardPreviewAdd = 0;
      if (e.cardId) setPreviewAdd(e.cardId, 0);
    }
  }

  renderDayCheckoutDialog();
  byId("dlg_day_checkout")?.classList.remove("hidden");
}

function renderCardBlock(owner, entry, idx) {
  const cards = activeCardsForCustomer(owner);
  if (cards.length === 0) {
    return `<div class="muted">Keine aktive Karte vorhanden. Bitte im Kundenprofil eine Karte kaufen.</div>`;
  }

  autoPickCardIfSingle(owner, entry);
  if (entry.cardId) entry.cardPreviewAdd = getPreviewAdd(entry.cardId);

  const options = [
    `<option value="">— Karte wählen —</option>`,
    ...cards.map(c => {
      const rem = cardRemaining(c);
      const half = c.allowHalfDay ? " · ½" : "";
      return `<option value="${esc(c.id)}" ${entry.cardId === c.id ? "selected" : ""}>
        ${esc(c.packName || "Karte")} (${rem.toLocaleString("de-DE")} frei${half})
      </option>`;
    })
  ].join("");

  const chosen = cards.find(c => c.id === entry.cardId);
  if (!chosen) {
    return `
      <div class="mini-grid" style="margin-top:10px">
        <label>Stempelkarte
          <select onchange="window.__daySetCard(${idx}, this.value)">${options}</select>
        </label>
      </div>
    `;
  }

  const total = Number(chosen.fieldsTotal || 0);
  const baseUsed = clampHalfSteps(chosen.fieldsUsed);
  const baseIndex = Math.floor(baseUsed);
  const baseFrac = baseUsed - baseIndex;
  const allowHalf = !!chosen.allowHalfDay;

  const remaining = clampHalfSteps(Math.max(0, total - baseUsed));
  const sharedAdd = clampHalfSteps(getPreviewAdd(chosen.id));
  const add = Math.min(sharedAdd, remaining);
  if (Math.abs(add - sharedAdd) > 0.001) setPreviewAdd(chosen.id, add);

  const pu = previewUsed(baseUsed, add);
  const iconIndex = currentStampIndex(pu);

  const stamps = Array.from({ length: total }).map((_, i) => {
    const baseFull = (i < baseIndex);
    const baseHalf = (!baseFull && i === baseIndex && baseFrac >= 0.5);

    const pFull = (pu >= i + 1);
    const pHalf = (!pFull && pu >= i + 0.5);

    let cls = "";
    let clickable = false;

    if (baseFull) {
      cls = "used";
      clickable = false;
    } else if (baseHalf) {
      cls = pFull ? "mix-half" : "base-half";
      clickable = true;
    } else {
      if (pFull) cls = "sel";
      else if (pHalf) cls = "sel-half";
      else cls = "";
      clickable = true;
    }

    const clickAttr = clickable ? `onclick="window.__dayClickStamp(${idx}, ${i}, event)"` : "";

    const showHalfIcon =
      allowHalf &&
      i === iconIndex &&
      pu < (i + 1) &&
      i >= baseIndex;

    const halfBtn = showHalfIcon
      ? `<span class="dc-half-btn" title="Halber Tag" onclick="window.__dayHalfOnCurrent(${idx}, event)">½</span>`
      : "";

    return `
      <div class="dc-stamp-wrap">
        <div class="dc-stamp ${cls} ${clickable ? "clickable" : ""}" ${clickAttr}>${i + 1}</div>
        ${halfBtn}
      </div>
    `;
  }).join("");

  return `
    <div class="mini-grid" style="margin-top:10px">
      <label>Stempelkarte
        <select onchange="window.__daySetCard(${idx}, this.value)">${options}</select>
      </label>
    </div>
    <div class="hrline"></div>
    <div class="dc-stamp-row">${stamps}</div>
  `;
}

export function renderDayCheckoutDialog() {
  const body = byId("dayCheckoutBody");
  if (!body || !dayCtx) return;

  const owner = getCustomerById(dayCtx.cid);
  const hasActiveCard = (activeCardsForCustomer(owner).length > 0);
  if (!hasActiveCard) {
    for (let i = 0; i < (dayCtx.entries || []).length; i++) {
      const e = dayCtx.entries[i];
      if (e?.method === "card") {
        e.method = "cash";
        applyMethodDefaults(e);
        recalcEntry(i);
      }
    }
  }

  body.innerHTML = `
    <div class="muted" style="margin-bottom:10px">
      Besitzer: <strong>${esc(owner?.name || "")}</strong>
    </div>

    ${(dayCtx.entries || []).map((e, idx) => {
      const ciISO = combineDateTime(e.ciDate, e.ciTime).toISOString();
      const coISO = combineDateTime(e.coDate, e.coTime).toISOString();
      const { calc, explain } = calcExplain(ciISO, coISO, e.isSecond);
      const amountShown = (e.method === "card") ? 0 : Number(e.charged ?? calc.amount);

      return `
        <div class="card" style="margin:10px 0; padding:12px">
          <div>
            <div><strong>${esc(dogNameById(dayCtx.cid, e.dogId))}${e.isSecond ? " (2. Hund)" : ""}</strong></div>
          </div>

          <div class="hrline"></div>

          <div class="mini-grid">
            <label>CI Datum
              <input type="date" value="${esc(e.ciDate)}" onchange="window.__daySetCiDate(${idx}, this.value)">
            </label>
            <label>CI Uhrzeit
              <input type="time" value="${esc(e.ciTime)}" onchange="window.__daySetCiTime(${idx}, this.value)">
            </label>
            <label>CO Datum
              <input type="date" value="${esc(e.coDate)}" onchange="window.__daySetCoDate(${idx}, this.value)">
            </label>
            <label>CO Uhrzeit
              <input type="time" value="${esc(e.coTime)}" onchange="window.__daySetCoTime(${idx}, this.value)">
            </label>
          </div>

          <div class="muted" style="margin-top:8px">
            Dauer: <strong>${esc(String(calc.hoursRounded))}</strong> h
          </div>

          <div class="hrline"></div>

          <div class="mini-grid">
            <label>Zahlart
              <select onchange="window.__daySetMethod(${idx}, this.value)">
                <option value="card" ${e.method === "card" ? "selected" : ""} ${!hasActiveCard ? "disabled" : ""}>Karte</option>
                <option value="cash" ${e.method === "cash" ? "selected" : ""}>Bar</option>
                <option value="invoice" ${e.method === "invoice" ? "selected" : ""}>Rechnung</option>
                <option value="other" ${e.method === "other" ? "selected" : ""}>Sonstiges</option>
              </select>
            </label>

            <label>Rechnung erstellt?
              <select ${e.method === "card" || e.method === "other" ? "disabled" : ""}
                      onchange="window.__daySetInvoice(${idx}, this.value)">
                <option value="yes" ${e.invoiceIssued ? "selected" : ""}>Ja</option>
                <option value="no" ${!e.invoiceIssued ? "selected" : ""}>Nein</option>
              </select>
            </label>

            <label>Status
              <select ${e.method === "card" ? "disabled" : ""}
                      onchange="window.__daySetStatus(${idx}, this.value)">
                <option value="paid" ${e.payStatus === "paid" ? "selected" : ""}>bezahlt</option>
                <option value="open" ${e.payStatus === "open" ? "selected" : ""}>offen</option>
              </select>
            </label>

            <label>Betrag (€)
              <input type="number" step="0.01" inputmode="decimal"
                     value="${esc(String(amountShown))}"
                     ${e.method === "card" ? "disabled" : ""}
                     onchange="window.__daySetAmount(${idx}, this.value)">
              <div class="calc-note">${esc(explain)}</div>
            </label>
          </div>

          ${e.method === "card" ? renderCardBlock(owner, e, idx) : ""}
        </div>
      `;
    }).join("")}

    <div class="card" style="padding:12px; margin-top:12px">
      <div class="row between" style="align-items:center; gap:10px; flex-wrap:wrap">
        <strong id="dc_total"></strong>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px">
        <button type="button"
                onclick="window.saveDayCheckout()"
                style="background:#f59e0b; border:1px solid #f59e0b; color:#fff; padding:10px 14px; border-radius:12px; font-weight:800">
          Checkout
        </button>
        <button class="btn outline" type="button" onclick="window.closeDayCheckout()">Abbrechen</button>
      </div>
    </div>
  `;

  updateTotals();
}

export function updateTotals() {
  const totalEl = byId("dc_total");
  if (!totalEl || !dayCtx) return;

  let sum = 0;
  let anyCard = false;
  for (const e of (dayCtx.entries || [])) {
    if (e.method === "card") { anyCard = true; continue; }
    sum += Number(e.charged || 0);
  }

  if (anyCard && sum === 0) totalEl.textContent = "Summe: 0,00 € (Karte)";
  else if (anyCard) totalEl.textContent = `Summe: ${sum.toFixed(2)} € + Karte`;
  else totalEl.textContent = `Summe: ${sum.toFixed(2)} €`;
}

/* -------------------------------
   Save (consume per cardId once)
-------------------------------- */
function consumeCardOnce(ownerId, cardId, add) {
  const owner = getCustomerById(ownerId);
  const card = (owner?.cards || []).find(c => c.id === cardId);
  if (!card) { toast("Bitte Stempelkarte wählen."); return false; }

  const total = Number(card.fieldsTotal || 0);
  const baseUsed = clampHalfSteps(card.fieldsUsed);
  const allowHalf = !!card.allowHalfDay;
  const a = clampHalfSteps(add);

  if (a <= 0) { toast("Bitte im Checkout Stempel auswählen (ein oder mehrere)."); return false; }
  if (!allowHalf && (Math.round(a * 2) % 2 !== 0)) { toast("Diese Karte unterstützt keinen ½ Tag."); return false; }

  const remaining = clampHalfSteps(Math.max(0, total - baseUsed));
  if (a > remaining) { toast("Nicht genügend freie Stempel auf der Karte."); return false; }

  const newUsed = clampHalfSteps(baseUsed + a);
  card.fieldsUsed = Math.max(0, Math.min(total, newUsed));

  if (total > 0 && card.fieldsUsed >= total) {
    card.fieldsUsed = total;
    card.active = false;
    card.finishedAt = card.finishedAt || new Date().toISOString();
    toast("Letztes Feld → Karte ins Archiv.");
  }
  return true;
}

function distributeCardUsed(totalAdd, entryIdxs) {
  const n = entryIdxs.length;
  const out = new Array(n).fill(0);
  let rem = clampHalfSteps(totalAdd);

  for (let i = 0; i < n && rem >= 1; i++) {
    out[i] = 1;
    rem = clampHalfSteps(rem - 1);
  }
  if (rem >= 0.5) {
    const j = Math.min(out.findIndex(v => v === 0), n - 1);
    out[j] = clampHalfSteps(out[j] + 0.5);
  }
  return out;
}

export function closeDayCheckout() {
  byId("dlg_day_checkout")?.classList.add("hidden");
  dayCtx = null;
}

export function saveDayCheckout() {
  if (!dayCtx) return;
  const owner = getCustomerById(dayCtx.cid);
  if (!owner) return;

  const m = dayCtx.entries?.[0]?.method || "cash";
  setLastMethod(dayCtx.cid, m);

  const cardGroups = new Map();
  dayCtx.entries.forEach((e, idx) => {
    if (e.method !== "card") return;
    if (!e.cardId) return;
    if (!cardGroups.has(e.cardId)) cardGroups.set(e.cardId, []);
    cardGroups.get(e.cardId).push(idx);
  });

  for (const [cardId, idxs] of cardGroups.entries()) {
    const add = clampHalfSteps(getPreviewAdd(cardId));
    if (!consumeCardOnce(dayCtx.cid, cardId, add)) return;

    const parts = distributeCardUsed(add, idxs);
    idxs.forEach((entryIdx, k) => {
      const e = dayCtx.entries[entryIdx];
      e.cardPreviewAdd = parts[k];
    });

    setPreviewAdd(cardId, 0);
  }

  for (let idx = 0; idx < dayCtx.entries.length; idx++) {
    const e = dayCtx.entries[idx];
    const v = (visits || []).find(x => x.id === e.visitId);
    if (!v) continue;

    const ciISO = combineDateTime(e.ciDate, e.ciTime).toISOString();
    const coISO = combineDateTime(e.coDate, e.coTime).toISOString();

    v.checkinAt = ciISO;
    v.checkoutAt = coISO;

    v.method = e.method;
    v.invoiceIssued = !!e.invoiceIssued;
    v.payStatus = (e.method === "card") ? "paid" : (e.payStatus || "paid");
    v.charged = (e.method === "card") ? 0 : Number(e.charged || 0);

    if (e.method === "card") {
      v.cardId = e.cardId || null;
      v.cardUsed = clampHalfSteps(e.cardPreviewAdd || 0);
    } else {
      v.cardId = null;
      v.cardUsed = 0;
    }
  }

  saveAll();
  closeDayCheckout();
  renderDayList();
}

/* -------------------------------
   Inline handlers
-------------------------------- */
function recalcEntry(idx) {
  const e = dayCtx?.entries?.[idx];
  if (!e) return;

  const ciISO = combineDateTime(e.ciDate, e.ciTime).toISOString();
  const coISO = combineDateTime(e.coDate, e.coTime).toISOString();
  const { calc } = calcExplain(ciISO, coISO, e.isSecond);

  if (e.method !== "card") e.charged = calc.amount;
  else e.charged = 0;
}

window.__daySetCiDate = (idx, v) => { if (!dayCtx?.entries?.[idx]) return; dayCtx.entries[idx].ciDate = v; recalcEntry(idx); renderDayCheckoutDialog(); };
window.__daySetCiTime = (idx, v) => { if (!dayCtx?.entries?.[idx]) return; dayCtx.entries[idx].ciTime = v; recalcEntry(idx); renderDayCheckoutDialog(); };
window.__daySetCoDate = (idx, v) => { if (!dayCtx?.entries?.[idx]) return; dayCtx.entries[idx].coDate = v; recalcEntry(idx); renderDayCheckoutDialog(); };
window.__daySetCoTime = (idx, v) => { if (!dayCtx?.entries?.[idx]) return; dayCtx.entries[idx].coTime = v; recalcEntry(idx); renderDayCheckoutDialog(); };

window.__daySetMethod = (idx, v) => {
  if (!dayCtx?.entries?.[idx]) return;
  const e = dayCtx.entries[idx];

  const owner = getCustomerById(dayCtx.cid);
  const hasActiveCard = (activeCardsForCustomer(owner).length > 0);
  if (v === "card" && !hasActiveCard) {
    toast("Keine aktive Karte vorhanden.");
    v = "cash";
  }

  e.method = v;
  applyMethodDefaults(e);
  recalcEntry(idx);

  if (e.method === "card") {
    autoPickCardIfSingle(owner, e);
    e.charged = 0;
  }
  renderDayCheckoutDialog();
};

window.__daySetInvoice = (idx, v) => { if (!dayCtx?.entries?.[idx]) return; dayCtx.entries[idx].invoiceIssued = (v === "yes"); renderDayCheckoutDialog(); };
window.__daySetStatus = (idx, v) => { if (!dayCtx?.entries?.[idx]) return; dayCtx.entries[idx].payStatus = v; renderDayCheckoutDialog(); };
window.__daySetAmount = (idx, v) => { if (!dayCtx?.entries?.[idx]) return; dayCtx.entries[idx].charged = Number(v || 0); renderDayCheckoutDialog(); };

window.__daySetCard = (idx, cardId) => {
  if (!dayCtx?.entries?.[idx]) return;
  const e = dayCtx.entries[idx];
  e.cardId = cardId || null;
  renderDayCheckoutDialog();
};

function canSelectCardStamp(card, stampIndex) {
  const total = Number(card?.fieldsTotal || 0);
  const baseUsed = clampHalfSteps(card?.fieldsUsed || 0);
  if (stampIndex < 0 || stampIndex >= total) return false;
  const fullUsed = Math.floor(baseUsed);
  if (stampIndex < fullUsed) return false;
  return true;
}

window.__dayClickStamp = (idx, stampIndex, ev) => {
  try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch { }
  if (!dayCtx?.entries?.[idx]) return;
  const e = dayCtx.entries[idx];
  if (e.method !== "card" || !e.cardId) return;

  const owner = getCustomerById(dayCtx.cid);
  const card = (owner?.cards || []).find(c => c.id === e.cardId);
  if (!card) { toast("Bitte Stempelkarte wählen."); return; }
  if (!canSelectCardStamp(card, stampIndex)) return;

  const total = Number(card.fieldsTotal || 0);
  const baseUsed = clampHalfSteps(card.fieldsUsed);
  const remaining = clampHalfSteps(Math.max(0, total - baseUsed));
  if (remaining <= 0) { toast("Keine freien Stempel mehr."); return; }

  let targetUsed = clampHalfSteps(stampIndex + 1);
  if (targetUsed < baseUsed) targetUsed = baseUsed;

  let add = clampHalfSteps(targetUsed - baseUsed);
  if (add > remaining) add = remaining;
  if (add < 0) add = 0;

  const curAdd = getPreviewAdd(e.cardId);
  if (Math.abs(curAdd - add) < 0.001) add = clampHalfSteps(Math.max(0, add - 1));

  setPreviewAdd(e.cardId, add);
  renderDayCheckoutDialog();
};

window.__dayHalfOnCurrent = (idx, ev) => {
  try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch { }
  if (!dayCtx?.entries?.[idx]) return;
  const e = dayCtx.entries[idx];
  if (e.method !== "card" || !e.cardId) return;

  const owner = getCustomerById(dayCtx.cid);
  const card = (owner?.cards || []).find(c => c.id === e.cardId);
  if (!card) { toast("Bitte Stempelkarte wählen."); return; }
  if (!card.allowHalfDay) { toast("Diese Karte unterstützt keinen ½ Tag."); return; }

  const total = Number(card.fieldsTotal || 0);
  const baseUsed = clampHalfSteps(card.fieldsUsed);
  const remaining = clampHalfSteps(Math.max(0, total - baseUsed));
  if (remaining < 0.5) { toast("Keine freien Stempel mehr."); return; }

  const curAdd = getPreviewAdd(e.cardId);
  const pu = previewUsed(baseUsed, curAdd);
  const idxCur = currentStampIndex(pu);

  const baseIndex = Math.floor(baseUsed);
  const baseFrac = baseUsed - baseIndex;

  let targetUsed;
  if (baseFrac >= 0.5 && idxCur === baseIndex && curAdd === 0) targetUsed = clampHalfSteps(baseUsed + 0.5);
  else targetUsed = clampHalfSteps(idxCur + 0.5);

  let add = clampHalfSteps(targetUsed - baseUsed);
  if (add < 0) add = 0;
  if (add > remaining) add = remaining;

  if (Math.abs(curAdd - add) < 0.001) add = clampHalfSteps(Math.max(0, add - 0.5));

  setPreviewAdd(e.cardId, add);
  renderDayCheckoutDialog();
};

/* -------------------------------
   Window bindings (kept, but list no longer depends on it)
-------------------------------- */
window.renderDayPage = renderDayPage;
window.dayOwnerChanged = dayOwnerChanged;
window.dayCheckInMulti = dayCheckInMulti;
window.renderDayList = renderDayList;
window.openDayCheckout = openDayCheckout;
window.renderDayCheckoutDialog = renderDayCheckoutDialog;
window.updateTotals = updateTotals;
window.closeDayCheckout = closeDayCheckout;
window.saveDayCheckout = saveDayCheckout;

export default {};