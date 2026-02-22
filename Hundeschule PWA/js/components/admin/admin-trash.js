// /js/components/admin/admin-trash.js
// Papierkorb – bereinigte Version (2026-02-16)

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

export function renderTrashPage() {
  const wrap = document.getElementById("trash_customers");
  if (!wrap) return;

  if (customersTrash.length === 0) {
    wrap.innerHTML = `<div class="muted">Keine gelöschten Kunden.</div>`;
    return;
  }

  let html = `
    <table class="table">
      <tr>
        <th>Gelöscht am</th>
        <th>Kunde</th>
        <th>Aktionen</th>
      </tr>
  `;

  customersTrash
    .slice()
    .reverse()
    .forEach((c) => {
      html += `
        <tr>
          <td>${c.deletedAt ? new Date(c.deletedAt).toLocaleString() : "–"}</td>
          <td>${esc(c.name || "")}</td>
          <td>
            <button class="btn" onclick="restoreCustomerFromTrash('${c.id}')">Wiederherstellen</button>
            <button class="btn outline" onclick="deleteCustomerPermanent('${c.id}')">Löschen</button>
          </td>
        </tr>
      `;
    });

  html += `</table>`;
  wrap.innerHTML = html;
}

export function restoreCustomerFromTrash(id) {
  const idx = customersTrash.findIndex((c) => c.id === id);
  if (idx < 0) return;

  const c = customersTrash[idx];
  customersTrash.splice(idx, 1);
  customers.push(c);

  const relV = visitsTrash.filter((v) => v.customerId === id);
  const relS = staysTrash.filter((s) => s.customerId === id);

  // aus den Trash-Listen herausnehmen
  for (let i = visitsTrash.length - 1; i >= 0; i--) {
    if (visitsTrash[i].customerId === id) visitsTrash.splice(i, 1);
  }
  for (let i = staysTrash.length - 1; i >= 0; i--) {
    if (staysTrash[i].customerId === id) staysTrash.splice(i, 1);
  }

  // zurück in aktive Listen
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

/* globale Exporte */
window.renderTrashPage = renderTrashPage;
window.restoreCustomerFromTrash = restoreCustomerFromTrash;
window.deleteCustomerPermanent = deleteCustomerPermanent;