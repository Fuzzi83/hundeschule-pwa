// /js/components/admin/customers/openitems.js
"use strict";

import { saveAll, getCustomerById, visits, stays } from "../../core/storage.js";
import { getPurchases } from "./utils.js";
import { renderCustomerList } from "./list.js";
import { renderCustomerRevenue } from "./revenue.js";

/** Offene Posten (Visits/Stays/Karten) */
export function renderCustomerOpenInvoices(c) {
  const wrap = document.getElementById("c_openInvoices");
  if (!wrap) return;

  const openV = (visits ?? []).filter(
    v => v.customerId === c.id && v.method !== "ten" && v.payStatus !== "paid"
  );
  const openS = (stays ?? []).filter(
    s => s.customerId === c.id && s.method && s.payStatus !== "paid"
  );
  const openP = getPurchases(c).filter(p => p.payStatus !== "paid");

  if (openV.length === 0 && openS.length === 0 && openP.length === 0) {
    wrap.innerHTML = `<div class="muted">Keine offenen Posten.</div>`;
    return;
  }

  let html = `<table class="table">
    <tr><th>Typ</th><th>Datum</th><th>Betrag (€)</th><th>Aktionen</th></tr>`;

  openV.forEach(v => {
    html += `<tr>
      <td>Tag (${v.method === "cash" ? "Bar" : "Rech."})</td>
      <td>${v.date}</td>
      <td>${(v.charged ?? 0).toFixed(2)}</td>
      <td>
        <button class="btn" onclick="markVisitPaid('${v.id}')">bezahlt</button>
        <button class="btn ghost" onclick="editVisit('${v.id}')">Bearb.</button>
        <button class="btn warn" onclick="delVisit('${v.id}')">Löschen</button>
      </td>
    </tr>`;
  });

  openS.forEach(s => {
    const ci = (s.checkinAt ?? "").slice(0, 10);
    const co = (s.checkoutDate ?? "").slice(0, 10) || "—";
    html += `<tr>
      <td>Pension (${s.method === "cash" ? "Bar" : "Rech."})</td>
      <td>${ci} – ${co}</td>
      <td>${(s.price ?? 0).toFixed(2)}</td>
      <td>
        <button class="btn" onclick="markStayPaid('${s.id}')">bezahlt</button>
        <button class="btn ghost" onclick="editStay('${s.id}')">Bearb.</button>
        <button class="btn warn" onclick="delStay('${s.id}')">Löschen</button>
      </td>
    </tr>`;
  });

  openP.forEach(p => {
    html += `<tr>
      <td>Karte (${p.method === "cash" ? "Bar" : "Rech."})</td>
      <td>${(p.date ?? "").slice(0, 10)}</td>
      <td>${(p.price ?? 0).toFixed(2)}</td>
      <td>
        <button class="btn" onclick="markPurchasePaid('${c.id}','${p.id}')">bezahlt</button>
        <button class="btn ghost" onclick="editTen('${c.id}','${p.id}')">Bearb.</button>
      </td>
    </tr>`;
  });

  html += `</table>`;
  wrap.innerHTML = html;
}

/** Visits */
export function markVisitPaid(vid) {
  const v = (visits ?? []).find(x => x.id === vid);
  if (!v) return;
  v.payStatus = "paid";
  saveAll();

  const c = getCustomerById(v.customerId);
  if (c) {
    renderCustomerOpenInvoices(c);
    renderCustomerList();
    renderCustomerRevenue();
  }
  if (window.renderDayList) window.renderDayList();
  if (window.renderReports) window.renderReports();
}

export function editVisit(vid) {
  const v = (visits ?? []).find(x => x.id === vid);
  if (!v) return;

  const amt = prompt("Betrag (€):", String(v.charged ?? 0));
  if (amt === null) return;

  const status = prompt("Status (paid/open):", v.payStatus ?? "open");
  if (status === null) return;

  v.charged = parseFloat(amt) || v.charged;
  if (!v.method || v.method === "ten") v.method = "invoice";
  v.payStatus = status === "paid" ? "paid" : "open";

  saveAll();

  const c = getCustomerById(v.customerId);
  if (c) {
    renderCustomerOpenInvoices(c);
    renderCustomerList();
    renderCustomerRevenue();
  }
  if (window.renderReports) window.renderReports();
}

export function delVisit(vid) {
  const v = (visits ?? []).find(x => x.id === vid);
  if (!v) return;
  if (!confirm("Eintrag löschen?")) return;

  const cid = v.customerId;
  const idx = visits.findIndex(x => x.id === vid);
  if (idx >= 0) visits.splice(idx, 1);
  saveAll();

  const c = getCustomerById(cid);
  if (c) {
    renderCustomerOpenInvoices(c);
    renderCustomerList();
    renderCustomerRevenue();
  }
  if (window.renderReports) window.renderReports();
  if (window.renderDayList) window.renderDayList();
}

/** Stays */
export function markStayPaid(id) {
  const s = (stays ?? []).find(x => x.id === id);
  if (!s) return;
  s.payStatus = "paid";
  saveAll();

  const c = getCustomerById(s.customerId);
  if (c) {
    renderCustomerOpenInvoices(c);
    renderCustomerList();
    renderCustomerRevenue();
  }
  if (window.renderReports) window.renderReports();
}

export function editStay(id) {
  const s = (stays ?? []).find(x => x.id === id);
  if (!s) return;

  const amt = prompt("Betrag (€):", String(s.price ?? 0));
  if (amt === null) return;

  const status = prompt("Status (paid/open):", s.payStatus ?? "open");
  if (status === null) return;

  s.price = parseFloat(amt) || s.price;
  if (!s.method) s.method = "invoice";
  s.payStatus = status === "paid" ? "paid" : "open";

  saveAll();

  const c = getCustomerById(s.customerId);
  if (c) {
    renderCustomerOpenInvoices(c);
    renderCustomerList();
    renderCustomerRevenue();
  }
  if (window.renderReports) window.renderReports();
}

export function delStay(id) {
  const s = (stays ?? []).find(x => x.id === id);
  if (!s) return;
  if (!confirm("Eintrag löschen?")) return;

  const cid = s.customerId;
  const idx = stays.findIndex(x => x.id === id);
  if (idx >= 0) stays.splice(idx, 1);
  saveAll();

  const c = getCustomerById(cid);
  if (c) {
    renderCustomerOpenInvoices(c);
    renderCustomerList();
    renderCustomerRevenue();
  }
  if (window.renderReports) window.renderReports();
}