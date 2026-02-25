// /js/components/admin/admin-hourpacks.js
// Admin-Seite: Stundenpakete – jetzt mit Checkboxen "Hundetraining" & "Hundepension"

import {
  listPacks,
  createPack,
  updatePack,
  deletePack,
  getPackById,
} from "../../core/hourpacks.js";
import { toast, esc } from "../../core/utils.js";

function num(v) { return Number.parseFloat(v ?? "NaN"); }
function setv(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ""; }
function gv(id) { return document.getElementById(id)?.value ?? ""; }
function cbv(id) { return !!document.getElementById(id)?.checked; }

let editId = null;

export function renderHourPacks() {
  const wrap = document.getElementById("hp_list");
  if (!wrap) return;

  const packs = listPacks();
  if (packs.length === 0) {
    wrap.innerHTML = `<div class="muted">Noch keine Stundenpakete angelegt.</div>`;
  } else {
    wrap.innerHTML = packs.map(p => {
      const tags = [
        p.forTraining ? "Hundetraining" : null,
        p.forPension  ? "Hundepension"  : null,
      ].filter(Boolean).join(", ") || "—";
      return `
        <div class="card" data-id="${p.id}" style="margin:8px 0">
          <div><strong>${esc(p.name)}</strong></div>
          <div>Felder: ${p.felder} · Preis: ${p.preis.toFixed(2)} € · Status: ${p.aktiv ? "aktiv" : "inaktiv"}</div>
          <div class="muted">Freigegeben für: ${esc(tags)}</div>
          <div style="margin-top:6px">
            <button class="btn" data-act="edit">Bearbeiten</button>
            <button class="btn danger" data-act="del">Löschen</button>
          </div>
        </div>
      `;
    }).join("");
  }

  const btnNew = document.getElementById("btn_hp_new");
  if (btnNew && !btnNew._bound) {
    btnNew._bound = true;
    btnNew.addEventListener("click", openNewHourPack);
  }

  wrap.querySelectorAll(".card").forEach(div => {
    if (div._bound) return;
    div._bound = true;
    const id = div.dataset.id;
    div.querySelector('[data-act="edit"]').addEventListener("click", () => openEditHourPack(id));
    div.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (!confirm("Stundenpaket wirklich löschen?")) return;
      doDelete(id);
    });
  });

  const kpi = document.getElementById("hp_kpi");
  if (kpi) kpi.textContent = `Pakete: ${packs.length}`;
}

function openNewHourPack() {
  editId = null;
  setv("hp_name", "");
  setv("hp_fields", "10");
  setv("hp_price", "0");
  const cbActive     = document.getElementById("hp_active");
  const cbTraining   = document.getElementById("hp_for_training");
  const cbPension    = document.getElementById("hp_for_pension");
  if (cbActive)   cbActive.checked = true;
  if (cbTraining) cbTraining.checked = false; // Training später
  if (cbPension)  cbPension.checked  = true;  // Pension direkt nutzbar
  document.getElementById("dlg_hp")?.classList.remove("hidden");
}

function openEditHourPack(id) {
  const p = getPackById(id);
  if (!p) return toast("Paket nicht gefunden.");
  editId = id;
  setv("hp_name", String(p.name || ""));
  setv("hp_fields", String(p.felder));
  setv("hp_price", String(p.preis));
  const cbActive     = document.getElementById("hp_active");
  const cbTraining   = document.getElementById("hp_for_training");
  const cbPension    = document.getElementById("hp_for_pension");
  if (cbActive)   cbActive.checked   = !!p.aktiv;
  if (cbTraining) cbTraining.checked = !!p.forTraining;
  if (cbPension)  cbPension.checked  = !!p.forPension;
  document.getElementById("dlg_hp")?.classList.remove("hidden");
}

export function closeHourPackDlg() {
  document.getElementById("dlg_hp")?.classList.add("hidden");
}

export function saveHourPack() {
  const name   = gv("hp_name").trim();
  const felder = Math.max(1, parseInt(gv("hp_fields"), 10) || 1);
  const preis  = Math.max(0, num(gv("hp_price")) || 0);
  const aktiv  = !!document.getElementById("hp_active")?.checked;
  const forTraining = cbv("hp_for_training");
  const forPension  = cbv("hp_for_pension");

  if (!name) {
    toast("Bitte einen Namen eingeben.");
    document.getElementById("hp_name")?.focus();
    return;
  }
  // Sicherheitsregel: Mindestens ein Bereich (standard: Hundepension)
  if (!forTraining && !forPension) {
    toast("Bitte mindestens einen Bereich auswählen (Hundepension oder Hundetraining).");
    document.getElementById("hp_for_pension")?.focus();
    return;
  }

  if (editId) {
    updatePack(editId, { name, felder, preis, aktiv, forTraining, forPension });
    toast("Stundenpaket aktualisiert.");
  } else {
    createPack({ name, felder, preis, aktiv, forTraining, forPension });
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

// Dialog-Buttons (einmal binden)
(function init() {
  const btnSave = document.getElementById("btn_hp_save");
  if (btnSave && !btnSave._bound) {
    btnSave._bound = true;
    btnSave.addEventListener("click", saveHourPack);
  }
  const btnClose = document.getElementById("btn_hp_close");
  if (btnClose && !btnClose._bound) {
    btnClose._bound = true;
    btnClose.addEventListener("click", closeHourPackDlg);
  }
})();

// Für manuelle Aufrufe
window.renderHourPacks = renderHourPacks;
window.openNewHourPack = openNewHourPack;
window.closeHourPackDlg = closeHourPackDlg;
window.saveHourPack = saveHourPack;