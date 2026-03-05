// /js/components/training.js
"use strict";

import { todayStr, nowTime, esc, genId, setv, gv, combineDateTime, toast } from "../core/utils.js";
import { settings, customers, saveAll, getCustomerById } from "../core/storage.js";

function byId(id) { return document.getElementById(id); }
function ensureDogList(cust) { return Array.isArray(cust?.dogs) ? cust.dogs : []; }

function trainingsArr() {
  if (!Array.isArray(settings.trainings)) settings.trainings = [];
  return settings.trainings;
}

/* Owner-Picker (same impl) */
function _hpEnsureOwnerPickerCSS() {
  if (document.getElementById("hp_owner_picker_css")) return;
  const st = document.createElement("style");
  st.id = "hp_owner_picker_css";
  st.textContent = `
    .hp-op-wrap.hidden{ display:none; }
    .hp-op-wrap{ position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:9999; }
    .hp-op-dlg{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:min(520px, calc(100vw - 24px)); max-height:min(80vh, 720px);
      background:#fff; border-radius:18px; overflow:hidden;
      box-shadow: 0 18px 50px rgba(0,0,0,.20);
      display:flex; flex-direction:column;
    }
    .hp-op-h{ padding:14px 16px; display:flex; justify-content:space-between; align-items:center;
      border-bottom:1px solid rgba(0,0,0,.08); font-weight:900;
    }
    .hp-op-b{ padding:12px 16px; display:flex; flex-direction:column; gap:10px; }
    .hp-op-search input{ width:100%; }
    .hp-op-list{ overflow:auto; padding:0 16px 14px; }
    .hp-op-item{ width:100%; text-align:left; padding:12px 12px; border-radius:14px;
      border:1px solid rgba(0,0,0,.10); background:#fff; margin-top:10px;
      display:flex; justify-content:space-between; align-items:center; gap:10px;
    }
    .hp-op-item:active{ transform:scale(.99); }
    .hp-op-meta{ font-size:12px; opacity:.65; }
  `;
  document.head.appendChild(st);
}
function _hpEsc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function _hpBuildOwnerPicker(dlgId, title) {
  let wrap = document.getElementById(dlgId);
  if (wrap) return wrap;

  _hpEnsureOwnerPickerCSS();

  wrap = document.createElement("div");
  wrap.id = dlgId;
  wrap.className = "hp-op-wrap hidden";
  wrap.innerHTML = `
    <div class="hp-op-dlg" role="dialog" aria-modal="true">
      <div class="hp-op-h">
        <div>${_hpEsc(title)}</div>
        <button class="btn" type="button" data-op-close>Schließen</button>
      </div>
      <div class="hp-op-b">
        <div class="hp-op-search">
          <input type="search" placeholder="Suchen…" autocomplete="off" />
        </div>
      </div>
      <div class="hp-op-list"></div>
    </div>
  `;
  document.body.appendChild(wrap);

  wrap.addEventListener("click", (e) => { if (e.target === wrap) _hpCloseOwnerPicker(dlgId); });
  wrap.querySelector("[data-op-close]")?.addEventListener("click", () => _hpCloseOwnerPicker(dlgId));

  return wrap;
}
function _hpOpenOwnerPicker(selectId, dlgId, title, items, onPick) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const wrap = _hpBuildOwnerPicker(dlgId, title);
  const input = wrap.querySelector("input[type='search']");
  const list = wrap.querySelector(".hp-op-list");
  const cur = sel.value || "";

  function render(q) {
    const qq = String(q || "").trim().toLowerCase();
    const filtered = (items || []).filter(it => {
      if (!qq) return true;
      return String(it.name || "").toLowerCase().includes(qq);
    });

    if (!filtered.length) {
      list.innerHTML = `<div class="muted" style="padding:12px 0">Keine Treffer.</div>`;
      return;
    }

    list.innerHTML = filtered.map(it => {
      const active = it.id === cur;
      return `
        <button class="hp-op-item" type="button" data-id="${_hpEsc(it.id)}">
          <div style="min-width:0">
            <div style="font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${_hpEsc(it.name || "—")}
            </div>
            ${it.meta ? `<div class="hp-op-meta">${_hpEsc(it.meta)}</div>` : ``}
          </div>
          <div class="muted">${active ? "✓" : ""}</div>
        </button>
      `;
    }).join("");

    list.querySelectorAll("[data-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id") || "";
        if (onPick) onPick(id);
        _hpCloseOwnerPicker(dlgId);
      });
    });
  }

  input.value = "";
  input.oninput = () => render(input.value);
  render("");

  wrap.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => input.focus(), 0);
}
function _hpCloseOwnerPicker(dlgId) {
  const wrap = document.getElementById(dlgId);
  if (!wrap) return;
  wrap.classList.add("hidden");
  document.body.style.overflow = "";
}
function _hpAttachOwnerPicker(selectId, dlgId, title, getItems, onPickFnName) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  try {
    const card = sel.closest(".card") || sel.parentElement;
    if (card) {
      const extra = [...card.querySelectorAll("input[type='search'], input[type='text']")]
        .filter(i => (i.placeholder || "").toLowerCase().includes("besitzer"));
      extra.forEach(i => i.style.display = "none");
    }
  } catch { }

  if (sel.dataset.hpPickerBound === "1") return;
  sel.dataset.hpPickerBound = "1";

  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const items = (typeof getItems === "function") ? getItems() : [];
    _hpOpenOwnerPicker(selectId, dlgId, title, items, (id) => {
      sel.value = id;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      const fn = window[onPickFnName];
      if (typeof fn === "function") fn();
    });
  };

  sel.addEventListener("mousedown", handler, true);
  sel.addEventListener("touchstart", handler, true);
  sel.addEventListener("click", handler, true);
}

