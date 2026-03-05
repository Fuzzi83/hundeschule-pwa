// /js/components/admin/admin-hourpacks.js
"use strict";

import { toast, esc } from "../../core/utils.js";
import { listPacks, createPack, updatePack, deletePack, getPackById } from "../../core/hourpacks.js";

function byId(id) { return document.getElementById(id); }
function gv(id) { return byId(id)?.value ?? ""; }
function setv(id, v) { const el = byId(id); if (el) el.value = (v ?? ""); }
function cbv(id) { return !!byId(id)?.checked; }
function setcb(id, v) { const el = byId(id); if (el) el.checked = !!v; }
function num(v) {
  const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

let editId = null;

function ensurePageShell() {
  // ✅ Falls eine alte index.html-Variante existiert (adminHourpacks), bauen wir eine kompatible Struktur nach
  const legacyWrap = byId("adminHourpacks");
  if (legacyWrap && !byId("btn_hp_new")) {
    legacyWrap.innerHTML = `
      <div class="toolbar" style="display:flex; gap:8px; align-items:center">
        <button class="btn primary" id="btn_hp_new">Neues Stundenpaket</button>
        <span id="hp_kpi" class="muted"></span>
      </div>
      <div id="hp_list" style="margin-top:10px"></div>
    `;
  }
}

function openDlg() {
  const dlg = byId("dlg_hp");
  if (!dlg) return;
  dlg.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

export function closeHourPackDlg() {
  const dlg = byId("dlg_hp");
  if (!dlg) return;
  dlg.classList.add("hidden");
  document.body.style.overflow = "";
  editId = null;
}

function openNewHourPack() {
  editId = null;
  openDlg();

  setv("hp_name", "");
  setv("hp_fields", "10");
  setv("hp_price", "0");

  setcb("hp_active", true);
  setcb("hp_for_training", false);
  setcb("hp_for_pension", true);
  setcb("hp_allow_half_day", false);
}

function openEditHourPack(id) {
  const p = getPackById(id);
  if (!p) return toast("Paket nicht gefunden.");
  editId = id;
  openDlg();

  setv("hp_name", String(p.name || ""));
  setv("hp_fields", String(p.felder ?? 10));
  setv("hp_price", String(p.preis ?? 0));

  setcb("hp_active", p.aktiv !== false);
  setcb("hp_for_training", !!p.forTraining);
  setcb("hp_for_pension", p.forPension !== false);
  setcb("hp_allow_half_day", !!p.allowHalfDay);
}

export function saveHourPack() {
  const name = String(gv("hp_name")).trim();
  const felder = Math.max(1, parseInt(gv("hp_fields"), 10) || 1);
  const preis = Math.max(0, num(gv("hp_price")));

  const aktiv = cbv("hp_active");
  const forTraining = cbv("hp_for_training");
  const forPension = cbv("hp_for_pension");
  const allowHalfDay = cbv("hp_allow_half_day");

  if (!name) {
    toast("Bitte einen Namen eingeben.");
    byId("hp_name")?.focus();
    return;
  }
  if (!forTraining && !forPension) {
    toast("Bitte mindestens einen Bereich auswählen (Hundepension oder Hundetraining).");
    byId("hp_for_pension")?.focus();
    return;
  }

  if (editId) {
    updatePack(editId, { name, felder, preis, aktiv, forTraining, forPension, allowHalfDay });
    toast("Stundenpaket aktualisiert.");
  } else {
    createPack({ name, felder, preis, aktiv, forTraining, forPension, allowHalfDay });
    toast("Stundenpaket angelegt.");
  }

  closeHourPackDlg();
  renderHourPacks();
}

function doDelete(id) {
  if (deletePack(id)) {
    toast("Stundenpaket gelöscht.");
    renderHourPacks();
  } else {
    toast("Löschen fehlgeschlagen.");
  }
}

function rowHTML(p) {
  const tags = [
    p.forTraining ? "Hundetraining" : null,
    p.forPension ? "Hundepension" : null,
  ].filter(Boolean).join(", ") || "—";

  const half = p.allowHalfDay ? " · ½ Tag: ja" : "";
  const price = Number(p.preis || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `
    <div class="card" data-id="${p.id}" style="margin:8px 0; padding:12px">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start">
        <div style="min-width:0">
          <div style="font-weight:900">${esc(p.name || "—")}</div>
          <div class="muted" style="font-size:12px; margin-top:4px">
            Felder: ${Number(p.felder || 0)} · Preis: ${price} € · Status: ${p.aktiv ? "aktiv" : "inaktiv"}${half}
          </div>
          <div class="muted" style="font-size:12px">Freigegeben für: ${esc(tags)}</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn" data-act="edit" type="button">Bearbeiten</button>
          <button class="btn outline" data-act="del" type="button">Löschen</button>
        </div>
      </div>
    </div>
  `;
}

function bindUIOnce() {
  const btnNew = byId("btn_hp_new");
  if (btnNew && !btnNew._bound) {
    btnNew._bound = true;
    btnNew.addEventListener("click", openNewHourPack);
  }

  const btnClose = byId("btn_hp_close");
  if (btnClose && !btnClose._bound) {
    btnClose._bound = true;
    btnClose.addEventListener("click", closeHourPackDlg);
  }

  const btnSave = byId("btn_hp_save");
  if (btnSave && !btnSave._bound) {
    btnSave._bound = true;
    btnSave.addEventListener("click", saveHourPack);
  }

  // backdrop click -> schließen
  const dlg = byId("dlg_hp");
  if (dlg && !dlg._bound) {
    dlg._bound = true;
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) closeHourPackDlg();
    });
  }

  // kompatibel zu index.html inline onclick="window.saveHourPack()"
  window.saveHourPack = saveHourPack;
  window.closeHourPackDlg = closeHourPackDlg;
}

export function renderHourPacks() {
  ensurePageShell();
  bindUIOnce();

  const wrap = byId("hp_list");
  if (!wrap) return;

  const packs = listPacks({ includeInactive: true }) || [];

  const kpi = byId("hp_kpi");
  if (kpi) kpi.textContent = `Pakete: ${packs.length}`;

  if (packs.length === 0) {
    wrap.innerHTML = `<div class="muted">Noch keine Stundenpakete angelegt.</div>`;
    return;
  }

  wrap.innerHTML = packs.map(rowHTML).join("");

  wrap.querySelectorAll(".card").forEach(div => {
    if (div._bound) return;
    div._bound = true;

    const id = div.dataset.id;
    div.querySelector('[data-act="edit"]')?.addEventListener("click", () => openEditHourPack(id));
    div.querySelector('[data-act="del"]')?.addEventListener("click", () => {
      if (!confirm("Stundenpaket wirklich löschen?")) return;
      doDelete(id);
    });
  });
}

// ✅ exakt das, was index.html erwartet
window.renderHourPacks = renderHourPacks;