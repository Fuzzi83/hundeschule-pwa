// /js/components/admin/admin-trash.js
// Papierkorb – Render in #trashList (index.html) + Restore/Delete + Empty

import {
  customersTrash,
  visitsTrash,
  staysTrash,
  customers,
  visits,
  stays,
  saveAll
} from "../../core/storage.js";
import { esc, toast } from "../../core/utils.js";

function fmtDT(iso) {
  if (!iso) return "–";
  try { return new Date(iso).toLocaleString("de-DE"); } catch { return "–"; }
}

function getTrashContainer() {
  // ✅ korrekt laut index.html: trashList
  return (
    document.getElementById("trashList") ||
    // fallback für alte IDs
    document.getElementById("trash_customers") ||
    document.getElementById("trash_customers_list") ||
    null
  );
}

export function renderTrashPage() {
  const wrap = getTrashContainer();
  if (!wrap) {
    console.warn("[trash] Container nicht gefunden (erwartet: #trashList).");
    return;
  }

  const list = Array.isArray(customersTrash) ? customersTrash : [];

  if (list.length === 0) {
    wrap.innerHTML = `<div class="muted">Keine gelöschten Kunden.</div>`;
    return;
  }

  const rows = list
    .slice()
    .sort((a, b) => String(b.deletedAt || "").localeCompare(String(a.deletedAt || "")));

  wrap.innerHTML = `
    <table class="table">
      <tr>
        <th>Gelöscht am</th>
        <th>Kunde</th>
        <th>Aktionen</th>
      </tr>
      ${rows.map(c => `
        <tr>
          <td>${fmtDT(c.deletedAt)}</td>
          <td>${esc(c.name || "(ohne Name)")}</td>
          <td style="white-space:nowrap">
            <button class="btn" onclick="restoreCustomerFromTrash('${c.id}')">Wiederherstellen</button>
            <button class="btn outline" onclick="deleteCustomerPermanent('${c.id}')">Endgültig löschen</button>
          </td>
        </tr>
      `).join("")}
    </table>
  `;
}

export function restoreCustomerFromTrash(id) {
  const idx = customersTrash.findIndex(c => c.id === id);
  if (idx < 0) return;

  const c = customersTrash[idx];
  customersTrash.splice(idx, 1);
  customers.push(c);

  // zugehörige Einträge zurückholen
  const relV = (visitsTrash || []).filter(v => v.customerId === id);
  const relS = (staysTrash || []).filter(s => s.customerId === id);

  for (let i = visitsTrash.length - 1; i >= 0; i--) {
    if (visitsTrash[i].customerId === id) visitsTrash.splice(i, 1);
  }
  for (let i = staysTrash.length - 1; i >= 0; i--) {
    if (staysTrash[i].customerId === id) staysTrash.splice(i, 1);
  }

  visits.push(...relV);
  stays.push(...relS);

  saveAll();
  toast("Kunde wiederhergestellt.");

  renderTrashPage();
  window.renderCustomerList?.();
}

export function deleteCustomerPermanent(id) {
  if (!confirm("Endgültig löschen? Dies kann nicht rückgängig gemacht werden.")) return;

  for (let i = customersTrash.length - 1; i >= 0; i--) {
    if (customersTrash[i].id === id) customersTrash.splice(i, 1);
  }
  for (let i = visitsTrash.length - 1; i >= 0; i--) {
    if (visitsTrash[i].customerId === id) visitsTrash.splice(i, 1);
  }
  for (let i = staysTrash.length - 1; i >= 0; i--) {
    if (staysTrash[i].customerId === id) staysTrash.splice(i, 1);
  }

  saveAll();
  toast("Endgültig gelöscht.");
  renderTrashPage();
}

export function emptyTrash() {
  if (!confirm("Papierkorb wirklich leeren?")) return;

  customersTrash.splice(0, customersTrash.length);
  visitsTrash.splice(0, visitsTrash.length);
  staysTrash.splice(0, staysTrash.length);

  saveAll();
  toast("Papierkorb geleert.");
  renderTrashPage();
}

/* globals */
window.renderTrashPage = renderTrashPage;
window.restoreCustomerFromTrash = restoreCustomerFromTrash;
window.deleteCustomerPermanent = deleteCustomerPermanent;
window.emptyTrash = emptyTrash;