/* training types */
function getTrainingTypes() {
  if (settings.trainingJuenghunde == null) settings.trainingJuenghunde = 0;
  if (settings.trainingWelpen == null) settings.trainingWelpen = 0;
  if (settings.trainingEinzel == null) settings.trainingEinzel = 0;
  if (settings.trainingKurse == null) settings.trainingKurse = 0;

  return [
    { id: "junghunde", name: "Junghundegruppe", rate: Number(settings.trainingJuenghunde || 0) || 0 },
    { id: "welpen", name: "Welpen", rate: Number(settings.trainingWelpen || 0) || 0 },
    { id: "einzel", name: "Einzeltraining", rate: Number(settings.trainingEinzel || 0) || 0 },
    { id: "kurse", name: "Kurse", rate: Number(settings.trainingKurse || 0) || 0 },
  ];
}
function fmtEUR(n) {
  return Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function typeKey() { return "training_selected_type_v1"; }
function getSelectedTypeId() { try { return localStorage.getItem(typeKey()) || ""; } catch { return ""; } }
function setSelectedTypeId(id) { try { localStorage.setItem(typeKey(), id || ""); } catch {} }

function ownerFreqTraining() {
  const m = new Map();
  trainingsArr().forEach(t => {
    if (!t?.customerId) return;
    m.set(t.customerId, (m.get(t.customerId) || 0) + 1);
  });
  return m;
}

let _trOwnersSorted = [];

export function renderTrainingPage() {
  const typeSel = byId("tr_type");
  const ownerSel = byId("tr_owner");
  const dateEl = byId("tr_date");
  const timeEl = byId("tr_time_in");
  if (!typeSel || !ownerSel || !dateEl || !timeEl) return;

  // types
  const types = getTrainingTypes();
  const selId = getSelectedTypeId();
  typeSel.innerHTML = types.map(t => `<option value="${esc(t.id)}">${esc(t.name)} (${fmtEUR(t.rate)})</option>`).join("");
  if (selId && types.some(t => t.id === selId)) typeSel.value = selId;
  else { typeSel.value = types[0]?.id || ""; setSelectedTypeId(typeSel.value); }
  typeSel.onchange = () => setSelectedTypeId(typeSel.value);

  // owners sorted
  const freq = ownerFreqTraining();
  _trOwnersSorted = (customers || []).slice().sort((a, b) => {
    const fa = freq.get(a.id) || 0, fb = freq.get(b.id) || 0;
    if (fb !== fa) return fb - fa;
    return String(a.name || "").localeCompare(String(b.name || ""), "de");
  });

  ownerSel.innerHTML = `<option value="">— Besitzer wählen —</option>` +
    _trOwnersSorted.map(c => `<option value="${esc(c.id)}">${esc(c.name || "—")}</option>`).join("");

  _hpAttachOwnerPicker("tr_owner", "dlg_owner_training", "Besitzer wählen", () => {
    const freq = ownerFreqTraining();
    return (_trOwnersSorted || []).map(c => ({
      id: c.id,
      name: c.name || "—",
      meta: (freq.get(c.id) || 0) ? `HT: ${freq.get(c.id)}` : ""
    }));
  }, "trainingOwnerChanged");

  if (!dateEl.value) setv("tr_date", todayStr());
  if (!timeEl.value) setv("tr_time_in", nowTime());

  trainingOwnerChanged();
  window.renderTrainingList?.();
}

export function trainingOwnerChanged() {
  const ownerId = gv("tr_owner");
  const box = byId("tr_dogs");
  if (!box) return;

  const cust = getCustomerById(ownerId);
  if (!cust) { box.innerHTML = `<div class="muted">Kein Besitzer gewählt.</div>`; return; }

  const dogs = ensureDogList(cust);
  if (dogs.length === 0) { box.innerHTML = `<div class="muted">Dieser Besitzer hat noch keine Hunde.</div>`; return; }

  if (dogs.length === 1) {
    const d = dogs[0];
    box.innerHTML = `
      <div class="card" style="padding:10px 12px">
        <strong>${esc(d.name || "Hund")}</strong>
        <input type="checkbox" name="tr_dog" value="${esc(d.id)}" checked style="display:none">
      </div>
      <div class="muted" style="margin-top:6px">1 Hund – wird automatisch eingecheckt.</div>
    `;
    return;
  }

  box.innerHTML = dogs.map(d => `
    <label class="card" style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none">
      <input type="checkbox" name="tr_dog" value="${esc(d.id)}" style="width:18px;height:18px">
      <span>${esc(d.name || "Hund")}</span>
    </label>
  `).join("");
}

export function trainingCheckInMulti() {
  const ownerId = gv("tr_owner");
  const cust = getCustomerById(ownerId);
  if (!cust) { toast("Bitte Besitzer wählen."); return; }

  const di = gv("tr_date") || todayStr();
  const ti = gv("tr_time_in") || nowTime();
  const chosen = [...document.querySelectorAll("#tr_dogs input[name='tr_dog']:checked")].map(i => i.value);
  if (chosen.length === 0) { toast("Bitte mindestens einen Hund auswählen."); return; }

  const typeId = gv("tr_type");
  const type = getTrainingTypes().find(t => t.id === typeId) || getTrainingTypes()[0] || { id: "", name: "Training", rate: 0 };

  chosen.forEach((dogId, idx) => {
    const exists = trainingsArr().some(t =>
      (t.checkinAt || "").slice(0, 10) === di &&
      t.customerId === ownerId &&
      t.dogId === dogId &&
      !t.checkoutAt
    );
    if (exists) return;

    trainingsArr().push({
      id: genId(),
      customerId: ownerId,
      dogId,
      checkinAt: combineDateTime(di, ti).toISOString(),
      checkoutAt: null,
      typeId: type.id,
      typeName: type.name,
      rate: Number(type.rate || 0) || 0,
      method: null,
      invoiceIssued: false,
      payStatus: "open",
      charged: 0,
      cardId: null,
      cardUsed: 0,
      isSecond: idx >= 1
    });
  });

  saveAll();
  toast("Check-in gespeichert");
  window.renderTrainingList?.();
}

window.renderTrainingPage = renderTrainingPage;
window.trainingOwnerChanged = trainingOwnerChanged;
window.trainingCheckInMulti = trainingCheckInMulti;

export default {};